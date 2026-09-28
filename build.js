// Empaqueta la app en un solo HTML (dist/derrotero.html) listo para publicar como artefacto.
const fs = require('fs');
const r = (p) => fs.readFileSync(__dirname + '/' + p, 'utf8');
const seed = JSON.stringify(JSON.parse(r('data/seed.json'))).replace(/<\//g, '<\\/');
const js = ['src/logic.js', 'src/store.js', 'src/ui.js', 'src/app.js'].map(r).join('\n;\n').replace(/<\/script/gi, '<\\/script');
const html = r('src/shell.html')
  .replace('/*__CSS__*/', () => r('src/styles.css'))
  .replace('/*__SEED__*/', () => seed)
  .replace('/*__JS__*/', () => js);
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/derrotero.html', html);
// Versión para abrir en un navegador fuera del artefacto (pruebas): documento completo.
fs.writeFileSync(__dirname + '/dist/derrotero.local.html', '<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>');
console.log('dist/derrotero.html', (html.length / 1024).toFixed(1) + ' KB');
