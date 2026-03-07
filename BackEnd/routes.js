import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { login } from './controllers/login.js';

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

router.get('/main', (req, res) => {
    const indexPath = path.join(rootDir, 'FrontEnd', 'Views', 'main.html');
    res.sendFile(indexPath);
});

export default router;
