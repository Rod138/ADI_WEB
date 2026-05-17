const SUPPORT_BASE = process.env.SUPPORT_BASE_URL || 'https://adi-backend-umber.vercel.app';

const proxyJson = async (url, init = {}) => {
    const response = await fetch(url, init);
    const raw = await response.text();

    let data;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = { success: false, message: raw || 'Respuesta no válida del servicio de soporte' };
    }

    return { response, data };
};

export const getMyTickets = async (req, res) => {
    try {
        const user = req.sessionUser;
        if (!user) return res.status(401).json({ success: false, message: 'Sesión inválida' });

        const { response, data } = await proxyJson(
            `${SUPPORT_BASE}/api/tickets/user/${encodeURIComponent(user.id)}`
        );

        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[Support] getMyTickets error', err);
        return res.status(500).json({ success: false, message: 'Error consultando tickets' });
    }
};

export const postMyTicket = async (req, res) => {
    try {
        const user = req.sessionUser;
        if (!user) return res.status(401).json({ success: false, message: 'Sesión inválida' });

        const payload = {
            ...(req.body || {}),
            adi_user_id: Number(user.id),
            adi_rol_id: Number(user.rol_id),
        };

        const { response, data } = await proxyJson(`${SUPPORT_BASE}/api/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[Support] postMyTicket error', err);
        return res.status(500).json({ success: false, message: 'Error creando ticket' });
    }
};

export const getAreas = async (req, res) => {
    try {
        const { response, data } = await proxyJson(`${SUPPORT_BASE}/api/areas`);
        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[Support] getAreas error', err);
        return res.status(500).json({ success: false, message: 'Error consultando áreas' });
    }
};

export const getErrorTypesByArea = async (req, res) => {
    try {
        const { area_id } = req.params;
        const { response, data } = await proxyJson(`${SUPPORT_BASE}/api/error-types/area/${encodeURIComponent(area_id)}`);
        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[Support] getErrorTypesByArea error', err);
        return res.status(500).json({ success: false, message: 'Error consultando tipos de error' });
    }
};
