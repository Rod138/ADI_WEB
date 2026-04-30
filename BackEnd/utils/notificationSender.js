/**
 * TESINA: Centralizador de envío de notificaciones
 * Responsabilidad: enviar notificaciones automáticas por eventos del sistema
 * Tipos de notificación:
 *  1 → INCIDENT_STATUS_CHANGE  (residente que reportó)
 *  2 → QUOTA_PUBLISHED         (todos los residentes)
 *  3 → QUOTA_REJECTED          (residente del depto)
 *  4 → QUOTA_VALIDATED         (residente del depto)
 *  5 → NEW_EXPENSE             (todos los residentes)
 *  6 → NEW_INCIDENT            (todos los admins)
 *  7 → NEW_RECEIPT             (todos los tesoreros)
 */

import supabase from '../dbconfig.js';

const NOTIFICATION_TYPE = {
    INCIDENT_STATUS_CHANGE: 1,
    QUOTA_PUBLISHED: 2,
    QUOTA_REJECTED: 3,
    QUOTA_VALIDATED: 4,
    NEW_EXPENSE: 5,
    NEW_INCIDENT: 6,
    NEW_RECEIPT: 7,
};

// ── Helper: crear notificación individual ──────────────────────────────────

async function createNotification({ usr_id, type_id, title, description }) {
    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                usr_id,
                type_id,
                title,
                description,
                created_at: new Date().toISOString(),
                read: false
            });

        if (error) {
            console.error(`[Notifications] Error creando notificación para usuario ${usr_id}:`, error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[Notifications] Exception:`, error.message);
        return false;
    }
}

// ── Helper: crear notificaciones en lote ───────────────────────────────────

async function createNotificationBatch(payloads) {
    try {
        const data = payloads.map(p => ({
            usr_id: p.usr_id,
            type_id: p.type_id,
            title: p.title,
            description: p.description,
            created_at: new Date().toISOString(),
            read: false
        }));

        const { error } = await supabase
            .from('notifications')
            .insert(data);

        if (error) {
            console.error(`[Notifications] Error en batch:`, error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[Notifications] Exception en batch:`, error.message);
        return false;
    }
}

// ── Helper: obtener IDs de usuarios por rol ────────────────────────────────

async function getUserIdsByRole(rolIds) {
    try {
        const { data } = await supabase
            .from('users')
            .select('id')
            .in('rol_id', rolIds);
        return (data ?? []).map((u) => u.id);
    } catch (error) {
        console.error('[Notifications] Error getting users by role:', error.message);
        return [];
    }
}

// rol_id: 1=Residente, 2=Tesorero, 3=Admin, 4=Tesorero+Admin
async function getAllResidentIds() {
    return getUserIdsByRole([1, 2, 3, 4]);
}

async function getAdminIds() {
    return getUserIdsByRole([3, 4]);
}

async function getTreasurerIds() {
    return getUserIdsByRole([2, 4]);
}

// ── Notificaciones públicas ────────────────────────────────────────────────

/**
 * 1. Cambio de estado de incidencia → al residente que la reportó
 */
export async function notifyIncidentStatusChange({ reporterUserId, newStatus, area }) {
    const areaLabel = area ? ` en ${area}` : '';
    await createNotification({
        usr_id: reporterUserId,
        type_id: NOTIFICATION_TYPE.INCIDENT_STATUS_CHANGE,
        title: 'Estado de incidencia actualizado',
        description: `La incidencia${areaLabel} cambió a "${newStatus}".`
    });
}

/**
 * 2. Nueva cuota del mes publicada → todos los usuarios
 */
export async function notifyQuotaPublished({ month, year, amount }) {
    const userIds = await getAllResidentIds();
    const formatted = `$${Number(amount).toLocaleString('es-MX')}`;
    const payloads = userIds.map((uid) => ({
        usr_id: uid,
        type_id: NOTIFICATION_TYPE.QUOTA_PUBLISHED,
        title: `Cuota de ${month} ${year} registrada`,
        description: `La cuota de mantenimiento de ${month} ${year} es ${formatted}. Ya puedes subir tu comprobante.`
    }));
    await createNotificationBatch(payloads);
}

/**
 * 3. Cuota rechazada → al residente del departamento
 */
export async function notifyQuotaRejected({ depId, month, year }) {
    try {
        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('dep_id', depId);

        const userIds = (data ?? []).map((u) => u.id);
        const payloads = userIds.map((uid) => ({
            usr_id: uid,
            type_id: NOTIFICATION_TYPE.QUOTA_REJECTED,
            title: 'Comprobante rechazado',
            description: `Tu comprobante de cuota de ${month} ${year} fue rechazado. Por favor sube uno nuevo.`
        }));
        await createNotificationBatch(payloads);
    } catch (error) {
        console.error('[Notifications] Error notifying quota rejected:', error.message);
    }
}

/**
 * 4. Cuota validada/aprobada → al residente del departamento
 */
export async function notifyQuotaValidated({ depId, month, year, amountPaid }) {
    try {
        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('dep_id', depId);

        const userIds = (data ?? []).map((u) => u.id);
        const formatted = `$${Number(amountPaid).toLocaleString('es-MX')}`;
        const payloads = userIds.map((uid) => ({
            usr_id: uid,
            type_id: NOTIFICATION_TYPE.QUOTA_VALIDATED,
            title: 'Cuota aprobada ✓',
            description: `Tu pago de ${formatted} para ${month} ${year} fue aprobado correctamente.`
        }));
        await createNotificationBatch(payloads);
    } catch (error) {
        console.error('[Notifications] Error notifying quota validated:', error.message);
    }
}

/**
 * 5. Nuevo gasto registrado en la torre → todos los usuarios
 */
export async function notifyNewExpense({ description, amount }) {
    const userIds = await getAllResidentIds();
    const formatted = `$${Number(amount).toLocaleString('es-MX')}`;
    const payloads = userIds.map((uid) => ({
        usr_id: uid,
        type_id: NOTIFICATION_TYPE.NEW_EXPENSE,
        title: 'Nuevo gasto registrado',
        description: `Se registró un gasto de ${formatted}: "${description}".`
    }));
    await createNotificationBatch(payloads);
}

/**
 * 6. Nueva incidencia creada → todos los admins
 */
export async function notifyNewIncident({ reporterName, area, description }) {
    const adminIds = await getAdminIds();
    const areaLabel = area ? ` en ${area}` : '';
    const shortDesc = description.length > 60 ? description.slice(0, 57) + '...' : description;

    const payloads = adminIds.map((uid) => ({
        usr_id: uid,
        type_id: NOTIFICATION_TYPE.NEW_INCIDENT,
        title: `Nueva incidencia${areaLabel}`,
        description: `${reporterName} reportó: "${shortDesc}"`
    }));
    await createNotificationBatch(payloads);
}

/**
 * 7. Nuevo comprobante de cuota recibido → todos los tesoreros
 */
export async function notifyNewReceipt({ depName, month, year, amountPaid }) {
    const treasurerIds = await getTreasurerIds();
    const formatted = `$${Number(amountPaid).toLocaleString('es-MX')}`;
    const payloads = treasurerIds.map((uid) => ({
        usr_id: uid,
        type_id: NOTIFICATION_TYPE.NEW_RECEIPT,
        title: 'Nuevo comprobante recibido',
        description: `${depName} subió su comprobante de ${formatted} para ${month} ${year}. Pendiente de revisión.`
    }));
    await createNotificationBatch(payloads);
}

export { NOTIFICATION_TYPE };
