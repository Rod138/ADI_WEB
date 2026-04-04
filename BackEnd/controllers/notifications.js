import supabase from '../dbconfig.js';

export const getNotifications = async (req, res) => {
    const usrId = parseInt(req.query.usr_id, 10);

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

        const areaRes = await supabase
            .from('areas')
            .select('*');

        let notiRes = await supabase
            .from('notifications')
            .select('*')
            .eq('usr_id', usrId)
            .order('created_at', { ascending: false });

        // Compatibilidad si el campo del usuario se llama user_id en la BD.
        if (notiRes.error) {
            notiRes = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', usrId)
                .order('created_at', { ascending: false });
        }

        if (notiRes.error || typeRes.error || areaRes.error) {
            return res.status(500).json({
                success: false,
                message: notiRes.error?.message || typeRes.error?.message || areaRes.error?.message || 'Error al obtener notificaciones'
            });
        }

        const areasMap = Object.fromEntries((areaRes.data || []).map(a => [
            a.id,
            a.name ?? a.area ?? String(a.id)
        ]));

        const normalizedNotifications = (notiRes.data || []).map(n => ({
            area_id: n.area_id ?? n.inc_area_id ?? n.area ?? null,
            area_name: areasMap[n.area_id ?? n.inc_area_id ?? n.area] ?? null,
            id: n.id,
            title: n.title ?? n.name ?? 'Sin titulo',
            description: n.description ?? n.content ?? '',
            type_id: n.type_id ?? n.notification_type_id ?? n.type ?? null,
            usr_id: n.usr_id ?? n.user_id ?? usrId,
            created_at: n.created_at ?? n.createdAt ?? null,
            read: Boolean(n.read ?? n.is_read ?? false)
        }));

        return res.status(200).json({
            success: true,
            notifications: normalizedNotifications,
            types: typeRes.data || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
    }
};

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
