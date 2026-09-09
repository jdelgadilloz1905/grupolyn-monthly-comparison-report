/**
 * Auth.js — control de acceso del menú Admin.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE ESTO ES Y LO QUE NO ES
 *
 * Esto es una BARRERA DE CONVENIENCIA, no un control de seguridad. En un script
 * vinculado a una hoja, cualquiera con permiso de edición puede abrir el editor
 * de Apps Script, leer el código y ver las Script Properties. No existe ningún
 * secreto que se pueda ocultar a un editor decidido.
 *
 * Lo que SÍ aporta:
 *  - Evita que alguien genere o envíe algo por accidente.
 *  - Guarda un hash, no la contraseña: si el código se reutiliza en otro sitio,
 *    aquí no queda expuesto.
 *  - Deja rastro auditable de cada intento.
 *  - Frena la fuerza bruta desde el propio diálogo.
 *
 * La frontera de seguridad REAL son los permisos de compartición del archivo,
 * los rangos protegidos, y —para producción— mover las operaciones sensibles a
 * un Web App desplegado como el propietario. Ver docs/01-casos-de-uso.md.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const Auth = {
  PROP_HASH: 'ADMIN_CODE_HASH',
  PROP_SALT: 'ADMIN_CODE_SALT',
  PROP_ALLOWLIST: 'ADMIN_ALLOWLIST',

  CACHE_SESSION: 'admin_session',
  CACHE_FAILS: 'admin_failed_attempts',
  CACHE_LOCK: 'admin_locked_until',

  /** Duración de la sesión de administrador, en segundos. */
  SESSION_TTL: 30 * 60,

  /** Duración del bloqueo tras agotar los intentos, en segundos. */
  LOCK_TTL: 15 * 60,

  /** Intentos fallidos permitidos antes de bloquear. */
  MAX_ATTEMPTS: 5,

  // -------------------------------------------------------------------------
  // Almacenes del anfitrión
  // -------------------------------------------------------------------------

  /** @private Inyectados por bindHost(). Nulos en instalación clásica. */
  _hostProps: null,
  _hostCache: null,

  /**
   * Inyecta los almacenes de quien invoca. Solo lo usa el despliegue por biblioteca.
   *
   * MOTIVO: cuando este código corre como BIBLIOTECA compartida,
   * `PropertiesService.getScriptProperties()` devuelve las propiedades de la
   * biblioteca, no las de la hoja del cliente que la llama. Sin corregirlo, los
   * 50 clientes compartirían un único código de administrador y un único
   * contador de intentos: uno falla cinco veces y bloquea a todos los demás.
   *
   * El arranque generado por el Deployer llama a esto en cada punto de entrada,
   * pasando los almacenes del propio cliente. En la instalación clásica —el
   * código vive dentro de la hoja— nadie lo llama y se usan los de siempre.
   *
   * @param {GoogleAppsScript.Properties.Properties} props
   * @param {GoogleAppsScript.Cache.Cache} cache
   */
  bindHost(props, cache) {
    this._hostProps = props || null;
    this._hostCache = cache || null;
    return this;
  },

  /** @private */
  _props() {
    return this._hostProps || PropertiesService.getScriptProperties();
  },

  // -------------------------------------------------------------------------
  // Instalación (se ejecuta UNA vez, a mano, desde el editor)
  // -------------------------------------------------------------------------

  /**
   * Define el código de administrador. Guarda un hash con salt, nunca el texto.
   * No hay código por defecto a propósito: un valor de fábrica es peor que no tener nada.
   *
   * @param {string} plainCode
   * @param {string[]} [allowedEmails] Lista blanca opcional.
   */
  setupAdminCode(plainCode, allowedEmails) {
    if (!plainCode || String(plainCode).length < 8) {
      throw new Error('The administrator code must be at least 8 characters long.');
    }

    const props = this._props();
    const salt = this._randomSalt();

    props.setProperty(this.PROP_SALT, salt);
    props.setProperty(this.PROP_HASH, this.hash(plainCode, salt));

    if (allowedEmails && allowedEmails.length) {
      props.setProperty(this.PROP_ALLOWLIST, allowedEmails.join(','));
    }

    return 'Administrator code configured. It is not stored in plain text.';
  },

  /** ¿Está el sistema configurado? */
  isConfigured() {
    const props = this._props();
    return !!(props.getProperty(this.PROP_HASH) && props.getProperty(this.PROP_SALT));
  },

  // -------------------------------------------------------------------------
  // Autenticación
  // -------------------------------------------------------------------------

  /**
   * Valida el código e inicia sesión.
   * @param {string} code
   * @returns {{ok: boolean, message: string}}
   */
  unlock(code) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'Administrator access has not been set up yet. ' +
          'Ask whoever installed this tool to complete the one-time setup.',
      };
    }

    if (this.isLockedOut()) {
      this._audit('unlock', false, 'locked out after repeated failures');
      return {
        ok: false,
        message: 'Too many failed attempts. Please try again in a few minutes.',
      };
    }

    // La lista blanca se comprueba ANTES que el código: un usuario no autorizado
    // no debe poder confirmar si un código es válido.
    if (!this._isAllowed(this._currentEmail())) {
      this._registerFailure();
      this._audit('unlock', false, 'user not in allowlist');
      return { ok: false, message: 'Incorrect code.' };
    }

    const props = this._props();
    const salt = props.getProperty(this.PROP_SALT);
    const expected = props.getProperty(this.PROP_HASH);

    if (this.hash(String(code || ''), salt) !== expected) {
      this._registerFailure();
      this._audit('unlock', false, 'incorrect code');
      // Mensaje genérico: no revela cuántos intentos quedan ni por qué falló.
      return { ok: false, message: 'Incorrect code.' };
    }

    this._cache().put(this.CACHE_SESSION, '1', this.SESSION_TTL);
    this._cache().remove(this.CACHE_FAILS);
    this._audit('unlock', true, '');

    // El texto se deriva de la constante: cambiar SESSION_TTL sin tocar esta
    // linea dejaria el mensaje mintiendo al usuario.
    return {
      ok: true,
      message: 'Admin menu unlocked for ' + (this.SESSION_TTL / 60) + ' minutes.',
    };
  },

  /** Cierra la sesión de administrador. */
  lock() {
    this._cache().remove(this.CACHE_SESSION);
    this._audit('lock', true, '');
    return { ok: true, message: 'Admin menu locked.' };
  },

  /** @returns {boolean} */
  isSessionValid() {
    return this._cache().get(this.CACHE_SESSION) === '1';
  },

  /**
   * Se llama al principio de TODA función de administrador.
   * El menú es cosmético: alguien puede invocar la función desde el editor.
   * @throws {Error} si no hay sesión.
   */
  requireSession() {
    if (!this.isSessionValid()) {
      throw new Error(
        'Restricted action. Unlock the Admin menu before continuing.'
      );
    }
    return true;
  },

  /** @returns {boolean} */
  isLockedOut() {
    return this._cache().get(this.CACHE_LOCK) === '1';
  },

  /**
   * SHA-256 del salt concatenado al código, en base64.
   * @param {string} plain
   * @param {string} salt
   * @returns {string}
   */
  hash(plain, salt) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(salt) + String(plain),
      Utilities.Charset.UTF_8
    );
    return Utilities.base64Encode(bytes);
  },

  // -------------------------------------------------------------------------
  // Privados
  // -------------------------------------------------------------------------

  /** @private */
  _registerFailure() {
    const cache = this._cache();
    const current = parseInt(cache.get(this.CACHE_FAILS) || '0', 10) + 1;

    if (current >= this.MAX_ATTEMPTS) {
      cache.put(this.CACHE_LOCK, '1', this.LOCK_TTL);
      cache.remove(this.CACHE_FAILS);
    } else {
      cache.put(this.CACHE_FAILS, String(current), this.LOCK_TTL);
    }
    return current;
  },

  /** @private */
  _isAllowed(email) {
    const raw = this._props().getProperty(this.PROP_ALLOWLIST);
    // Sin lista blanca configurada, solo manda el código.
    if (!raw) return true;

    const allowed = raw.split(',').map(function (e) { return e.trim().toLowerCase(); });
    return allowed.indexOf(String(email || '').toLowerCase()) !== -1;
  },

  /** @private */
  _currentEmail() {
    try {
      return Session.getEffectiveUser().getEmail();
    } catch (e) {
      return '';
    }
  },

  /** @private */
  _cache() {
    return this._hostCache || CacheService.getUserCache();
  },

  /** @private */
  _randomSalt() {
    return Utilities.getUuid() + Utilities.getUuid();
  },

  /**
   * Registra el intento en la hoja de auditoría.
   * Falla en silencio a propósito: que no se pueda auditar no debe impedir trabajar,
   * pero tampoco debe romper la autenticación.
   * @private
   */
  _audit(action, success, detail) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(Config.AUDIT_SHEET);

      if (!sheet) {
        sheet = ss.insertSheet(Config.AUDIT_SHEET);
        sheet.appendRow(['Timestamp', 'User', 'Action', 'Result', 'Detail']);
        sheet.hideSheet();
      }

      sheet.appendRow([
        new Date(),
        this._currentEmail(),
        action,
        success ? 'OK' : 'FAILED',
        detail || '',
      ]);
    } catch (e) {
      // Sin auditoría seguimos, pero el fallo queda en el log de ejecución.
      if (typeof Logger !== 'undefined') {
        Logger.log('Could not write audit entry: ' + e.message);
      }
    }
  },
};
