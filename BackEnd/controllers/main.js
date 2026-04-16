/**
 * TESINA: Controlador para construir el menu principal segun el rol.
 * Responsabilidad: resolver identidad, permisos y opciones de navegacion.
 * Objetivo: personalizar interfaz y acciones para cada tipo de usuario.
 */

import supabase from '../dbconfig.js';

const ROLES = Object.freeze({
    RESIDENTE: 1,
    TESORERO: 2,
    ADMINISTRADOR: 3,
    TESORERO_ADMIN: 4
});

// Traduce el id de rol a una etiqueta legible para interfaz.
const getRoleLabel = (roleId) => {
    const role = Number(roleId);
    switch (role) {
        case ROLES.RESIDENTE: return 'Residente';
        case ROLES.TESORERO: return 'Tesorero';
        case ROLES.ADMINISTRADOR: return 'Administrador';
        case ROLES.TESORERO_ADMIN: return 'Tesorero y Admin';
        default: return 'Usuario';
    }
};

// Normaliza el identificador de sesion y descarta valores invalidos.
const parseSessionUserId = (rawValue) => {
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

// Resuelve el usuario autenticado desde cookie o header para renderizado del menu.
const loadSessionUser = async (req) => {
    // Primero intenta obtener el ID de la cookie
    let userId = parseSessionUserId(req.cookies?.session_user_id);

    // Si no hay cookie, intenta obtenerlo del header
    if (!userId) {
        userId = parseSessionUserId(req.get('x-session-user-id'));
    }

    if (!userId) {
        return null;
    }

    const { data, error } = await supabase
        .from('users')
        .select('id, rol_id, name, dep_id, email')
        .eq('id', userId)
        .single();

    if (error || !data || Number(data.rol_id) <= 0 || data.name === '-') {
        return null;
    }

    return {
        id: Number(data.id),
        rol_id: Number(data.rol_id),
        dep_id: data.dep_id,
        name: data.name,
        email: data.email,
        roleLabel: getRoleLabel(Number(data.rol_id))
    };
};

// Renderiza el menu principal filtrando modulos segun permisos por rol.
export const getMainMenu = async (req, res) => {
    try {
        const sessionUser = await loadSessionUser(req);

        if (!sessionUser) {
            return res.redirect('/login');
        }

        const userRole = Number(sessionUser.rol_id);

        const menuItems = [
            {
                id: 'incidents',
                title: 'ADMINISTRACIÓN DE INCIDENCIAS',
                href: '/incident-board',
                visible: true,
                button_class: 'button-2'
            },
            {
                id: 'departments',
                title: 'ADMINISTRACIÓN DE DEPARTAMENTOS',
                href: '/departments',
                visible: true,
                button_class: 'button-1'
            },
            {
                id: 'reports',
                title: 'REPORTES',
                href: '/reports',
                visible: true,
                button_class: 'button-3'
            },
            {
                id: 'accounting',
                title: 'CONTABILIDAD',
                href: '/accounting',
                visible: userRole >= ROLES.TESORERO,
                button_class: 'button-4'
            }
        ];

        return res.render('main', {
            user: sessionUser,
            menuItems: menuItems.filter(item => item.visible)
        });
    } catch (error) {
        console.error('[Main] Error:', error);
        return res.redirect('/login');
    }
};
