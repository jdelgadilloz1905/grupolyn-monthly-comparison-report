/**
 * Tests.js — arnés de pruebas del proyecto.
 *
 * Se ejecuta de dos formas, con el mismo código:
 *  - En Apps Script: abrir el editor y ejecutar `runAllTests()`. Resultado en el log.
 *  - En local:       `node tools/run-tests-local.js`. Mucho más rápido para iterar.
 *
 * Los casos cubiertos salen de la tabla de casos límite de la skill
 * `budget-domain-model`, todos observados en los datos reales de la plantilla.
 */

/** Registro de resultados de la ejecución en curso. */
var __testResults = [];

/**
 * Serializa un valor SIN perder los casos especiales.
 *
 * POR QUÉ NO SE USA JSON.stringify: convierte Infinity, NaN y null todos en la
 * cadena "null". Como este proyecto se apoya precisamente en «nunca Infinity,
 * nunca NaN», un comparador basado en JSON sería ciego justo a lo que hay que
 * detectar: assertEquals(Infinity, null) pasaría en verde.
 *
 * @param {*} v
 * @returns {string}
 */
function repr(v) {
  if (v === null) return '<null>';
  if (v === undefined) return '<undefined>';

  const t = typeof v;

  if (t === 'number') {
    if (v !== v) return '<NaN>';                    // NaN no es igual a sí mismo
    if (v === Infinity) return '<Infinity>';
    if (v === -Infinity) return '<-Infinity>';
    if (v === 0 && 1 / v === -Infinity) return '<-0>';
    return 'num:' + v;
  }
  if (t === 'string') return 'str:' + v;
  if (t === 'boolean') return 'bool:' + v;
  if (t === 'function') return 'fn:' + (v.name || 'anon');

  if (Object.prototype.toString.call(v) === '[object Date]') {
    return 'date:' + v.getTime();
  }
  if (Array.isArray(v)) {
    return '[' + v.map(repr).join(',') + ']';
  }

  // Objeto: claves ordenadas para que el orden de declaración no afecte.
  const keys = Object.keys(v).sort();
  return '{' + keys.map(function (k) { return k + ':' + repr(v[k]); }).join(',') + '}';
}

/**
 * Compara dos valores distinguiendo NaN, Infinity, null y undefined.
 * @param {*} actual
 * @param {*} expected
 * @param {string} name
 */
function assertEquals(actual, expected, name) {
  const a = repr(actual);
  const e = repr(expected);
  __testResults.push({
    ok: a === e,
    name: name,
    msg: a === e ? '' : 'esperado ' + e + ', obtenido ' + a,
  });
}

/**
 * Comprueba que el comparador NO es ciego a los casos especiales.
 * Es un test del propio arnés: si esto falla, ningún otro test es de fiar.
 */
function test_elComparadorDistingueCasosEspeciales() {
  assertTrue(repr(Infinity) !== repr(null), 'Infinity se distingue de null');
  assertTrue(repr(NaN) !== repr(null), 'NaN se distingue de null');
  assertTrue(repr(undefined) !== repr(null), 'undefined se distingue de null');
  assertTrue(repr(NaN) !== repr(Infinity), 'NaN se distingue de Infinity');
  assertTrue(repr(1) !== repr('1'), 'el numero 1 se distingue de la cadena "1"');
  assertEquals(repr(NaN), '<NaN>', 'NaN tiene su propia representacion');
  assertEquals(repr([1, NaN, null]), '[num:1,<NaN>,<null>]',
    'dentro de un array tambien');
}

/**
 * Verifica una condición booleana.
 * @param {boolean} condition
 * @param {string} name
 */
function assertTrue(condition, name) {
  __testResults.push({
    ok: condition === true,
    name: name,
    msg: condition === true ? '' : 'se esperaba true, se obtuvo ' + JSON.stringify(condition),
  });
}

// ---------------------------------------------------------------------------
// Caso límite 1 — planned = 0 con actual != 0
// Forma tomada de la hoja: partida sin presupuestar pero con gasto real
// ---------------------------------------------------------------------------
function test_plannedCeroDevuelve100() {
  assertEquals(DeviationEngine.percent(1200, 0), 100,
    'planned=0 y actual>0 devuelve 100, no Infinity');
  assertTrue(DeviationEngine.percent(1200, 0) !== Infinity,
    'y explicitamente NO es Infinity');
  assertEquals(DeviationEngine.percent(-800, 0), 100,
    'planned=0 y actual<0 tambien devuelve 100');
  assertTrue(isFinite(DeviationEngine.percent(1200, 0)),
    'el resultado es finito');
}

// ---------------------------------------------------------------------------
// Caso límite 2 — planned = 0 y actual = 0 -> se omite
// ---------------------------------------------------------------------------
function test_partidaVaciaSeOmite() {
  assertEquals(DeviationEngine.percent(0, 0), null,
    'planned=0 y actual=0 devuelve null');

  const ranked = DeviationEngine.rankItems([
    { name: 'Vacia', planned: 0, actual: 0 },
    { name: 'Activa', planned: 100, actual: 150 },
  ]);
  assertEquals(ranked.map(function (i) { return i.name; }), ['Activa'],
    'las partidas vacias se descartan del ranking');
}

// ---------------------------------------------------------------------------
// Caso límite 3 — importes negativos son reembolsos válidos
// Forma tomada de la hoja: una partida con reembolso, importe real negativo
// ---------------------------------------------------------------------------
function test_importeNegativoEsReembolso() {
  const pct = DeviationEngine.percent(-300, 60);
  assertEquals(pct, -600, 'un reembolso de -300 sobre 60 previstos da -600 %');
  assertEquals(DeviationEngine.amount(-300, 60), -360,
    'la desviacion en importe es -360');
  assertEquals(DeviationEngine.status(-360), 'Under',
    'un reembolso queda por debajo de lo previsto');
}

