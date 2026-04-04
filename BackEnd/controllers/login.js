import supabase from '../dbconfig.js'
const buildMailerTransport = async () => {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
        return null
    }

    const { default: nodemailer } = await import('nodemailer')

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    })
}

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

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales no válidas'
            });
        }

        if (user.rol_id > 0) {
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

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Correo requerido'
            });
        }

        const { data: user } = await supabase
            .from('users')
            .select('id, name, email, password')
            .eq('email', email)
            .maybeSingle();

        // Respuesta neutra para no exponer si el correo existe o no.
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'Si el correo existe, recibirás tu contraseña en el correo'
            });
        }

        const transporter = await buildMailerTransport()
        if (!transporter) {
            return res.status(500).json({
                success: false,
                message: 'El servicio de correo no está configurado'
            })
        }

        try {
            await transporter.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to: user.email,
                subject: 'ADI - Recuperación de contraseña',
                text: `Hola ${user.name || ''},\n\nTu contraseña actual es: ${user.password}\n\nADI`,
                html: `<p>Hola ${user.name || ''},</p><p>Tu contraseña actual es: <b>${user.password}</b></p><p>ADI</p>`
            })
        } catch (mailError) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo enviar el correo de recuperación'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Se envió tu contraseña al correo registrado'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
}
