import supabase from '../dbconfig.js'
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
