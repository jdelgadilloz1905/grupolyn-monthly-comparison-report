/**
 * Menu.js — menú «Admin» y puntos de entrada desde la interfaz.
 *
 * EL MENÚ ES COSMÉTICO. Ocultar una opción no protege nada: cualquiera puede
 * ejecutar la función desde el editor de Apps Script. Por eso TODA función de
 * administrador llama a `Auth.requireSession()` antes de hacer nada.
 *
 * `onOpen` es un disparador simple y se ejecuta con permisos limitados, así que
 * se construye de forma defensiva: si algo falla, se muestra el menú bloqueado
 * en lugar de dejar la hoja sin menú.
 */

/**
 * Disparador simple. Dibuja el menú según el estado de la sesión.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Admin');

  let desbloqueado = false;
  try {
    desbloqueado = Auth.isSessionValid();
  } catch (e) {
    // Ante cualquier problema, el menú se queda bloqueado. Nunca al revés.
    desbloqueado = false;
  }

  if (desbloqueado) {
    menu
      .addItem('📊 Generate Monthly Comparison Report', 'showReportDialog')
      .addSeparator()
      .addItem('❓ Help', 'showHelpDialog')
      .addItem('🔒 Lock menu', 'lockAdmin');
  } else {
    menu
      .addItem('🔓 Unlock…', 'showAuthDialog')
      .addSeparator()
      .addItem('❓ Help', 'showHelpDialog');
  }

  menu.addToUi();
}

/**
 * Muestra la ayuda de la herramienta.
 *
 * A propósito NO exige sesión: es documentación, no una acción. Alguien que
 * hereda esta hoja necesita poder averiguar qué hace antes de tener el código.
 */
function showHelpDialog() {
  const html = HtmlService.createHtmlOutputFromFile('HelpDialog')
    .setWidth(560)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Help — Monthly Comparison Report');
}

/**
 * Abre el diálogo de contraseña.
 *
 * Se usa HtmlService y no `ui.prompt()` porque prompt muestra en pantalla lo que
 * se teclea. Aquí el campo es `type="password"`.
 */
function showAuthDialog() {
  const html = HtmlService.createHtmlOutputFromFile('AuthDialog')
    .setWidth(360)
    .setHeight(240);
  SpreadsheetApp.getUi().showModalDialog(html, 'Administrator access');
}

/**
 * Llamada desde AuthDialog.html mediante google.script.run.
 * @param {string} code
 * @returns {{ok: boolean, message: string}}
 */
function processUnlock(code) {
  const resultado = Auth.unlock(code);

  if (resultado.ok) {
    // Redibujar el menú para que aparezcan las opciones de administrador.
    onOpen();
    SpreadsheetApp.getActiveSpreadsheet().toast(resultado.message, 'Admin', 5);
  }
  return resultado;
}

/** Cierra la sesión de administrador y vuelve a dibujar el menú. */
function lockAdmin() {
  const resultado = Auth.lock();
  onOpen();
  SpreadsheetApp.getActiveSpreadsheet().toast(resultado.message, 'Admin', 3);
  return resultado;
}

/**
 * Punto de entrada del reporte desde el menú.
 *
 * Revalida la sesión aunque el menú ya la haya comprobado: entre que se dibujó
 * el menú y se pulsó la opción pueden haber pasado los 30 minutos, y además esta
 * función es invocable directamente desde el editor.
 */
function showReportDialog() {
  Auth.requireSession();
  return Orchestrator.showReportDialog();
}

/**
 * Instalación inicial. Se ejecuta UNA vez, a mano, desde el editor.
 *
 * No se expone en el menú a propósito: no debe ser accesible desde la interfaz
 * de la hoja. Edita el código aquí, ejecútalo, y vuelve a dejarlo vacío.
 */
function setupAdmin() {
  // Sustituye estos valores, ejecuta la función UNA vez, y bórralos de nuevo.
  //
  // NO uses un ejemplo que aparezca escrito aquí ni en ninguna documentación:
  // si el código de ejemplo acaba siendo el código real, queda publicado en el
  // propio archivo. Inventa uno.
  const CODIGO = '';           // mínimo 8 caracteres
  const AUTORIZADOS = [];      // opcional: ['correo@dominio.com']

  if (!CODIGO) {
    throw new Error(
      'Edit setupAdmin() in Menu.js, set a code of at least 8 characters, ' +
      'run it once, and then clear the constant again.'
    );
  }
  const mensaje = Auth.setupAdminCode(CODIGO, AUTORIZADOS);
  Logger.log(mensaje);
  return mensaje;
}
