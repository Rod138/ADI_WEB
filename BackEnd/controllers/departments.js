import supabase from '../dbconfig.js';

// GET /api/departments  — lista todos los departamentos
export const getDepartments = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('departments')
            .select('id, name, is_in_use')
            .order('name', { ascending: true });

        if (error) return res.status(500).json({ success: false, message: 'Error al obtener departamentos' });
        return res.status(200).json({ success: true, departments: data });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// GET /api/roles
export const getRoles = async (req, res) => {
    try {
        const { data, error } = await supabase.from('roles').select('*').order('id', { ascending: true });
        if (error) return res.status(500).json({ success: false, message: 'Error al obtener roles' });
        return res.status(200).json({ success: true, roles: data });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// POST /api/users  — crear nuevo usuario
export const createUser = async (req, res) => {
    const { name, ap, am, email, phone, password, rol_id, dep_id } = req.body;
    if (!name || !ap || !email || !phone || !password || !rol_id || !dep_id) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }
    try {
        const { data: maxRow } = await supabase
            .from('users')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        const newId = (maxRow?.id ?? 0) + 1;

        const { error } = await supabase.from('users').insert({
            id: newId,
            name, ap, am: am || null, email, phone, password,
            rol_id: parseInt(rol_id, 10),
            dep_id: parseInt(dep_id, 10)
        });
        if (error) return res.status(500).json({ success: false, message: error.message ?? 'Error al crear usuario' });
        return res.status(201).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// GET /api/users?dep_id=X  — usuarios de un departamento (id, name, ap)
export const getUsers = async (req, res) => {
    const { dep_id } = req.query;
    try {
        let query = supabase.from('users').select('id, name, ap').order('name', { ascending: true });
        if (dep_id) query = query.eq('dep_id', parseInt(dep_id, 10));

        const { data, error } = await query;
        if (error) return res.status(500).json({ success: false, message: 'Error al obtener usuarios' });

        const filtered = (data ?? []).filter(u => u.name !== '-');
        return res.status(200).json({ success: true, users: filtered });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// GET /api/users/:id  — usuario completo + su departamento
export const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const [userRes, rolesRes] = await Promise.all([
            supabase.from('users').select('*').eq('id', id).single(),
            supabase.from('roles').select('*').order('id', { ascending: true })
        ]);

        if (userRes.error) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        if (rolesRes.error) return res.status(500).json({ success: false, message: 'Error al obtener roles' });

        let department = null;
        if (userRes.data.dep_id) {
            const { data: dep, error: depError } = await supabase
                .from('departments')
                .select('id, name, is_in_use')
                .eq('id', userRes.data.dep_id)
                .single();
            if (!depError) department = dep;
        }

        return res.status(200).json({
            success: true,
            user: userRes.data,
            roles: rolesRes.data,
            department
        });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// PATCH /api/users/:id  — actualizar datos del usuario
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const allowed = ['name', 'ap', 'am', 'email', 'phone', 'password', 'rol_id', 'dep_id'];
    const updates = {};

    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field] === '' ? null : req.body[field];
        }
    }

    if (Object.keys(updates).length === 0)
        return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });

    try {
        const { error } = await supabase.from('users').update(updates).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
        return res.status(200).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// PATCH /api/departments/:id  — actualizar is_in_use
// Si is_in_use pasa a false, resetea los datos del usuario asignado
export const updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { is_in_use } = req.body;

    if (typeof is_in_use !== 'boolean')
        return res.status(400).json({ success: false, message: 'is_in_use debe ser booleano' });

    try {
        const { error: depError } = await supabase
            .from('departments')
            .update({ is_in_use })
            .eq('id', id);

        if (depError) return res.status(500).json({ success: false, message: 'Error al actualizar departamento' });

        // Si se pone en false, limpiar datos del usuario asignado a ese depa
        if (!is_in_use) {
            const { data: users } = await supabase
                .from('users')
                .select('id')
                .eq('dep_id', id);

            if (users && users.length > 0) {
                const userIds = users.map(u => u.id);
                await supabase.from('users').update({
                    name: '-',
                    ap: '-',
                    am: null,
                    email: '-',
                    phone: '-',
                    password: '-'
                }).in('id', userIds);
            }
        }

        return res.status(200).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};
