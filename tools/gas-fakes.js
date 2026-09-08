/**
 * gas-fakes.js — dobles de los servicios de Google Apps Script para pruebas locales.
 *
 * No pretenden ser fieles a todo: implementan lo que este proyecto usa, y añaden
 * un reloj controlable para poder probar caducidades sin esperar 30 minutos.
 *
 * Vive en tools/ para que clasp NO lo suba: es andamiaje de pruebas.
 */
const crypto = require('crypto');

function build() {
  // Reloj virtual: los tests lo adelantan a voluntad.
  const clock = { now: Date.now() };

  const scriptProps = {};
  const cacheStore = {};

  const auditLog = [];
  const sheets = {};

  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty: (k) => (k in scriptProps ? scriptProps[k] : null),
        setProperty: (k, v) => { scriptProps[k] = String(v); },
        deleteProperty: (k) => { delete scriptProps[k]; },
        getProperties: () => Object.assign({}, scriptProps),
      };
    },
  };

  const cacheApi = {
    get(k) {
      const e = cacheStore[k];
      if (!e) return null;
      if (e.expiresAt <= clock.now) { delete cacheStore[k]; return null; }
      return e.value;
    },
    put(k, v, ttlSeconds) {
      cacheStore[k] = { value: String(v), expiresAt: clock.now + (ttlSeconds * 1000) };
    },
    remove(k) { delete cacheStore[k]; },
  };

  const CacheService = {
    getUserCache: () => cacheApi,
    getScriptCache: () => cacheApi,
  };

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algo, value) {
      return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest());
    },
    base64Encode(bytes) {
      return Buffer.from(bytes).toString('base64');
    },
    getUuid() {
      return crypto.randomUUID();
    },
  };

  const session = { email: 'jdelgadilloz1905@gmail.com' };
  const Session = {
    getEffectiveUser: () => ({ getEmail: () => session.email }),
    getActiveUser: () => ({ getEmail: () => session.email }),
  };

  function fakeSheet(name) {
    const rows = [];
    return {
      _rows: rows,
      getName: () => name,
      appendRow: (r) => { rows.push(r); if (name === '_Admin Audit') auditLog.push(r); },
      hideSheet: () => {},
      clear: () => { rows.length = 0; },
      getRange: () => ({
        setValues: () => {},
        setNumberFormat: () => {},
        setFontWeight: () => ({ setBackground: () => {} }),
        setBackground: () => {},
      }),
      setFrozenRows: () => {},
      autoResizeColumn: () => {},
      getDataRange: () => ({ getValues: () => rows }),
    };
  }

  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => { sheets[n] = fakeSheet(n); return sheets[n]; },
      getSheets: () => Object.keys(sheets).map((n) => sheets[n]),
    }),
  };

  const drafts = [];
  const GmailApp = {
    createDraft(to, subject, body) {
      const d = { id: 'draft-' + (drafts.length + 1), to, subject, body };
      drafts.push(d);
      return { getId: () => d.id };
    },
  };

  return {
    globals: {
      PropertiesService, CacheService, Utilities, Session, SpreadsheetApp, GmailApp,
      Logger: { log: () => {} },
      console,
    },
    // Ganchos para que los tests inspeccionen y manipulen el entorno.
    control: {
      clock,
      advanceMinutes(m) { clock.now += m * 60 * 1000; },
      scriptProps,
      auditLog,
      drafts,
      sheets,
      setUserEmail(e) { session.email = e; },
      reset() {
        Object.keys(scriptProps).forEach((k) => delete scriptProps[k]);
        Object.keys(cacheStore).forEach((k) => delete cacheStore[k]);
        Object.keys(sheets).forEach((k) => delete sheets[k]);
        auditLog.length = 0;
        drafts.length = 0;
        clock.now = Date.now();
        session.email = 'jdelgadilloz1905@gmail.com';
      },
    },
  };
}

module.exports = { build };
