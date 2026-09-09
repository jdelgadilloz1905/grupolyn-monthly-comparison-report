/**
 * Ejecuta la batería de tests de Apps Script en Node, sin subir nada.
 *
 * Apps Script comparte un único ámbito global entre todos los archivos del
 * proyecto. Node no. Este runner concatena los archivos y los evalúa en un
 * mismo contexto para reproducir ese comportamiento con fidelidad.
 *
 * Los servicios de Google (PropertiesService, CacheService, Utilities, Session,
 * SpreadsheetApp, GmailApp) se sustituyen por dobles con reloj controlable, para
 * poder probar caducidades sin esperar media hora.
 *
 * Uso:  node tools/run-tests-local.js
 * Sale con código 1 si algún assert falla, para poder encadenarlo en CI.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const gasFakes = require('./gas-fakes');

const SRC = path.join(__dirname, '..', 'src');

// Orden importante: las dependencias primero, igual que filePushOrder en clasp.
const FILES = [
  'Config.js',
  'DeviationEngine.js',
  'BudgetReader.js',
  'ReportSheet.js',
  'EmailDraft.js',
  'Auth.js',
  'Orchestrator.js',
  'Menu.js',
  'Deployer.js',
  'Fixtures.js',
  'Tests.js',
];

// GUARDA CONTRA EL FALSO VERDE:
// la lista de arriba está ordenada a mano porque el orden de carga importa, pero
// si alguien crea un archivo en src/ y olvida añadirlo, sus tests no se ejecutan
// y la suite sigue en verde sin probar nada. Eso es peor que un fallo.
const enDisco = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const olvidados = enDisco.filter((f) => FILES.indexOf(f) === -1);
const fantasmas = FILES.filter((f) => enDisco.indexOf(f) === -1);

if (olvidados.length > 0) {
  console.error('\n  ERROR: hay archivos en src/ que NO están en la lista del runner:');
  olvidados.forEach((f) => console.error('    - ' + f));
  console.error('  Sus tests no se ejecutarían. Añádelos a FILES en tools/run-tests-local.js\n');
  process.exit(1);
}
if (fantasmas.length > 0) {
  console.error('\n  ERROR: la lista del runner nombra archivos que ya no existen:');
  fantasmas.forEach((f) => console.error('    - ' + f));
  process.exit(1);
}

const source = FILES.map((f) => {
  const p = path.join(SRC, f);
  return `// ---- ${f} ----\n${fs.readFileSync(p, 'utf8')}`;
}).join('\n\n');

const fakes = gasFakes.build();
const sandbox = Object.assign({}, fakes.globals);
// El codigo fuente, para que los tests puedan comprobar propiedades del propio
// codigo: por ejemplo, que EmailDraft no contenga ninguna llamada de envio.
sandbox.__sources = {};
FILES.forEach((f) => { sandbox.__sources[f] = fs.readFileSync(path.join(SRC, f), 'utf8'); });
// Los tests necesitan manipular el reloj y espiar la auditoría.
sandbox.__gas = fakes.control;
vm.createContext(sandbox);

try {
  vm.runInContext(source, sandbox, { filename: 'gas-bundle.js' });
} catch (e) {
  console.error('Error cargando los archivos:', e.message);
  process.exit(1);
}

console.log('\n═══ Batería de tests ═══\n');
const summary = sandbox.runAllTests();

sandbox.__testResults.forEach((r) => {
  console.log(`  ${r.ok ? 'OK  ' : 'FALLA'}  ${r.name}${r.ok ? '' : '\n          ' + r.msg}`);
});

console.log(`\n  ${summary.passed}/${summary.total} asserts correctos\n`);

if (summary.failed > 0) {
  console.error(`  ${summary.failed} fallo(s).\n`);
  process.exit(1);
}
