/**
 * TESINA: Controlador de notificaciones de usuario.
 * Responsabilidad: listar, filtrar y eliminar notificaciones por usuario.
 * Detalle: soporta variantes de nombre de tabla para compatibilidad.
 */

import supabase from '../dbconfig.js';

// Lista notificaciones del usuario con filtros opcionales de tipo y orden temporal.
export const getNotifications = async (req, res) => {
    const usrId = parseInt(req.query.usr_id, 10);
    const typeId = parseInt(req.query.type_id, 10);
    const hasTypeFilter = !isNaN(typeId);
    const order = String(req.query.order || 'desc').toLowerCase();
    const isAscending = order === 'asc';

    if (isNaN(usrId)) {
        return res.status(400).json({ success: false, message: 'usr_id inválido' });
    }

    try {
        let typeRes = await supabase
            .from('notifications_type')
            .select('id, name')
            .order('id', { ascending: true });

        // Compatibilidad si la tabla se llama notification_type.
        if (typeRes.error) {
            typeRes = await supabase
                .from('notification_type')
                .select('id, name')
                .order('id', { ascending: true });
        }

        // Compatibilidad si la tabla se llama notification_types (plural).
        if (typeRes.error) {
            typeRes = await supabase
                .from('notification_types')
                .select('id, name')
                .order('id', { ascending: true });
        }

        // Ejecuta consulta tolerante a variaciones de nombres de columnas.
        const queryNotifications = async (userField, typeField) => {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq(userField, usrId)
                .order('created_at', { ascending: isAscending });

            if (hasTypeFilter) {
                query = query.eq(typeField, typeId);
            }

            return query;
        };

        let notiRes = await queryNotifications('usr_id', 'type_id');

        // Compatibilidad si cambian los campos de usuario/tipo en la BD.
        if (notiRes.error) {
            notiRes = await queryNotifications('user_id', 'type_id');
        }

        if (notiRes.error) {
            notiRes = await queryNotifications('usr_id', 'notification_type_id');
        }

        if (notiRes.error) {
            notiRes = await queryNotifications('user_id', 'notification_type_id');
        }

        if (notiRes.error || typeRes.error) {
            return res.status(500).json({
                success: false,
                message: notiRes.error?.message || typeRes.error?.message || 'Error al obtener notificaciones'
            });
        }

        // Mapeo de tipos de notificación a etiquetas en español (con acentos).
        const translateType = (key) => {
            if (!key) return 'Otro';
            const map = {
                'incident_status_change': 'Cambio en el estado de la incidencia',
                'quota_published': 'Cuota mensual publicada',
                'quota_rejected': 'Cuota mensual rechazada',
                'quota_validated': 'Cuota mensual aprobada',
                'new_expense': 'Nuevo gasto',
                'new_incident': 'Nueva incidencia',
                'new_receipt': 'Nuevo recibo de pago de cuota mensual'
            };

            if (map[key]) return map[key];

            // Fallback: convertir snake_case a título (sin acentos).
            return String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        };

        const typesList = (typeRes.data || []).map(t => ({
            ...t,
            label: translateType(t.name ?? t.type ?? t.key)
        }));

        const normalizedNotifications = (notiRes.data || []).map(n => {
            const typeKey = n.type ?? n.name ?? null;
            const resolvedTypeId = n.type_id ?? n.notification_type_id ?? null;
            // Intenta obtener la etiqueta desde la lista de tipos por id, si existe.
            let typeLabel = null;
            if (resolvedTypeId && typesList.length) {
                const found = typesList.find(tt => Number(tt.id) === Number(resolvedTypeId));
                if (found) typeLabel = found.label;
            }

            // Si no se obtuvo por id, intenta traducir por key.
            if (!typeLabel) {
                typeLabel = translateType(typeKey || (n.type_name ?? n.name ?? null));
            }

            return {
                id: n.id,
                title: n.title ?? n.name ?? 'Sin titulo',
                description: n.description ?? n.content ?? '',
                type_id: resolvedTypeId,
                type_label: typeLabel,
                usr_id: n.usr_id ?? n.user_id ?? usrId,
                created_at: n.created_at ?? n.createdAt ?? null,
                read: Boolean(n.read ?? n.is_read ?? false)
            };
        });

        return res.status(200).json({
            success: true,
            notifications: normalizedNotifications,
            types: typesList
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
    }
};

// Elimina una notificacion validando pertenencia por usuario autenticado.
export const deleteNotification = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const usrId = parseInt(req.body.usr_id, 10);

    if (isNaN(id) || isNaN(usrId)) {
        return res.status(400).json({ success: false, message: 'Parámetros inválidos' });
    }

    try {
        let deleteRes = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('usr_id', usrId)
            .select('id');

        // Compatibilidad si el campo del usuario se llama user_id.
        if (deleteRes.error) {
            deleteRes = await supabase
                .from('notifications')
                .delete()
                .eq('id', id)
                .eq('user_id', usrId)
                .select('id');
        }

        const { data, error } = deleteRes;

        if (error) {
            return res.status(500).json({ success: false, message: error.message || 'Error al borrar notificación' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
    }
};

// Elimina todas las notificaciones del usuario autenticado.
export const deleteAllNotifications = async (req, res) => {
    const usrId = parseInt(req.body.usr_id, 10);

    if (isNaN(usrId)) {
        return res.status(400).json({ success: false, message: 'Usuario inválido' });
    }

    try {
        let deleteRes = await supabase
            .from('notifications')
            .delete()
            .eq('usr_id', usrId)
            .select('id');

        // Compatibilidad si el campo del usuario se llama user_id.
        if (deleteRes.error) {
            deleteRes = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', usrId)
                .select('id');
        }

        const { data, error } = deleteRes;

        if (error) {
            return res.status(500).json({ success: false, message: error.message || 'Error al borrar notificaciones' });
        }

        return res.status(200).json({
            success: true,
            message: `Se eliminaron ${data?.length || 0} notificaciones`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
    }
};

// Marca una notificación como leída (read = true). Compatibilidad con campos usr_id/user_id.
export const markNotificationRead = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const usrId = parseInt(req.body.usr_id, 10);

    if (isNaN(id) || isNaN(usrId)) {
        return res.status(400).json({ success: false, message: 'Parámetros inválidos' });
    }

    try {
        let updateRes = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .eq('usr_id', usrId)
            .select('id, read');

        // Compatibilidad si el campo del usuario se llama user_id.
        if (updateRes.error) {
            updateRes = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id)
                .eq('user_id', usrId)
                .select('id, read');
        }

        const { data, error } = updateRes;

        if (error) {
            return res.status(500).json({ success: false, message: error.message || 'Error al marcar como leído' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
    }
};
