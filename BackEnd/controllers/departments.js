/**
 * TESINA: Controlador de departamentos y administracion de usuarios.
 * Responsabilidad: altas, ediciones y sincronizacion de estado de ocupacion.
 * Regla clave: la disponibilidad del departamento depende de usuarios asociados.
 */

import supabase from '../dbconfig.js';
import { hashPassword } from '../utils/validation.js';

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const isDuplicateEmail = async (email, excludeId = null) => {
    let query = supabase
        .from('users')
        .select('id')
        .eq('email', email);

    if (excludeId !== null && excludeId !== undefined) {
        query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
};

// Sincroniza el indicador is_in_use en departamentos con base en la ocupacion real.
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
// Entrega catalogo de roles para formularios de administracion.
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
// Inserta un usuario con ID incremental y datos normalizados.
export const createUser = async (req, res) => {
    const { name, email, phone, password, rol_id, dep_id, ap } = req.body;

    // Validar campos requeridos
    if (!name) {
        return res.status(400).json({ success: false, message: 'Nombre requerido' });
    }
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email requerido' });
    }
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Teléfono requerido' });
    }
    if (!password) {
        return res.status(400).json({ success: false, message: 'Contraseña requerida' });
    }
    if (!rol_id) {
        return res.status(400).json({ success: false, message: 'Rol requerido' });
    }
    if (!dep_id) {
        return res.status(400).json({ success: false, message: 'Departamento requerido' });
    }

    // Validar nombre: 3-30 caracteres, solo letras y espacios
    const nameRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/;
    if (!nameRegex.test(String(name).trim())) {
        return res.status(400).json({
            success: false,
            message: 'Nombre: solo letras y espacios, entre 3 y 30 caracteres'
        });
    }

    // Normalizar y validar apellido paterno si se proporciona (solo apellido paterno)
    let apPaternal = null;
    if (ap && String(ap).trim()) {
        apPaternal = String(ap).trim().split(/\s+/)[0];
        const apRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ]{1,30}$/;
        if (!apRegex.test(apPaternal)) {
            return res.status(400).json({
                success: false,
                message: 'Apellido paterno: solo letras, sin espacios, máximo 30 caracteres'
            });
        }
    }

    // Validar email: 6-320 caracteres, formato válido
    const emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/i;
    const emailTrimmed = normalizeEmail(email);
    if (emailTrimmed.length < 6 || emailTrimmed.length > 320) {
        return res.status(400).json({
            success: false,
            message: 'Email: debe tener entre 6 y 320 caracteres'
        });
    }
    if (!emailRegex.test(emailTrimmed)) {
        return res.status(400).json({
            success: false,
            message: 'Email: formato válido requerido'
        });
    }

    try {
        if (await isDuplicateEmail(emailTrimmed)) {
            return res.status(409).json({
                success: false,
                message: 'Ese email ya está registrado en la base de datos'
            });
        }
    } catch {
        return res.status(500).json({ success: false, message: 'Error al validar email' });
    }

    // Validar teléfono: exactamente 10 dígitos
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(String(phone).trim())) {
        return res.status(400).json({
            success: false,
            message: 'Teléfono: debe contener exactamente 10 dígitos numéricos'
        });
    }

    // Validar contraseña: 8-16 caracteres, al menos 1 número o letra
    const passwordStr = String(password);
    if (!passwordStr || passwordStr === '') {
        return res.status(400).json({
            success: false,
            message: 'Contraseña requerida'
        });
    }
    if (passwordStr.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Contraseña muy corta: mínimo 8 caracteres'
        });
    }
    if (passwordStr.length > 16) {
        return res.status(400).json({
            success: false,
            message: 'Contraseña muy larga: máximo 16 caracteres'
        });
    }
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(passwordStr);
    if (!hasAlphanumeric) {
        return res.status(400).json({
            success: false,
            message: 'Contraseña debe contener al menos una letra o un número'
        });
    }
    const passwordRegex = /^[a-zA-Z0-9@$!%+*?&"-]+$/;
    if (!passwordRegex.test(passwordStr)) {
        return res.status(400).json({
            success: false,
            message: 'Contraseña contiene caracteres no permitidos. Permitidos: letras, números y @$!%+*?&-"'
        });
    }

    try {
        const { data: maxRow } = await supabase
            .from('users')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        const newId = (maxRow?.id ?? 0) + 1;

        const hashedPassword = await hashPassword(passwordStr);

        const { error } = await supabase.from('users').insert({
            id: newId,
            name: String(name).trim(),
            email: emailTrimmed,
            phone: String(phone).trim(),
            password: hashedPassword,
            rol_id: parseInt(rol_id, 10),
            dep_id: parseInt(dep_id, 10),
            ap: apPaternal
        });
        if (error) return res.status(500).json({ success: false, message: error.message ?? 'Error al crear usuario' });
        return res.status(201).json({ success: true });
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// GET /api/users?dep_id=X  — usuarios de un departamento (id, name, ap)
// Lista usuarios activos y omite registros marcados como eliminados logicos.
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
// Obtiene un usuario puntual junto con su departamento y roles disponibles.
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
// Aplica actualización parcial permitiendo limpiar campos opcionales con null.
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const allowed = ['name', 'email', 'phone', 'password', 'rol_id', 'dep_id', 'ap'];
    const updates = {};

    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field] === '' ? null : req.body[field];
        }
    }

    if (Object.keys(updates).length === 0)
        return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });

    // Validar campos si se están actualizando
    if (updates.name) {
        const nameRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/;
        if (!nameRegex.test(String(updates.name).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Nombre: solo letras y espacios, entre 3 y 30 caracteres'
            });
        }
    }

    if (updates.ap && updates.ap !== null) {
        // Normalizar a solo apellido paterno (primer token sin espacios)
        const apPaternal = String(updates.ap).trim().split(/\s+/)[0];
        const apRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ]{1,30}$/;
        if (!apRegex.test(apPaternal)) {
            return res.status(400).json({
                success: false,
                message: 'Apellido paterno: solo letras, sin espacios, máximo 30 caracteres'
            });
        }

        updates.ap = apPaternal;
    }

    if (updates.email) {
        const emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/i;
        const emailTrimmed = normalizeEmail(updates.email);
        if (emailTrimmed.length < 6 || emailTrimmed.length > 320) {
            return res.status(400).json({
                success: false,
                message: 'Email: debe tener entre 6 y 320 caracteres'
            });
        }
        if (!emailRegex.test(emailTrimmed)) {
            return res.status(400).json({
                success: false,
                message: 'Email: formato válido requerido'
            });
        }

        try {
            if (await isDuplicateEmail(emailTrimmed, id)) {
                return res.status(409).json({
                    success: false,
                    message: 'Ese email ya está registrado en la base de datos'
                });
            }
        } catch {
            return res.status(500).json({ success: false, message: 'Error al validar email' });
        }

        updates.email = emailTrimmed;
    }

    if (updates.phone) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(String(updates.phone).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Teléfono: debe contener exactamente 10 dígitos numéricos'
            });
        }
    }

    if (updates.password) {
        const passwordStr = String(updates.password);
        if (passwordStr.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña muy corta: mínimo 8 caracteres'
            });
        }
        if (passwordStr.length > 16) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña muy larga: máximo 16 caracteres'
            });
        }
        const hasAlphanumeric = /[a-zA-Z0-9]/.test(passwordStr);
        if (!hasAlphanumeric) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña debe contener al menos una letra o un número'
            });
        }
        const passwordRegex = /^[a-zA-Z0-9@$!%+*?&"-]+$/;
        if (!passwordRegex.test(passwordStr)) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña contiene caracteres no permitidos. Permitidos: letras, números y @$!%+*?&-"'
            });
        }
    }

    try {
        // Si se está actualizando la contraseña, aplicamos hash antes de guardar
        if (updates.password !== undefined && updates.password !== null) {
            const pwd = String(updates.password);
            updates.password = await hashPassword(pwd);
        }

        const { error } = await supabase.from('users').update(updates).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error('Error en updateUser:', e && e.message ? e.message : e);
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

// DELETE /api/users/:id  — borrar usuario (resetea datos y desasocia del departamento)
// Ejecuta borrado logico para conservar trazabilidad historica en BD.
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('users').update({
            name: '-',
            ap: '-',
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
// Mantiene consistencia entre ocupacion del departamento y asignaciones de usuarios.
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
