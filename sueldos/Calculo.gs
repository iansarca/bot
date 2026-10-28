/**
 * Sueldos — reglas de liquidación y armado de las tablas de salida.
 *
 * Este archivo no usa nada propio de Google (ni SpreadsheetApp ni Utilities):
 * recibe los datos de las hojas como objetos simples y devuelve filas listas
 * para escribir. Así se puede probar fuera de Google (ver test/calculo.test.js).
 *
 * Fechas: llegan como texto 'aaaa-mm-dd'. Períodos: texto 'aaaa-mm'.
 */

const CONVENIO_UOM = 'UOM';
const CONVENIO_FC = 'Fuera de convenio';

const REGIMEN_COMPLETO = 'Completo';
const REGIMEN_SOLO_JUB = 'Solo jubilación';
const REGIMEN_SIN = 'Sin aportes';

const AUMENTO_ESCALA = 'Aumento de escala';
const AUMENTO_ANTICIPO = 'Anticipo a cuenta';
const AUMENTO_SUELDO = 'Aumento de sueldo';

const HOJAS = {
  instrucciones: 'Cómo se usa',
  parametros: 'Parámetros',
  legajos: 'Legajos',
  escala: 'Escala UOM',
  topes: 'Topes',
  novedades: 'Novedades',
  aumentos: 'Aumentos previstos',
  planilla: 'Planilla original',
  liquidacion: 'Liquidación',
  proyeccion: 'Proyección',
  resumen: 'Resumen',
  evolucion: 'Evolución',
  control: 'Control',
  recibo: 'Recibo',
};

// Columnas de las hojas que se cargan a mano: [clave interna, encabezado, formato].
// El encabezado es lo que se busca en la fila 1, así que las columnas se pueden reordenar.
const COLUMNAS = {
  parametros: [['clave', 'Clave', 'texto'], ['valor', 'Valor', 'texto'], ['descripcion', 'Descripción', 'texto']],
  legajos: [
    ['legajo', 'Legajo', 'texto'],
    ['nombre', 'Apellido y nombre', 'texto'],
    ['cuil', 'CUIL', 'texto'],
    ['convenio', 'Convenio', 'texto'],
    ['categoria', 'Categoría', 'texto'],
    ['ingreso', 'Fecha de ingreso', 'fecha'],
    ['aniosReconocidos', 'Años de antigüedad reconocidos', 'num'],
    ['regimen', 'Régimen de aportes', 'texto'],
    ['afiliado', 'Afiliado UOM', 'texto'],
    ['estado', 'Estado', 'texto'],
    ['baja', 'Fecha de baja', 'fecha'],
    ['observaciones', 'Observaciones', 'texto'],
  ],
  escala: [
    ['desde', 'Desde período', 'periodo'],
    ['categoria', 'Categoría', 'texto'],
    ['basico', 'Básico mensual', 'pesos'],
    ['observaciones', 'Observaciones', 'texto'],
  ],
  topes: [
    ['desde', 'Desde período', 'periodo'],
    ['tope', 'Tope base de aportes', 'pesos'],
    ['observaciones', 'Observaciones', 'texto'],
  ],
  novedades: [
    ['periodo', 'Período', 'periodo'],
    ['legajo', 'Legajo', 'texto'],
    ['nombre', 'Empleado', 'texto'],
    ['basico', 'Sueldo básico (fuera de convenio)', 'pesos'],
    ['netoPactado', 'Neto pactado (fuera de convenio)', 'pesos'],
    ['aCuenta', 'A cuenta futuros aumentos', 'pesos'],
    ['anticipo', 'Anticipo absorbible', 'pesos'],
    ['horasExtra', 'Horas extra', 'pesos'],
    ['otrosRem', 'Otros remunerativos', 'pesos'],
    ['noRem', 'No remunerativos', 'pesos'],
    ['descuentos', 'Otros descuentos', 'pesos'],
    ['dias', 'Días trabajados', 'num'],
    ['observaciones', 'Observaciones', 'texto'],
  ],
  aumentos: [
    ['desde', 'Desde período', 'periodo'],
    ['convenio', 'Convenio', 'texto'],
    ['tipo', 'Tipo', 'texto'],
    ['porcentaje', 'Porcentaje', 'porc'],
    ['observaciones', 'Observaciones', 'texto'],
  ],
  planilla: [
    ['periodo', 'Período', 'periodo'],
    ['legajo', 'Legajo', 'texto'],
    ['nombre', 'Empleado', 'texto'],
    ['bruto', 'Bruto planilla', 'pesos'],
    ['neto', 'Neto planilla', 'pesos'],
  ],
};

