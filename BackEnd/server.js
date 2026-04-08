import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import routes from './routes.js'

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));

app.use((error, req, res, next) => {
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'La imagen es demasiado pesada.' });
  }
  return next(error);
});
const publicDir = path.join(rootDir, 'FrontEnd');
app.use(express.static(publicDir));
app.use('/FrontEnd', express.static(publicDir));

app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'FrontEnd', 'Views'));

app.use('/', routes);

app.use((req, res) => {
  res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}/`)
})
