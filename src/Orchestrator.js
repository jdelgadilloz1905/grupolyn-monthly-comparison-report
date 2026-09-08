/**
 * Orchestrator.js — une las piezas tras el clic del menú.
 *
 * No contiene lógica de negocio: coordina. Toda la inteligencia vive en
 * DeviationEngine (cálculo), BudgetReader (lectura), ReportSheet (pintado) y
 * EmailDraft (redacción). Aquí solo se decide el orden y se traducen errores
 * a mensajes que un consultor pueda entender.
 */

const Orchestrator = {
  /**
   * Abre el diálogo de parámetros, precargado con el mes del selector de la hoja.
   */
  showReportDialog() {
    Auth.requireSession();

    const defaults = this.readDefaults();
    const template = HtmlService.createTemplateFromFile('ReportDialog');
    template.defaults = defaults;

    const html = template.evaluate().setWidth(420).setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(html, 'Monthly Comparison Report');
  },

  /**
   * Lee el periodo que la hoja tiene seleccionado, para no obligar a teclearlo.
   *
   * NO se captura el error a propósito. Si la pestaña falta o se renombró, es
   * preferible que el consultor lo sepa AHORA —con el mensaje concreto que da
   * BudgetReader— y no que vea un formulario en blanco, lo rellene entero, y se
   * entere al pulsar Generar.
   *
   * @returns {{month: string, year: (number|string), threshold: number}}
   */
  readDefaults() {
    const model = BudgetReader.read(Config.BUDGET_SHEET);
    return {
      month: model.month || '',
      year: model.year || '',
      threshold: Config.DEFAULT_THRESHOLD,
    };
  },

  /**
   * Genera el reporte. Llamado desde ReportDialog.html.
   *
   * @param {{month:string, year:(number|string), threshold:number,
   *          destination:string, clientEmail:string, clientName:string,
   *          allowOverwriteReference:boolean}} params
   * @returns {{ok:boolean, message:string, details:Object}}
   */
  generateReport(params) {
    // Se revalida aquí también: esta función es invocable desde el editor.
    Auth.requireSession();

    const p = params || {};
    const threshold = Number(p.threshold) || Config.DEFAULT_THRESHOLD;
    const destination = p.destination || 'both';

    const model = BudgetReader.read(Config.BUDGET_SHEET);

    // El periodo lo manda LA HOJA, no el diálogo.
    //
    // El diálogo muestra el mes solo para confirmarlo. Si el usuario escribiera
    // otro, el sistema NO leería datos de ese mes —la hoja sigue mostrando los
    // suyos— y produciría un reporte de un mes etiquetado como otro: incorrecto
    // y con toda la apariencia de ser correcto. Se falla en voz alta.
    this._assertPeriodoCoincide(p, model);

    const report = DeviationEngine.analyze(model, { threshold: threshold });
    const details = {
      month: model.month,
      year: model.year,
      threshold: threshold,
      categoriesAnalyzed: report.categories.length,
      significantCount: report.significantCount,
    };

    if (destination === 'sheet' || destination === 'both') {
      const written = ReportSheet.render(report, {
        allowOverwriteReference: !!p.allowOverwriteReference,
      });
      details.sheetName = written.sheetName;
    }

    if (destination === 'draft' || destination === 'both') {
      if (!p.clientEmail) {
        details.draftSkipped = 'No client email address was provided.';
      } else {
        const draft = EmailDraft.createDraft(report, {
          to: p.clientEmail,
          clientName: p.clientName,
        });
        details.draftId = draft.draftId;
        details.draftTo = draft.to;
      }
    }

    return { ok: true, message: this._resumen(details), details: details };
  },

  /**
   * Impide generar un reporte cuyo periodo no coincida con el que la hoja está
   * mostrando. Cambiar el mes es una acción sobre la HOJA, no sobre el diálogo.
   * @private
   */
  _assertPeriodoCoincide(p, model) {
    const norm = function (v) { return String(v === null || v === undefined ? '' : v).trim().toLowerCase(); };

    if (p.month && norm(p.month) !== norm(model.month)) {
      throw new Error(
        'The "' + Config.BUDGET_SHEET + '" sheet is showing ' + model.month +
        ', not ' + p.month + '. Change the month in the sheet selector and reopen ' +
        'this dialog: otherwise the report would carry ' + model.month +
        ' data labelled as ' + p.month + '.'
      );
    }
    if (p.year && norm(p.year) !== norm(model.year)) {
      throw new Error(
        'The sheet is showing year ' + model.year + ', not ' + p.year +
        '. Change the year in the sheet selector.'
      );
    }
  },

  /** @private */
  _resumen(d) {
    const partes = [];
    partes.push(d.categoriesAnalyzed + ' categories analysed.');
    partes.push(d.significantCount === 0
      ? 'None deviated more than ' + d.threshold + '%.'
      : d.significantCount + ' deviated more than ' + d.threshold + '%.');

    if (d.sheetName) partes.push('Report written to "' + d.sheetName + '".');
    if (d.draftId) partes.push('Draft created for ' + d.draftTo + '.');
    if (d.draftSkipped) partes.push('Draft skipped: ' + d.draftSkipped);

    return partes.join(' ');
  },
};

/**
 * Puente para ReportDialog.html (google.script.run necesita funciones globales).
 * @param {Object} params
 */
function runReportGeneration(params) {
  try {
    return Orchestrator.generateReport(params);
  } catch (e) {
    return { ok: false, message: e.message, details: {} };
  }
}
