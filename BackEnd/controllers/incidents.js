/**
 * TESINA: Controlador para gestion de incidencias.
 * Responsabilidad: listar incidencias y cat�logos, consultar detalle y actualizar.
 * Flujo: consumir tablas de soporte (estado, area, tipo) para vista completa.
 */

import supabase from "../dbconfig.js";

const INCIDENT_DESCRIPTION_MAX_LENGTH = 100;

// Normaliza el payload para compatibilidad entre nombres de columnas antiguos y actuales.
const normalizeIncident = (incident) => {
    if (!incident) return incident;
    return {
        ...incident,
        content: incident.content ?? incident.description ?? '',
        image_url: incident.image_url ?? incident.image ?? null
    };
};

// Obtiene incidencias y catalogos auxiliares para construir filtros en el cliente.
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
            incidents: (incRes.data || []).map(normalizeIncident),
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

// Recupera el detalle completo de una incidencia y resuelve etiquetas descriptivas.
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
            incident: normalizeIncident(incRes.data),
            statusName: statusesMap[incRes.data.status_id] ?? incRes.data.status_id,
            areaName:   areasMap[incRes.data.area_id]     ?? incRes.data.area_id,
            typeName:   typesMap[incRes.data.type_id]     ?? incRes.data.type_id,
            statuses:   statusRes.data,
            areas:      areaRes.data,
            types:      typeRes.data,
            userName
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

// Actualiza campos operativos de una incidencia (estado, notas, costo y cierre).
// Owners pueden editar: description, area_id, type_id, image_url
// Solo Admin puede editar: status_id, cost, notes, set_completed_at
export const updateIncident = async (req, res) => {
    const { id } = req.params;
    const { description, area_id, type_id, image_url, image, status_id, notes, cost, set_completed_at } = req.body;
    const userId = parseInt(req.get('x-session-user-id') || req.cookies?.session_user_id, 10);

    try {
        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('usr_id')
            .eq('id', id)
            .single();

        if (fetchError || !incident) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }

        const { data: user } = await supabase
            .from('users')
            .select('rol_id')
            .eq('id', userId)
            .single();

        const isAdmin = user && Number(user.rol_id) >= 3;
        const isOwner = Number(incident.usr_id) === userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar esta incidencia'
            });
        }

        const updates = {};

        // Campos que solo ADMIN puede editar
        if (status_id !== undefined || notes !== undefined || cost !== undefined || set_completed_at !== undefined) {
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo administradores pueden actualizar estado, costo y notas'
                });
            }

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
        }

        // Campos que OWNER (o ADMIN) pueden editar - estos son campos de reporte
        if (description !== undefined && description !== null) {
            const descriptionText = String(description).trim();
            if (descriptionText.length > INCIDENT_DESCRIPTION_MAX_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `description excede ${INCIDENT_DESCRIPTION_MAX_LENGTH} caracteres`
                });
            }
            updates.description = descriptionText;
        }
        if (area_id !== undefined && area_id !== null && area_id !== '') {
            const parsed = parseInt(area_id, 10);
            if (isNaN(parsed)) return res.status(400).json({ success: false, message: 'area_id inválido' });
            updates.area_id = parsed;
        }
        if (type_id !== undefined && type_id !== null && type_id !== '') {
            const parsed = parseInt(type_id, 10);
            if (isNaN(parsed)) return res.status(400).json({ success: false, message: 'type_id inválido' });
            updates.type_id = parsed;
        }
        const normalizedImage = image !== undefined ? image : image_url;
        if (normalizedImage !== undefined && normalizedImage !== null) {
            updates.image = normalizedImage;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });
        }

        const { error } = await supabase.from('incidents').update(updates).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al actualizar' });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

// Crea una nueva incidencia.
export const createIncident = async (req, res) => {
    const { description, type_id, area_id, image_url, image } = req.body;
    const userId = req.get('x-session-user-id') || req.cookies?.session_user_id;
    const descriptionText = String(description || '').trim();

    if (!userId || !descriptionText || !type_id || !area_id) {
        return res.status(400).json({
            success: false,
            message: 'Faltan campos requeridos: description, type_id, area_id'
        });
    }

    if (descriptionText.length > INCIDENT_DESCRIPTION_MAX_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `description excede ${INCIDENT_DESCRIPTION_MAX_LENGTH} caracteres`
        });
    }

    try {
        const normalizedImage = image !== undefined ? image : image_url;

        const { data, error } = await supabase
            .from('incidents')
            .insert({
                usr_id: parseInt(userId, 10),
                description: descriptionText,
                type_id: parseInt(type_id, 10),
                area_id: parseInt(area_id, 10),
                status_id: 1, // Estado inicial
                image: normalizedImage || null,
                created_at: new Date().toISOString()
            })
            .select();

        if (error) {
            return res.status(500).json({
                success: false,
                message: `Error al crear incidencia: ${error.message}`
            });
        }

        return res.status(201).json({
            success: true,
            incident: normalizeIncident(data?.[0]),
            message: 'Incidencia creada exitosamente'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

// Elimina una incidencia (solo el creador o admin).
export const deleteIncident = async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(req.get('x-session-user-id') || req.cookies?.session_user_id, 10);

    try {
        // Obtener la incidencia para verificar propiedad
        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('usr_id')
            .eq('id', id)
            .single();

        if (fetchError || !incident) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }

        // Verificar permisos: propietario o admin (rol_id >= 3)
        const { data: user } = await supabase
            .from('users')
            .select('rol_id')
            .eq('id', userId)
            .single();

        const isAdmin = user && Number(user.rol_id) >= 3;
        const isOwner = Number(incident.usr_id) === userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar esta incidencia' });
        }

        // Eliminar
        const { error: deleteError } = await supabase
            .from('incidents')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return res.status(500).json({ success: false, message: 'Error al eliminar' });
        }

        return res.status(200).json({ success: true, message: 'Incidencia eliminada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}
