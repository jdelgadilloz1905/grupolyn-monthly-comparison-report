/**
 * Fixtures.js — datos de prueba SINTÉTICOS.
 *
 * ⚠️ IMPORTANTE: los importes de este archivo son INVENTADOS.
 *
 * Reproducen fielmente la FORMA de la hoja real (disposición de columnas,
 * jerarquía por indentación, marca «Hide») y la de cada caso límite, pero
 * ninguna cifra procede del plan financiero del cliente. La plantilla contiene
 * datos personales reales y CLAUDE.md es explícito: al repositorio solo va código.
 *
 * La fidelidad numérica frente a los reportes que el cliente hizo a mano se
 * comprueba en T-10, ejecutando contra la hoja real. Ahí es donde corresponde:
 * es una verificación de integración, no un dato que deba vivir versionado.
 *
 * Disposición verificada de la hoja:
 *   col A -> sección   col B -> categoría   col C -> partida
 *   col D -> Budget    col F -> Actual      col P -> "Hide"
 *
 * Casos límite representados:
 *   · planned = 0 con actual > 0        -> "Ayuda Familiar"
 *   · planned = 0 y actual = 0          -> "Comisiones"
 *   · fila marcada Hide                 -> "Impuesto Municipal", "Ayuda Alquiler"
 *   · desviación exactamente cero       -> "Seguro Hogar"
 *   · ahorro engañoso (actual 0, grande)-> "Alquiler"
 *   · ingreso frente a gasto            -> secciones Income / Expenses
 */

const Fixtures = {
  /**
   * Matriz con la forma de `getDataRange().getValues()`.
   * @returns {Array<Array<*>>}
   */
  monthlyBudget() {
    const H = 'Hide';
    return [
      // Preámbulo: la hoja tiene decenas de filas antes de la cabecera.
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', 'Year', 2025, 'BOM:', '1/1/2025'],
      ['', '', '', '', 'Month', 'Jan', 'EOM:', '1/31/2025'],
      ['', '', '', '', '', '', '', ''],

      // Cabecera: se localiza por las etiquetas, no por su número de fila.
      ['', 'Monthly Budget', '', 'Budget', 'Budget % of Total Income',
        'Actual', 'Actual % of Total Income', 'Variance'],

      // --- Sección Income ---
      ['Income', '', '', '', '', '', '', ''],
      ['', 'Person 1', '', '', '', '', '', ''],
      ['', '', 'Salario', 5000, '80.6%', 500, '29.4%', -4500],
      ['', '', 'Comisiones', '', '0.0%', '-', '0.00%', '-'],
      ['', 'Total Person 1', '', 5000, '80.6%', 500, '29.4%', -4500],
      ['', '', '', '', '', '', '', ''],
      ['', 'Other Income', '', '', '', '', '', ''],
      ['', '', 'Ayuda Familiar', '', '0.0%', 1200, '70.6%', 1200],
      ['', '', 'Ayuda Alquiler', '-', '0.0%', '-', '0.00%', '-', '', '', '', '', '', '', '', H],
      ['', 'Total Other Income', '', 0, '0.0%', 1200, '70.6%', 1200],
      ['Total Income', '', '', 5000, '100.00%', 1700, '100.00%', -3300],
      ['', '', '', '', '', '', '', ''],

      // --- Sección Expenses ---
      ['Expenses & Debt Service', '', '', '', '', '', '', ''],
      ['', 'Shelter', '', '', '', '', '', ''],
      ['', '', 'Alquiler', 1500, '30.0%', 0, '0.00%', 1500],
      ['', '', 'Impuesto Municipal', '-', '0.0%', '-', '0.00%', '-', '', '', '', '', '', '', '', H],
      ['', '', 'Jardinería', 400, '8.0%', 100, '5.9%', 300],
      ['', '', 'Reparaciones', 100, '2.0%', 360, '21.2%', -260],
      ['', '', 'Seguro Hogar', 250, '5.0%', 250, '14.7%', 0],
      ['', 'Total Shelter', '', 2000, '40.0%', 460, '27.1%', 1540],
      ['', '', '', '', '', '', '', ''],
      ['', 'Personal Care', '', '', '', '', '', ''],
      ['', '', 'Gimnasio', 200, '4.0%', 700, '41.2%', -500],
      ['', '', 'Tintorería', 150, '3.0%', 300, '17.6%', -150],
      ['', '', 'Entrenador', 100, '2.0%', 50, '2.9%', 50],
      ['', 'Total Personal Care', '', 1000, '20.0%', 1600, '94.1%', -600],
    ];
  },

  /**
   * La misma hoja con `n` filas en blanco insertadas arriba.
   * Prueba que no se dependen de coordenadas fijas.
   * @param {number} n
   */
  monthlyBudgetShiftedDown(n) {
    const blank = [];
    for (let i = 0; i < (n || 3); i++) blank.push(['', '', '', '', '', '', '', '']);
    return blank.concat(this.monthlyBudget());
  },

  /**
   * La misma hoja con `n` columnas en blanco insertadas a la izquierda.
   * @param {number} n
   */
  monthlyBudgetShiftedRight(n) {
    const pad = n || 2;
    return this.monthlyBudget().map(function (row) {
      const prefix = [];
      for (let i = 0; i < pad; i++) prefix.push('');
      return prefix.concat(row);
    });
  },

  /**
   * Modelo ya en forma de categorías, para probar salida y redacción sin pasar
   * por el lector. Mismos importes sintéticos que `monthlyBudget()`.
   */
  sampleModel() {
    return {
      month: 'Jan',
      year: 2025,
      categories: [
        {
          name: 'Shelter',
          kind: 'expense',
          planned: 2000,
          actual: 460,
          items: [
            // Ahorro engañoso: no se cargó, pero volverá.
            { name: 'Alquiler', planned: 1500, actual: 0 },
            { name: 'Jardinería', planned: 400, actual: 100 },
            { name: 'Reparaciones', planned: 100, actual: 360 },
            // Cuadra exactamente: no debe aparecer como responsable.
            { name: 'Seguro Hogar', planned: 250, actual: 250 },
          ],
        },
        {
          name: 'Personal Care',
          kind: 'expense',
          planned: 1000,
          actual: 1600,
          items: [
            { name: 'Gimnasio', planned: 200, actual: 700 },
            { name: 'Tintorería', planned: 150, actual: 300 },
            { name: 'Entrenador', planned: 100, actual: 50 },
          ],
        },
        {
          name: 'Person 1',
          kind: 'income',
          planned: 5000,
          actual: 500,
          items: [
            { name: 'Salario', planned: 5000, actual: 500 },
          ],
        },
      ],
    };
  },

  /**
   * La hoja con una categoría que el código no conoce de antemano.
   * @param {string} name
   */
  monthlyBudgetWithNewCategory(name) {
    const rows = this.monthlyBudget();
    rows.push(['', name, '', '', '', '', '', '']);
    rows.push(['', '', 'Suscripción', 100, '2.0%', 250, '14.7%', -150]);
    rows.push(['', 'Total ' + name, '', 100, '2.0%', 250, '14.7%', -150]);
    return rows;
  },
};
