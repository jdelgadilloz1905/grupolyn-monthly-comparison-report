/**
 * Config.js — parámetros del sistema en un solo sitio.
 *
 * Nada de valores mágicos repartidos por el código. Si un consultor quiere cambiar
 * el umbral o el nombre de una pestaña, lo hace aquí y no busca por los archivos.
 *
 * Los SECRETOS no viven aquí: van en ScriptProperties (ver Auth.js).
 */

const Config = {
  /** Pestaña de origen del presupuesto. */
  BUDGET_SHEET: 'Monthly Budget',

  /** Desviación porcentual a partir de la cual una categoría se explica. */
  DEFAULT_THRESHOLD: 15,

  /**
   * Plantilla del nombre de la pestaña de reporte.
   *
   * VERIFICADO contra el libro real: ya existen «Jan Budget Comparison»,
   * «Feb Budget Comparison», «Apr Budget Comparison», «May Budget Comparison» y
   * «Jun Budget Comparison». Seguimos esa convención en lugar de inventar otra.
   *
   * LIMITACIÓN CONOCIDA: la convención del cliente no incluye el año, así que un
   * reporte de enero de 2026 chocaría con el de enero de 2025. Se respeta la
   * convención existente a propósito; la protección está en pedir confirmación
   * antes de sobrescribir (ver CU-02, flujo alternativo B4).
   */
  REPORT_SHEET_PATTERN: '{month} Budget Comparison',

  /**
   * Pestañas de referencia creadas a mano por el cliente. NO se deben sobrescribir:
   * son la especificación del formato de salida.
   */
  REFERENCE_SHEETS: [
    'Jan Budget Comparison',
    'Feb Budget Comparison',
    'Apr Budget Comparison',
    'May Budget Comparison',
    'Jun Budget Comparison',
  ],

  /** Cabecera del reporte. Copiada literalmente de los ejemplos del libro. */
  REPORT_HEADERS: [
    'Category',
    'Item Description',
    'Actual',
    'Planned',
    'Deviation ($)',
    'Deviation (%)',
    'Status',
  ],

  /**
   * Formatos de número, copiados del comportamiento de los reportes de referencia.
   *
   * Ojo a la asimetría, que está verificada contra el libro y NO es un descuido:
   *   Deviation ($) -> los positivos SÍ llevan el signo «+»
   *   Deviation (%) -> los positivos NO llevan signo alguno
   * En ambas, los negativos llevan «-».
   */
  NUMBER_FORMATS: {
    actual: '$#,##0.00;-$#,##0.00',
    planned: '$#,##0.00;-$#,##0.00',
    deviationAmount: '+#,##0.00;-#,##0.00',
    deviationPct: '0.00%;-0.00%',
  },

  /**
   * Umbral en importe por debajo del cual una desviación no se comenta en el correo,
   * por mucho que el porcentaje sea llamativo. Evita el ruido del tipo «+300 % en café».
   */
  MIN_AMOUNT_TO_NARRATE: 50,

  /**
   * Un gasto con Actual = 0 y Planned por encima de esta cifra se marca como
   * «ahorro engañoso»: casi siempre es un cargo pendiente, no un ahorro real.
   */
  SUSPICIOUS_ZERO_THRESHOLD: 500,

  /** Nombre de la pestaña de auditoría de accesos. */
  AUDIT_SHEET: '_Admin Audit',

  /**
   * Construye el nombre de la pestaña de reporte.
   * @param {string} month
   * @param {number|string} year
   */
  reportSheetName(month, year) {
    return this.REPORT_SHEET_PATTERN
      .replace('{month}', String(month || ''))
      .replace('{year}', String(year || ''))
      .trim();
  },

  /**
   * ¿Esta pestaña es una de las de referencia del cliente?
   * Se usa para exigir confirmación explícita antes de tocarlas.
   * @param {string} name
   * @returns {boolean}
   */
  isReferenceSheet(name) {
    return this.REFERENCE_SHEETS.indexOf(String(name).trim()) !== -1;
  },
};
