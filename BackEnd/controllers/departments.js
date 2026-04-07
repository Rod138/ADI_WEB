import supabase from '../dbconfig.js';

const syncDepartmentStatuses = async () => {
    const [departmentsRes, usersRes] = await Promise.all([
        supabase.from('departments').select('id, is_in_use'),
        supabase.from('users').select('dep_id')
    ]);

    if (departmentsRes.error) throw departmentsRes.error;
    if (usersRes.error) throw usersRes.error;

    const userCountByDepartment = new Map();
    for (const user of usersRes.data ?? []) {
        if (user.dep_id === null || user.dep_id === undefined) continue;
        const departmentId = String(user.dep_id);
        userCountByDepartment.set(departmentId, (userCountByDepartment.get(departmentId) ?? 0) + 1);
    }

    const updates = [];
    for (const department of departmentsRes.data ?? []) {
        const hasUsers = (userCountByDepartment.get(String(department.id)) ?? 0) > 0;
        if (Boolean(department.is_in_use) !== hasUsers) {
            updates.push(
                supabase
                    .from('departments')
                    .update({ is_in_use: hasUsers })
                    .eq('id', department.id)
            );
        }
    }

    if (updates.length > 0) {
        const results = await Promise.all(updates);
        const firstError = results.find(result => result.error);
        if (firstError?.error) throw firstError.error;
    }
};

// GET /api/departments  — lista todos los departamentos
export const getDepartments = async (req, res) => {
    try {
        await syncDepartmentStatuses();

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
    if (!name || !email || !phone || !password || !rol_id || !dep_id) {
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
            name,
            ap: ap ? String(ap).trim() || null : null,
            am: am || null,
            email,
            phone,
            password,
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

// DELETE /api/users/:id  — borrar usuario (resetea datos y desasocia del departamento)
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('users').update({
            name: '-',
            ap: '-',
            am: null,
            email: '-',
            phone: '-',
            password: '-',
            dep_id: null
        }).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al borrar usuario' });
        return res.status(200).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// PATCH /api/departments/:id  — actualizar is_in_use
// Si is_in_use pasa a false, desasocia los usuarios del departamento
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

        // Si se pone en false, borrar usuarios del departamento
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
                    password: '-',
                    dep_id: null
                }).in('id', userIds);
            }
        }

        return res.status(200).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};
