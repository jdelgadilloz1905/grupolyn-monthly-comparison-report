/**
 * Deployer.js — despliegue masivo a las hojas de clientes (BONUS, T-11).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ESTE ARCHIVO NO PERTENECE AL SCRIPT DEL CLIENTE
 *
 * Va en un proyecto Apps Script **standalone**, propiedad de GrupoLyN, con su
 * propio proyecto de GCP. Meterlo en el script vinculado a la hoja del cliente
 * obligaría a pedirle permisos sobre archivos ajenos, que no tiene sentido.
 *
 * Scopes que necesita (NO son los del script del cliente):
 *   https://www.googleapis.com/auth/script.projects
 *   https://www.googleapis.com/auth/drive.readonly
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── LIMITACIÓN REAL, VERIFICADA ────────────────────────────────────────────
 * El enunciado dice «te proporcionaremos una lista de URLs de Google Sheets».
 * De una URL de hoja **no se puede obtener el ID de su script vinculado**: los
 * scripts *container-bound* no aparecen en Drive ni los expone ninguna API
 * pública. No es una carencia de esta implementación, es del propio Google.
 *
 * ── AGRAVANTE, OBSERVADO EN LA HOJA REAL ──────────────────────────────────
 * Una hoja puede tener MÁS DE UN script vinculado. La copia del cliente tiene
 * dos: el nuestro y un «Prospr Script» que venía con la plantilla de Tiller.
 *
 * Es decir, aunque se pudiera resolver «hoja -> script», la respuesta no sería
 * única: habría que elegir a cuál inyectar. Inyectar en el equivocado
 * sobrescribiría código del proveedor de la plantilla.
 *
 * Refuerza la conclusión: el mapa explícito `cliente -> scriptId` no es un
 * apaño, es la única forma correcta de saber dónde escribir. Y refuerza aún
 * más la opción del Editor Add-on, que no escribe en ningún script ajeno.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Tres formas de resolverlo, de mejor a peor:
 *   1. Que las copias nuevas salgan de una plantilla que YA tenga la biblioteca
 *      vinculada. Entonces no hay nada que inyectar.
 *   2. Publicar la funcionalidad como **Editor Add-on** del Workspace: se
 *      instala una vez y la tienen todas las copias. Es la respuesta correcta
 *      a escala y elimina el problema de raíz.
 *   3. Mantener un mapa `url de hoja -> scriptId`, que alguien rellena una vez
 *      por cliente abriendo el editor. Es lo que implementa este módulo, porque
 *      es lo único viable sobre el parque de copias que YA existe.
 * ───────────────────────────────────────────────────────────────────────────
 */

