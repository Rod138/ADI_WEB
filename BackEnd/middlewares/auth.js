/**
 * TESINA: Middleware de autenticacion y autorizacion por rol.
 * Responsabilidad: validar sesion activa e impedir acceso no autorizado.
 * Uso: se aplica en rutas sensibles para proteger datos y operaciones.
 */

import supabase from '../dbconfig.js';
import { verifyAccessToken } from '../utils/validation.js';

const SESSION_USER_ID_HEADER = 'x-session-user-id';

// Convierte un valor de entrada en ID de sesion valido o null.
const parseSessionUserId = (rawValue) => {
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

const respondUnauthorized = (req, res) => {
    const isApi = String(req.originalUrl || '').startsWith('/api');
    if (isApi) {
        return res.status(401).json({
            success: false,
            message: 'Sesion invalida. Inicia sesion nuevamente.'
        });
    }
    return res.redirect('/session-invalid');
};

const respondForbidden = (req, res) => {
    const isApi = String(req.originalUrl || '').startsWith('/api');
    if (isApi) {
        return res.status(403).json({
            success: false,
            message: 'No tienes permisos para realizar esta accion.'
        });
    }
    return res.status(403).render('unauthorized');
};

// Carga y cachea en request el usuario de sesion para evitar consultas duplicadas.
const loadSessionUser = async (req) => {
    if (req.sessionUser !== undefined) {
        return req.sessionUser;
    }

    let userId = null;

    // PRIORIDAD 1: Intentar obtener JWT del header Authorization
    const authHeader = req.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7); // Quita "Bearer "
        const decoded = await verifyAccessToken(token);
        if (decoded && decoded.userId) {
            userId = decoded.userId;
        }
    }

    // PRIORIDAD 2: Fallback a cookie (para compatibilidad con sesiones antiguas)
    if (!userId) {
        userId = parseSessionUserId(req.cookies?.session_user_id);
    }

    // PRIORIDAD 3: Fallback a header antiguo (para transición)
    if (!userId) {
        userId = parseSessionUserId(req.get(SESSION_USER_ID_HEADER));
    }

    if (!userId) {
        req.sessionUser = null;
        return null;
    }

    const { data, error } = await supabase
        .from('users')
        .select('id, rol_id, name, dep_id, email')
        .eq('id', userId)
        .single();

    if (error || !data || Number(data.rol_id) <= 0 || data.name === '-') {
        req.sessionUser = null;
        return null;
    }

    req.sessionUser = {
        id: Number(data.id),
        rol_id: Number(data.rol_id),
        dep_id: data.dep_id,
        name: data.name,
        email: data.email
    };

    return req.sessionUser;
};

// Inyecta el usuario autenticado en res.locals para que todas las vistas lo reciban.
export const injectSessionUser = async (req, res, next) => {
    try {
        const sessionUser = await loadSessionUser(req);
        res.locals.user = sessionUser;
        return next();
    } catch (error) {
        res.locals.user = null;
        return next();
    }
};

// Fabrica middleware que exige un rol minimo para ejecutar una ruta.
export const requireMinRole = (minRole) => {
    return async (req, res, next) => {
        try {
            const sessionUser = await loadSessionUser(req);

            if (!sessionUser) {
                return respondUnauthorized(req, res);
            }

            if (sessionUser.rol_id < minRole) {
                return respondForbidden(req, res);
            }

            return next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo validar la sesion del usuario.'
            });
        }
    };
};

// Permite acceso al propio recurso o a roles administrativos superiores.
export const requireSelfOrMinRole = (minRole, paramName = 'id') => {
    return async (req, res, next) => {
        try {
            const sessionUser = await loadSessionUser(req);

            if (!sessionUser) {
                return respondUnauthorized(req, res);
            }

            const targetId = parseSessionUserId(req.params?.[paramName]);
            if (targetId && targetId === sessionUser.id) {
                return next();
            }

            if (sessionUser.rol_id < minRole) {
                return respondForbidden(req, res);
            }

            return next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo validar la sesion del usuario.'
            });
        }
    };
};
