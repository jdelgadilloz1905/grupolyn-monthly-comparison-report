/**
 * ReportSheet.js — pinta el reporte comparativo en una pestaña.
 *
 * Separación igual que en BudgetReader:
 *  - `buildRows(report)` es PURO: devuelve la matriz. Testeable en Node.
 *  - `render(report)` es lo único que toca SpreadsheetApp.
 *
 * El formato NO es una invención: reproduce los reportes que ya existen en el libro
 * hechos a mano (ver la skill `budget-domain-model`). Orden de columnas verificado:
 *   Category | Item Description | Actual | Planned | Deviation ($) | Deviation (%) | Status
 * Ojo: Actual va ANTES que Planned, al contrario de lo que sugiere el enunciado.
 */

const ReportSheet = {
  /**
   * Construye la matriz completa del reporte, cabecera incluida.
   * @param {Object} report Salida de DeviationEngine.analyze()
   * @returns {Array<Array<*>>}
   */
  buildRows(report) {
    const rows = [];

    // Preámbulo, como en los reportes de referencia.
    rows.push(['', '', 'Year', report.year || '', 'Month', report.month || '', '']);
    rows.push(['', '', '', '', '', '', '']);
    rows.push(Config.REPORT_HEADERS.slice());

    (report.categories || []).forEach(function (cat) {
      // Fila de categoría: lleva Status.
      rows.push([
        cat.name,
        '',
        cat.actual,
        cat.planned,
        cat.deviationAmount,
        cat.deviationPct === null ? '' : cat.deviationPct / 100,
        cat.status,
      ]);

      // Línea de explicación en texto, como pide el enunciado:
      // «Inserta algunas líneas entre las categorías con una breve explicación».
      if (cat.isSignificant) {
        rows.push(['', this.explanationLine(cat), '', '', '', '', '']);
      }

      // Partidas responsables: solo si la categoría se desvió. Status vacío.
      (cat.drivers || []).forEach(function (item) {
        rows.push([
          '',
          item.name,
          item.actual,
          item.planned,
          item.deviationAmount,
          item.deviationPct === null ? '' : item.deviationPct / 100,
          '',
        ]);
      });

      // Fila en blanco entre categorías, como en el original.
      rows.push(['', '', '', '', '', '', '']);
    }, this);

    return rows;
  },

  /**
   * Frase que explica la desviación, en el formato del ejemplo del enunciado:
   *   «Shelter is over budget by 20%.»
   *
   * En inglés a propósito: la hoja del cliente, sus categorías y los cinco
   * reportes de referencia están en inglés. Mezclar idiomas en la misma pestaña
   * quedaría incoherente.
   *
   * @param {Object} cat Categoría ya analizada.
   * @returns {string}
   */
  explanationLine(cat) {
    const pct = Math.abs(Math.round(cat.deviationPct * 10) / 10);
    const amount = Math.abs(cat.deviationAmount).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (cat.kind === 'income') {
      return cat.deviationAmount < 0
        ? cat.name + ' is under plan by ' + pct + '% ($' + amount + ' less than expected).'
        : cat.name + ' is above plan by ' + pct + '% ($' + amount + ' more than expected).';
    }
    return cat.deviationAmount > 0
      ? cat.name + ' is over budget by ' + pct + '% ($' + amount + ' more than planned).'
      : cat.name + ' is under budget by ' + pct + '% ($' + amount + ' less than planned).';
  },

  /**
   * Escribe el reporte en una pestaña. Si existe, la reemplaza.
   * @param {Object} report
   * @param {{sheetName?: string}} [options]
   * @returns {{sheetName: string, rowCount: number}}
   */
  render(report, options) {
    const opts = options || {};
    const name = opts.sheetName || Config.reportSheetName(report.month, report.year);

    // Las pestañas que el cliente hizo a mano son la especificación del formato.
    // Pisarlas destruiría la referencia, así que exigen un acto explícito.
    if (Config.isReferenceSheet(name) && !opts.allowOverwriteReference) {
      // Mensaje para el CONSULTOR, no para quien programa: describe qué hacer
      // desde la interfaz. El parámetro técnico que lo permitiría no se
      // menciona a propósito, porque no está expuesto en el diálogo.
      throw new Error(
        'A hand-made report already exists for that month: the "' + name + '" tab. ' +
        'It is not overwritten so it does not get lost. To generate a new one, ' +
        'rename the existing tab (for example to "' + name + ' (original)") ' +
        'and try again.'
      );
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(name);
    }

    const rows = this.buildRows(report);
    const width = Config.REPORT_HEADERS.length;

    // UNA sola escritura. Nada de setValue() en bucle.
    sheet.getRange(1, 1, rows.length, width).setValues(rows);

    this._applyFormat(sheet, rows, width);

    return { sheetName: name, rowCount: rows.length };
  },

  /**
   * Formato visual. Se aplica por rangos completos, no celda a celda.
   *
   * Las posiciones se DERIVAN de las filas ya construidas, no se recalculan a
   * partir del modelo. Recalcularlas obliga a mantener sincronizadas dos
   * lógicas distintas, y basta añadir una fila —como la de explicación— para
   * que el resaltado caiga en el sitio equivocado sin que nada avise.
   *
   * @private
   */
  _applyFormat(sheet, rows, width) {
    const HEADER_ROW = 3;

    sheet.getRange(HEADER_ROW, 1, 1, width)
      .setFontWeight('bold')
      .setBackground('#f1f3f4');

    const dataRows = rows.length - HEADER_ROW;
    if (dataRows > 0) {
      sheet.getRange(HEADER_ROW + 1, 3, dataRows, 1).setNumberFormat(Config.NUMBER_FORMATS.actual);
      sheet.getRange(HEADER_ROW + 1, 4, dataRows, 1).setNumberFormat(Config.NUMBER_FORMATS.planned);
      sheet.getRange(HEADER_ROW + 1, 5, dataRows, 1).setNumberFormat(Config.NUMBER_FORMATS.deviationAmount);
      sheet.getRange(HEADER_ROW + 1, 6, dataRows, 1).setNumberFormat(Config.NUMBER_FORMATS.deviationPct);
    }

    for (let i = HEADER_ROW; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 1; // 1-indexado en la hoja

      // Fila de categoría: nombre en la primera columna y Status en la última.
      if (row[0] !== '' && row[6] !== '') {
        const destacar = row[6] === 'Over' || row[6] === 'Under';
        const rango = sheet.getRange(fila, 1, 1, width).setFontWeight('bold');
        if (destacar) {
          rango.setBackground(row[6] === 'Over' ? '#fce8e6' : '#e6f4ea');
        }
        continue;
      }

      // Fila de explicación: texto en la 2ª columna y ninguna cifra.
      if (row[0] === '' && row[1] !== '' && row[2] === '') {
        sheet.getRange(fila, 2, 1, width - 1)
          .setFontStyle('italic')
          .setFontColor('#5f6368');
      }
    }

    sheet.setFrozenRows(HEADER_ROW);
    for (let c = 1; c <= width; c++) sheet.autoResizeColumn(c);
  },
};
