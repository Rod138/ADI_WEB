/**
 * TESINA: Mapa central de endpoints HTTP del sistema ADI_WEB.
 * Responsabilidad: enlazar vistas y APIs con sus controladores.
 * Nota: concentra reglas de acceso por rol mediante middlewares de auth.
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, forgotPassword } from './controllers/login.js';import { getMainMenu } from './controllers/main.js';import { getIncidents, getIncidentById, updateIncident, createIncident, deleteIncident, updateIncidentImage, deleteIncidentImage } from './controllers/incidents.js';
import { getUsers, getUserById, updateUser, deleteUser, updateDepartment, getDepartments, getRoles, createUser } from './controllers/departments.js';
import { getNotifications, deleteNotification, deleteAllNotifications, markNotificationRead } from './controllers/notifications.js';
import { createTowerExpense, updateTowerExpense, deleteTowerExpense, getTowerExpensesBoard, getFinanceConfig, upsertFinanceConfig, getTowerFundConfig, upsertTowerFundConfig, getMonthlyQuotaConfig, upsertMonthlyQuotaConfig, getPaymentReceipts, getPaymentReceiptById, updatePaymentReceipt, getQuotaPaymentData, createQuotaPayment, getAccountingReportsData } from './controllers/accounting.js';
import { requireMinRole, requireSelfOrMinRole } from './middlewares/auth.js';
import { getMyTickets, postMyTicket, getAreas as getSupportAreas, getErrorTypesByArea as getSupportErrorTypesByArea } from './controllers/support.js';
import { verifyRefreshToken, generateAccessToken, verifyRefreshTokenInDB, deleteRefreshTokenFromDB } from './utils/validation.js';
import supabase from './dbconfig.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

router.get('/', (req, res) => {
    const indexPath = path.join(rootDir, 'FrontEnd', 'Views', 'index.html');
    res.sendFile(indexPath);
});

router.get('/login', (req, res) => {
    const indexPath = path.join(rootDir, 'FrontEnd', 'Views', 'login.html')
    res.sendFile(indexPath);
});

router.get('/session-invalid', (req, res) => {
    const reason = req.query?.reason || 'invalid-session';
    res.render('session-invalid', { reason });
});

router.get('/unauthorized', (req, res) => {
    const reason = req.query?.reason || 'forbidden';
    res.render('unauthorized', { reason });
});

router.post('/api/login', login);

router.post('/api/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Token de sesión no disponible'
            });
        }

        const decoded = await verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Tu sesión terminó. Vuelve a iniciar sesión.'
            });
        }

        const tokenRecord = await verifyRefreshTokenInDB(supabase, refreshToken);
        if (!tokenRecord) {
            return res.status(401).json({
                success: false,
                message: 'Tu sesión terminó. Vuelve a iniciar sesión.'
            });
        }

        // Obtener datos del usuario y su rol para generar access token con información de rol
        const { data: userData, error: userError } = await supabase.from('users').select('id, rol_id').eq('id', decoded.userId).single();
        if (userError || !userData) {
            return res.status(401).json({ success: false, message: 'Tu sesión terminó. Vuelve a iniciar sesión.' });
        }

        let roleName = null;
        try {
            const { data: roleData, error: roleError } = await supabase.from('roles').select('name').eq('id', userData.rol_id).single();
            if (!roleError && roleData) roleName = roleData.name;
        } catch (e) {
            // ignorar error y generar token sin nombre de rol
        }

        const newAccessToken = await generateAccessToken(userData.id, userData.rol_id, roleName);

        return res.status(200).json({ success: true, accessToken: newAccessToken });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No pudimos renovar tu sesión en este momento'
        });
    }
});

router.post('/api/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (refreshToken) {
            await deleteRefreshTokenFromDB(supabase, refreshToken);
        }
    } catch (error) {
        // Respuesta de cierre siempre positiva para no bloquear salida del usuario.
    }

    res.clearCookie('session_user_id');
    return res.status(200).json({ success: true, message: 'Sesión cerrada' });
});

// Rutas de recuperación de contraseña
router.get('/forgot-password', (req, res) => {
    const forgotPasswordPath = path.join(rootDir, 'FrontEnd', 'Views', 'forgot-password.html');
    res.sendFile(forgotPasswordPath);
});

router.post('/api/forgot-password', forgotPassword);

router.get('/main', getMainMenu);

router.get('/profile', (req, res) => {
    res.render('profile');
});

router.get('/notifications', (req, res) => {
    res.render('notifications');
});

router.get('/incident-board', (req, res) => {
    res.render('incidents/board');
});

router.get('/incident-create', (req, res) => {
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const cloudinaryUploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    res.render('incidents/create', {
        cloudinaryCloudName,
        cloudinaryUploadPreset
    });
});

router.get('/api/incidents', getIncidents);
router.get('/api/incidents/:id', getIncidentById);
router.post('/api/incidents', requireMinRole(1), createIncident);
router.patch('/api/incidents/:id', requireMinRole(1), updateIncident);
router.delete('/api/incidents/:id', requireMinRole(1), deleteIncident);
router.post('/api/incidents/:id/image', requireMinRole(1), updateIncidentImage);
router.delete('/api/incidents/:id/image', requireMinRole(1), deleteIncidentImage);

router.get('/incident', (req, res) => {
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const cloudinaryUploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    res.render('incidents/incident', {
        cloudinaryCloudName,
        cloudinaryUploadPreset
    });
});

router.get('/departments', requireMinRole(3), (req, res) => {
    res.render('departments/departments');
});

router.get('/accounting', (req, res) => {
    res.render('accounting/accounting');
});

router.get('/accounting/expense', (req, res) => {
    res.render('accounting/expense');
});

router.get('/accounting/expenses-board', (req, res) => {
    res.render('accounting/expenses-board');
});

// Legacy routes redirect to unified finance config
router.get('/accounting/tower-fund', (req, res) => {
    res.redirect('/accounting/finance-config');
});

router.get('/accounting/monthly-quota', (req, res) => {
    res.redirect('/accounting/finance-config');
});

router.get('/accounting/finance-config', (req, res) => {
    res.render('accounting/finance-config');
});

router.get('/accounting/payment', (req, res) => {
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const cloudinaryUploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    res.render('accounting/payment', {
        cloudinaryCloudName,
        cloudinaryUploadPreset
    });
});

router.get('/accounting/cash-payment', requireMinRole(2), (req, res) => {
    res.render('accounting/cash-payment');
});

router.get('/reports', (req, res) => {
    res.render('accounting/reports');
});

// Soporte (ADI-SOPORTE) - frontend page that fetches from external service
router.get('/support', requireMinRole(1), (req, res) => {
    res.render('support', { user: req.sessionUser });
});

router.get('/support/faqs', requireMinRole(1), (req, res) => {
    res.render('support-faqs', { user: req.sessionUser });
});

router.get('/support/tickets', requireMinRole(1), (req, res) => {
    res.render('support-tickets', {
        user: req.sessionUser
    });
});

// Proxy endpoints to ADI-SOPORTE for tickets (only operate on authenticated user's tickets)
router.get('/api/support/tickets', requireMinRole(1), getMyTickets);
router.post('/api/support/tickets', requireMinRole(1), postMyTicket);
router.get('/api/support/areas', requireMinRole(1), getSupportAreas);
router.get('/api/support/error-types/:area_id', requireMinRole(1), getSupportErrorTypesByArea);

router.get('/accounting/receipts-board', (req, res) => {
    res.render('accounting/receipts-board');
});

router.get('/accounting/receipt', (req, res) => {
    res.render('accounting/receipt');
});

router.post('/api/accounting/expenses', requireMinRole(2), createTowerExpense);
router.patch('/api/accounting/expenses/:id', requireMinRole(2), updateTowerExpense);
router.delete('/api/accounting/expenses/:id', requireMinRole(2), deleteTowerExpense);
router.get('/api/accounting/expenses-board', requireMinRole(1), getTowerExpensesBoard);
// Unified finance config endpoints (legacy routes still work for backward compatibility)
router.get('/api/accounting/finance-config', getFinanceConfig);
router.post('/api/accounting/finance-config', requireMinRole(2), upsertFinanceConfig);
router.get('/api/accounting/tower-fund', getFinanceConfig);
router.post('/api/accounting/tower-fund', requireMinRole(2), upsertFinanceConfig);
router.get('/api/accounting/monthly-quota', getFinanceConfig);
router.post('/api/accounting/monthly-quota', requireMinRole(2), upsertFinanceConfig);
router.get('/api/accounting/receipts', getPaymentReceipts);
router.get('/api/accounting/receipts/:id', getPaymentReceiptById);
router.patch('/api/accounting/receipts/:id', requireMinRole(2), updatePaymentReceipt);
router.get('/api/accounting/payment-data', getQuotaPaymentData);
router.post('/api/accounting/payment', requireMinRole(1), createQuotaPayment);
router.get('/api/accounting/reports-data', getAccountingReportsData);

router.get('/api/users', getUsers);
router.get('/api/users/:id', getUserById);
router.patch('/api/users/:id', requireSelfOrMinRole(3), updateUser);
router.delete('/api/users/:id', requireMinRole(3), deleteUser);
router.post('/api/users', requireMinRole(3), createUser);
router.get('/api/roles', getRoles);
router.get('/api/departments', getDepartments);
router.patch('/api/departments/:id', requireMinRole(3), updateDepartment);

router.get('/api/notifications', getNotifications);
router.delete('/api/notifications/:id', deleteNotification);
router.patch('/api/notifications/:id/read', markNotificationRead);
router.post('/api/notifications/delete-all', deleteAllNotifications);

export default router;
