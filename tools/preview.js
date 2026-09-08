/**
 * preview.js — muestra la salida real que produce el sistema, sin tocar Google.
 * Uso: node tools/preview.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['Config.js', 'DeviationEngine.js', 'BudgetReader.js',
  'ReportSheet.js', 'EmailDraft.js', 'Fixtures.js'];

const source = FILES.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

const sandbox = { Logger: { log: () => {} }, console, __out: null };
vm.createContext(sandbox);

// Los `const` de nivel superior no se cuelgan del objeto global del contexto,
// así que exponemos lo que necesitamos de forma explícita.
vm.runInContext(source + '\n__out = { DeviationEngine, EmailDraft, ReportSheet, Fixtures };', sandbox);

const { DeviationEngine, EmailDraft, ReportSheet, Fixtures } = sandbox.__out;
const report = DeviationEngine.analyze(Fixtures.sampleModel(), { threshold: 15 });

console.log('\n═══════════ CORREO GENERADO ═══════════\n');
console.log(EmailDraft.buildBody(report, { clientName: 'Hi Ana' }));

console.log('\n═══════════ PESTAÑA DE REPORTE ═══════════\n');
const pad = (c) => String(c === '' || c === null || c === undefined ? '' : c).padEnd(14).slice(0, 14);
ReportSheet.buildRows(report).slice(2).forEach((r) => {
  console.log('  ' + r.map(pad).join('| '));
});
console.log('');