// ---------------------------------------------------------------------------
// Caso límite 4 — desviaciones extremas siguen siendo finitas
// Forma tomada de la hoja: presupuesto simbólico y gasto real muy superior
// ---------------------------------------------------------------------------
function test_desviacionExtremaEsFinita() {
  const pct = DeviationEngine.percent(1000, 10);
  assertEquals(pct, 9900, 'gastar 1000 con 10 previstos da +9900 %');
  assertTrue(isFinite(pct), 'sigue siendo un numero finito');
  assertTrue(pct !== Infinity, 'y no es Infinity');
}

// ---------------------------------------------------------------------------
// Caso límite 5 — el orden es por IMPORTE, no por porcentaje
// Es la decisión de diseño central del motor.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Caso límite 7 — una partida que cuadra no es responsable de nada
// El reporte de referencia no lista partidas con desviación cero.
// ---------------------------------------------------------------------------
function test_partidaSinDesviacionNoSeLista() {
  const ranked = DeviationEngine.rankItems([
    { name: 'Alquiler', planned: 1500, actual: 0 },
    { name: 'Seguro Hogar', planned: 250, actual: 250 },   // desviacion 0
    { name: 'Basuras', planned: 30, actual: 30 },          // desviacion 0
    { name: 'Reparaciones', planned: 100, actual: 360 },
  ]);

  assertEquals(ranked.map(function (i) { return i.name; }),
    ['Alquiler', 'Reparaciones'],
    'las partidas que cuadran no aparecen como responsables');
  assertTrue(ranked.every(function (i) { return i.deviationAmount !== 0; }),
    'ninguna partida emitida tiene desviacion cero');
}

// ---------------------------------------------------------------------------
// Formatos: la asimetría de signos es intencionada, no un descuido
// ---------------------------------------------------------------------------
function test_formatosRespetanLaConvencionDelOriginal() {
  assertEquals(Config.NUMBER_FORMATS.deviationAmount, '+#,##0.00;-#,##0.00',
    'Deviation ($): los positivos llevan +');
  assertEquals(Config.NUMBER_FORMATS.deviationPct, '0.00%;-0.00%',
    'Deviation (%): los positivos NO llevan signo, como en el original');
}

function test_ordenPorImporteNoPorPorcentaje() {
  const ranked = DeviationEngine.rankItems([
    { name: 'Cafe', planned: 10, actual: 40 },        // +300 %, pero solo +$30
    { name: 'Vivienda', planned: 3000, actual: 3600 }, // +20 %, pero +600
  ]);
  assertEquals(ranked.map(function (i) { return i.name; }), ['Vivienda', 'Cafe'],
    'ordena por importe absoluto: Vivienda antes que Cafe');
}

// ---------------------------------------------------------------------------
// Caso límite 6 — el umbral filtra qué categorías se explican
// ---------------------------------------------------------------------------
function test_umbralDecideQueSeExplica() {
  const categoria = {
    name: 'Personal Care',
    kind: 'expense',
    planned: 1000,
    actual: 1600,
    items: [
      { name: 'Gimnasio', planned: 200, actual: 700 },
      { name: 'Tintoreria', planned: 150, actual: 300 },
      { name: 'Entrenador', planned: 100, actual: 50 },
    ],
  };

  const conUmbral15 = DeviationEngine.analyzeCategory(categoria, 15);
  assertTrue(conUmbral15.isSignificant, '+60 % supera el umbral del 15 %');
  assertEquals(conUmbral15.status, 'Over', 'se clasifica como Over');
  assertEquals(conUmbral15.drivers[0].name, 'Gimnasio',
    'el gimnasio es el principal responsable, por importe');

  const conUmbral80 = DeviationEngine.analyzeCategory(categoria, 80);
  assertTrue(!conUmbral80.isSignificant, '+60 % no supera un umbral del 80 %');
  assertEquals(conUmbral80.drivers, [],
    'sin desviacion significativa no se listan partidas');
}

// ---------------------------------------------------------------------------
// Extra — normalización de los formatos que entrega la hoja
// ---------------------------------------------------------------------------
function test_normalizaFormatosDeLaHoja() {
  assertEquals(DeviationEngine.amount('1,234.56', 0), 1234.56,
    'acepta separador de millares');
  assertEquals(DeviationEngine.amount('(1,234.56)', 0), -1234.56,
    'los parentesis significan negativo');
  assertEquals(DeviationEngine.amount('-', 0), 0,
    'el guion de la plantilla vale cero');
  assertEquals(DeviationEngine.amount('$1,500.00', 0), 1500,
    'acepta el simbolo de moneda');
}

// ---------------------------------------------------------------------------
// Extra — ingresos y gastos: el signo se calcula igual
// ---------------------------------------------------------------------------
function test_ingresoYGastoCompartenAritmetica() {
  const ingreso = DeviationEngine.analyzeCategory(
    { name: 'Person 1', kind: 'income', planned: 5000, actual: 500, items: [] }, 15);
  const gasto = DeviationEngine.analyzeCategory(
    { name: 'Shelter', kind: 'expense', planned: 2000, actual: 460, items: [] }, 15);

  assertEquals(ingreso.status, 'Under', 'ingreso por debajo -> Under');
  assertEquals(gasto.status, 'Under', 'gasto por debajo -> Under');
  assertEquals(ingreso.kind, 'income', 'conserva el tipo para que el texto lo interprete');
  assertEquals(gasto.kind, 'expense', 'conserva el tipo');
}

// ===========================================================================
// BudgetReader — T-03
// ===========================================================================

/** Atajo: devuelve la categoría con ese nombre dentro del modelo. */
function _cat(model, name) {
  return model.categories.filter(function (c) { return c.name === name; })[0];
}

// --- Criterio 1: localiza por etiqueta, no por coordenada ------------------
function test_lectorEncuentraCategoriasPorEtiqueta() {
  const model = BudgetReader.parse(Fixtures.monthlyBudget());
  const shelter = _cat(model, 'Shelter');

  assertTrue(!!shelter, 'encuentra la categoria Shelter');
  assertEquals(shelter.planned, 2000, 'toma el Budget de la fila "Total Shelter"');
  assertEquals(shelter.actual, 460, 'toma el Actual de la fila "Total Shelter"');
}

