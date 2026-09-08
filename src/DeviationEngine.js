/**
 * DeviationEngine — motor de cálculo de desviaciones presupuesto vs real.
 *
 * REGLA DE ORO: este módulo NO conoce Google. No usa SpreadsheetApp, GmailApp ni
 * ningún servicio. Recibe estructuras de datos y devuelve estructuras de datos.
 * Es lo que permite probarlo sin abrir una hoja de cálculo.
 *
 * Convenciones tomadas de los reportes ya existentes en el libro (ver la skill
 * `budget-domain-model`), no inventadas.
 */

/**
 * @typedef {Object} BudgetItem
 * @property {string} name    Nombre de la partida, p. ej. "Gym"
 * @property {number} planned Importe presupuestado (columna `Budget` en la hoja)
 * @property {number} actual  Importe real (columna `Actual`)
 */

/**
 * @typedef {Object} BudgetCategory
 * @property {string} name              p. ej. "Personal Care"
 * @property {'income'|'expense'} kind  Determina cómo se interpreta el signo
 * @property {number} planned           Total planificado de la categoría
 * @property {number} actual            Total real de la categoría
 * @property {BudgetItem[]} items       Partidas que la componen
 */

/**
 * @typedef {Object} AnalyzedItem
 * @property {string} name
 * @property {number} planned
 * @property {number} actual
 * @property {number} deviationAmount    actual - planned
 * @property {number|null} deviationPct  null solo si la partida se omite
 */

