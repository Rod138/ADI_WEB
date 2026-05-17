import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

const imgDir = path.join(process.cwd(), 'FrontEnd', 'IMG');
const viewsDir = path.join(process.cwd(), 'FrontEnd', 'Views');

const files = [
  { src: 'POLITICA_DE_PRIVACIDAD.docx', out: 'politicas.html', title: 'Políticas de Privacidad' },
  { src: 'TERMINOS_Y_CONDICIONES.docx', out: 'terminos.html', title: 'Términos y Condiciones' }
];

async function convertAll() {
  if (!fs.existsSync(viewsDir)) fs.mkdirSync(viewsDir, { recursive: true });

  for (const f of files) {
    const srcPath = path.join(imgDir, f.src);
    const outPath = path.join(viewsDir, f.out);

    if (!fs.existsSync(srcPath)) {
      console.warn('No existe:', srcPath);
      continue;
    }

    try {
      const result = await mammoth.convertToHtml({ path: srcPath });
      const bodyHtml = result.value; // HTML string
      const fullHtml = `<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>${f.title}</title>\n  <style>body{font-family:Arial,Helvetica,sans-serif;line-height:1.6;padding:20px;max-width:900px;margin:auto}</style>\n</head>\n<body>\n  <h1>${f.title}</h1>\n  ${bodyHtml}\n</body>\n</html>`;

      fs.writeFileSync(outPath, fullHtml, { encoding: 'utf8' });
      console.log('WROTE', outPath);
    } catch (err) {
      console.error('ERROR converting', srcPath, err);
    }
  }
}

convertAll();