function test_lectorResisteFilasInsertadasArriba() {
  const base = BudgetReader.parse(Fixtures.monthlyBudget());
  const movido = BudgetReader.parse(Fixtures.monthlyBudgetShiftedDown(5));

  assertTrue(movido.headerRow !== base.headerRow, 'la cabecera cambio de fila');
  assertEquals(
    movido.categories.map(function (c) { return c.name; }),
    base.categories.map(function (c) { return c.name; }),
    'insertar 5 filas arriba no altera el resultado'
  );
}

function test_lectorResisteColumnasInsertadasIzquierda() {
  const base = BudgetReader.parse(Fixtures.monthlyBudget());
  const movido = BudgetReader.parse(Fixtures.monthlyBudgetShiftedRight(2));

  assertEquals(
    movido.categories.map(function (c) { return c.name; }),
    base.categories.map(function (c) { return c.name; }),
    'insertar 2 columnas a la izquierda no altera la jerarquia'
  );
  assertEquals(_cat(movido, 'Shelter').actual, 460, 'los importes siguen bien');
}

// --- Criterio 2: descarta las filas marcadas Hide --------------------------
function test_lectorDescartaFilasOcultas() {
  const model = BudgetReader.parse(Fixtures.monthlyBudget());
  const shelter = _cat(model, 'Shelter');
  const nombres = shelter.items.map(function (i) { return i.name; });

  assertEquals(nombres, ['Alquiler', 'Jardinería', 'Reparaciones', 'Seguro Hogar'],
    'Impuesto Municipal se descarta por estar marcada Hide');
  assertTrue(nombres.indexOf('Impuesto Municipal') === -1,
    'la partida oculta no aparece');
}

// --- Criterio 4: descubre categorías no previstas --------------------------
function test_lectorDescubreCategoriasNuevas() {
  const model = BudgetReader.parse(Fixtures.monthlyBudgetWithNewCategory('Cripto'));
  const nueva = _cat(model, 'Cripto');

  assertTrue(!!nueva, 'encuentra una categoria que el codigo no conocia');
  assertEquals(nueva.actual, 250, 'con sus importes correctos');
}

// --- Semántica ingreso/gasto ----------------------------------------------
function test_lectorDistingueIngresoDeGasto() {
  const model = BudgetReader.parse(Fixtures.monthlyBudget());
  assertEquals(_cat(model, 'Person 1').kind, 'income',
    'Person 1 cuelga de Income -> income');
  assertEquals(_cat(model, 'Shelter').kind, 'expense',
    'Shelter cuelga de Expenses -> expense');
}

// --- Integración lector + motor -------------------------------------------
function test_lectorAlimentaAlMotor() {
  const model = BudgetReader.parse(Fixtures.monthlyBudget());
  const report = DeviationEngine.analyze(model, { threshold: 15 });
  const pc = report.categories.filter(function (c) { return c.name === 'Personal Care'; })[0];

  assertEquals(pc.deviationAmount, 600, 'Personal Care se desvia +600');
  assertEquals(pc.deviationPct, 60, 'lo que equivale a +60 %');
  assertEquals(pc.status, 'Over', 'clasificada como Over');
  assertEquals(pc.drivers[0].name, 'Gimnasio',
    'el gimnasio es el principal responsable, por importe');
}

// ===========================================================================
// ReportSheet — T-07
// ===========================================================================

function _sampleReport() {
  return DeviationEngine.analyze(Fixtures.sampleModel(), { threshold: 15 });
}

function test_reporteUsaLaCabeceraDeReferencia() {
  const rows = ReportSheet.buildRows(_sampleReport());
  assertEquals(rows[2],
    ['Category', 'Item Description', 'Actual', 'Planned', 'Deviation ($)', 'Deviation (%)', 'Status'],
    'la cabecera coincide con la de los reportes del libro');
  assertEquals(rows[2][2], 'Actual', 'Actual va ANTES que Planned, como en el original');
}

function test_reporteCategoriaLlevaStatusYPartidasNo() {
  const rows = ReportSheet.buildRows(_sampleReport());
  const catRow = rows[3];
  const itemRow = rows[4];

  assertEquals(catRow[0], 'Shelter', 'la fila de categoria lleva el nombre en la col 1');
  assertTrue(catRow[6] === 'Over' || catRow[6] === 'Under', 'la categoria lleva Status');
  assertEquals(itemRow[0], '', 'la partida deja vacia la columna de categoria');
  assertEquals(itemRow[6], '', 'la partida NO lleva Status');
}

function test_reporteInsertaFilaEnBlancoEntreCategorias() {
  const rows = ReportSheet.buildRows(_sampleReport());
  const vacias = rows.filter(function (r) {
    return r.join('') === '';
  });
  assertTrue(vacias.length >= 3, 'hay una fila en blanco por cada categoria');
}

function test_nombreDePestanaSigueLaConvencionDelCliente() {
  assertEquals(Config.reportSheetName('Apr', 2025), 'Apr Budget Comparison',
    'sigue la convencion real del libro, no una inventada');
  assertEquals(Config.reportSheetName('Mar', 2025), 'Mar Budget Comparison',
    'la convencion no incluye el ano');
}

function test_pestanasDeReferenciaEstanProtegidas() {
  assertTrue(Config.isReferenceSheet('Apr Budget Comparison'),
    'Apr Budget Comparison esta marcada como referencia');
  assertTrue(Config.isReferenceSheet('Jun Budget Comparison'),
    'Jun Budget Comparison tambien');
  assertTrue(!Config.isReferenceSheet('Mar Budget Comparison'),
    'un mes sin reporte previo no esta protegido');
  assertTrue(!Config.isReferenceSheet('Monthly Budget'),
    'la pestana de origen no es una de referencia');
}