const DeviationEngine = {
  /** Umbral por defecto, en porcentaje, a partir del cual una desviación es relevante. */
  DEFAULT_THRESHOLD: 15,

  /**
   * Desviación porcentual entre real y planificado.
   *
   * Casos límite (observados en los datos reales de la plantilla):
   *  - planned = 0 y actual != 0  -> 100. Convención del libro. NUNCA Infinity.
   *  - planned = 0 y actual = 0   -> null. La partida se omite del reporte.
   *  - planned negativo           -> se divide por |planned| para no invertir el signo.
   *
   * @param {number} actual
   * @param {number} planned
   * @returns {number|null} Porcentaje, o null si la partida carece de contenido.
   */
  percent(actual, planned) {
    const a = this._toNumber(actual);
    const p = this._toNumber(planned);

    if (p === 0) {
      return a === 0 ? null : 100;
    }
    return ((a - p) / Math.abs(p)) * 100;
  },

  /**
   * Desviación en importe. Positivo = se gastó/ingresó más de lo previsto.
   * @param {number} actual
   * @param {number} planned
   * @returns {number}
   */
  amount(actual, planned) {
    return this._toNumber(actual) - this._toNumber(planned);
  },

  /**
   * Etiqueta Over/Under, tal como aparece en los reportes del libro.
   * Es puramente aritmética: NO interpreta si es bueno o malo. Esa lectura
   * depende de `kind` y la resuelve quien redacta el texto.
   *
   * @param {number} deviationAmount
   * @returns {'Over'|'Under'|'On target'}
   */
  status(deviationAmount) {
    if (deviationAmount > 0) return 'Over';
    if (deviationAmount < 0) return 'Under';
    return 'On target';
  },

  /**
   * ¿Merece explicación esta desviación?
   * @param {number|null} deviationPct
   * @param {number} [threshold=15]
   * @returns {boolean}
   */
  isSignificant(deviationPct, threshold) {
    if (deviationPct === null || deviationPct === undefined) return false;
    const limit = threshold === undefined ? this.DEFAULT_THRESHOLD : threshold;
    return Math.abs(deviationPct) >= limit;
  },

  /**
   * Ordena partidas por IMPACTO ABSOLUTO EN IMPORTE, descendente.
   *
   * Esta es la decisión de diseño más importante del motor. Ordenar por
   * porcentaje sería engañoso: un +300 % sobre $10 son $30 y es ruido; un
   * +20 % sobre $3.000 son $600 y es la noticia. El cliente necesita saber
   * dónde se fue el dinero, no qué partida tiene el porcentaje más vistoso.
   *
   * Se descartan dos tipos de partida:
   *  1. Sin contenido (planned = 0 y actual = 0).
   *  2. Con desviación EXACTAMENTE cero. Una partida que cuadra no explica nada:
   *     aparece como «+0.00 / 0.00%» y solo añade ruido. Verificado contra los
   *     reportes de referencia del libro, que tampoco las listan (Shelter tiene
   *     18 partidas en el presupuesto y el reporte de abril solo lista 6).
   *
   * @param {BudgetItem[]} items
   * @returns {AnalyzedItem[]}
   */
  rankItems(items) {
    return (items || [])
      .map((it) => ({
        name: it.name,
        planned: this._toNumber(it.planned),
        actual: this._toNumber(it.actual),
        deviationAmount: this.amount(it.actual, it.planned),
        deviationPct: this.percent(it.actual, it.planned),
      }))
      .filter((it) => it.deviationPct !== null && it.deviationAmount !== 0)
      .sort((a, b) => Math.abs(b.deviationAmount) - Math.abs(a.deviationAmount));
  },

  /**
   * Analiza una categoría completa: su total y las partidas que lo explican.
   *
   * Solo devuelve partidas cuando la categoría supera el umbral. Si está dentro
   * de lo previsto, el reporte muestra únicamente la fila de la categoría.
   *
   * @param {BudgetCategory} category
   * @param {number} [threshold]
   * @returns {Object}
   */
  analyzeCategory(category, threshold) {
    const deviationAmount = this.amount(category.actual, category.planned);
    const deviationPct = this.percent(category.actual, category.planned);
    const significant = this.isSignificant(deviationPct, threshold);

    return {
      name: category.name,
      kind: category.kind || 'expense',
      planned: this._toNumber(category.planned),
      actual: this._toNumber(category.actual),
      deviationAmount: deviationAmount,
      deviationPct: deviationPct,
      status: this.status(deviationAmount),
      isSignificant: significant,
      // Las partidas solo acompañan a las categorías que hay que explicar.
      drivers: significant ? this.rankItems(category.items) : [],
    };
  },

  /**
   * Punto de entrada. Analiza el modelo completo del presupuesto.
   *
   * @param {{categories: BudgetCategory[], month?: string, year?: number}} model
   * @param {{threshold?: number}} [options]
   * @returns {Object} Modelo listo para pintar en hoja o redactar en correo.
   */
  analyze(model, options) {
    const opts = options || {};
    const threshold = opts.threshold === undefined ? this.DEFAULT_THRESHOLD : opts.threshold;
    const categories = (model && model.categories) || [];

    const analyzed = categories
      .map((c) => this.analyzeCategory(c, threshold))
      // Una categoría sin NINGÚN movimiento (ni presupuesto ni gasto) no dice
      // nada al cliente: saldría como «$0.00 / $0.00 / +0.00» y solo añade ruido.
      // Las que tienen presupuesto pero no gasto SÍ se conservan: son las que
      // revelan cargos pendientes.
      .filter((c) => !(c.planned === 0 && c.actual === 0));

    return {
      month: model && model.month,
      year: model && model.year,
      threshold: threshold,
      categories: analyzed,
      significantCount: analyzed.filter((c) => c.isSignificant).length,
    };
  },

  /**
   * Normaliza a número. La hoja entrega celdas vacías, guiones y texto.
   * @private
   */
  _toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === '') return 0;

    // La plantilla usa "-" para el cero, y paréntesis para negativos: (1,045.45)
    const raw = String(value).trim();
    if (raw === '-' || raw === '—') return 0;

    const negativeByParens = /^\(.*\)$/.test(raw);
    const cleaned = raw.replace(/[()$,\s]/g, '');
    const n = parseFloat(cleaned);

    if (isNaN(n)) return 0;
    return negativeByParens ? -Math.abs(n) : n;
  },
};
