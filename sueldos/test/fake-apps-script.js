// Simulación mínima de SpreadsheetApp y compañía para correr Code.gs en Node.
// Solo implementa lo que usa Code.gs; cualquier otro método tira error, así un
// nombre mal escrito se detecta en las pruebas.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function estricto(obj, nombre) {
  return new Proxy(obj, {
    get(t, k) {
      if (k in t || typeof k === 'symbol' || k === 'then' || k === 'toJSON') return t[k];
      throw new Error(nombre + '.' + String(k) + ' no existe en la simulación');
    },
  });
}

function a1(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
  const col = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const c1 = col(m[1]), r1 = m[2] ? Number(m[2]) : 1;
  const c2 = m[3] ? col(m[3]) : c1, r2 = m[4] ? Number(m[4]) : m[3] ? null : r1;
  return { r: r1, c: c1, nr: r2 === null ? null : r2 - r1 + 1, nc: c2 - c1 + 1 };
}

let FechaDelContexto = Date; // las fechas tienen que ser del mismo "mundo" que el código probado

// Como Sheets al escribir: un texto con forma de fecha se vuelve fecha salvo en celdas de texto (@).
function interpretar(v, formato) {
  if (typeof v === 'string' && formato !== '@') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new FechaDelContexto(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (/^\d{4}-\d{2}$/.test(v)) return new FechaDelContexto(Number(v.slice(0, 4)), Number(v.slice(5)) - 1, 1);
  }
  return v;
}

function crearHoja(ss, nombre, id) {
  const celdas = new Map(); // 'r,c' -> valor
  const formatos = new Map();
  const hoja = {
    _celdas: celdas,
    getName: () => nombre,
    getSheetId: () => id,
    getLastRow() {
      let m = 0;
      for (const [k, v] of celdas) if (v !== '' && v !== null && v !== undefined) m = Math.max(m, Number(k.split(',')[0]));
      return m;
    },
    getLastColumn() {
      let m = 0;
      for (const [k, v] of celdas) if (v !== '' && v !== null && v !== undefined) m = Math.max(m, Number(k.split(',')[1]));
      return m;
    },
    getMaxRows: () => 1000,
    getRange(a, b, c, d) {
      if (typeof a === 'string') {
        const p = a1(a);
        return rango(p.r, p.c, p.nr === null ? 1000 - p.r + 1 : p.nr, p.nc);
      }
      return rango(a, b, c || 1, d || 1);
    },
    getDataRange() {
      return rango(1, 1, Math.max(hoja.getLastRow(), 1), Math.max(hoja.getLastColumn(), 1));
    },
    clear() { celdas.clear(); formatos.clear(); return hoja; },
    setFrozenRows: () => hoja,
    setFrozenColumns: () => hoja,
    setTabColor: () => hoja,
    setColumnWidth: () => hoja,
    setColumnWidths: () => hoja,
    activate: () => { ss._activa = hoja; return hoja; },
    setActiveRange: () => hoja,
  };
  function rango(r, c, nr, nc) {
    if (!(nr > 0 && nc > 0)) throw new Error('Rango inválido ' + [r, c, nr, nc]);
    const cada = f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) f(r + i, c + j, i, j); };
    const R = {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const fila = [];
          for (let j = 0; j < nc; j++) {
            const v = celdas.get(r + i + ',' + (c + j));
            fila.push(v === undefined ? '' : v);
          }
          out.push(fila);
        }
        return out;
      },
      getValue: () => R.getValues()[0][0],
      setValues(vals) {
        if (vals.length !== nr || vals.some(f => f.length !== nc)) throw new Error('setValues: tamaño ' + vals.length + 'x' + (vals[0] || []).length + ' en rango ' + nr + 'x' + nc);
        cada((rr, cc, i, j) => celdas.set(rr + ',' + cc, interpretar(vals[i][j], formatos.get(rr + ',' + cc))));
        return P;
      },
      setValue(v) { cada((rr, cc) => celdas.set(rr + ',' + cc, interpretar(v, formatos.get(rr + ',' + cc)))); return P; },
      setNumberFormat(f) { cada((rr, cc) => formatos.set(rr + ',' + cc, f)); return P; },
      clear() { cada((rr, cc) => { celdas.delete(rr + ',' + cc); formatos.delete(rr + ',' + cc); }); return P; },
      setDataValidation: () => P,
    };
    for (const m of ['setFontWeight', 'setFontColor', 'setFontSize', 'setBackground', 'setWrap', 'setVerticalAlignment', 'setHorizontalAlignment', 'setBorder']) R[m] = () => P;
    const P = estricto(R, 'Range');
    return P;
  }
  return estricto(hoja, 'Sheet');
}

