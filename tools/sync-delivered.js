/**
 * Sincroniza src/ con el script vinculado a la hoja entregada.
 *
 * Hace lo mismo que `clasp push`, contra la API de Apps Script. Existe porque
 * en la maquina de desarrollo clasp no esta instalado globalmente, y porque
 * asi el paso queda con simulacion por defecto y con verificacion posterior:
 * despues de escribir vuelve a leer del servidor y compara.
 *
 *   node tools/sync-delivered.js              -> informa de las diferencias
 *   node tools/sync-delivered.js --escribir   -> las aplica
 */
const fs = require('fs');
const path = require('path');
const { getContent, updateContent } = require('./gas-api');

const SRC = path.join(__dirname, '..', 'src');
const SCRIPT_ID = '1qcQ_PYvuJQ5savWxxas8eN6zc7hSUD37SrF7uKmmViFcqcBQoytCg-rA';

const locales = fs.readdirSync(SRC).sort().map((f) => {
  const ext = path.extname(f), base = path.basename(f, ext);
  const tipo = ext === '.js' ? 'SERVER_JS' : ext === '.html' ? 'HTML' : 'JSON';
  return { name: base, type: tipo, source: fs.readFileSync(path.join(SRC, f), 'utf8') };
});

(async () => {
  const remoto = await getContent(SCRIPT_ID);
  const porNombre = {};
  remoto.files.forEach((f) => { porNombre[f.name] = f; });

  console.log('remoto: ' + remoto.files.length + ' archivos | local: ' + locales.length);
  let cambios = 0;
  locales.forEach((l) => {
    const r = porNombre[l.name];
    if (!r) { console.log('  NUEVO      ' + l.name); cambios++; return; }
    if (r.source !== l.source) { console.log('  MODIFICADO ' + l.name); cambios++; }
  });
  const nombresLocales = locales.map((l) => l.name);
  remoto.files.forEach((r) => {
    if (nombresLocales.indexOf(r.name) === -1) { console.log('  SE BORRA   ' + r.name); cambios++; }
  });
  if (cambios === 0) { console.log('  sin cambios'); return; }

  if (process.argv.indexOf('--escribir') === -1) {
    console.log('\n(' + cambios + ' cambios; simulacion, no se ha escrito nada)');
    return;
  }
  await updateContent(SCRIPT_ID, locales);
  const vuelta = await getContent(SCRIPT_ID);
  const iguales = locales.every((l) => {
    const r = vuelta.files.filter((f) => f.name === l.name)[0];
    return r && r.source === l.source;
  });
  console.log('\nescrito. releido del servidor: ' + vuelta.files.length + ' archivos, ' +
    (iguales ? 'identicos a src/' : 'DIFERENCIAS — revisar'));
  process.exit(iguales ? 0 : 1);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });
