/**
 * BudgetReader — convierte la pestaña «Monthly Budget» en un modelo de datos limpio.
 *
 * Separación deliberada:
 *  - `parse(values)` es PURO: recibe una matriz y devuelve un modelo. Testeable en Node.
 *  - `read(sheetName)` es la única función que toca SpreadsheetApp.
 *
 * NADA de coordenadas fijas. La hoja es dato e interfaz a la vez: el usuario inserta
 * filas y columnas cuando quiere. Todo se localiza por contenido:
 *  - La fila de cabecera se busca por las etiquetas «Budget» y «Actual».
 *  - Las columnas de importe se derivan de esa fila.
 *  - El nivel jerárquico se deduce de cuál es la primera columna con texto.
 *
 * Estructura verificada en la hoja real (no supuesta):
 *   col A -> sección  ("Income", "Expenses & Debt Service", "Total Income")
 *   col B -> categoría ("Shelter", "Total Shelter")
 *   col C -> partida   ("Mortgage")
 *   col D -> Budget (= Planned)      col F -> Actual
 *   col P -> marca "Hide" en filas inactivas
 */

const BudgetReader = {
  /** Prefijo que identifica una fila de totales. */
  TOTAL_PREFIX: 'total ',

  /** Texto que marca una fila como oculta. */
  HIDE_MARKER: 'hide',

  /**
   * Lee la pestaña desde la hoja activa. Es el único punto que usa SpreadsheetApp.
   * @param {string} [sheetName='Monthly Budget']
   * @returns {Object} Modelo del presupuesto.
   */
  read(sheetName) {
    const name = sheetName || 'Monthly Budget';
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

    if (!sheet) {
      throw new Error(
        'Sheet "' + name + '" was not found. Check that it has not been renamed.'
      );
    }

    // UNA sola llamada. Leer celda a celda en Apps Script es lentísimo.
    const values = sheet.getDataRange().getValues();
    const model = this.parse(values);
    model.sheetName = name;
    return model;
  },

  /**
   * Convierte la matriz de la hoja en el modelo. Función pura.
   * @param {Array<Array<*>>} values
   * @returns {{headerRow:number, plannedCol:number, actualCol:number,
   *            sections:Array, categories:Array}}
   */
  parse(values) {
    const header = this._findHeader(values);
    // La profundidad es RELATIVA a la primera columna de etiquetas que se use de
    // verdad, no el índice absoluto. Así insertar columnas a la izquierda no
    // desplaza la jerarquía.
    header.labelStartCol = this._findLabelStart(values, header);

    const sections = [];
    let currentSection = null;
    let currentCategory = null;

    for (let r = header.row + 1; r < values.length; r++) {
      const row = values[r];
      if (this._isBlank(row, header)) continue;

      const label = this._labelOf(row, header);
      if (!label) continue;

      const planned = row[header.plannedCol];
      const actual = row[header.actualCol];
      const isTotal = label.text.toLowerCase().indexOf(this.TOTAL_PREFIX) === 0;
      const cleanName = isTotal ? label.text.substring(6).trim() : label.text;

      // --- Nivel 0: sección -------------------------------------------------
      if (label.depth === 0) {
        if (isTotal) {
          // "Total Income" cierra la sección; no abre nada nuevo.
          if (currentSection && currentSection.name === cleanName) {
            currentSection.planned = planned;
            currentSection.actual = actual;
          }
          currentCategory = null;
        } else {
          currentSection = {
            name: label.text,
            kind: this._kindOf(label.text),
            planned: null,
            actual: null,
            categories: [],
          };
          sections.push(currentSection);
          currentCategory = null;
        }
        continue;
      }

      // --- Nivel 1: categoría ----------------------------------------------
      if (label.depth === 1) {
        if (isTotal) {
          // "Total Shelter": aquí viven los importes que compara el reporte.
          if (currentCategory && currentCategory.name === cleanName) {
            currentCategory.planned = planned;
            currentCategory.actual = actual;
          }
          currentCategory = null;
        } else {
          currentCategory = {
            name: label.text,
            kind: currentSection ? currentSection.kind : 'expense',
            planned: null,
            actual: null,
            items: [],
          };
          if (currentSection) currentSection.categories.push(currentCategory);
        }
        continue;
      }

      // --- Nivel 2: partida -------------------------------------------------
      if (label.depth >= 2 && currentCategory) {
        if (this._isHidden(row)) continue;
        currentCategory.items.push({
          name: label.text,
          planned: planned,
          actual: actual,
        });
      }
    }

    // Aplanado que consume DeviationEngine.analyze()
    const categories = [];
    sections.forEach(function (s) {
      s.categories.forEach(function (c) {
        if (c.planned !== null || c.actual !== null) categories.push(c);
      });
    });

    const meta = this._findMeta(values, header.row);

    return {
      headerRow: header.row,
      plannedCol: header.plannedCol,
      actualCol: header.actualCol,
      month: meta.month,
      year: meta.year,
      sections: sections,
      categories: categories,
    };
  },

  /**
   * Extrae el periodo del selector que la hoja tiene sobre la cabecera
   * (`Year 2025` / `Month Jan`). Se busca por etiqueta, no por celda fija.
   * @private
   * @returns {{month: (string|null), year: (number|string|null)}}
   */
  _findMeta(values, headerRow) {
    const meta = { month: null, year: null };

    for (let r = 0; r < headerRow && r < values.length; r++) {
      const row = values[r];
      for (let c = 0; c < row.length - 1; c++) {
        const label = String(row[c] === null || row[c] === undefined ? '' : row[c])
          .trim().replace(/:$/, '').toLowerCase();

        if (label === 'year' && meta.year === null) meta.year = row[c + 1];
        if (label === 'month' && meta.month === null) meta.month = row[c + 1];
      }
    }
    return meta;
  },

  // -------------------------------------------------------------------------
  // Privados
  // -------------------------------------------------------------------------

  /**
   * Localiza la fila de cabecera por sus etiquetas y deriva las columnas de importe.
   * @private
   */
  _findHeader(values) {
    for (let r = 0; r < values.length; r++) {
      const row = values[r];
      let plannedCol = -1;
      let actualCol = -1;

      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
        // La cabecera repite las etiquetas para la vista YTD: nos quedamos con la primera.
        if (plannedCol === -1 && cell === 'Budget') plannedCol = c;
        if (actualCol === -1 && cell === 'Actual') actualCol = c;
      }

      if (plannedCol !== -1 && actualCol !== -1 && actualCol > plannedCol) {
        return { row: r, plannedCol: plannedCol, actualCol: actualCol };
      }
    }

    throw new Error(
      'Header row not found. Looking for the "Budget" and "Actual" columns ' +
      'in the budget sheet.'
    );
  },

  /**
   * Devuelve la primera celda con texto a la izquierda de las columnas de importe,
   * junto con su profundidad. La profundidad ES el nivel jerárquico.
   * @private
   */
  _labelOf(row, header) {
    const start = header.labelStartCol || 0;
    for (let c = start; c < header.plannedCol; c++) {
      const cell = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
      if (cell !== '') return { text: cell, depth: c - start };
    }
    return null;
  },

  /**
   * Primera columna de etiquetas realmente usada en los datos. Se calcula en vez de
   * asumirse, para que insertar columnas a la izquierda no rompa la jerarquía.
   * @private
   */
  _findLabelStart(values, header) {
    let min = header.plannedCol;
    for (let r = header.row + 1; r < values.length; r++) {
      const row = values[r];
      for (let c = 0; c < header.plannedCol; c++) {
        const cell = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
        if (cell !== '') {
          if (c < min) min = c;
          break;
        }
      }
    }
    return min === header.plannedCol ? 0 : min;
  },

  /**
   * Una fila está oculta si alguna celda contiene exactamente "Hide".
   * Se busca por contenido y no por columna fija, para no romperse si se inserta una.
   * @private
   */
  _isHidden(row) {
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
      if (cell.toLowerCase() === this.HIDE_MARKER) return true;
    }
    return false;
  },

  /** @private */
  _isBlank(row, header) {
    for (let c = 0; c <= header.actualCol; c++) {
      const cell = row[c];
      if (cell !== null && cell !== undefined && String(cell).trim() !== '') return false;
    }
    return true;
  },

  /**
   * En ingresos, gastar de más es bueno; en gastos es malo. El signo se calcula
   * igual, pero el texto explicativo tiene que invertir la lectura.
   * @private
   */
  _kindOf(sectionName) {
    return /income/i.test(sectionName) ? 'income' : 'expense';
  },
};
