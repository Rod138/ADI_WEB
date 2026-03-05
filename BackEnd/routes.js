import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

router.get('/', (req, res) => {
    const indexPath = path.join(rootDir, 'FrontEnd', 'Views', 'index.html');
    res.sendFile(indexPath);
});

export default router;