function test_reporteSoloDetallaCategoriasDesviadas() {
  const dentroDeUmbral = DeviationEngine.analyze({
    month: 'Jan', year: 2025,
    categories: [{ name: 'Estable', kind: 'expense', planned: 1000, actual: 1010,
      items: [{ name: 'Algo', planned: 500, actual: 510 }] }],
  }, { threshold: 15 });

  const rows = ReportSheet.buildRows(dentroDeUmbral);
  // preambulo(2) + cabecera(1) + categoria(1) + blanco(1) = 5
  assertEquals(rows.length, 5, 'sin desviacion no se listan partidas');
}

// ===========================================================================
// EmailDraft — T-08
// ===========================================================================

function test_correoExplicaLaCausaNoSoloLaCifra() {
  const body = EmailDraft.buildBody(_sampleReport(), { clientName: 'Hi Ana' });
  assertTrue(body.indexOf('Gimnasio') !== -1, 'nombra al responsable principal');
  assertTrue(body.indexOf('main driver') !== -1, 'explica la causa, no solo enumera');
  assertTrue(body.indexOf('700.00') !== -1, 'incluye el importe del responsable');
  assertTrue(body.indexOf('accounts for') !== -1,
    'cuantifica cuanto pesa el responsable sobre el total');
}

function test_correoDistingueIngresoDeGasto() {
  const body = EmailDraft.buildBody(_sampleReport());
  assertTrue(body.indexOf('You received') !== -1,
    'para ingresos usa lenguaje de ingreso');
  assertTrue(body.indexOf('You spent') !== -1,
    'para gastos usa lenguaje de gasto');
  assertTrue(body.indexOf('over budget') !== -1 && body.indexOf('below plan') !== -1,
    'y la lectura se invierte: over budget para gasto, below plan para ingreso');
}

function test_correoAvisaDelAhorroEnganoso() {
  const body = EmailDraft.buildBody(_sampleReport());
  assertTrue(body.indexOf('Alquiler') !== -1,
    'menciona el alquiler no cargado');
  assertTrue(body.indexOf('timing difference') !== -1,
    'advierte de que no es un ahorro real sino un cargo pendiente');
  assertTrue(body.indexOf('expect it to come back') !== -1,
    'y de que volvera a aparecer');
}

function test_correoSinDesviacionesLoDiceClaro() {
  const estable = DeviationEngine.analyze({
    month: 'Jan', year: 2025,
    categories: [{ name: 'Estable', kind: 'expense', planned: 1000, actual: 1010, items: [] }],
  }, { threshold: 15 });

  const body = EmailDraft.buildBody(estable);
  assertTrue(body.indexOf('within plan') !== -1,
    'informa de que no hay desviaciones en vez de mandar un correo vacio');
}

function test_correoIgnoraRuidoDePocoImporte() {
  const ruido = DeviationEngine.analyze({
    month: 'Jan', year: 2025,
    categories: [{ name: 'Cafe', kind: 'expense', planned: 10, actual: 40,
      items: [{ name: 'Cafe', planned: 10, actual: 40 }] }],
  }, { threshold: 15 });

  const body = EmailDraft.buildBody(ruido);
  assertTrue(body.indexOf('within plan') !== -1,
    '+300 % sobre 10 son 30: no merece parrafo propio');
}

// ===========================================================================
// Auth — T-04
// Estos tests solo corren en local: necesitan el reloj controlable de los dobles.
// ===========================================================================

/** ¿Estamos en el runner local, con dobles instrumentados? */
function _tieneDobles() {
  return typeof __gas !== 'undefined' && __gas && __gas.control !== null;
}

const CODIGO_PRUEBA = 'GrupoLyN2026!';

// --- Criterio 2: guarda hash, nunca texto plano ---------------------------
function test_authGuardaHashNoTextoPlano() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  const guardado = PropertiesService.getScriptProperties().getProperty(Auth.PROP_HASH);

  assertTrue(guardado !== CODIGO_PRUEBA, 'lo almacenado NO es la contrasena');
  assertTrue(guardado.indexOf(CODIGO_PRUEBA) === -1, 'no la contiene ni como fragmento');
  assertEquals(guardado.length, 44, 'es un SHA-256 en base64 (44 caracteres)');

  const props = PropertiesService.getScriptProperties().getProperties();
  const todos = Object.keys(props).map(function (k) { return props[k]; }).join('|');
  assertTrue(todos.indexOf(CODIGO_PRUEBA) === -1,
    'la contrasena no aparece en NINGUNA propiedad');
}

function test_authRechazaCodigosCortos() {
  if (!_tieneDobles()) return;
  __gas.reset();

  let lanzo = false;
  try { Auth.setupAdminCode('corto'); } catch (e) { lanzo = true; }
  assertTrue(lanzo, 'rechaza un codigo de menos de 8 caracteres');
}

function test_authSinConfigurarNoAbre() {
  if (!_tieneDobles()) return;
  __gas.reset();

  const r = Auth.unlock('loquesea');
  assertTrue(!r.ok, 'sin configurar, no abre');
  assertTrue(!Auth.isSessionValid(), 'y no deja sesion');
}

// --- Criterio 3: la sesión caduca a los 30 minutos ------------------------
function test_authSesionCaducaALos30Minutos() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  assertTrue(Auth.unlock(CODIGO_PRUEBA).ok, 'el codigo correcto abre sesion');
  assertTrue(Auth.isSessionValid(), 'la sesion esta viva');

  __gas.advanceMinutes(29);
  assertTrue(Auth.isSessionValid(), 'a los 29 minutos sigue viva');

  __gas.advanceMinutes(2);
  assertTrue(!Auth.isSessionValid(), 'a los 31 minutos ha caducado');
}

function test_authRequireSessionProtegeAunqueNoSeUseElMenu() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  let lanzo = false;
  try { Auth.requireSession(); } catch (e) { lanzo = true; }
  assertTrue(lanzo, 'sin sesion, requireSession lanza error');

  Auth.unlock(CODIGO_PRUEBA);
  assertTrue(Auth.requireSession(), 'con sesion, deja pasar');
}

