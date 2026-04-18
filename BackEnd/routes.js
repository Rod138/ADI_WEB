/**
 * TESINA: Mapa central de endpoints HTTP del sistema ADI_WEB.
 * Responsabilidad: enlazar vistas y APIs con sus controladores.
 * Nota: concentra reglas de acceso por rol mediante middlewares de auth.
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, forgotPassword } from './controllers/login.js';import { getMainMenu } from './controllers/main.js';import { getIncidents, getIncidentById, updateIncident, createIncident, deleteIncident } from './controllers/incidents.js';
import { getUsers, getUserById, updateUser, deleteUser, updateDepartment, getDepartments, getRoles, createUser } from './controllers/departments.js';
import { getNotifications, deleteNotification } from './controllers/notifications.js';
import { createTowerExpense, getTowerExpensesBoard, getTowerFundConfig, upsertTowerFundConfig, getMonthlyQuotaConfig, upsertMonthlyQuotaConfig, getPaymentReceipts, getPaymentReceiptById, updatePaymentReceipt, getQuotaPaymentData, createQuotaPayment, getAccountingReportsData } from './controllers/accounting.js';
import { requireMinRole, requireSelfOrMinRole } from './middlewares/auth.js';

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

router.post('/api/login', login);

router.post('/api/logout', (req, res) => {
    res.clearCookie('session_user_id');
    res.status(200).json({ success: true, message: 'Sesión cerrada' });
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

router.get('/incident', (req, res) => {
    res.render('incidents/incident');
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

router.get('/accounting/tower-fund', (req, res) => {
    res.redirect('/accounting/monthly-quota');
});

router.get('/accounting/monthly-quota', (req, res) => {
    res.render('accounting/monthly-quota');
});

router.get('/accounting/payment', (req, res) => {
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const cloudinaryUploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

    res.render('accounting/payment', {
        cloudinaryCloudName,
        cloudinaryUploadPreset
    });
});

router.get('/reports', (req, res) => {
    res.render('accounting/reports');
});

router.get('/accounting/receipts-board', (req, res) => {
    res.render('accounting/receipts-board');
});

router.get('/accounting/receipt', (req, res) => {
    res.render('accounting/receipt');
});

router.post('/api/accounting/expenses', requireMinRole(2), createTowerExpense);
router.get('/api/accounting/expenses-board', requireMinRole(1), getTowerExpensesBoard);
router.get('/api/accounting/tower-fund', getTowerFundConfig);
router.post('/api/accounting/tower-fund', requireMinRole(2), upsertTowerFundConfig);
router.get('/api/accounting/monthly-quota', getMonthlyQuotaConfig);
router.post('/api/accounting/monthly-quota', requireMinRole(2), upsertMonthlyQuotaConfig);
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

export default router;
