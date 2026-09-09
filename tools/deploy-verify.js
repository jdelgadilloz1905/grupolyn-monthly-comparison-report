const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getContent } = require('./gas-api');
const estado = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'despliegue.json'), 'utf8'));

const sandbox = { console, UrlFetchApp: {}, ScriptApp: {} };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'Deployer.js'), 'utf8') +
  String.fromCharCode(10) + ';this.Deployer = Deployer;', sandbox);

const esperado = sandbox.Deployer.buildBootstrap({
  libraryScriptId: estado.library.scriptId,
  libraryVersion: estado.library.version,
  libraryIdentifier: estado.library.identifier,
});

let fallos = 0;
function comprobar(ok, texto) {
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + texto);
  if (!ok) fallos++;
}

(async () => {
  // 1. Lo desplegado coincide byte a byte con lo que genera el Deployer.
  for (const t of estado.targets) {
    const c = await getContent(t.scriptId);
    const boot = c.files.filter((f) => f.name === 'GrupoLynBootstrap')[0];
    console.log(t.name);
    comprobar(!!boot, 'el arranque existe en el servidor');
    comprobar(boot && boot.source === esperado, 'y coincide byte a byte con buildBootstrap()');

    const m = JSON.parse(c.files.filter((f) => f.name === 'appsscript')[0].source);
    comprobar((m.dependencies.libraries || []).length === 1, 'una sola dependencia, sin duplicar');
    comprobar(m.dependencies.libraries[0].libraryId === estado.library.scriptId,
      'apunta a la biblioteca correcta');
    comprobar((m.oauthScopes || []).length === sandbox.Deployer.REQUIRED_SCOPES.length,
      'declara los ' + sandbox.Deployer.REQUIRED_SCOPES.length + ' permisos');
    comprobar(c.files.length === 2, 'no se colo codigo de mas: solo manifiesto y arranque');
  }

  // 2. La biblioteca expone, como funciones sueltas, todo lo que el arranque llama.
  console.log('\nBiblioteca (v' + estado.library.version + ')');
  const lib = await getContent(estado.library.scriptId);
  const globales = lib.files
    .filter((f) => f.type === 'SERVER_JS')
    .map((f) => f.source).join('\n')
    .split('\n')
    .map((l) => { const g = l.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/); return g && g[1]; })
    .filter(Boolean);

  const re = /GrupoLynLib\.([A-Za-z_$][\w$]*)\s*\(/g;
  const invocadas = new Set();
  let m2; while ((m2 = re.exec(esperado)) !== null) invocadas.add(m2[1]);

  invocadas.forEach((n) => comprobar(globales.indexOf(n) !== -1,
    'expone ' + n + '() como funcion de nivel superior'));

  console.log('\n' + (fallos === 0 ? 'TODO CORRECTO' : fallos + ' COMPROBACIONES FALLIDAS'));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });
