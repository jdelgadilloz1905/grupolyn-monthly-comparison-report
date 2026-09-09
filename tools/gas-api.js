/**
 * gas-api.js — cliente mínimo de la API de Apps Script, con el token de clasp.
 *
 * Se usa para dos cosas:
 *  1. Respaldar proyectos antes de tocar nada.
 *  2. Dar transporte real a Deployer.js, sustituyendo UrlFetchApp por fetch.
 *
 * Nunca imprime el token.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const RC = path.join(os.homedir(), '.clasprc.json');

function buscarClaves(obj, out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (k === 'access_token' && typeof v === 'string') out.access = v;
    if (k === 'refresh_token' && typeof v === 'string') out.refresh = v;
    if (k === 'client_id' && typeof v === 'string') out.clientId = v;
    if (k === 'client_secret' && typeof v === 'string') out.clientSecret = v;
    if (k === 'expiry_date' && typeof v === 'number') out.expiry = v;
    if (typeof v === 'object') buscarClaves(v, out);
  }
  return out;
}

let cacheToken = null;

async function getToken() {
  if (cacheToken) return cacheToken;
  const c = buscarClaves(JSON.parse(fs.readFileSync(RC, 'utf8')));

  if (c.expiry && c.expiry > Date.now() + 60000) {
    cacheToken = c.access;
    return cacheToken;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refresh,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('No se pudo renovar el token: ' + JSON.stringify(j).slice(0, 200));
  cacheToken = j.access_token;
  return cacheToken;
}

/** GET del contenido de un proyecto. */
async function getContent(scriptId) {
  const token = await getToken();
  const r = await fetch('https://script.googleapis.com/v1/projects/' + scriptId + '/content', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const texto = await r.text();
  if (r.status !== 200) throw new Error('GET ' + scriptId + ' -> HTTP ' + r.status + ': ' + texto.slice(0, 300));
  return JSON.parse(texto);
}

/** PUT del contenido de un proyecto. ESCRIBE. */
async function updateContent(scriptId, files) {
  const token = await getToken();
  const r = await fetch('https://script.googleapis.com/v1/projects/' + scriptId + '/content', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const texto = await r.text();
  if (r.status !== 200) throw new Error('PUT ' + scriptId + ' -> HTTP ' + r.status + ': ' + texto.slice(0, 300));
  return JSON.parse(texto);
}

/** Crea un proyecto standalone o vinculado (si se pasa parentId). */
async function createProject(title, parentId) {
  const token = await getToken();
  const body = parentId ? { title, parentId } : { title };
  const r = await fetch('https://script.googleapis.com/v1/projects', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const texto = await r.text();
  if (r.status !== 200) throw new Error('POST /projects -> HTTP ' + r.status + ': ' + texto.slice(0, 300));
  return JSON.parse(texto);
}

/** Crea una versión numerada del proyecto (necesario para usarlo como biblioteca). */
async function createVersion(scriptId, description) {
  const token = await getToken();
  const r = await fetch('https://script.googleapis.com/v1/projects/' + scriptId + '/versions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: description || '' }),
  });
  const texto = await r.text();
  if (r.status !== 200) throw new Error('POST /versions -> HTTP ' + r.status + ': ' + texto.slice(0, 300));
  return JSON.parse(texto);
}

module.exports = { getToken, getContent, updateContent, createProject, createVersion };