// Columnas de Liquidación y Proyección.
const COLUMNAS_LIQ = [
  ['periodo', 'Período', 'periodo'],
  ['tipo', 'Tipo', 'texto'],
  ['legajo', 'Legajo', 'texto'],
  ['nombre', 'Empleado', 'texto'],
  ['convenio', 'Convenio', 'texto'],
  ['categoria', 'Categoría', 'texto'],
  ['anios', 'Años antigüedad', 'num'],
  ['dias', 'Días', 'num'],
  ['basico', 'Básico', 'pesos'],
  ['antiguedad', 'Antigüedad', 'pesos'],
  ['aCuenta', 'A cuenta futuros aumentos', 'pesos'],
  ['anticipo', 'Anticipo absorbible', 'pesos'],
  ['horasExtra', 'Horas extra', 'pesos'],
  ['otrosRem', 'Otros remunerativos', 'pesos'],
  ['remunerativo', 'Total remunerativo', 'pesos'],
  ['sac', 'SAC (aguinaldo)', 'pesos'],
  ['noRem', 'No remunerativo', 'pesos'],
  ['jubilacion', 'Jubilación', 'pesos'],
  ['ley19032', 'Ley 19.032 (PAMI)', 'pesos'],
  ['obraSocial', 'Obra social', 'pesos'],
  ['cuotaSindical', 'Cuota sindical', 'pesos'],
  ['fijoUOM', 'Aporte fijo UOM', 'pesos'],
  ['aportes', 'Total aportes', 'pesos'],
  ['descuentos', 'Otros descuentos', 'pesos'],
  ['neto', 'Neto a cobrar', 'pesos'],
  ['netoSinSAC', 'Neto sin SAC', 'pesos'],
  ['contribuciones', 'Contribuciones patronales', 'pesos'],
  ['art', 'ART y seguro de vida', 'pesos'],
  ['costo', 'Costo total empresa', 'pesos'],
  ['observaciones', 'Observaciones', 'texto'],
];

// [clave, valor por defecto, descripción]. Los porcentajes van como fracción (0,11 = 11%).
const PARAMETROS_DEFECTO = [
  ['EMPRESA', '', 'Nombre de la empresa para el encabezado del recibo.'],
  ['APORTE_JUBILACION', 0.11, 'Aporte del empleado: jubilación (SIPA).'],
  ['APORTE_LEY_19032', 0.03, 'Aporte del empleado: Ley 19.032 (PAMI).'],
  ['APORTE_OBRA_SOCIAL', 0.03, 'Aporte del empleado: obra social (incluye ANSSAL).'],
  ['CUOTA_SINDICAL_UOM', 0.025, 'Cuota sindical UOM, solo a los afiliados.'],
  ['APORTE_FIJO_UOM', 7368, 'Monto fijo que se descuenta a los afiliados UOM además de la cuota sindical.'],
  ['ANTIGUEDAD_UOM_POR_ANIO', 0.01, 'Adicional por antigüedad UOM: porcentaje del básico por cada año cumplido.'],
  ['CONTRIB_JUBILACION', 0.11, 'Contribución patronal: jubilación.'],
  ['CONTRIB_LEY_19032', 0.02, 'Contribución patronal: Ley 19.032.'],
  ['CONTRIB_FNE', 0.05, 'Contribución patronal: Fondo Nacional de Empleo.'],
  ['CONTRIB_ASIG_FAMILIARES', 0.05, 'Contribución patronal: asignaciones familiares.'],
  ['CONTRIB_OBRA_SOCIAL', 0.05, 'Contribución patronal: obra social.'],
  ['CONTRIB_ANSSAL', 0.01, 'Contribución patronal: ANSSAL.'],
  ['ART_VARIABLE', 0.05, 'ART: porcentaje sobre la remuneración.'],
  ['ART_FIJO', 1827, 'ART: monto fijo por persona por mes.'],
  ['SEGURO_VIDA_OBLIGATORIO', 425, 'Seguro colectivo de vida obligatorio, por persona por mes.'],
  ['DIAS_MES', 30, 'Días del mes para calcular los proporcionales (ingresos y egresos).'],
  ['SAC_AUTOMATICO', 'Sí', 'Sí: en junio y diciembre se calcula el aguinaldo solo.'],
  ['ABSORBER_ANTICIPO', 'Sí', 'Sí: cuando sube el básico de la escala, el anticipo absorbible baja en lo mismo que subió.'],
  ['PROYECTAR_HASTA', '2027-04', 'Último mes de la proyección (aaaa-mm).'],
];

// --- Conversión de valores ---------------------------------------------------

