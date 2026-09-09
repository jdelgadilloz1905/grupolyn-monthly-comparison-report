/**
 * Ejecuta el Deployer.js REAL —el mismo archivo que se entrega— contra los
 * destinos de despliegue.json.
 *
 * El unico postizo es el transporte: en Apps Script las llamadas son
 * UrlFetchApp, que es sincrono. Aqui se sustituye por curl, tambien sincrono,
 * para no tener que tocar ni una linea del Deployer. La logica que se prueba es
 * la de verdad, no una reescritura.
 *
 *   node run_deploy.js            -> simulacion, no escribe nada
 *   node run_deploy.js --escribir -> escribe de verdad
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { getToken } = require('./gas-api');

const ESTADO = path.join(__dirname, '..', 'despliegue.json');
const DEPLOYER = path.join(__dirname, '..', 'src', 'Deployer.js');

// ── Cortafuegos ───────────────────────────────────────────────────────────
// Ids que este script NO puede tocar bajo ninguna circunstancia.
const PROHIBIDOS = {
  '1qcQ_PYvuJQ5savWxxas8eN6zc7hSUD37SrF7uKmmViFcqcBQoytCg-rA':
    'GrupoLyN Report Engine — el script de la hoja ya entregada',
};

function transporteSincrono(token) {
  return function (url, params) {
    const args = ['-s', '-w', '\n%{http_code}', '-X', (params.method || 'get').toUpperCase(),
      '-H', 'Authorization: Bearer ' + token];
    let tmp = null;
    if (params.payload) {
      tmp = path.join(os.tmpdir(), 'gas-payload-' + Date.now() + '.json');
      fs.writeFileSync(tmp, params.payload, 'utf8');
      args.push('-H', 'Content-Type: application/json', '--data-binary', '@' + tmp);
    }
    args.push(url);
    try {
      const salida = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const corte = salida.lastIndexOf('\n');
      const cuerpo = salida.slice(0, corte);
      const codigo = parseInt(salida.slice(corte + 1).trim(), 10);
      return { getResponseCode: () => codigo, getContentText: () => cuerpo };
    } finally {
      if (tmp) { try { fs.unlinkSync(tmp); } catch (e) {} }
    }
  };
}

(async () => {
  const escribir = process.argv.indexOf('--escribir') !== -1;
  const estado = JSON.parse(fs.readFileSync(ESTADO, 'utf8'));

  // El cortafuegos se aplica ANTES de nada.
  estado.targets.forEach((t) => {
    if (PROHIBIDOS[t.scriptId]) {
      console.error('ABORTADO: el destino "' + t.name + '" apunta a ' + PROHIBIDOS[t.scriptId]);
      process.exit(1);
    }
    if (t.scriptId === estado.library.scriptId) {
      console.error('ABORTADO: el destino "' + t.name + '" es la propia biblioteca.');
      process.exit(1);
    }
  });

  const token = await getToken();
  const sandbox = {
    console,
    UrlFetchApp: { fetch: transporteSincrono(token) },
    ScriptApp: { getOAuthToken: () => token },
  };
  vm.createContext(sandbox);
  // `const Deployer = {...}` no se cuelga del objeto global, ni aqui ni en
  // Apps Script. Es la misma razon por la que la biblioteca expone funciones
  // sueltas y no objetos: hay que sacarlo explicitamente.
  const EXPORTAR = String.fromCharCode(10) + ';this.Deployer = Deployer;';
  vm.runInContext(fs.readFileSync(DEPLOYER, 'utf8') + EXPORTAR,
    sandbox, { filename: 'Deployer.js' });

  const opciones = {
    libraryScriptId: estado.library.scriptId,
    libraryVersion: estado.library.version,
    libraryIdentifier: estado.library.identifier,
    dryRun: !escribir,
  };

  console.log('=== DESPLIEGUE ' + (escribir ? '**REAL**' : '(simulacion)') + ' ===');
  console.log('biblioteca: ' + estado.library.scriptId + ' v' + estado.library.version);
  console.log('destinos:   ' + estado.targets.length);
  estado.targets.forEach((t) => console.log('   - ' + t.name + '  ' + t.scriptId));
  console.log('');

  const informe = sandbox.Deployer.deploy(estado.targets, opciones);

  console.log('dryRun:     ' + informe.dryRun);
  console.log('actualizados: ' + informe.updated.length);
  informe.updated.forEach((r) => {
    console.log('   ' + r.name + ': ' + (r.from || 'sin instalar') + ' -> ' + r.to +
      (r.changes ? '  [cambia: ' + r.changes.join(', ') + ']' : ''));
  });
  console.log('ya al dia:  ' + informe.upToDate.length);
  informe.upToDate.forEach((r) => console.log('   ' + r.name + ': ya en ' + r.from));
  console.log('fallidos:   ' + informe.failed.length);
  informe.failed.forEach((r) => console.log('   ' + r.name + ': ' + r.reason));

  process.exit(informe.failed.length ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });
