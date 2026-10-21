/**
 * Relevamiento de uso de Quality Soft — backend de Google Apps Script.
 *
 * Va pegado en el editor de Apps Script de una planilla de Google
 * (Extensiones > Apps Script). La planilla guarda las respuestas:
 *   - "Respuestas": una fila por persona (marcas en JSON).
 *   - "Pantallas":  catálogo de las pantallas del menú, lo carga la página la primera vez.
 *   - "Matriz":     vista legible, una fila por pantalla y una columna por persona.
 *                   Se regenera en cada guardado; no la edites a mano.
 *
 * Implementar como aplicación web con "Ejecutar como: Yo" y acceso
 * restringido al dominio de la empresa, así Session.getActiveUser()
 * devuelve el mail de quien responde.
 */

const HOJA_RESP = 'Respuestas';
const HOJA_PANT = 'Pantallas';
const HOJA_MATRIZ = 'Matriz';
const COLS_RESP = ['email', 'nombre', 'area', 'notas', 'actualizado', 'marcas'];
const FRECUENCIAS = { d: 'Diario', s: 'Semanal', m: 'Mensual', r: 'Rara vez' };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Relevamiento Quality Soft')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- Llamadas desde la página -------------------------------------------

function cargar() {
  const email = emailActual_();
  if (!email) return { email: '', nombreSugerido: '', mine: null, tieneCatalogo: true };
  const mia = leerTodas_().find(r => r.email === email);
  return {
    email: email,
    nombreSugerido: nombreDesdeEmail_(email),
    mine: mia ? publica_(mia) : null,
    tieneCatalogo: hojaPantallas_().getLastRow() > 1,
  };
}

function obtenerTodas() {
  if (!emailActual_()) throw new Error('No se pudo identificar tu cuenta.');
  return leerTodas_().map(publica_);
}

function registrarPantallas(lista) {
  if (!emailActual_()) throw new Error('No se pudo identificar tu cuenta.');
  if (!Array.isArray(lista) || lista.length > 2000) throw new Error('Catálogo inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hojaPantallas_();
    if (sh.getLastRow() > 1) return true; // ya estaba cargado
    const filas = lista.map(p => [p[0], p[1], p[2], p[3]].map(v => String(v || '').slice(0, 200)));
    sh.getRange(2, 1, filas.length, 4).setValues(filas);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function guardar(datos) {
  const email = emailActual_();
  if (!email) throw new Error('No se pudo identificar tu cuenta.');
  datos = datos || {};
  const marcas = {};
  Object.keys(datos.marcas || {}).forEach(k => {
    const v = datos.marcas[k];
    if (FRECUENCIAS[v] && /^[a-z0-9_]{1,200}$/.test(k)) marcas[k] = v;
  });
  const fila = [
    email,
    String(datos.nombre || '').slice(0, 80),
    String(datos.area || '').slice(0, 60),
    String(datos.notas || '').slice(0, 4000),
    new Date(),
    JSON.stringify(marcas),
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hojaRespuestas_();
    const existente = leerTodas_().find(r => r.email === email);
    if (existente) sh.getRange(existente.fila, 1, 1, COLS_RESP.length).setValues([fila]);
    else sh.appendRow(fila);
    reconstruirMatriz_();
  } finally {
    lock.releaseLock();
  }
  return true;
}

// --- Planilla -------------------------------------------------------------

function hoja_(nombre, encabezados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    if (encabezados) {
      sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function hojaRespuestas_() { return hoja_(HOJA_RESP, COLS_RESP); }
function hojaPantallas_() { return hoja_(HOJA_PANT, ['id', 'Menú', 'Submenú', 'Pantalla']); }

function leerTodas_() {
  const valores = hojaRespuestas_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < valores.length; i++) {
    const r = valores[i];
    if (!r[0]) continue;
    let marcas = {};
    try { marcas = JSON.parse(r[5] || '{}'); } catch (e) { marcas = {}; }
    out.push({
      fila: i + 1,
      email: String(r[0]).toLowerCase(),
      nombre: String(r[1] || ''),
      area: String(r[2] || ''),
      notas: String(r[3] || ''),
      actualizado: r[4] instanceof Date ? r[4].toISOString() : String(r[4] || ''),
      marcas: marcas,
    });
  }
  return out;
}

function reconstruirMatriz_() {
  const pantallas = hojaPantallas_().getDataRange().getValues().slice(1).filter(p => p[0]);
  if (!pantallas.length) return;
  const personas = leerTodas_().sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
  const encabezado = ['Menú', 'Submenú', 'Pantalla', 'Personas que la usan']
    .concat(personas.map(p => p.nombre || p.email));
  const filas = pantallas.map(p => {
    const marcas = personas.map(per => FRECUENCIAS[per.marcas[p[0]]] || '');
    return [p[1], p[2], p[3], marcas.filter(Boolean).length].concat(marcas);
  });
  const sh = hoja_(HOJA_MATRIZ);
  sh.clearContents();
  sh.getRange(1, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight('bold');
  sh.getRange(2, 1, filas.length, encabezado.length).setValues(filas);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
}

// --- Utilidades -----------------------------------------------------------

function emailActual_() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}

function nombreDesdeEmail_(email) {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function publica_(r) {
  return { email: r.email, nombre: r.nombre, area: r.area, notas: r.notas, actualizado: r.actualizado, marcas: r.marcas };
}