// --- Criterio 4: bloqueo tras 5 intentos ---------------------------------
function test_authBloqueaTras5Intentos() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  for (let i = 0; i < 5; i++) Auth.unlock('incorrecto');

  assertTrue(Auth.isLockedOut(), 'tras 5 fallos queda bloqueado');

  const r = Auth.unlock(CODIGO_PRUEBA);
  assertTrue(!r.ok, 'ni siquiera el codigo CORRECTO abre estando bloqueado');
  assertTrue(!Auth.isSessionValid(), 'y no hay sesion');

  __gas.advanceMinutes(16);
  assertTrue(!Auth.isLockedOut(), 'a los 16 minutos se levanta el bloqueo');
  assertTrue(Auth.unlock(CODIGO_PRUEBA).ok, 'y vuelve a funcionar');
}

function test_authMensajeDeErrorEsGenerico() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  const r = Auth.unlock('incorrecto');
  assertEquals(r.message, 'Incorrect code.',
    'no revela intentos restantes ni el motivo real');
}

// --- Criterio 5: cada intento queda auditado ------------------------------
function test_authAuditaExitosYFallos() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA);
  Auth.unlock('incorrecto');
  Auth.unlock(CODIGO_PRUEBA);

  // La primera fila de la hoja es la cabecera, no un intento: se descarta.
  const log = __gas.auditLog.filter(function (r) { return r[0] instanceof Date; });

  assertEquals(log.length, 2, 'quedan registrados los dos intentos');
  assertEquals(log[0][3], 'FAILED', 'el primero como fallo');
  assertEquals(log[1][3], 'OK', 'el segundo como exito');
  assertTrue(String(log[1][1]).indexOf('@') !== -1, 'registra el usuario');
  assertEquals(__gas.auditLog[0][0], 'Timestamp',
    'la hoja de auditoria lleva cabecera, para que sea legible');
}

// --- Lista blanca ---------------------------------------------------------
function test_authListaBlancaBloqueaAOtrosUsuarios() {
  if (!_tieneDobles()) return;
  __gas.reset();

  Auth.setupAdminCode(CODIGO_PRUEBA, ['consultor@grupolyn.com']);
  __gas.setUserEmail('intruso@ejemplo.com');

  const r = Auth.unlock(CODIGO_PRUEBA);
  assertTrue(!r.ok, 'el codigo correcto NO basta si el usuario no esta autorizado');
  assertEquals(r.message, 'Incorrect code.',
    'el mensaje no delata que el problema sea el usuario');

  __gas.setUserEmail('consultor@grupolyn.com');
  assertTrue(Auth.unlock(CODIGO_PRUEBA).ok, 'el usuario autorizado si entra');
}

// ===========================================================================
// Menu y Orchestrator — T-06 / T-09
// ===========================================================================

// --- T-06 criterio 3: toda funcion de admin revalida la sesion -------------
function test_funcionesDeAdminRevalidanLaSesion() {
  if (!_tieneDobles()) return;
  __gas.reset();
  Auth.setupAdminCode(CODIGO_PRUEBA);

  let lanzoDialogo = false;
  try { Orchestrator.showReportDialog(); } catch (e) { lanzoDialogo = true; }
  assertTrue(lanzoDialogo, 'showReportDialog exige sesion aunque se invoque directo');

  let lanzoGenerar = false;
  try { Orchestrator.generateReport({}); } catch (e) { lanzoGenerar = true; }
  assertTrue(lanzoGenerar, 'generateReport exige sesion aunque se invoque directo');
}

function test_sesionCaducadaBloqueaLaGeneracion() {
  if (!_tieneDobles()) return;
  __gas.reset();
  Auth.setupAdminCode(CODIGO_PRUEBA);
  Auth.unlock(CODIGO_PRUEBA);

  __gas.advanceMinutes(31);

  let lanzo = false;
  try { Orchestrator.generateReport({}); } catch (e) { lanzo = true; }
  assertTrue(lanzo, 'pasados los 30 minutos, ya no genera');
}

function test_puenteDevuelveErrorEnVezDeRomper() {
  if (!_tieneDobles()) return;
  __gas.reset();
  Auth.setupAdminCode(CODIGO_PRUEBA);

  // Sin sesion: el puente debe devolver {ok:false}, no propagar la excepcion
  // al dialogo, que solo sabria mostrar un error generico.
  const r = runReportGeneration({});
  assertTrue(!r.ok, 'devuelve ok:false');
  assertTrue(r.message.indexOf('Unlock the Admin menu') !== -1,
    'con un mensaje que dice que hacer');
}

// --- T-09 criterio 1: el mes por defecto sale del selector de la hoja ------
function test_lectorExtraeElPeriodoDelSelector() {
  const model = BudgetReader.parse(Fixtures.monthlyBudget());
  assertEquals(model.month, 'Jan', 'toma el mes del selector de la hoja');
  assertEquals(model.year, 2025, 'y el ano');
}

// ===========================================================================
// Deployer — T-11 (solo la lógica pura; las llamadas de red no se simulan)
// ===========================================================================

const OPTS_DESPLIEGUE = {
  libraryScriptId: 'LIB-SCRIPT-ID-DE-PRUEBA',
  libraryVersion: 3,
  libraryIdentifier: 'GrupoLynLib',
};

function test_despliegueVinculaLaBibliotecaEnElManifiesto() {
  const original = JSON.stringify({ timeZone: 'America/New_York', runtimeVersion: 'V8' });
  const salida = JSON.parse(Deployer.mergeManifest(original, OPTS_DESPLIEGUE));

  assertEquals(salida.dependencies.libraries.length, 1, 'anade una biblioteca');
  assertEquals(salida.dependencies.libraries[0].libraryId, 'LIB-SCRIPT-ID-DE-PRUEBA',
    'con el id correcto');
  assertEquals(salida.dependencies.libraries[0].userSymbol, 'GrupoLynLib',
    'y el simbolo con el que se invoca');
}

