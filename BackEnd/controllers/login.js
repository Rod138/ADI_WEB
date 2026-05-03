/**
 * TESINA: Controlador de inicio de sesion y recuperacion de acceso.
 * Responsabilidad: autenticar usuario y enviar correo de recuperacion.
 * Integracion: usa Supabase y cliente Gmail OAuth cuando esta configurado.
 */

import supabase from '../dbconfig.js'
import { sanitizeEmail, validatePassword, generateAccessToken, generateRefreshToken, saveRefreshTokenToDB } from '../utils/validation.js';

// Interpreta duraciones simples como 15m, 7d, 3600s para calcular expiración en BD.
const parseDurationToMs = (rawValue, fallbackMs) => {
    if (!rawValue || typeof rawValue !== 'string') return fallbackMs;
    const match = rawValue.trim().match(/^(\d+)\s*([smhd])$/i);
    if (!match) return fallbackMs;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return amount * (multipliers[unit] || 1);
}

// Construye cliente OAuth para Gmail API cuando existen credenciales de entorno.
const buildGmailClient = async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
        return null
    }

    const { google } = await import('googleapis')
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    return { google, oauth2Client }
}

// Genera payload RFC822 codificado en base64url para envio via Gmail API.
const buildEmailMessage = (from, to, subject, text, html) => {
    const message = [
        `From: ${from}`,
        `To: ${to}`,
        'Content-Type: text/html; charset="UTF-8"',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        html || text
    ].join('\n')

    return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
}

// Valida credenciales y abre sesion devolviendo datos minimos del usuario.
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar que se reciban los datos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Correo y contraseña requeridos'
            });
        }

        // Validar formato de email
        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        // Validar contraseña no esté vacía
        if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña inválida'
            });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', sanitizedEmail)
            .eq('password', password)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales no válidas'
            });
        }

        if (user.rol_id > 0) {
            // Obtener nombre del rol para incluirlo en el JWT
            let roleName = null;
            try {
                const { data: roleData, error: roleError } = await supabase.from('roles').select('name').eq('id', user.rol_id).single();
                if (!roleError && roleData) roleName = roleData.name;
            } catch (e) {
                // no bloquear inicio de sesión por error al obtener nombre del rol
            }

            // Generar JWT tokens (access token incluye rol)
            const accessToken = await generateAccessToken(user.id, user.rol_id, roleName);
            const refreshToken = await generateRefreshToken(user.id);

            // Calcular fecha de expiración del refresh token según configuración.
            const refreshExpiryMs = parseDurationToMs(process.env.JWT_REFRESH_EXPIRY, 7 * 24 * 60 * 60 * 1000);
            const expiresAt = new Date(Date.now() + refreshExpiryMs);

            // Guardar refresh token en BD para permitir revocación
            const saved = await saveRefreshTokenToDB(supabase, user.id, refreshToken, expiresAt);
            if (!saved) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al crear la sesión'
                });
            }

            // Cookie de sesión para rutas renderizadas del servidor (ej. /main).
            res.cookie('session_user_id', String(user.id), {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3 * 24 * 60 * 60 * 1000
            });

            return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso',
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    dep_id: user.dep_id,
                    rol_id: user.rol_id,
                    name: user.name
                }
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Credenciales no válidas'
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
}

// Atiende recuperacion de acceso y envia la clave actual al correo registrado.
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Correo requerido'
            });
        }

        // Validar formato de email
        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, password')
            .eq('email', sanitizedEmail)
            .maybeSingle();

        if (userError) {
            console.error('Error consultando usuario en forgotPassword:', userError)
            return res.status(500).json({
                success: false,
                message: 'No se pudo consultar la base de datos'
            });
        }

        // Respuesta neutra para no exponer si el correo existe o no.
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'Si el correo existe, recibirás tu contraseña en el correo'
            });
        }

        const gmailConfig = await buildGmailClient()
        const senderEmail = process.env.GMAIL_SENDER

        if (!gmailConfig || !senderEmail) {
            console.error('Gmail API no configurada. Verifica GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN y GMAIL_SENDER')
            return res.status(500).json({
                success: false,
                message: 'El servicio de correo no está configurado'
            })
        }

        try {
            const gmail = gmailConfig.google.gmail({ version: 'v1', auth: gmailConfig.oauth2Client })
            const rawMessage = buildEmailMessage(
                senderEmail,
                user.email,
                'ADI - Recuperación de contraseña',
                `Hola ${user.name || ''},\n\nTu contraseña actual es: ${user.password}\n\nADI`,
                `<p>Hola ${user.name || ''},</p><p>Tu contraseña actual es: <b>${user.password}</b></p><p>ADI</p>`
            )

            const sendResult = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: rawMessage
                }
            })

            console.log('Gmail API send result:', sendResult.data)
        } catch (mailError) {
            console.error('Error enviando correo en forgotPassword:', mailError)
            const providerMessage = mailError?.message || mailError?.response?.data?.error?.message || ''
            return res.status(500).json({
                success: false,
                message: providerMessage || 'No se pudo enviar el correo de recuperación'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Se envió tu contraseña al correo registrado'
        });
    } catch (error) {
        console.error('Error no controlado en forgotPassword:', error)
        return res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
}
