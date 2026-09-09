/**
 * EmailDraft.js — redacta el resumen mensual para el cliente.
 *
 *  - `buildBody(report)` es PURO: devuelve el texto. Testeable en Node.
 *  - `createDraft(...)` es lo único que toca GmailApp.
 *
 * REGLA INQUEBRANTABLE: se crea un BORRADOR, nunca se envía.
 *
 * OJO con el scope: `gmail.compose` es el más restringido que permite crear
 * borradores, pero Google lo describe como «administrar borradores y enviar
 * correo electrónico». SÍ permitiría enviar. No existe un scope de Gmail que
 * deje crear borradores y prohíba enviarlos.
 *
 * Por tanto la garantía NO la da el permiso, la da este archivo: aquí no hay
 * ninguna llamada de envío, y `test_correoNuncaEnvia()` falla si alguien la
 * añade. Si alguna vez hace falta un candado real, la vía es un Web App que
 * ejecute como el propietario, no un scope más estrecho: no lo hay.
 *
 * IDIOMA: el correo sale en INGLÉS, igual que la pestaña de reporte. Todo lo que
 * ve el cliente vive en el mismo idioma que su libro de trabajo, sus categorías y
 * los reportes de referencia. Los comentarios del código quedan en español porque
 * su audiencia es quien lo mantiene, no el cliente.
 *
 * El objetivo del texto es EXPLICAR, no enumerar. Un cliente no necesita una tabla:
 * necesita saber a dónde se fue el dinero y qué debería revisar.
 */

