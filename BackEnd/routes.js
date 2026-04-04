import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, forgotPassword } from './controllers/login.js';
import { getIncidents, getIncidentById, updateIncident } from './controllers/incidents.js';
import { getUsers, getUserById, updateUser, updateDepartment, getDepartments, getRoles, createUser } from './controllers/departments.js';
import { getNotifications, deleteNotification } from './controllers/notifications.js';

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

// Rutas de recuperación de contraseña
router.get('/forgot-password', (req, res) => {
    const forgotPasswordPath = path.join(rootDir, 'FrontEnd', 'Views', 'forgot-password.html');
    res.sendFile(forgotPasswordPath);
});

router.post('/api/forgot-password', forgotPassword);

router.get('/main', (req, res) => {
    res.render('main');
});

router.get('/profile', (req, res) => {
    res.render('profile');
});

router.get('/notifications', (req, res) => {
    res.render('notifications');
});

router.get('/incident-board', (req, res) => {
    res.render('incidents/board');
});

router.get('/api/incidents', getIncidents);
router.get('/api/incidents/:id', getIncidentById);
router.patch('/api/incidents/:id', updateIncident);

router.get('/incident', (req, res) => {
    res.render('incidents/incident');
});

router.get('/departments', (req, res) => {
    res.render('departments/departments');
});

router.get('/api/users', getUsers);
router.get('/api/users/:id', getUserById);
router.patch('/api/users/:id', updateUser);
router.post('/api/users', createUser);
router.get('/api/roles', getRoles);
router.get('/api/departments', getDepartments);
router.patch('/api/departments/:id', updateDepartment);

router.get('/api/notifications', getNotifications);
router.delete('/api/notifications/:id', deleteNotification);

export default router;