function test_despliegueNoPisaOtrasBibliotecasDelCliente() {
  const original = JSON.stringify({
    timeZone: 'America/New_York',
    dependencies: { libraries: [{ userSymbol: 'OtraLib', libraryId: 'OTRO-ID', version: '1' }] },
  });
  const salida = JSON.parse(Deployer.mergeManifest(original, OPTS_DESPLIEGUE));

  assertEquals(salida.dependencies.libraries.length, 2,
    'conserva la biblioteca que el cliente ya tenia');
  assertEquals(salida.dependencies.libraries[0].userSymbol, 'OtraLib',
    'y no la altera');
}

function test_despliegueEsIdempotenteEnElManifiesto() {
  const uno = Deployer.mergeManifest(JSON.stringify({ timeZone: 'X' }), OPTS_DESPLIEGUE);
  const dos = Deployer.mergeManifest(uno, OPTS_DESPLIEGUE);
  const tres = Deployer.mergeManifest(dos, OPTS_DESPLIEGUE);

  assertEquals(dos, tres, 'aplicarlo varias veces no cambia nada mas');
  assertEquals(JSON.parse(tres).dependencies.libraries.length, 1,
    'y NO duplica la dependencia');
}

function test_despliegueDetectaLaVersionYaInstalada() {
  const sinDesplegar = [{ name: 'Code', type: 'SERVER_JS', source: 'function foo(){}' }];
  assertEquals(Deployer.installedVersion(sinDesplegar), null,
    'un cliente virgen no tiene version');

  const conBootstrap = [
    { name: 'Code', type: 'SERVER_JS', source: 'function foo(){}' },
    { name: Deployer.BOOTSTRAP_FILE, type: 'SERVER_JS',
      source: Deployer.buildBootstrap(OPTS_DESPLIEGUE) },
  ];
  assertEquals(Deployer.installedVersion(conBootstrap), Deployer.BOOTSTRAP_VERSION,
    'tras desplegar, la marca de version es legible');
}

function test_despliegueRespetaElCodigoDelCliente() {
  const existentes = [
    { name: 'appsscript', type: 'JSON', source: JSON.stringify({ timeZone: 'X' }) },
    { name: 'CodigoDelCliente', type: 'SERVER_JS', source: 'function suyo(){ return 42; }' },
  ];
  const salida = Deployer.buildFiles(existentes, OPTS_DESPLIEGUE);
  const suyo = salida.filter(function (f) { return f.name === 'CodigoDelCliente'; })[0];

  assertTrue(!!suyo, 'el archivo del cliente sigue ahi');
  assertEquals(suyo.source, 'function suyo(){ return 42; }', 'intacto');
  assertEquals(suyo._changed, false, 'y marcado como no modificado');

  const nombres = salida.map(function (f) { return f.name; });
  assertTrue(nombres.indexOf(Deployer.BOOTSTRAP_FILE) !== -1,
    'y se anadio el archivo de arranque');
}

function test_despliegueExigeElIdDeLaBiblioteca() {
  let lanzo = false;
  try { Deployer.deploy([], {}); } catch (e) { lanzo = true; }
  assertTrue(lanzo, 'sin libraryScriptId se niega a hacer nada');
}

function test_despliegueRechazaEntradasSinScriptId() {
  // Refleja la limitacion documentada: de una URL de hoja no se puede sacar el scriptId.
  const r = Deployer.deploy([{ name: 'Cliente A' }], {
    libraryScriptId: 'X', dryRun: true,
  });
  assertEquals(r.failed.length, 1, 'la entrada sin scriptId falla');
  assertEquals(r.updated.length, 0, 'y no se despliega nada');
  assertTrue(r.failed[0].reason.indexOf('scriptId') !== -1,
    'con un motivo que lo explica');
}