const EmailDraft = {
  /**
   * Redacta el cuerpo del correo en lenguaje llano.
   * @param {Object} report Salida de DeviationEngine.analyze()
   * @param {{clientName?: string}} [options]
   * @returns {string}
   */
  buildBody(report, options) {
    const opts = options || {};
    const saludo = opts.clientName || 'Hi';
    const periodo = [report.month, report.year].filter(Boolean).join(' ');
    const lines = [];

    lines.push(saludo + ',');
    lines.push('');
    lines.push('Here is your ' + (periodo || 'monthly') + ' summary.');
    lines.push('');

    const relevantes = (report.categories || []).filter(function (c) {
      return c.isSignificant && Math.abs(c.deviationAmount) >= Config.MIN_AMOUNT_TO_NARRATE;
    });

    if (relevantes.length === 0) {
      lines.push('Everything stayed within plan this month. There are no');
      lines.push('deviations worth your attention.');
      lines.push('');
      lines.push('Happy to walk through any of it if useful.');
      return lines.join('\n');
    }

    // Lo desfavorable primero: es lo accionable.
    const malas = relevantes.filter(this._esDesfavorable, this);
    const buenas = relevantes.filter(function (c) { return !this._esDesfavorable(c); }, this);

    malas.forEach(function (cat) {
      lines.push(this._parrafoCategoria(cat));
      lines.push('');
    }, this);

    if (buenas.length > 0) {
      lines.push('On the positive side:');
      buenas.forEach(function (cat) {
        lines.push('  - ' + this._frasePositiva(cat));
        const aviso = this._ahorroEngañoso(cat);
        if (aviso) lines.push('    ' + aviso);
      }, this);
      lines.push('');
    }

    lines.push('Happy to walk through any of it if useful.');
    return lines.join('\n');
  },

  /**
   * Crea el borrador en Gmail. Único punto que toca GmailApp.
   * @param {Object} report
   * @param {{to: string, clientName?: string}} options
   * @returns {{draftId: string, to: string}}
   */
  createDraft(report, options) {
    const opts = options || {};
    if (!opts.to) {
      throw new Error(
        'The client email address is missing. Set it before generating the draft.'
      );
    }

    const periodo = [report.month, report.year].filter(Boolean).join(' ');
    const subject = 'Your financial summary — ' + (periodo || 'this period');
    const body = this.buildBody(report, opts);

    // createDraft, NUNCA sendEmail.
    const draft = GmailApp.createDraft(opts.to, subject, body);
    return { draftId: draft.getId(), to: opts.to };
  },

  // -------------------------------------------------------------------------
  // Redacción
  // -------------------------------------------------------------------------

  /**
   * ¿Es una mala noticia? En gastos, pasarse. En ingresos, quedarse corto.
   * El signo es el mismo; la lectura se invierte.
   * @private
   */
  _esDesfavorable(cat) {
    return cat.kind === 'income' ? cat.deviationAmount < 0 : cat.deviationAmount > 0;
  },

  /** @private */
  _parrafoCategoria(cat) {
    const importe = this._dinero(Math.abs(cat.deviationAmount));
    const pct = Math.round(Math.abs(cat.deviationPct));

    let texto;
    if (cat.kind === 'income') {
      texto = 'You received ' + importe + ' less than planned in ' + cat.name +
        ' (' + pct + '% below plan).';
    } else {
      texto = 'You spent ' + importe + ' more than planned on ' + cat.name +
        ' (' + pct + '% over budget).';
    }

    const driver = (cat.drivers || [])[0];
    if (driver && Math.abs(driver.deviationAmount) >= Config.MIN_AMOUNT_TO_NARRATE) {
      const peso = Math.abs(cat.deviationAmount) > 0
        ? Math.round((Math.abs(driver.deviationAmount) / Math.abs(cat.deviationAmount)) * 100)
        : 0;
      texto += ' The main driver is ' + driver.name + ': ' +
        this._dinero(driver.planned) + ' was budgeted and the actual came in at ' +
        this._dinero(driver.actual);

      // Una partida puede desviarse MÁS que su propia categoría, cuando otras
      // partidas del mismo grupo se desvían en sentido contrario y compensan.
      // Decir «explica el 126 % de la diferencia» es aritméticamente cierto y
      // suena a error de cálculo. En ese caso se explica el fenómeno.
      if (peso > 100) {
        texto += ', more than the whole gap on its own — other items in this ' +
          'category came in under plan and offset part of it';
      } else if (peso >= 50) {
        texto += ', which alone accounts for ' + peso + '% of the gap';
      }
      texto += '.';
    }

    // Solo se listan las partidas que empujan en la MISMA dirección que la
    // categoría. Incluir las que fueron en sentido contrario y llamarlas
    // «también por encima» sería sencillamente falso: contradice sus propias
    // cifras en la misma frase.
    const direccion = cat.deviationAmount > 0 ? 1 : -1;
    const otros = (cat.drivers || []).slice(1).filter(function (d) {
      return Math.abs(d.deviationAmount) >= Config.MIN_AMOUNT_TO_NARRATE &&
        (d.deviationAmount > 0 ? 1 : -1) === direccion;
    }, this).slice(0, 2);

    if (otros.length > 0) {
      const etiqueta = cat.kind === 'income'
        ? ' Also below plan: '
        : (direccion > 0 ? ' Also above plan: ' : ' Also under plan: ');
      texto += etiqueta + otros.map(function (d) {
        return d.name + ' (' + this._dinero(d.actual) + ' vs ' + this._dinero(d.planned) + ')';
      }, this).join(' and ') + '.';
    }

    return texto;
  },

  /** @private */
  _frasePositiva(cat) {
    const importe = this._dinero(Math.abs(cat.deviationAmount));
    if (cat.kind === 'income') {
      return cat.name + ' came in ' + importe + ' above plan.';
    }
    return cat.name + ' came in ' + importe + ' under budget.';
  },

  /**
   * Detecta el «ahorro engañoso»: un gasto grande que no se cargó.
   * No es ahorro, es un cargo pendiente — y avisarlo evita que el cliente
   * se confíe con un dinero que en realidad debe.
   * @private
   */
  _ahorroEngañoso(cat) {
    if (cat.kind === 'income') return null;

    const sospechosa = (cat.drivers || []).filter(function (d) {
      return d.actual === 0 && d.planned >= Config.SUSPICIOUS_ZERO_THRESHOLD;
    })[0];

    if (!sospechosa) return null;
    return 'Worth checking: ' + sospechosa.name + ' had no charge at all (' +
      this._dinero(sospechosa.planned) + ' was budgeted). This is often a timing ' +
      'difference rather than a saving, so expect it to come back.';
  },

  /** @private */
  _dinero(n) {
    const v = Math.abs(Number(n) || 0);
    const s = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (Number(n) < 0 ? '-$' : '$') + s;
  },
};
