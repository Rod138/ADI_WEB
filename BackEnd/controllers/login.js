/**
 * TESINA: Controlador de inicio de sesion y recuperacion de acceso.
 * Responsabilidad: autenticar usuario y enviar correo de recuperacion.
 * Integracion: usa Supabase y cliente Gmail OAuth cuando esta configurado.
 */

import supabase from '../dbconfig.js'
import { sanitizeEmail, validatePassword } from '../utils/validation.js';

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
            // Establecer cookie con el ID del usuario
            res.cookie('session_user_id', String(user.id), {
                httpOnly: true,
                secure: false, // Cambiar a true en producción con HTTPS
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });

            return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso',
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
