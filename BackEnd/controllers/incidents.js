import supabase from "../dbconfig.js";
export const getIncidents = async (req, res) => {
    try {
        const [incRes, statusRes, areaRes, typeRes] = await Promise.all([
            supabase.from('incidents').select('*'),
            supabase.from('inc_status').select('*'),
            supabase.from('areas').select('*'),
            supabase.from('inc_types').select('*')
        ]);

        if (incRes.error || statusRes.error || areaRes.error || typeRes.error) {
            return res.status(500).json({
                success: false,
                message: 'Error al obtener los datos'
            });
        }

        return res.status(200).json({
            success: true,
            incidents: incRes.data,
            statuses: statusRes.data,
            areas: areaRes.data,
            types: typeRes.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
}

export const getIncidentById = async (req, res) => {
    const { id } = req.params;
    try {
        const [incRes, statusRes, areaRes, typeRes] = await Promise.all([
            supabase.from('incidents').select('*').eq('id', id).single(),
            supabase.from('inc_status').select('*'),
            supabase.from('areas').select('*'),
            supabase.from('inc_types').select('*')
        ]);

        if (incRes.error) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }
        if (statusRes.error || areaRes.error || typeRes.error) {
            return res.status(500).json({ success: false, message: 'Error al obtener los datos' });
        }

        const statusesMap = Object.fromEntries(statusRes.data.map(s => [s.id, s.name ?? s.status ?? s.id]));
        const areasMap    = Object.fromEntries(areaRes.data.map(a => [a.id, a.name ?? a.area ?? a.id]));
        const typesMap    = Object.fromEntries(typeRes.data.map(t => [t.id, t.name ?? t.type ?? t.id]));

        let userName = 'Desconocido';
        if (incRes.data.usr_id) {
            const { data: usr } = await supabase
                .from('users')
                .select('name, ap')
                .eq('id', incRes.data.usr_id)
                .single();
            if (usr) {
                userName = (usr.name === '-' && usr.ap === '-')
                    ? 'Usuario eliminado'
                    : `${usr.name ?? ''} ${usr.ap ?? ''}`.trim();
            }
        }

        return res.status(200).json({
            success: true,
            incident: incRes.data,
            statusName: statusesMap[incRes.data.status_id] ?? incRes.data.status_id,
            areaName:   areasMap[incRes.data.area_id]     ?? incRes.data.area_id,
            typeName:   typesMap[incRes.data.type_id]     ?? incRes.data.type_id,
            statuses:   statusRes.data,
            userName
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

export const updateIncident = async (req, res) => {
    const { id } = req.params;
    const { status_id, notes, cost, set_completed_at } = req.body;

    const updates = {};

    if (status_id !== undefined && status_id !== null && status_id !== '') {
        const parsed = parseInt(status_id, 10);
        if (isNaN(parsed)) return res.status(400).json({ success: false, message: 'status_id inválido' });
        updates.status_id = parsed;
    }
    if (notes !== undefined && notes !== null) {
        if (String(notes).length > 150) return res.status(400).json({ success: false, message: 'notes excede 150 caracteres' });
        updates.notes = String(notes).trim();
    }
    if (cost !== undefined && cost !== null && cost !== '') {
        const parsed = parseFloat(cost);
        if (isNaN(parsed) || parsed < 0) return res.status(400).json({ success: false, message: 'cost inválido' });
        updates.cost = parsed;
    }
    if (set_completed_at) {
        updates.completed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });
    }

    try {
        const { error } = await supabase.from('incidents').update(updates).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al actualizar' });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}