function crearEntorno(archivos) {
  const alertas = [], toasts = [], pdfs = [];
  const hojas = [];
  let sig = 1;
  const ss = {
    _activa: null,
    getSheetByName: n => hojas.find(h => h.getName() === n) || null,
    insertSheet(n) { const h = crearHoja(ss, n, sig++); hojas.push(h); return h; },
    getSheets: () => hojas.slice(),
    deleteSheet(h) { hojas.splice(hojas.indexOf(h), 1); },
    setActiveSheet(h) { ss._activa = h; return h; },
    moveActiveSheet(pos) { const i = hojas.indexOf(ss._activa); hojas.splice(i, 1); hojas.splice(pos - 1, 0, ss._activa); },
    toast: (m) => toasts.push(m),
    getId: () => 'ID',
    getSpreadsheetTimeZone: () => 'America/Argentina/Buenos_Aires',
  };
  ss.insertSheet('Hoja 1');
  const SS = estricto(ss, 'Spreadsheet');
  const ui = estricto({
    alert: (a, b) => { alertas.push(b === undefined ? a : a + ': ' + b); return 'OK'; },
    createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => m }; return m; },
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    Button: { OK: 'OK', CANCEL: 'CANCEL' },
  }, 'Ui');
  const validacion = () => { const v = { requireValueInList: () => v, requireValueInRange: () => v, setAllowInvalid: () => v, build: () => ({}) }; return v; };
  const dos = n => (n < 10 ? '0' : '') + n;
  const contexto = vm.createContext({
    SpreadsheetApp: estricto({ getActive: () => SS, getUi: () => ui, newDataValidation: validacion, flush: () => {} }, 'SpreadsheetApp'),
    Utilities: estricto({
      formatDate: (d, tz, f) => { if (f !== 'yyyy-MM-dd') throw new Error('formato ' + f); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); },
      sleep: () => {},
    }, 'Utilities'),
    DriveApp: estricto({
      getFileById: () => ({ getParents: () => ({ hasNext: () => false }) }),
      getRootFolder: () => ({ createFolder: n => ({ getName: () => n, getUrl: () => 'url', createFile: b => pdfs.push(b.nombre) }) }),
    }, 'DriveApp'),
    UrlFetchApp: estricto({ fetch: () => ({ getResponseCode: () => 200, getBlob: () => { const b = { setName: n => { b.nombre = n; return b; } }; return b; } }) }, 'UrlFetchApp'),
    ScriptApp: estricto({ getOAuthToken: () => 'token' }, 'ScriptApp'),
  });
  FechaDelContexto = vm.runInContext('Date', contexto);
  const codigo = archivos.map(a => (a.endsWith('.gs') && fs.existsSync(a) ? fs.readFileSync(a, 'utf8') : a)).join('\n;\n');
  vm.runInContext(codigo, contexto);
  return { ctx: contexto, ss: SS, alertas, toasts, pdfs, valores: n => SS.getSheetByName(n).getDataRange().getValues() };
}

module.exports = { crearEntorno, carpeta: path.join(__dirname, '..') };
