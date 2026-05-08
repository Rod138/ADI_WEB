/**
 * TESINA: Controlador para gestion de incidencias.
 * Responsabilidad: listar incidencias y cat�logos, consultar detalle y actualizar.
 * Flujo: consumir tablas de soporte (estado, area, tipo) para vista completa.
 */

import supabase from "../dbconfig.js";
import { notifyNewIncident, notifyIncidentStatusChange } from "../utils/notificationSender.js";
import crypto from 'crypto';
const INCIDENT_DESCRIPTION_MAX_LENGTH = 100;
const INCIDENT_EDIT_WINDOW_HOURS = 24;

// Elimina una imagen de Cloudinary por su URL
const deleteCloudinaryImage = async (imageUrl) => {
    if (!imageUrl) return true; // No hay imagen que eliminar

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;

        if (!cloudName || !apiKey) {
            console.warn('Cloudinary credentials not configured, skipping image deletion');
            return true;
        }

        // Extraer public_id de la URL de Cloudinary
        // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{ext}
        const urlMatch = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/);
        if (!urlMatch) {
            console.warn('Could not extract public_id from image URL');
            return true;
        }

        const publicId = urlMatch[1];

        // Preparar credenciales para API de Cloudinary
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto.createHash('sha1')
            .update(`public_id=${publicId}&timestamp=${timestamp}${apiKey}`)
            .digest('hex');

        // Hacer DELETE request a Cloudinary API
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/destroy`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    public_id: publicId,
                    signature,
                    api_key: apiKey,
                    timestamp
                }).toString()
            }
        );

        if (!response.ok) {
            console.warn(`Cloudinary deletion failed for ${publicId}:`, response.statusText);
            return true; // No fallar la operación si Cloudinary falla
        }

        return true;
    } catch (error) {
        console.error('Error deleting Cloudinary image:', error.message);
        return true; // No fallar la operación si hay error
    }
};

// Verifica si una incidencia puede ser editada (menos de 24 horas)
const isIncidentEditable = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff < INCIDENT_EDIT_WINDOW_HOURS;
};

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
        let userDepartment = '';
        if (incRes.data.usr_id) {
            const { data: usr } = await supabase
                .from('users')
                .select('name, dep_id')
                .eq('id', incRes.data.usr_id)
                .single();
            if (usr && usr.name !== '-') {
                userName = usr.name ?? 'Usuario eliminado';
                // Get department name
                if (usr.dep_id) {
                    const { data: dept } = await supabase
                        .from('departments')
                        .select('name')
                        .eq('id', usr.dep_id)
                        .single();
                    userDepartment = dept?.name ?? '';
                }
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
            userName: userName + (userDepartment ? ` ${userDepartment}` : '')
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

// Actualiza campos operativos de una incidencia (estado, notas, costo y cierre).
// Owners pueden editar solo dentro de 24 horas: description, area_id, type_id, image_url
// Solo Admin puede editar: status_id, cost, notes, set_completed_at
export const updateIncident = async (req, res) => {
    const { id } = req.params;
    const { description, area_id, type_id, image_url, image, status_id, notes, cost, set_completed_at } = req.body;
    const userId = parseInt(req.get('x-session-user-id') || req.cookies?.session_user_id, 10);

    try {
        // Obtener la incidencia para verificar propiedad
        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('usr_id, created_at, area_id, image_url, image')
            .eq('id', id)
            .single();

        if (fetchError || !incident) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }

        const isOwner = Number(incident.usr_id) === userId;

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar esta incidencia'
            });
        }

        const isOwnIncidentPastWindow = !isIncidentEditable(incident.created_at);

        const updates = {};

        // Validar restricción de 24 horas para cambios de reporte
        if (description !== undefined || area_id !== undefined || type_id !== undefined || image !== undefined || image_url !== undefined || status_id !== undefined || notes !== undefined || cost !== undefined || set_completed_at !== undefined) {
            if (isOwnIncidentPastWindow) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo puedes editar el reporte dentro de 24 horas de su creación.'
                });
            }
        }

        // Campos que OWNER puede editar - estos son campos de reporte
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
        
        // Campos opcionales que el owner también puede editar dentro de 24 horas
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
            if (cost === undefined || cost === null || cost === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Debes capturar el costo para resolver la incidencia'
                });
            }
            updates.completed_at = new Date().toISOString();
        }
        
        const normalizedImage = image !== undefined ? image : image_url;
        if (normalizedImage !== undefined && normalizedImage !== null) {
            // Si hay una imagen anterior, eliminarla de Cloudinary
            if (incident.image_url || incident.image) {
                const oldImageUrl = incident.image_url ?? incident.image;
                await deleteCloudinaryImage(oldImageUrl);
            }
            updates.image = normalizedImage;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });
        }

        const { error } = await supabase.from('incidents').update(updates).eq('id', id);
        if (error) return res.status(500).json({ success: false, message: 'Error al actualizar' });

        if (set_completed_at) {
            await supabase.from('incidents').update({ edited_at: new Date().toISOString() }).eq('id', id);
        }

        // Enviar notificación si cambió el estado
        if (status_id !== undefined) {
            try {
                const { data: statusData } = await supabase
                    .from('inc_status')
                    .select('name')
                    .eq('id', status_id)
                    .single();
                const statusName = statusData?.name || `Estado ${status_id}`;

                const { data: areaData } = await supabase
                    .from('areas')
                    .select('name')
                    .eq('id', incident.area_id ?? 0)
                    .single();
                const areaName = areaData?.name || undefined;

                await notifyIncidentStatusChange({
                    reporterUserId: incident.usr_id,
                    newStatus: statusName,
                    area: areaName
                });
            } catch (notifError) {
                console.error('Error enviando notificación de estado:', notifError.message);
            }
        }

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

        const createdIncident = data?.[0];

        // Enviar notificación de nueva incidencia a los admins
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('name')
                .eq('id', parseInt(userId, 10))
                .single();

            const { data: areaData } = await supabase
                .from('areas')
                .select('name')
                .eq('id', parseInt(area_id, 10))
                .single();

            const reporterName = userData?.name || 'Usuario';
            const areaName = areaData?.name || undefined;

            await notifyNewIncident({
                reporterName,
                area: areaName,
                description: descriptionText
            });
        } catch (notifError) {
            console.error('Error enviando notificación de incidencia:', notifError.message);
        }

        return res.status(201).json({
            success: true,
            incident: normalizeIncident(createdIncident),
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
            .select('usr_id, image_url, image, created_at')
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

        // Verificar ventana de edición (24 horas) - solo para propietarios no-admin
        if (isOwner && !isAdmin && !isIncidentEditable(incident.created_at)) {
            return res.status(403).json({
                success: false,
                message: 'Solo puedes editar o borrar la incidencia dentro de 24 horas de su creación. Después solo un administrador puede resolverla.'
            });
        }

        // Eliminar imagen de Cloudinary si existe
        if (incident.image_url || incident.image) {
            const imageUrl = incident.image_url ?? incident.image;
            await deleteCloudinaryImage(imageUrl);
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

// Actualiza la imagen de una incidencia.
export const updateIncidentImage = async (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;
    const userId = parseInt(req.get('x-session-user-id') || req.cookies?.session_user_id, 10);

    if (!image_url) {
        return res.status(400).json({ success: false, message: 'Se requiere image_url' });
    }

    try {
        // Obtener la incidencia para verificar propiedad
        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('usr_id, image_url, created_at')
            .eq('id', id)
            .single();

        if (fetchError || !incident) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }

        // Verificar permisos
        const { data: user } = await supabase
            .from('users')
            .select('rol_id')
            .eq('id', userId)
            .single();

        const isAdmin = user && Number(user.rol_id) >= 3;
        const isOwner = Number(incident.usr_id) === userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta incidencia' });
        }

        // Verificar ventana de edición (24 horas) para propietarios (incluye admin propietario)
        if (isOwner && !isIncidentEditable(incident.created_at)) {
            return res.status(403).json({
                success: false,
                message: 'Solo puedes editar la incidencia dentro de 24 horas de su creación'
            });
        }

        // Eliminar imagen antigua de Cloudinary si existe
        if (incident.image_url) {
            await deleteCloudinaryImage(incident.image_url);
        }

        // Actualizar imagen
        const { error: updateError } = await supabase
            .from('incidents')
            .update({ image_url })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ success: false, message: 'Error al actualizar imagen' });
        }

        return res.status(200).json({ success: true, message: 'Imagen actualizada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}

// Elimina la imagen de una incidencia.
export const deleteIncidentImage = async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(req.get('x-session-user-id') || req.cookies?.session_user_id, 10);

    try {
        // Obtener la incidencia para verificar propiedad
        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('usr_id, image_url, created_at')
            .eq('id', id)
            .single();

        if (fetchError || !incident) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
        }

        // Verificar permisos
        const { data: user } = await supabase
            .from('users')
            .select('rol_id')
            .eq('id', userId)
            .single();

        const isAdmin = user && Number(user.rol_id) >= 3;
        const isOwner = Number(incident.usr_id) === userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta incidencia' });
        }

        // Verificar ventana de edición (24 horas) para propietarios (incluye admin propietario)
        if (isOwner && !isIncidentEditable(incident.created_at)) {
            return res.status(403).json({
                success: false,
                message: 'Solo puedes editar la incidencia dentro de 24 horas de su creación'
            });
        }

        // Eliminar imagen de Cloudinary
        if (incident.image_url) {
            await deleteCloudinaryImage(incident.image_url);
        }

        // Eliminar imagen (set a null)
        const { error: updateError } = await supabase
            .from('incidents')
            .update({ image_url: null })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ success: false, message: 'Error al eliminar imagen' });
        }

        return res.status(200).json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};