const Deployer = {
  /** Endpoint de la Apps Script API. */
  API: 'https://script.googleapis.com/v1/projects',

  /**
   * Marca de versión que se inyecta en el código del cliente.
   * Es lo que hace la operación idempotente: si ya está, no se vuelve a tocar.
   */
  VERSION_MARKER: '@grupolyn-bootstrap-version',

  /** Versión del código de arranque que se despliega. */
  BOOTSTRAP_VERSION: '1.1.0',

  /**
   * Permisos que la biblioteca necesita para trabajar.
   *
   * Tienen que estar en el manifiesto DEL CLIENTE. Apps Script deduce los
   * permisos leyendo el código, y el arranque solo contiene llamadas a
   * `GrupoLynLib.…`: a través de una biblioteca no ve nada que deducir. Sin
   * declararlos aquí, el menú se dibuja y luego todo falla por permisos.
   */
  REQUIRED_SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/script.container.ui',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
  ],

  /** Nombre del archivo inyectado en el proyecto del cliente. */
  BOOTSTRAP_FILE: 'GrupoLynBootstrap',

  /**
   * Despliega a un conjunto de clientes.
   *
   * @param {Array<{name: string, scriptId: string}>} targets
   * @param {{libraryScriptId: string, libraryVersion: number,
   *          libraryIdentifier: string, dryRun: boolean}} options
   * @returns {{dryRun: boolean, updated: Array, upToDate: Array, failed: Array}}
   */
  deploy(targets, options) {
    const opts = options || {};
    // dryRun por defecto: escribir en archivos de clientes exige un acto explícito.
    const dryRun = opts.dryRun !== false;

    if (!opts.libraryScriptId) {
      throw new Error(
        'Falta libraryScriptId: el identificador de la Master Script Library. ' +
        'Sin él no se puede vincular nada.'
      );
    }

    const report = { dryRun: dryRun, updated: [], upToDate: [], failed: [] };

    (targets || []).forEach(function (target) {
      // AISLAMIENTO: un cliente que falla no puede abortar el lote.
      try {
        const result = this._deployOne(target, opts, dryRun);
        report[result.status].push(result);
      } catch (e) {
        report.failed.push({
          name: target && target.name,
          scriptId: target && target.scriptId,
          status: 'failed',
          reason: e.message,
        });
      }
    }, this);

    return report;
  },

  /**
   * Procesa un único cliente.
   * @private
   */
  _deployOne(target, opts, dryRun) {
    if (!target || !target.scriptId) {
      throw new Error('Entrada sin scriptId. Ver la limitación documentada arriba.');
    }

    const content = this._getContent(target.scriptId);
    const installed = this.installedVersion(content.files);

    if (installed === this.BOOTSTRAP_VERSION) {
      return {
        name: target.name, scriptId: target.scriptId,
        status: 'upToDate', from: installed, to: this.BOOTSTRAP_VERSION,
      };
    }

    const nuevos = this.buildFiles(content.files, opts);

    if (dryRun) {
      return {
        name: target.name, scriptId: target.scriptId,
        status: 'updated', from: installed, to: this.BOOTSTRAP_VERSION,
        simulated: true,
        changes: nuevos.filter(function (f) { return f._changed; })
          .map(function (f) { return f.name; }),
      };
    }

    this._updateContent(target.scriptId, nuevos);
    return {
      name: target.name, scriptId: target.scriptId,
      status: 'updated', from: installed, to: this.BOOTSTRAP_VERSION,
      simulated: false,
    };
  },

  // -------------------------------------------------------------------------
  // Lógica pura — testeable sin red
  // -------------------------------------------------------------------------

  /**
   * Versión de arranque ya instalada, leyendo la marca del código.
   * @param {Array<{name:string, source:string}>} files
   * @returns {string|null} null si nunca se ha desplegado.
   */
  installedVersion(files) {
    const marker = this.VERSION_MARKER;
    let found = null;

    (files || []).forEach(function (f) {
      if (found || !f.source) return;
      const idx = f.source.indexOf(marker);
      if (idx === -1) return;
      const resto = f.source.substring(idx + marker.length);
      const m = resto.match(/\s*([0-9]+\.[0-9]+\.[0-9]+)/);
      if (m) found = m[1];
    });

    return found;
  },

  /**
   * Construye el conjunto de archivos a enviar: manifiesto con la biblioteca
   * vinculada + archivo de arranque, conservando todo lo demás intacto.
   *
   * @param {Array} existing
   * @param {{libraryScriptId:string, libraryVersion:number, libraryIdentifier:string}} opts
   * @returns {Array}
   */
  buildFiles(existing, opts) {
    const out = [];
    let manifestSeen = false;
    let bootstrapSeen = false;

    (existing || []).forEach(function (f) {
      if (f.type === 'JSON' && f.name === 'appsscript') {
        manifestSeen = true;
        const actualizado = this.mergeManifest(f.source, opts);
        out.push({
          name: f.name, type: f.type, source: actualizado,
          _changed: actualizado !== f.source,
        });
        return;
      }
      if (f.name === this.BOOTSTRAP_FILE) {
        bootstrapSeen = true;
        const nuevo = this.buildBootstrap(opts);
        out.push({
          name: f.name, type: 'SERVER_JS', source: nuevo,
          _changed: nuevo !== f.source,
        });
        return;
      }
      // Todo lo demás del cliente se respeta tal cual.
      out.push({ name: f.name, type: f.type, source: f.source, _changed: false });
    }, this);

    if (!manifestSeen) {
      out.push({
        name: 'appsscript', type: 'JSON',
        source: this.mergeManifest(null, opts), _changed: true,
      });
    }
    if (!bootstrapSeen) {
      out.push({
        name: this.BOOTSTRAP_FILE, type: 'SERVER_JS',
        source: this.buildBootstrap(opts), _changed: true,
      });
    }

    return out;
  },

  /**
   * Añade la dependencia de biblioteca al manifiesto sin pisar lo que ya haya.
   * @param {string|null} source
   * @param {{libraryScriptId:string, libraryVersion:number, libraryIdentifier:string}} opts
   * @returns {string}
   */
  mergeManifest(source, opts) {
    let manifest;
    try {
      manifest = source ? JSON.parse(source) : {};
    } catch (e) {
      throw new Error('El manifiesto del cliente no es JSON válido: ' + e.message);
    }

    if (!manifest.timeZone) manifest.timeZone = 'America/New_York';
    if (!manifest.runtimeVersion) manifest.runtimeVersion = 'V8';
    if (!manifest.dependencies) manifest.dependencies = {};
    if (!manifest.dependencies.libraries) manifest.dependencies.libraries = [];

    const identifier = opts.libraryIdentifier || 'GrupoLynLib';
    const libs = manifest.dependencies.libraries;
    let encontrada = false;

    for (let i = 0; i < libs.length; i++) {
      if (libs[i].libraryId === opts.libraryScriptId || libs[i].userSymbol === identifier) {
        libs[i].libraryId = opts.libraryScriptId;
        libs[i].userSymbol = identifier;
        libs[i].version = String(opts.libraryVersion || 1);
        libs[i].developmentMode = false;
        encontrada = true;
        break;
      }
    }

    if (!encontrada) {
      libs.push({
        userSymbol: identifier,
        libraryId: opts.libraryScriptId,
        version: String(opts.libraryVersion || 1),
        developmentMode: false,
      });
    }

    // Se AÑADEN los permisos que faltan, sin quitar los que el cliente ya tuviera:
    // la hoja puede llevar otro script encima con necesidades propias.
    const scopes = manifest.oauthScopes || [];
    this.REQUIRED_SCOPES.forEach(function (s) {
      if (scopes.indexOf(s) === -1) scopes.push(s);
    });
    manifest.oauthScopes = scopes;

    return JSON.stringify(manifest, null, 2);
  },

  /**
   * Código de arranque que se inyecta en el cliente.
   *
   * Es deliberadamente MÍNIMO: solo delega en la biblioteca. Así, para cambiar
   * el comportamiento basta con publicar una versión nueva de la biblioteca, sin
   * volver a tocar ni un solo archivo de cliente.
   *
   * @param {{libraryIdentifier:string}} opts
   * @returns {string}
   */
  buildBootstrap(opts) {
    const id = opts.libraryIdentifier || 'GrupoLynLib';
    return [
      '/**',
      ' * Archivo generado automáticamente por el despliegue de GrupoLyN.',
      ' * NO EDITAR: se sobrescribe en cada actualización.',
      ' *',
      ' * ' + this.VERSION_MARKER + ' ' + this.BOOTSTRAP_VERSION,
      ' *',
      ' * Solo delega en la biblioteca compartida. Para cambiar el comportamiento,',
      ' * publica una versión nueva de la biblioteca: no hace falta tocar este archivo.',
      ' */',
      '',
      '/**',
      ' * Entrega a la biblioteca los almacenes DE ESTA HOJA.',
      ' *',
      ' * Una biblioteca que llame a PropertiesService por su cuenta lee las',
      ' * propiedades de la biblioteca, que son las mismas para todos los clientes.',
      ' * Pasándole las de aquí, cada hoja conserva su propio código de',
      ' * administrador y su propio contador de intentos fallidos.',
      ' */',
      'function grupolynBind_() {',
      '  ' + id + '.bindHost(',
      '    PropertiesService.getScriptProperties(),',
      '    CacheService.getUserCache()',
      '  );',
      '}',
      '',
      'function onOpen() { grupolynBind_(); ' + id + '.onOpen(); }',
      'function showAuthDialog() { grupolynBind_(); ' + id + '.showAuthDialog(); }',
      'function showHelpDialog() { grupolynBind_(); ' + id + '.showHelpDialog(); }',
      'function processUnlock(code) { grupolynBind_(); return ' + id + '.processUnlock(code); }',
      'function lockAdmin() { grupolynBind_(); return ' + id + '.lockAdmin(); }',
      'function showReportDialog() { grupolynBind_(); return ' + id + '.showReportDialog(); }',
      'function runReportGeneration(p) { grupolynBind_(); return ' + id + '.runReportGeneration(p); }',
      '',
      '/**',
      ' * Instalación por hoja, UNA vez. El código de administrador vive en las',
      ' * Script Properties, y esas NO se copian al duplicar una hoja: por eso hace',
      ' * falta este paso aunque el resto ya venga desplegado.',
      ' *',
      ' * Escribe el código, ejecuta la función una vez, y vuelve a vaciarlo.',
      ' */',
      'function setupAdmin() {',
      "  const CODIGO = '';        // mínimo 8 caracteres",
      '  const AUTORIZADOS = [];   // opcional: [\'correo@dominio.com\']',
      '  if (!CODIGO) {',
      "    throw new Error('Escribe un código de al menos 8 caracteres en setupAdmin(), " +
        "ejecútala una vez, y bórralo.');",
      '  }',
      '  grupolynBind_();',
      '  return ' + id + '.installAdminCode(CODIGO, AUTORIZADOS);',
      '}',
      '',
    ].join('\n');
  },

  // -------------------------------------------------------------------------
  // Llamadas a la Apps Script API
  // -------------------------------------------------------------------------

  /** @private */
  _getContent(scriptId) {
    const res = UrlFetchApp.fetch(this.API + '/' + scriptId + '/content', {
      method: 'get',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    return this._parse(res, scriptId, 'leer');
  },

  /** @private */
  _updateContent(scriptId, files) {
    const limpios = files.map(function (f) {
      return { name: f.name, type: f.type, source: f.source };
    });

    const res = UrlFetchApp.fetch(this.API + '/' + scriptId + '/content', {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ files: limpios }),
      muteHttpExceptions: true,
    });
    return this._parse(res, scriptId, 'escribir');
  },

  /** @private */
  _parse(res, scriptId, accion) {
    const code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText());

    if (code === 403) {
      throw new Error('Sin permiso para ' + accion + ' el script ' + scriptId +
        '. Verifica que la cuenta de despliegue tenga acceso de edición.');
    }
    if (code === 404) {
      throw new Error('No existe el script ' + scriptId + '.');
    }
    throw new Error('Error ' + code + ' al ' + accion + ' ' + scriptId + ': ' +
      res.getContentText().substring(0, 200));
  },
};