function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  let s = String(v).replace(/[$\s]/g, '');
  if (!s || s === '-') return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function texto(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function siNo(v, porDefecto) {
  const s = texto(v).toLowerCase();
  if (!s) return porDefecto;
  return /^(s|si|sí|x|true|1|verdadero)$/.test(s);
}

function r2(x) {
  return Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100 || 0;
}

function dos(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Devuelve 'aaaa-mm' o '' si no se entiende. */
function periodo(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + dos(v.getMonth() + 1);
  const s = texto(v);
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return m[1] + '-' + dos(Number(m[2]));
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + dos(Number(m[1]));
  m = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + dos(Number(m[1]));
  return '';
}

/** Devuelve {y, m, d} o null. Acepta 'aaaa-mm-dd' y 'dd/mm/aaaa'. */
function fecha(v) {
  if (v instanceof Date) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  const s = texto(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
  return null;
}

function sumarMeses(p, n) {
  const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return yy + '-' + dos(mm + 1);
}

function ultimoDia(p) {
  const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7));
  return { y: y, m: m, d: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

function diaNumero(f) {
  return Math.round(Date.UTC(f.y, f.m - 1, f.d) / 86400000);
}

/** Años cumplidos desde el ingreso al último día del período. */
function aniosCumplidos(ingreso, p) {
  if (!ingreso) return 0;
  const fin = ultimoDia(p);
  let a = fin.y - ingreso.y;
  if (fin.m < ingreso.m || (fin.m === ingreso.m && fin.d < ingreso.d)) a--;
  return Math.max(0, a);
}

/** Última fila con desde <= p que cumple el filtro (las filas vienen ordenadas por desde). */
function vigenteEn(filas, p, filtro) {
  let r = null;
  for (const f of filas) if (f.desde && f.desde <= p && (!filtro || filtro(f))) r = f;
  return r;
}

function basicoEscala(escala, categoria, p) {
  const f = vigenteEn(escala, p, e => e.categoria === categoria);
  return f ? f.basico : null;
}

function esMesSAC(p) {
  const m = p.slice(5, 7);
  return m === '06' || m === '12';
}

// --- Lectura de los datos crudos ----------------------------------------------

function leerParametros(filas) {
  const p = {};
  for (const [clave, valor] of PARAMETROS_DEFECTO) p[clave] = valor;
  for (const f of filas || []) {
    const k = texto(f.clave).toUpperCase();
    if (k) p[k] = f.valor;
  }
  const numericos = PARAMETROS_DEFECTO.filter(d => typeof d[1] === 'number').map(d => d[0]);
  for (const k of numericos) p[k] = num(p[k]);
  if (!(p.DIAS_MES > 0)) p.DIAS_MES = 30;
  p.SAC_AUTOMATICO = siNo(p.SAC_AUTOMATICO, true);
  p.ABSORBER_ANTICIPO = siNo(p.ABSORBER_ANTICIPO, true);
  p.PROYECTAR_HASTA = periodo(p.PROYECTAR_HASTA);
  p.EMPRESA = texto(p.EMPRESA);
  return p;
}

function normalizarConvenio(v) {
  const s = texto(v).toLowerCase();
  if (s === 'uom' || s.indexOf('uom') === 0) return CONVENIO_UOM;
  return CONVENIO_FC;
}

function normalizarRegimen(v) {
  const s = texto(v).toLowerCase();
  if (s.indexOf('sin') === 0) return REGIMEN_SIN;
  if (s.indexOf('solo') === 0) return REGIMEN_SOLO_JUB;
  return REGIMEN_COMPLETO;
}

function normalizarTipoAumento(v) {
  const s = texto(v).toLowerCase();
  if (s.indexOf('escala') >= 0) return AUMENTO_ESCALA;
  if (s.indexOf('anticipo') >= 0) return AUMENTO_ANTICIPO;
  if (s.indexOf('sueldo') >= 0) return AUMENTO_SUELDO;
  return '';
}

function porDesde(a, b) {
  return a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0;
}

/** Convierte lo leído de las hojas en datos tipados y junta los avisos. */
function prepararDatos(crudo) {
  const avisos = [];
  const p = leerParametros(crudo.parametros);

  const legajos = new Map();
  for (const f of crudo.legajos || []) {
    const id = texto(f.legajo);
    if (!id) continue;
    if (legajos.has(id)) avisos.push('Legajo repetido: ' + id + '. Se usa la primera fila.');
    if (legajos.has(id)) continue;
    const convenio = normalizarConvenio(f.convenio);
    const leg = {
      legajo: id,
      nombre: texto(f.nombre),
      cuil: texto(f.cuil),
      convenio: convenio,
      categoria: texto(f.categoria),
      ingreso: fecha(f.ingreso),
      aniosReconocidos: num(f.aniosReconocidos),
      regimen: normalizarRegimen(f.regimen),
      afiliado: convenio === CONVENIO_UOM && siNo(f.afiliado, true),
      activo: texto(f.estado).toLowerCase() !== 'baja',
      baja: fecha(f.baja),
    };
    if (!leg.ingreso) avisos.push('Legajo ' + id + ' (' + leg.nombre + ') no tiene fecha de ingreso: no se calcula antigüedad.');
    legajos.set(id, leg);
  }

  const escala = (crudo.escala || [])
    .map(f => ({ desde: periodo(f.desde), categoria: texto(f.categoria), basico: num(f.basico) }))
    .filter(f => f.desde && f.basico > 0)
    .sort(porDesde);

  const topes = (crudo.topes || [])
    .map(f => ({ desde: periodo(f.desde), tope: num(f.tope) }))
    .filter(f => f.desde)
    .sort(porDesde);

  const novedades = [];
  const vistas = new Set();
  for (const f of crudo.novedades || []) {
    const per = periodo(f.periodo), id = texto(f.legajo);
    if (!per && !id) continue;
    if (!per || !id) {
      avisos.push('Novedades: hay una fila sin período o sin legajo (' + (per || id) + '). Se ignora.');
      continue;
    }
    if (!legajos.has(id)) {
      avisos.push('Novedades ' + per + ': el legajo ' + id + ' no está en la hoja Legajos. Se ignora.');
      continue;
    }
    if (vistas.has(per + '|' + id)) {
      avisos.push('Novedades ' + per + ': el legajo ' + id + ' está dos veces. Se usa la primera fila.');
      continue;
    }
    vistas.add(per + '|' + id);
    novedades.push(normalizarNovedad(f, per, id));
  }
  novedades.sort((a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0));

  const aumentos = [];
  for (const f of crudo.aumentos || []) {
    const desde = periodo(f.desde);
    if (!desde) continue;
    const convenio = normalizarConvenio(f.convenio);
    const tipo = normalizarTipoAumento(f.tipo);
    const pct = num(f.porcentaje);
    const valido = convenio === CONVENIO_UOM ? tipo === AUMENTO_ESCALA || tipo === AUMENTO_ANTICIPO : tipo === AUMENTO_SUELDO;
    if (!valido) {
      avisos.push('Aumentos previstos ' + desde + ': el tipo "' + texto(f.tipo) + '" no corresponde a ' + convenio + '. Se ignora.');
      continue;
    }
    aumentos.push({ desde: desde, convenio: convenio, tipo: tipo, porcentaje: pct });
  }
  aumentos.sort(porDesde);

  const planilla = (crudo.planilla || [])
    .map(f => ({ periodo: periodo(f.periodo), legajo: texto(f.legajo), nombre: texto(f.nombre), bruto: num(f.bruto), neto: num(f.neto) }))
    .filter(f => f.periodo && f.legajo);

  return { p, legajos, escala, topes, novedades, aumentos, planilla, avisos };
}

function normalizarNovedad(f, per, id) {
  return {
    periodo: per,
    legajo: id,
    basico: num(f.basico),
    netoPactado: num(f.netoPactado),
    aCuenta: num(f.aCuenta),
    anticipo: num(f.anticipo),
    horasExtra: num(f.horasExtra),
    otrosRem: num(f.otrosRem),
    noRem: num(f.noRem),
    descuentos: num(f.descuentos),
    dias: num(f.dias),
    sac: 0,
    observaciones: texto(f.observaciones),
  };
}

// --- Liquidación de una persona en un mes ---------------------------------------

function tasasAportes(leg, p) {
  const completo = leg.regimen === REGIMEN_COMPLETO;
  return {
    jub: leg.regimen === REGIMEN_SIN ? 0 : p.APORTE_JUBILACION,
    pami: completo ? p.APORTE_LEY_19032 : 0,
    os: completo ? p.APORTE_OBRA_SOCIAL : 0,
    sind: leg.afiliado ? p.CUOTA_SINDICAL_UOM : 0,
    fijo: leg.afiliado ? p.APORTE_FIJO_UOM : 0,
  };
}

function tasaContribuciones(p) {
  return p.CONTRIB_JUBILACION + p.CONTRIB_LEY_19032 + p.CONTRIB_FNE + p.CONTRIB_ASIG_FAMILIARES + p.CONTRIB_OBRA_SOCIAL + p.CONTRIB_ANSSAL;
}

function topeEn(topes, p) {
  const f = vigenteEn(topes, p);
  return f && f.tope > 0 ? f.tope : 0;
}

/**
 * Remunerativo que deja un neto dado: neto = R - aportes(R).
 * aportes(R) = (jub+pami+os) * min(R, tope) + cuota sindical * R + fijo.
 */
function brutoDesdeNeto(neto, t, tope) {
  const rTope = t.jub + t.pami + t.os, rLibre = t.sind;
  let R = (neto + t.fijo) / (1 - rTope - rLibre);
  if (tope && R > tope) R = (neto + t.fijo + rTope * tope) / (1 - rLibre);
  return R;
}

/**
 * Liquida a una persona en un período.
 * nov: novedad normalizada (con nov.sac ya calculado si corresponde).
 * ctx: { p, escala, topes }.
 */
function liquidar(leg, nov, ctx) {
  const p = ctx.p, per = nov.periodo, obs = [];
  const esUOM = leg.convenio === CONVENIO_UOM;
  const dias = nov.dias > 0 ? Math.min(nov.dias, p.DIAS_MES) : p.DIAS_MES;
  const prop = dias / p.DIAS_MES;
  const anios = esUOM && leg.ingreso ? aniosCumplidos(leg.ingreso, per) + leg.aniosReconocidos : 0;
  const t = tasasAportes(leg, p);
  const tope = topeEn(ctx.topes, per);

  let basicoMes = 0, antigMes = 0;
  if (esUOM) {
    const b = basicoEscala(ctx.escala, leg.categoria, per);
    if (b === null) obs.push('No hay básico en la Escala UOM para la categoría "' + leg.categoria + '" en ' + per + '.');
    basicoMes = b || 0;
    antigMes = basicoMes * p.ANTIGUEDAD_UOM_POR_ANIO * anios;
  } else {
    basicoMes = nov.basico;
  }

  const r = {
    periodo: per,
    tipo: nov.tipo || 'Real',
    legajo: leg.legajo,
    nombre: leg.nombre,
    convenio: leg.convenio,
    categoria: leg.categoria,
    anios: esUOM ? anios : leg.ingreso ? aniosCumplidos(leg.ingreso, per) : '',
    dias: dias,
    basico: r2(basicoMes * prop),
    antiguedad: r2(antigMes * prop),
    aCuenta: r2(nov.aCuenta * prop),
    anticipo: r2(nov.anticipo * prop),
    horasExtra: r2(nov.horasExtra),
    otrosRem: r2(nov.otrosRem),
    noRem: r2(nov.noRem),
    descuentos: r2(nov.descuentos),
    sac: r2(nov.sac || 0),
  };

  if (!esUOM && nov.netoPactado > 0) {
    // Se pacta el neto: se busca el básico que lo deja, con los demás conceptos como están.
    const otros = r.aCuenta + r.anticipo + r.horasExtra + r.otrosRem;
    const R = brutoDesdeNeto(nov.netoPactado * prop - r.noRem + r.descuentos, t, tope);
    r.basico = r2(R - otros);
    obs.push('Básico calculado desde el neto pactado.');
    if (nov.basico > 0) obs.push('Se ignoró el sueldo básico cargado porque hay neto pactado.');
  } else if (!esUOM && !(nov.basico > 0)) {
    obs.push('Falta el sueldo básico (o el neto pactado).');
  }

  r.remunerativo = r2(r.basico + r.antiguedad + r.aCuenta + r.anticipo + r.horasExtra + r.otrosRem);

  const base = tope ? Math.min(r.remunerativo, tope) : r.remunerativo;
  const baseSac = tope ? Math.min(r.sac, tope / 2) : r.sac;
  const aportesDe = (b, bs, rem) => ({
    jubilacion: r2(b * t.jub) + r2(bs * t.jub),
    ley19032: r2(b * t.pami) + r2(bs * t.pami),
    obraSocial: r2(b * t.os) + r2(bs * t.os),
    cuotaSindical: r2(rem * t.sind),
    fijoUOM: r.remunerativo > 0 ? t.fijo : 0,
  });
  const ap = aportesDe(base, baseSac, r.remunerativo + r.sac);
  const apMes = aportesDe(base, 0, r.remunerativo);
  Object.assign(r, ap);
  for (const k in r) if (typeof r[k] === 'number') r[k] = r2(r[k]);
  r.aportes = r2(ap.jubilacion + ap.ley19032 + ap.obraSocial + ap.cuotaSindical + ap.fijoUOM);
  const aportesMes = apMes.jubilacion + apMes.ley19032 + apMes.obraSocial + apMes.cuotaSindical + apMes.fijoUOM;
  r.neto = r2(r.remunerativo + r.sac + r.noRem - r.aportes - r.descuentos);
  r.netoSinSAC = r2(r.remunerativo + r.noRem - aportesMes - r.descuentos);

  const conCargas = leg.regimen !== REGIMEN_SIN;
  const masa = r.remunerativo + r.sac;
  r.contribuciones = conCargas ? r2(masa * tasaContribuciones(p)) : 0;
  r.art = conCargas && r.remunerativo > 0 ? r2(masa * p.ART_VARIABLE + p.ART_FIJO + p.SEGURO_VIDA_OBLIGATORIO) : 0;
  r.costo = r2(masa + r.noRem + r.contribuciones + r.art);

  if (tope && r.remunerativo > tope) obs.push('Aportes con tope (' + tope + ').');
  if (leg.ingreso && diaNumero(leg.ingreso) > diaNumero(ultimoDia(per))) obs.push('La fecha de ingreso es posterior al período.');
  if (nov.observaciones) obs.push(nov.observaciones);
  r.observaciones = obs.join(' ');
  return r;
}

// --- Aguinaldo -----------------------------------------------------------------------

/**
 * SAC del semestre que termina en p (junio o diciembre): 50% de la mejor
 * remuneración mensual del semestre, proporcional si entró durante el semestre.
 * remPorPeriodo: { 'aaaa-mm': total remunerativo } de la persona.
 */
function calcularSAC(leg, p, remPorPeriodo) {
  const y = Number(p.slice(0, 4));
  const primero = p.slice(5, 7) === '06' ? y + '-01' : y + '-07';
  let mejor = 0;
  for (let m = primero; m <= p; m = sumarMeses(m, 1)) mejor = Math.max(mejor, remPorPeriodo[m] || 0);
  const ini = diaNumero({ y: y, m: Number(primero.slice(5, 7)), d: 1 });
  const fin = diaNumero(ultimoDia(p));
  const desde = leg.ingreso ? Math.max(ini, diaNumero(leg.ingreso)) : ini;
  const fraccion = Math.max(0, fin - desde + 1) / (fin - ini + 1);
  return r2((mejor / 2) * fraccion);
}

/**
 * Liquida una novedad agregando el SAC si corresponde.
 * remHist: Map legajo -> { periodo: remunerativo }, se va completando.
 */
function liquidarConSAC(leg, nov, ctx, remHist) {
  let r = liquidar(leg, nov, ctx);
  if (!remHist.has(leg.legajo)) remHist.set(leg.legajo, {});
  remHist.get(leg.legajo)[nov.periodo] = r.remunerativo;
  if (ctx.p.SAC_AUTOMATICO && esMesSAC(nov.periodo)) {
    const sac = calcularSAC(leg, nov.periodo, remHist.get(leg.legajo));
    if (sac > 0) r = liquidar(leg, Object.assign({}, nov, { sac: sac }), ctx);
  }
  return r;
}

// --- Meses reales, preparar mes siguiente y proyección -----------------------------

function liquidarReales(d) {
  const ctx = { p: d.p, escala: d.escala, topes: d.topes };
  const remHist = new Map();
  return d.novedades.map(n => liquidarConSAC(d.legajos.get(n.legajo), n, ctx, remHist));
}

function ultimoPeriodo(novedades) {
  return novedades.reduce((max, n) => (n.periodo > max ? n.periodo : max), '');
}

function legajoVigente(leg, per) {
  if (!leg.activo) return false;
  if (leg.ingreso && diaNumero(leg.ingreso) > diaNumero(ultimoDia(per))) return false;
  return true;
}

/** Diferencia del básico de escala entre un mes y el anterior (0 si no hay escala). */
function subaEscala(escala, categoria, per) {
  const antes = basicoEscala(escala, categoria, sumarMeses(per, -1));
  const ahora = basicoEscala(escala, categoria, per);
  return antes !== null && ahora !== null ? ahora - antes : 0;
}

/** Arrastra la novedad de un mes al siguiente: copia lo fijo y limpia lo variable. */
function arrastrarNovedad(prev, per) {
  return {
    periodo: per,
    legajo: prev.legajo,
    basico: prev.basico,
    netoPactado: prev.netoPactado,
    aCuenta: prev.aCuenta,
    anticipo: prev.anticipo,
    horasExtra: 0,
    otrosRem: 0,
    noRem: 0,
    descuentos: 0,
    dias: 0,
    sac: 0,
    observaciones: '',
  };
}

/**
 * Novedades del mes siguiente al último cargado, para los legajos activos.
 * Copia básico, neto pactado, a cuenta y anticipo del mes anterior; si subió
 * la escala UOM descuenta la suba del anticipo absorbible.
 */
function prepararMes(d) {
  const ult = ultimoPeriodo(d.novedades);
  if (!ult) return { periodo: '', filas: [] };
  const per = sumarMeses(ult, 1);
  const previas = new Map(d.novedades.filter(n => n.periodo === ult).map(n => [n.legajo, n]));
  const filas = [];
  for (const leg of d.legajos.values()) {
    if (!legajoVigente(leg, per)) continue;
    const prev = previas.get(leg.legajo);
    const n = prev ? arrastrarNovedad(prev, per) : normalizarNovedad({}, per, leg.legajo);
    if (!prev) n.observaciones = 'Nuevo: completar.';
    if (leg.convenio === CONVENIO_UOM && d.p.ABSORBER_ANTICIPO && n.anticipo > 0) {
      const suba = subaEscala(d.escala, leg.categoria, per);
      if (suba > 0) n.anticipo = r2(Math.max(0, n.anticipo - suba));
    }
    n.nombre = leg.nombre;
    filas.push(n);
  }
  return { periodo: per, filas: filas };
}

/**
 * Proyecta desde el mes siguiente al último real hasta PROYECTAR_HASTA,
 * aplicando la hoja Aumentos previstos.
 */
function proyectar(d, reales) {
  const desde = ultimoPeriodo(d.novedades), hasta = d.p.PROYECTAR_HASTA;
  if (!desde || !hasta || hasta <= desde) return [];

  const escala = d.escala.slice();
  const categorias = Array.from(new Set(Array.from(d.legajos.values()).filter(l => l.convenio === CONVENIO_UOM).map(l => l.categoria)));
  const ctx = { p: d.p, escala: escala, topes: d.topes };

  const remHist = new Map();
  for (const r of reales) {
    if (!remHist.has(r.legajo)) remHist.set(r.legajo, {});
    remHist.get(r.legajo)[r.periodo] = r.remunerativo;
  }

  let actuales = new Map(d.novedades.filter(n => n.periodo === desde).map(n => [n.legajo, n]));
  const remAnterior = new Map(reales.filter(r => r.periodo === desde).map(r => [r.legajo, r.remunerativo]));
  const filas = [];

  for (let per = sumarMeses(desde, 1); per <= hasta; per = sumarMeses(per, 1)) {
    const delMes = d.aumentos.filter(a => a.desde === per);

    // Escala del mes: si ya hay una fila real se respeta; si no, se aplica el aumento previsto.
    for (const cat of categorias) {
      const real = escala.some(e => e.desde === per && e.categoria === cat);
      const antes = basicoEscala(escala, cat, sumarMeses(per, -1));
      if (real || antes === null) continue;
      const pct = delMes.filter(a => a.tipo === AUMENTO_ESCALA).reduce((acc, a) => acc * (1 + a.porcentaje), 1);
      if (pct !== 1) {
        escala.push({ desde: per, categoria: cat, basico: r2(antes * pct), proyectado: true });
        escala.sort(porDesde);
      }
    }

    const siguientes = new Map();
    for (const leg of d.legajos.values()) {
      if (!legajoVigente(leg, per)) continue;
      const prev = actuales.get(leg.legajo);
      if (!prev) continue; // sin datos del último mes real no hay de dónde proyectar
      const n = arrastrarNovedad(prev, per);
      n.tipo = 'Proyectado';
      if (leg.convenio === CONVENIO_UOM) {
        if (d.p.ABSORBER_ANTICIPO && n.anticipo > 0) {
          const suba = subaEscala(escala, leg.categoria, per);
          if (suba > 0) n.anticipo = r2(Math.max(0, n.anticipo - suba));
        }
        for (const a of delMes) {
          if (a.convenio === CONVENIO_UOM && a.tipo === AUMENTO_ANTICIPO) n.anticipo = r2(n.anticipo + (remAnterior.get(leg.legajo) || 0) * a.porcentaje);
        }
      } else {
        for (const a of delMes) {
          if (a.convenio !== CONVENIO_FC) continue;
          if (n.netoPactado > 0) n.netoPactado = r2(n.netoPactado * (1 + a.porcentaje));
          else n.basico = r2(n.basico * (1 + a.porcentaje));
        }
      }
      const r = liquidarConSAC(leg, n, ctx, remHist);
      filas.push(r);
      siguientes.set(leg.legajo, n);
      remAnterior.set(leg.legajo, r.remunerativo);
    }
    actuales = siguientes;
  }
  return filas;
}

// --- Tablas de salida ------------------------------------------------------------------

function tablaDesdeObjetos(columnas, objetos) {
  return {
    encabezado: columnas.map(c => c[1]),
    formatos: columnas.map(c => c[2]),
    filas: objetos.map(o => columnas.map(c => (o[c[0]] === undefined || o[c[0]] === null ? '' : o[c[0]]))),
  };
}

function tablaResumen(filas) {
  const grupos = new Map();
  const clave = (per, tipo, conv) => per + '|' + tipo + '|' + conv;
  for (const r of filas) {
    for (const conv of [r.convenio, 'Total']) {
      const k = clave(r.periodo, r.tipo, conv);
      if (!grupos.has(k)) grupos.set(k, { periodo: r.periodo, tipo: r.tipo, convenio: conv, personas: 0, remunerativo: 0, sac: 0, noRem: 0, aportes: 0, neto: 0, cargas: 0, costo: 0 });
      const g = grupos.get(k);
      g.personas++;
      g.remunerativo += r.remunerativo;
      g.sac += r.sac;
      g.noRem += r.noRem;
      g.aportes += r.aportes;
      g.neto += r.neto;
      g.cargas += r.contribuciones + r.art;
      g.costo += r.costo;
    }
  }
  const orden = { [CONVENIO_UOM]: 0, [CONVENIO_FC]: 1, Total: 2 };
  const lista = Array.from(grupos.values()).sort((a, b) => (a.periodo !== b.periodo ? (a.periodo < b.periodo ? -1 : 1) : orden[a.convenio] - orden[b.convenio]));
  const anterior = {};
  const out = lista.map(g => {
    const prev = anterior[g.convenio];
    anterior[g.convenio] = g.costo;
    return [g.periodo, g.tipo, g.convenio, g.personas, r2(g.remunerativo), r2(g.sac), r2(g.noRem), r2(g.aportes), r2(g.neto), r2(g.cargas), r2(g.costo), prev ? g.costo / prev - 1 : ''];
  });
  return {
    encabezado: ['Período', 'Tipo', 'Convenio', 'Personas', 'Total remunerativo', 'SAC (aguinaldo)', 'No remunerativo', 'Aportes', 'Neto a cobrar', 'Contribuciones y ART', 'Costo total empresa', 'Variación costo vs mes anterior'],
    formatos: ['periodo', 'texto', 'texto', 'num', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'porc'],
    filas: out,
  };
}

/** Bruto y neto (sin SAC) por persona y por mes, con la variación contra el primer mes. */
function tablaEvolucion(d, filas) {
  const periodos = Array.from(new Set(filas.map(r => r.periodo))).sort();
  const proyectados = new Set(filas.filter(r => r.tipo === 'Proyectado').map(r => r.periodo));
  const etiqueta = per => per + (proyectados.has(per) ? ' (proy.)' : '');
  const ultimoReal = periodos.filter(per => !proyectados.has(per)).pop();
  const porLeg = new Map();
  for (const r of filas) {
    if (!porLeg.has(r.legajo)) porLeg.set(r.legajo, {});
    porLeg.get(r.legajo)[r.periodo] = r;
  }
  const encabezado = ['Dato', 'Legajo', 'Empleado', 'Convenio'].concat(periodos.map(etiqueta), ['% último real / primer mes', '% última proyección / primer mes']);
  const formatos = ['texto', 'texto', 'texto', 'texto'].concat(periodos.map(() => 'pesos'), ['porc', 'porc']);
  const out = [];
  const variacion = (vals, hasta) => {
    const primero = vals.find(v => v > 0);
    const ult = hasta === undefined ? vals.filter(v => v > 0).pop() : hasta;
    return primero && ult ? ult / primero - 1 : '';
  };
  for (const [dato, campo] of [['Bruto', 'remunerativo'], ['Neto sin SAC', 'netoSinSAC']]) {
    const legs = Array.from(porLeg.keys()).map(id => d.legajos.get(id)).sort((a, b) => (a.convenio !== b.convenio ? (a.convenio === CONVENIO_UOM ? -1 : 1) : a.nombre.localeCompare(b.nombre)));
    for (const leg of legs) {
      const m = porLeg.get(leg.legajo);
      const vals = periodos.map(per => (m[per] ? m[per][campo] : ''));
      const realUlt = ultimoReal && m[ultimoReal] ? m[ultimoReal][campo] : '';
      const tieneProy = periodos.some(per => proyectados.has(per) && m[per]);
      out.push([dato, leg.legajo, leg.nombre, leg.convenio].concat(vals, [variacion(vals, realUlt || 0), tieneProy ? variacion(vals) : '']));
    }
  }
  return { encabezado: encabezado, formatos: formatos, filas: out };
}

/** Compara lo calculado con los valores de la planilla anterior. */
function tablaControl(d, reales) {
  const idx = new Map(reales.map(r => [r.periodo + '|' + r.legajo, r]));
  const out = d.planilla.map(f => {
    const r = idx.get(f.periodo + '|' + f.legajo);
    const nombre = d.legajos.has(f.legajo) ? d.legajos.get(f.legajo).nombre : f.nombre;
    if (!r) return [f.periodo, f.legajo, nombre, f.bruto, '', '', f.neto, '', '', '', 'No liquidado'];
    const db = r2(r.remunerativo - f.bruto), dn = r2(r.netoSinSAC - f.neto);
    const pct = f.neto ? dn / f.neto : '';
    const ok = Math.abs(db) <= 1 && (!f.neto || Math.abs(dn) <= Math.max(100, Math.abs(f.neto) * 0.005));
    return [f.periodo, f.legajo, nombre, f.bruto, r.remunerativo, db, f.neto, r.netoSinSAC, dn, pct, ok ? 'OK' : 'Revisar'];
  });
  return {
    encabezado: ['Período', 'Legajo', 'Empleado', 'Bruto planilla', 'Bruto calculado', 'Diferencia bruto', 'Neto planilla', 'Neto calculado (sin SAC)', 'Diferencia neto', 'Diferencia neto %', 'Estado'],
    formatos: ['periodo', 'texto', 'texto', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'porc', 'texto'],
    filas: out,
  };
}

/** Todo lo que se regenera con "Liquidar y actualizar todo". */
function calcularTodo(crudo) {
  const d = prepararDatos(crudo);
  const reales = liquidarReales(d);
  const proy = proyectar(d, reales);
  const todas = reales.concat(proy);
  return {
    avisos: d.avisos,
    liquidacion: tablaDesdeObjetos(COLUMNAS_LIQ, reales),
    proyeccion: tablaDesdeObjetos(COLUMNAS_LIQ, proy),
    resumen: tablaResumen(todas),
    evolucion: tablaEvolucion(d, todas),
    control: tablaControl(d, reales),
  };
}

// --- Recibo ------------------------------------------------------------------------------

/**
 * Detalle de liquidación de una persona en un mes, como filas de 4 columnas:
 * Concepto | Remunerativo | No remunerativo | Descuentos.
 */
function armarRecibo(leg, r, p) {
  const filas = [];
  const fila = (a, b, c, e) => filas.push([a, b === undefined ? '' : b, c === undefined ? '' : c, e === undefined ? '' : e]);
  const pct = x => String(Math.round(x * 1000) / 10).replace('.', ',') + '%';
  const t = tasasAportes(leg, p);

  fila('DETALLE DE LIQUIDACIÓN — borrador de control');
  fila(p.EMPRESA || '');
  fila('');
  fila('Período', r.periodo + (r.tipo === 'Proyectado' ? ' (proyectado)' : ''));
  fila('Empleado', leg.nombre);
  fila('Legajo', leg.legajo, 'CUIL', leg.cuil);
  fila('Convenio', leg.convenio + (leg.categoria ? ' — ' + leg.categoria : ''));
  fila('Fecha de ingreso', leg.ingreso ? dos(leg.ingreso.d) + '/' + dos(leg.ingreso.m) + '/' + leg.ingreso.y : '', 'Antigüedad', r.anios === '' ? '' : r.anios + ' años');
  fila('');
  fila('Concepto', 'Remunerativo', 'No remunerativo', 'Descuentos');
  const conceptos = [
    ['Sueldo básico' + (r.dias < p.DIAS_MES ? ' (' + r.dias + ' días)' : ''), r.basico, 'R'],
    ['Antigüedad (' + r.anios + ' años)', r.antiguedad, 'R'],
    ['A cuenta futuros aumentos', r.aCuenta, 'R'],
    ['Anticipo absorbible', r.anticipo, 'R'],
    ['Horas extra', r.horasExtra, 'R'],
    ['Otros remunerativos', r.otrosRem, 'R'],
    ['SAC (aguinaldo)', r.sac, 'R'],
    ['No remunerativos', r.noRem, 'N'],
    ['Jubilación ' + pct(t.jub), r.jubilacion, 'D'],
    ['Ley 19.032 ' + pct(t.pami), r.ley19032, 'D'],
    ['Obra social ' + pct(t.os), r.obraSocial, 'D'],
    ['Cuota sindical UOM ' + pct(t.sind), r.cuotaSindical, 'D'],
    ['Aporte fijo UOM', r.fijoUOM, 'D'],
    ['Otros descuentos', r.descuentos, 'D'],
  ];
  for (const [nombre, monto, tipo] of conceptos) {
    if (!monto) continue;
    if (tipo === 'R') fila(nombre, monto);
    else if (tipo === 'N') fila(nombre, '', monto);
    else fila(nombre, '', '', monto);
  }
  fila('Totales', r2(r.remunerativo + r.sac), r.noRem, r2(r.aportes + r.descuentos));
  fila('');
  fila('NETO A COBRAR', r.neto);
  fila('');
  fila('Costo para la empresa', r.costo, 'Contribuciones y ART', r2(r.contribuciones + r.art));
  fila('');
  fila('Documento interno para controlar la liquidación. El recibo oficial lo emite el estudio contable.');
  return filas;
}