function test_despliegueAislaLosFallos() {
  const r = Deployer.deploy(
    [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    { libraryScriptId: 'X', dryRun: true }
  );
  assertEquals(r.failed.length, 3,
    'los tres fallan, pero se procesan los tres: uno malo no aborta el lote');
}

function test_despliegueEsDryRunPorDefecto() {
  const r = Deployer.deploy([], { libraryScriptId: 'X' });
  assertEquals(r.dryRun, true, 'sin decir nada, NO escribe');

  const explicito = Deployer.deploy([], { libraryScriptId: 'X', dryRun: false });
  assertEquals(explicito.dryRun, false, 'escribir exige pedirlo expresamente');
}


// --- El periodo lo manda la hoja, no el dialogo ----------------------------
function test_periodoDistintoAlDeLaHojaSeRechaza() {
  if (!_tieneDobles()) return;
  __gas.reset();
  Auth.setupAdminCode(CODIGO_PRUEBA);
  Auth.unlock(CODIGO_PRUEBA);

  // La hoja simulada no existe, asi que generateReport fallara al leerla.
  // Lo que se comprueba aqui es el guardarrail puro, sin tocar la hoja.
  const model = { month: 'Jan', year: 2025 };

  let lanzoMes = false;
  try { Orchestrator._assertPeriodoCoincide({ month: 'Feb' }, model); } catch (e) { lanzoMes = true; }
  assertTrue(lanzoMes, 'pedir Feb con la hoja en Jan se rechaza');

  let lanzoAno = false;
  try { Orchestrator._assertPeriodoCoincide({ year: 2024 }, model); } catch (e) { lanzoAno = true; }
  assertTrue(lanzoAno, 'pedir 2024 con la hoja en 2025 se rechaza');
}

function test_periodoCoincidenteSeAcepta() {
  const model = { month: 'Jan', year: 2025 };
  let lanzo = false;
  try {
    Orchestrator._assertPeriodoCoincide({ month: 'Jan', year: 2025 }, model);
    Orchestrator._assertPeriodoCoincide({ month: ' jan ', year: '2025' }, model);
    Orchestrator._assertPeriodoCoincide({}, model);
  } catch (e) { lanzo = true; }
  assertTrue(!lanzo, 'coincidir (aunque sea con espacios o mayusculas) se acepta');
}

function test_elErrorDePeriodoExplicaQueHacer() {
  const model = { month: 'Apr', year: 2025 };
  let msg = '';
  try { Orchestrator._assertPeriodoCoincide({ month: 'Feb' }, model); } catch (e) { msg = e.message; }

  assertTrue(msg.indexOf('sheet selector') !== -1,
    'dice donde se cambia el mes');
  assertTrue(msg.indexOf('Apr') !== -1 && msg.indexOf('Feb') !== -1,
    'nombra los dos periodos para que se vea el desajuste');
}


// --- Una categoria sin movimiento no se lista -----------------------------
function test_categoriaSinMovimientoSeOmite() {
  const rep = DeviationEngine.analyze({
    month: 'Mar', year: 2025,
    categories: [
      { name: 'Capital Expenses', kind: 'expense', planned: 0, actual: 0, items: [] },
      { name: 'Shelter', kind: 'expense', planned: 2000, actual: 460, items: [] },
      { name: 'Pendiente', kind: 'expense', planned: 1500, actual: 0, items: [] },
    ],
  }, { threshold: 15 });

  const nombres = rep.categories.map(function (c) { return c.name; });
  assertEquals(nombres, ['Shelter', 'Pendiente'],
    'la categoria 0/0 se omite; la que tiene presupuesto sin gasto se conserva');
}


// --- El enunciado pide una linea de explicacion en texto ------------------
function test_reporteIncluyeLineaDeExplicacion() {
  const rows = ReportSheet.buildRows(_sampleReport());
  const textos = rows.filter(function (r) {
    return r[0] === '' && r[1] !== '' && r[2] === '';
  }).map(function (r) { return r[1]; });

  assertTrue(textos.length > 0, 'hay al menos una linea de explicacion');
  assertTrue(textos.join(' ').indexOf('over budget by') !== -1,
    'usa el formato del ejemplo del enunciado: "is over budget by X%"');
}

function test_explicacionDistingueIngresoDeGasto() {
  const gastoOver = ReportSheet.explanationLine(
    { name: 'Shelter', kind: 'expense', deviationAmount: 600, deviationPct: 60 });
  const gastoUnder = ReportSheet.explanationLine(
    { name: 'Shelter', kind: 'expense', deviationAmount: -600, deviationPct: -60 });
  const ingresoBajo = ReportSheet.explanationLine(
    { name: 'Person 1', kind: 'income', deviationAmount: -4500, deviationPct: -90 });

  assertTrue(gastoOver.indexOf('over budget') !== -1, 'gasto de mas -> over budget');
  assertTrue(gastoUnder.indexOf('under budget') !== -1, 'gasto de menos -> under budget');
  assertTrue(ingresoBajo.indexOf('under plan') !== -1,
    'ingreso por debajo -> under plan, no under budget');
}

function test_explicacionLlevaImporteYPorcentaje() {
  const linea = ReportSheet.explanationLine(
    { name: 'Personal Care', kind: 'expense', deviationAmount: 600, deviationPct: 60 });
  assertEquals(linea, 'Personal Care is over budget by 60% ($600.00 more than planned).',
    'formato exacto de la frase');
}


// --- Todo lo que ve el cliente, en el mismo idioma que su libro ------------
function test_correoNoMezclaIdiomas() {
  const body = EmailDraft.buildBody(_sampleReport(), { clientName: 'Hi Ana' });
  const castellano = ['Gastaste', 'Ingresaste', 'previsto', 'motivo principal',
    'desfase', 'Ojo:', 'disposicion'];

  castellano.forEach(function (palabra) {
    assertTrue(body.indexOf(palabra) === -1,
      'el correo no contiene "' + palabra + '" (debe ir en ingles, como la hoja)');
  });
}


// --- Una partida puede desviarse mas que su propia categoria ---------------
function test_correoNoDiceQueAlgoExplicaMasDel100() {
  // Shelter se desvia +722.90 en total, pero Landscaping solo se paso +907.84:
  // otras partidas quedaron por debajo y compensaron. 907.84/722.90 = 126 %.
  const rep = DeviationEngine.analyze({
    month: 'Mar', year: 2025,
    categories: [{
      name: 'Shelter', kind: 'expense', planned: 4209.94, actual: 4932.84,
      items: [
        { name: 'Landscaping', planned: 200, actual: 1107.84 },
        { name: 'Jewlery Insurance', planned: 145, actual: 0 },
        { name: 'Home Repairs', planned: 250, actual: 192.05 },
      ],
    }],
  }, { threshold: 15 });

  const body = EmailDraft.buildBody(rep);

  assertTrue(body.indexOf('126%') === -1,
    'no afirma que una partida explique el 126 % de la diferencia');
  assertTrue(!/accounts for 1[0-9][0-9]%/.test(body),
    'ningun porcentaje de responsabilidad por encima de 100');
  assertTrue(body.indexOf('more than the whole gap') !== -1,
    'lo explica en palabras: se paso mas que el hueco entero');
  assertTrue(body.indexOf('offset part of it') !== -1,
    'y aclara que otras partidas lo compensaron');
}


// --- "Also above plan" solo para las que estan por encima -----------------
function test_correoNoLlamaAboveALoQueEstaBelow() {
  const rep = DeviationEngine.analyze({
    month: 'Mar', year: 2025,
    categories: [{
      name: 'Shelter', kind: 'expense', planned: 4209.94, actual: 4932.84,
      items: [
        { name: 'Landscaping', planned: 200, actual: 1107.84 },   // +907.84
        { name: 'Seguro', planned: 145, actual: 0 },              // -145, contrario
        { name: 'Reparaciones', planned: 250, actual: 192.05 },   // -57.95, contrario
        { name: 'Basuras', planned: 30, actual: 200 },            // +170, misma direccion
      ],
    }],
  }, { threshold: 15 });

  const body = EmailDraft.buildBody(rep);
  const tramo = body.substring(body.indexOf('Also'));

  assertTrue(body.indexOf('Also above plan') !== -1, 'lista otras partidas al alza');
  assertTrue(tramo.indexOf('Seguro') === -1,
    'no llama "above plan" a una partida que quedo por debajo');
  assertTrue(tramo.indexOf('Reparaciones') === -1,
    'ni a otra que tambien quedo por debajo');
  assertTrue(tramo.indexOf('Basuras') !== -1,
    'si incluye la que empuja en la misma direccion');
}

/**
 * Ejecuta toda la batería. Punto de entrada tanto en Apps Script como en local.
 * @returns {{total: number, passed: number, failed: number, failures: Array}}
 */
function runAllTests() {
  __testResults = [];

  // El arnes se valida a si mismo primero
  test_elComparadorDistingueCasosEspeciales();

  // DeviationEngine — T-01 / T-02
  test_plannedCeroDevuelve100();
  test_partidaVaciaSeOmite();
  test_importeNegativoEsReembolso();
  test_desviacionExtremaEsFinita();
  test_partidaSinDesviacionNoSeLista();
  test_formatosRespetanLaConvencionDelOriginal();
  test_categoriaSinMovimientoSeOmite();
  test_ordenPorImporteNoPorPorcentaje();
  test_umbralDecideQueSeExplica();
  test_normalizaFormatosDeLaHoja();
  test_ingresoYGastoCompartenAritmetica();

  // BudgetReader — T-03
  test_lectorEncuentraCategoriasPorEtiqueta();
  test_lectorResisteFilasInsertadasArriba();
  test_lectorResisteColumnasInsertadasIzquierda();
  test_lectorDescartaFilasOcultas();
  test_lectorDescubreCategoriasNuevas();
  test_lectorDistingueIngresoDeGasto();
  test_lectorAlimentaAlMotor();

  // ReportSheet — T-07
  test_reporteUsaLaCabeceraDeReferencia();
  test_nombreDePestanaSigueLaConvencionDelCliente();
  test_pestanasDeReferenciaEstanProtegidas();
  test_reporteCategoriaLlevaStatusYPartidasNo();
  test_reporteInsertaFilaEnBlancoEntreCategorias();
  test_reporteSoloDetallaCategoriasDesviadas();
  test_reporteIncluyeLineaDeExplicacion();
  test_explicacionDistingueIngresoDeGasto();
  test_explicacionLlevaImporteYPorcentaje();

  // EmailDraft — T-08
  test_correoExplicaLaCausaNoSoloLaCifra();
  test_correoDistingueIngresoDeGasto();
  test_correoAvisaDelAhorroEnganoso();
  test_correoSinDesviacionesLoDiceClaro();
  test_correoIgnoraRuidoDePocoImporte();
  test_correoNoMezclaIdiomas();
  test_correoNoDiceQueAlgoExplicaMasDel100();
  test_correoNoLlamaAboveALoQueEstaBelow();

  // Auth — T-04 (solo con dobles locales)
  test_authGuardaHashNoTextoPlano();
  test_authRechazaCodigosCortos();
  test_authSinConfigurarNoAbre();
  test_authSesionCaducaALos30Minutos();
  test_authRequireSessionProtegeAunqueNoSeUseElMenu();
  test_authBloqueaTras5Intentos();
  test_authMensajeDeErrorEsGenerico();
  test_authAuditaExitosYFallos();
  test_authListaBlancaBloqueaAOtrosUsuarios();

  // Menu y Orchestrator — T-06 / T-09
  test_funcionesDeAdminRevalidanLaSesion();
  test_sesionCaducadaBloqueaLaGeneracion();
  test_puenteDevuelveErrorEnVezDeRomper();
  test_lectorExtraeElPeriodoDelSelector();
  test_periodoDistintoAlDeLaHojaSeRechaza();
  test_periodoCoincidenteSeAcepta();
  test_elErrorDePeriodoExplicaQueHacer();

  // Deployer — T-11
  test_despliegueVinculaLaBibliotecaEnElManifiesto();
  test_despliegueNoPisaOtrasBibliotecasDelCliente();
  test_despliegueEsIdempotenteEnElManifiesto();
  test_despliegueDetectaLaVersionYaInstalada();
  test_despliegueRespetaElCodigoDelCliente();
  test_despliegueExigeElIdDeLaBiblioteca();
  test_despliegueRechazaEntradasSinScriptId();
  test_despliegueAislaLosFallos();
  test_despliegueEsDryRunPorDefecto();





  const failures = __testResults.filter(function (r) { return !r.ok; });
  const summary = {
    total: __testResults.length,
    passed: __testResults.length - failures.length,
    failed: failures.length,
    failures: failures,
  };

  const line = summary.passed + '/' + summary.total + ' asserts correctos';

  // UN solo canal: en el editor de Apps Script ambos aparecen en el registro y
  // duplicar cada línea lo vuelve ilegible. Se prefiere console.log, que en el
  // runtime V8 sale siempre; Logger.log queda de reserva para entornos sin él.
  const emitir = function (msg) {
    if (typeof console !== 'undefined' && console.log) {
      console.log(msg);
    } else if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(msg);
    }
  };

  emitir('════════════════════════════════════════');
  emitir(summary.failed === 0 ? 'TODO OK — ' + line : 'HAY FALLOS — ' + line);
  emitir('════════════════════════════════════════');

  failures.forEach(function (f) {
    emitir('FALLA: ' + f.name + ' -> ' + f.msg);
  });

  if (summary.failed === 0) {
    emitir('Nota: los tests de Auth y del periodo se omiten aquí porque');
    emitir('necesitan el reloj simulado del runner local. Se ejecutan con');
    emitir('node tools/run-tests-local.js');
  }

  return summary;
}
