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

const ESCENARIO_BASE = 'Base';

const MOTIVO_RENUNCIA = 'Renuncia';
const MOTIVO_DESPIDO = 'Despido sin causa';
const MOTIVO_CAUSA = 'Despido con causa';
const MOTIVO_ACUERDO = 'Mutuo acuerdo';
const MOTIVOS_BAJA = [MOTIVO_RENUNCIA, MOTIVO_DESPIDO, MOTIVO_CAUSA, MOTIVO_ACUERDO];

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
  escenarios: 'Escenarios',
  evolucion: 'Evolución',
  control: 'Control',
  finales: 'Liquidaciones finales',
  alertas: 'Alertas',
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
    ['motivoBaja', 'Motivo de baja', 'texto'],
    ['vacTomadas', 'Vacaciones tomadas en el año de la baja (días)', 'num'],
    ['altaBasico', 'Alta: sueldo básico (fuera de conv.)', 'pesos'],
    ['altaNeto', 'Alta: neto pactado (fuera de conv.)', 'pesos'],
    ['altaACuenta', 'Alta: a cuenta futuros aumentos', 'pesos'],
    ['escenario', 'Escenario (solo proyección)', 'texto'],
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
    ['legajo', 'Legajo (vacío = todos)', 'texto'],
    ['tipo', 'Tipo', 'texto'],
    ['porcentaje', 'Porcentaje', 'porc'],
    ['monto', 'Monto fijo', 'pesos'],
    ['escenario', 'Escenario (vacío = todos)', 'texto'],
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
  ['escenario', 'Escenario', 'texto'],
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
  ['final', 'Liquidación final (estimada)', 'pesos'],
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
  ['PROPORCIONAL_ALTAS_BAJAS', 'Sí', 'Sí: en el mes de ingreso o de baja se paga solo por los días trabajados (si no se cargan los días a mano).'],
  ['SAC_AUTOMATICO', 'Sí', 'Sí: en junio y diciembre se calcula el aguinaldo solo.'],
  ['ABSORBER_ANTICIPO', 'Sí', 'Sí: cuando sube el básico de la escala, el anticipo absorbible baja en lo mismo que subió.'],
  ['PERIODO_PRUEBA_MESES', 6, 'Duración del período de prueba (meses). Un despido dentro de ese plazo no lleva indemnización.'],
  ['DIVISOR_VACACIONES', 25, 'Divisor del sueldo mensual para el valor del día de vacaciones.'],
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

function fechaCorta(f) {
  return f ? dos(f.d) + '/' + dos(f.m) + '/' + f.y : '';
}

function periodoDe(f) {
  return f.y + '-' + dos(f.m);
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

/** Años cumplidos desde el ingreso hasta una fecha. */
function aniosHasta(ingreso, f) {
  if (!ingreso) return 0;
  let a = f.y - ingreso.y;
  if (f.m < ingreso.m || (f.m === ingreso.m && f.d < ingreso.d)) a--;
  return Math.max(0, a);
}

/** Años cumplidos desde el ingreso al último día del período. */
function aniosCumplidos(ingreso, p) {
  return aniosHasta(ingreso, ultimoDia(p));
}

/** Meses completos entre el ingreso y una fecha. */
function mesesHasta(ingreso, f) {
  let m = (f.y - ingreso.y) * 12 + (f.m - ingreso.m);
  if (f.d < ingreso.d) m--;
  return Math.max(0, m);
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

/** Una fila con escenario vacío vale para todos; con nombre, solo para ese escenario. */
function aplicaEscenario(escenarioFila, esc) {
  return !escenarioFila || escenarioFila === esc;
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
  if (!(p.DIVISOR_VACACIONES > 0)) p.DIVISOR_VACACIONES = 25;
  p.SAC_AUTOMATICO = siNo(p.SAC_AUTOMATICO, true);
  p.ABSORBER_ANTICIPO = siNo(p.ABSORBER_ANTICIPO, true);
  p.PROPORCIONAL_ALTAS_BAJAS = siNo(p.PROPORCIONAL_ALTAS_BAJAS, true);
  p.PROYECTAR_HASTA = periodo(p.PROYECTAR_HASTA);
  p.EMPRESA = texto(p.EMPRESA);
  return p;
}

function normalizarConvenio(v) {
  const s = texto(v).toLowerCase();
  if (!s) return '';
  if (s.indexOf('uom') === 0) return CONVENIO_UOM;
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

function normalizarMotivo(v) {
  const s = texto(v).toLowerCase();
  if (!s) return '';
  if (s.indexOf('renuncia') >= 0) return MOTIVO_RENUNCIA;
  if (s.indexOf('con causa') >= 0) return MOTIVO_CAUSA;
  if (s.indexOf('despido') >= 0 || s.indexOf('sin causa') >= 0) return MOTIVO_DESPIDO;
  if (s.indexOf('acuerdo') >= 0) return MOTIVO_ACUERDO;
  return MOTIVO_RENUNCIA;
}

function normalizarEscenario(v) {
  const s = texto(v);
  return s.toLowerCase() === ESCENARIO_BASE.toLowerCase() ? ESCENARIO_BASE : s;
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
    if (legajos.has(id)) {
      avisos.push('Legajo repetido: ' + id + '. Se usa la primera fila.');
      continue;
    }
    const convenio = normalizarConvenio(f.convenio) || CONVENIO_FC;
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
      motivoBaja: normalizarMotivo(f.motivoBaja),
      vacTomadas: num(f.vacTomadas),
      altaBasico: num(f.altaBasico),
      altaNeto: num(f.altaNeto),
      altaACuenta: num(f.altaACuenta),
      escenario: normalizarEscenario(f.escenario),
    };
    if (!leg.ingreso) avisos.push('Legajo ' + id + ' (' + leg.nombre + ') no tiene fecha de ingreso: no se calcula antigüedad.');
    if (leg.baja && leg.ingreso && diaNumero(leg.baja) < diaNumero(leg.ingreso)) avisos.push('Legajo ' + id + ': la fecha de baja es anterior al ingreso.');
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
    const legajo = texto(f.legajo);
    const tipo = normalizarTipoAumento(f.tipo);
    const donde = 'Aumentos previstos ' + desde + (legajo ? ' (' + legajo + ')' : '') + ': ';
    if (legajo && !legajos.has(legajo)) {
      avisos.push(donde + 'el legajo no está en la hoja Legajos. Se ignora.');
      continue;
    }
    const convenio = legajo ? legajos.get(legajo).convenio : normalizarConvenio(f.convenio);
    if (!convenio) {
      avisos.push(donde + 'falta el convenio o el legajo. Se ignora.');
      continue;
    }
    let error = '';
    if (!tipo) error = 'el tipo "' + texto(f.tipo) + '" no se entiende';
    else if (tipo === AUMENTO_ESCALA && (legajo || convenio !== CONVENIO_UOM)) error = 'el aumento de escala es para todo UOM, sin legajo';
    else if (tipo === AUMENTO_ANTICIPO && convenio !== CONVENIO_UOM) error = 'el anticipo a cuenta es solo para UOM';
    if (error) {
      avisos.push(donde + error + '. Se ignora.');
      continue;
    }
    aumentos.push({ desde: desde, convenio: convenio, legajo: legajo, tipo: tipo, porcentaje: num(f.porcentaje), monto: num(f.monto), escenario: normalizarEscenario(f.escenario) });
  }
  aumentos.sort(porDesde);

  const nombres = new Set([ESCENARIO_BASE]);
  for (const a of aumentos) if (a.escenario) nombres.add(a.escenario);
  for (const l of legajos.values()) if (l.escenario) nombres.add(l.escenario);
  const escenarios = Array.from(nombres);

  const planilla = (crudo.planilla || [])
    .map(f => ({ periodo: periodo(f.periodo), legajo: texto(f.legajo), nombre: texto(f.nombre), bruto: num(f.bruto), neto: num(f.neto) }))
    .filter(f => f.periodo && f.legajo);

  return { p, legajos, escala, topes, novedades, aumentos, escenarios, planilla, avisos };
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

// --- Vigencia, altas y bajas -------------------------------------------------------------

/**
 * Si la persona trabaja en el período. esc: escenario de la proyección, o null
 * para los meses reales (ahí no entran las altas hipotéticas de un escenario).
 */
function legajoVigente(leg, per, esc) {
  if (leg.escenario && leg.escenario !== esc) return false;
  const ini = diaNumero({ y: Number(per.slice(0, 4)), m: Number(per.slice(5, 7)), d: 1 });
  if (leg.ingreso && diaNumero(leg.ingreso) > diaNumero(ultimoDia(per))) return false;
  if (leg.baja) return diaNumero(leg.baja) >= ini;
  return leg.activo;
}

/** Días a pagar en el mes según ingreso y baja (mes de 30 días). */
function diasDelMes(leg, per, p) {
  const u = ultimoDia(per);
  let ini = 1, fin = p.DIAS_MES;
  if (leg.ingreso && leg.ingreso.y === u.y && leg.ingreso.m === u.m) ini = Math.min(leg.ingreso.d, p.DIAS_MES);
  if (leg.baja && leg.baja.y === u.y && leg.baja.m === u.m) fin = leg.baja.d >= u.d ? p.DIAS_MES : Math.min(leg.baja.d, p.DIAS_MES);
  return Math.max(0, fin - ini + 1);
}

function bajaEnPeriodo(leg, per) {
  return !!leg.baja && periodoDe(leg.baja) === per;
}

/** Novedad del primer mes de una persona, con los importes de alta del legajo. */
function novedadDeAlta(leg, per) {
  const n = normalizarNovedad({ basico: leg.altaBasico, netoPactado: leg.altaNeto, aCuenta: leg.altaACuenta }, per, leg.legajo);
  if (leg.convenio === CONVENIO_FC && !leg.altaBasico && !leg.altaNeto) n.observaciones = 'Nuevo: completar el sueldo.';
  return n;
}

function diasVacaciones(anios) {
  return anios < 5 ? 14 : anios < 10 ? 21 : anios < 20 ? 28 : 35;
}

/**
 * Estimación de la liquidación final (importes brutos).
 * info: { remMensual, mejorRem12, mejorRemSemestre, sacYaPagado }
 */
function liquidacionFinal(leg, info, p) {
  const baja = leg.baja, motivo = leg.motivoBaja || MOTIVO_RENUNCIA;
  const ingreso = leg.ingreso || baja;
  const meses = mesesHasta(ingreso, baja);
  const anios = Math.floor(meses / 12) + leg.aniosReconocidos;
  const rem = info.remMensual;
  const enPrueba = meses < p.PERIODO_PRUEBA_MESES;
  const c = [];
  const agregar = (nombre, monto, tipo) => { if (monto > 0) c.push([nombre, r2(monto), tipo]); };

  // Aguinaldo proporcional del semestre (salvo que ya se pague en junio o diciembre).
  if (!info.sacYaPagado) {
    const semIni = { y: baja.y, m: baja.m <= 6 ? 1 : 7, d: 1 };
    const semFin = { y: baja.y, m: baja.m <= 6 ? 6 : 12, d: baja.m <= 6 ? 30 : 31 };
    const desde = Math.max(diaNumero(semIni), diaNumero(ingreso));
    const fraccion = Math.max(0, diaNumero(baja) - desde + 1) / (diaNumero(semFin) - diaNumero(semIni) + 1);
    agregar('SAC proporcional', (info.mejorRemSemestre / 2) * fraccion, 'R');
  }

  // Vacaciones no gozadas, proporcionales a lo trabajado en el año.
  const inicioAnio = Math.max(diaNumero({ y: baja.y, m: 1, d: 1 }), diaNumero(ingreso));
  const trabajadosAnio = Math.max(0, diaNumero(baja) - inicioAnio + 1);
  const diasVac = Math.max(0, (diasVacaciones(aniosHasta(ingreso, { y: baja.y, m: 12, d: 31 }) + leg.aniosReconocidos) * trabajadosAnio) / 365 - leg.vacTomadas);
  const vac = (rem / p.DIVISOR_VACACIONES) * diasVac;
  agregar('Vacaciones no gozadas (' + Math.round(diasVac * 10) / 10 + ' días)', vac, 'N');
  agregar('SAC sobre vacaciones no gozadas', vac / 12, 'N');

  if (motivo === MOTIVO_DESPIDO) {
    if (enPrueba) {
      agregar('Preaviso (15 días, período de prueba)', rem / 2, 'R');
      agregar('SAC sobre preaviso', rem / 2 / 12, 'R');
    } else {
      const aniosIndem = Math.max(1, Math.floor(meses / 12) + (meses % 12 > 3 ? 1 : 0) + leg.aniosReconocidos);
      agregar('Indemnización por antigüedad (' + aniosIndem + ' × mejor remuneración)', info.mejorRem12 * aniosIndem, 'N');
      const mesesPreaviso = anios >= 5 ? 2 : 1;
      agregar('Preaviso (' + mesesPreaviso + (mesesPreaviso > 1 ? ' meses)' : ' mes)'), rem * mesesPreaviso, 'R');
      agregar('SAC sobre preaviso', (rem * mesesPreaviso) / 12, 'R');
      const u = ultimoDia(periodoDe(baja));
      if (baja.d < u.d) {
        const integ = (rem * (p.DIAS_MES - Math.min(baja.d, p.DIAS_MES))) / p.DIAS_MES;
        agregar('Integración mes de despido', integ, 'R');
        agregar('SAC sobre integración', integ / 12, 'R');
      }
    }
  }

  const t = tasasAportes(leg, p);
  const remItems = c.filter(x => x[2] === 'R').reduce((s, x) => s + x[1], 0);
  const noRemItems = c.filter(x => x[2] === 'N').reduce((s, x) => s + x[1], 0);
  const total = r2(remItems + noRemItems);
  const aportes = r2(remItems * (t.jub + t.pami + t.os + t.sind));
  const contribuciones = leg.regimen === REGIMEN_SIN ? 0 : r2(remItems * (tasaContribuciones(p) + p.ART_VARIABLE));
  return {
    legajo: leg.legajo,
    nombre: leg.nombre,
    baja: baja,
    motivo: motivo,
    meses: meses,
    enPrueba: enPrueba,
    mejorRem: r2(info.mejorRem12),
    conceptos: c,
    remunerativo: r2(remItems),
    noRemunerativo: r2(noRemItems),
    total: total,
    aportes: aportes,
    neto: r2(total - aportes),
    contribuciones: contribuciones,
    costo: r2(total + contribuciones),
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
  const dias = nov.dias > 0 ? Math.min(nov.dias, p.DIAS_MES) : p.PROPORCIONAL_ALTAS_BAJAS ? diasDelMes(leg, per, p) : p.DIAS_MES;
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
    escenario: nov.escenario || '',
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
    final: 0,
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
  if (dias < p.DIAS_MES && !(nov.dias > 0)) obs.push('Proporcional: ' + dias + ' días.');
  if (nov.observaciones) obs.push(nov.observaciones);
  r.observaciones = obs.join(' ');
  return r;
}

// --- Aguinaldo y liquidación final -------------------------------------------------------

/**
 * SAC del semestre que termina en p (junio o diciembre): 50% de la mejor
 * remuneración mensual del semestre, proporcional si entró o se fue durante el semestre.
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
  const hasta = leg.baja ? Math.min(fin, diaNumero(leg.baja)) : fin;
  const fraccion = Math.max(0, hasta - desde + 1) / (fin - ini + 1);
  return r2((mejor / 2) * fraccion);
}

function mejorEntre(hist, desde, hasta) {
  let mejor = 0;
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) mejor = Math.max(mejor, hist[m] || 0);
  return mejor;
}

/**
 * Liquida una novedad agregando el SAC y, si se va en el mes, la liquidación final.
 * remHist: Map legajo -> { periodo: remunerativo de mes completo }, se va completando.
 */
function liquidarConSAC(leg, nov, ctx, remHist) {
  const p = ctx.p;
  let r = liquidar(leg, nov, ctx);
  if (!remHist.has(leg.legajo)) remHist.set(leg.legajo, {});
  const hist = remHist.get(leg.legajo);
  // Para el aguinaldo y la indemnización cuenta la remuneración de un mes completo.
  const mesCompleto = r.dias > 0 && r.dias < p.DIAS_MES ? r2(r.remunerativo * p.DIAS_MES / r.dias) : r.remunerativo;
  hist[nov.periodo] = r.dias > 0 ? mesCompleto : hist[sumarMeses(nov.periodo, -1)] || 0;
  const sacDelMes = p.SAC_AUTOMATICO && esMesSAC(nov.periodo);
  if (sacDelMes) {
    const sac = calcularSAC(leg, nov.periodo, hist);
    if (sac > 0) r = liquidar(leg, Object.assign({}, nov, { sac: sac }), ctx);
  }
  if (bajaEnPeriodo(leg, nov.periodo) && leg.motivoBaja) {
    const per = nov.periodo;
    const semIni = per.slice(0, 5) + (Number(per.slice(5, 7)) <= 6 ? '01' : '07');
    const fin = liquidacionFinal(leg, {
      remMensual: hist[per],
      mejorRem12: mejorEntre(hist, sumarMeses(per, -11), per),
      mejorRemSemestre: mejorEntre(hist, semIni, per),
      sacYaPagado: sacDelMes,
    }, p);
    fin.periodo = per;
    fin.escenario = r.escenario;
    fin.tipo = r.tipo;
    r.final = fin.total;
    r.neto = r2(r.neto + fin.neto);
    r.costo = r2(r.costo + fin.costo);
    r.observaciones = (r.observaciones ? r.observaciones + ' ' : '') + 'Baja ' + fechaCorta(leg.baja) + ' (' + fin.motivo + '): liquidación final estimada.';
    r._final = fin;
  }
  return r;
}

// --- Aumentos -------------------------------------------------------------------------

/**
 * Aplica a la novedad los aumentos de sueldo y anticipos del mes que le tocan a la persona
 * (los de su legajo y los generales de su convenio). Los de escala van por la escala.
 * UOM: el porcentaje se calcula sobre el bruto del mes anterior y va a "a cuenta" (o al
 * anticipo). Fuera de convenio: sube el básico, o el neto pactado si se pactó en neto.
 */
function aplicarAumentos(n, leg, lista, remAnterior) {
  const aplicados = [];
  for (const a of lista) {
    if (a.tipo === AUMENTO_ESCALA) continue;
    if (a.legajo ? a.legajo !== leg.legajo : a.convenio !== leg.convenio) continue;
    if (leg.convenio === CONVENIO_UOM) {
      const extra = r2((remAnterior || 0) * a.porcentaje + a.monto);
      if (a.tipo === AUMENTO_ANTICIPO) n.anticipo = r2(n.anticipo + extra);
      else n.aCuenta = r2(n.aCuenta + extra);
    } else if (n.netoPactado > 0) {
      n.netoPactado = r2(n.netoPactado * (1 + a.porcentaje) + a.monto);
    } else {
      n.basico = r2(n.basico * (1 + a.porcentaje) + a.monto);
    }
    aplicados.push(a);
  }
  return aplicados;
}

function describirAumento(a) {
  const partes = [];
  if (a.porcentaje) partes.push(String(Math.round(a.porcentaje * 10000) / 100).replace('.', ',') + '%');
  if (a.monto) partes.push('$' + a.monto);
  return a.tipo + ' ' + partes.join(' + ');
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

/** Novedad del mes siguiente para una persona: arrastra, absorbe anticipo y aplica aumentos. */
function novedadSiguiente(leg, prev, per, escala, aumentosDelMes, remAnterior, p) {
  const n = prev ? arrastrarNovedad(prev, per) : novedadDeAlta(leg, per);
  if (leg.convenio === CONVENIO_UOM && p.ABSORBER_ANTICIPO && n.anticipo > 0) {
    const suba = subaEscala(escala, leg.categoria, per);
    if (suba > 0) n.anticipo = r2(Math.max(0, n.anticipo - suba));
  }
  const aplicados = aplicarAumentos(n, leg, aumentosDelMes, remAnterior);
  if (aplicados.length) n.observaciones = (n.observaciones ? n.observaciones + ' ' : '') + aplicados.map(describirAumento).join('; ') + '.';
  return n;
}

/**
 * Novedades del mes siguiente al último cargado, para los legajos activos.
 * Copia lo fijo del mes anterior (o los importes de alta si es nuevo), descuenta del
 * anticipo la suba de escala y aplica los aumentos previstos del escenario Base.
 */
function prepararMes(d) {
  const ult = ultimoPeriodo(d.novedades);
  if (!ult) return { periodo: '', filas: [], avisos: [] };
  const per = sumarMeses(ult, 1);
  const avisos = [];
  const previas = new Map(d.novedades.filter(n => n.periodo === ult).map(n => [n.legajo, n]));
  const remAnterior = new Map(liquidarReales(d).filter(r => r.periodo === ult).map(r => [r.legajo, r.remunerativo]));
  const delMes = d.aumentos.filter(a => a.desde === per && aplicaEscenario(a.escenario, ESCENARIO_BASE));
  const escalaPrevista = delMes.some(a => a.tipo === AUMENTO_ESCALA);
  if (escalaPrevista && !d.escala.some(e => e.desde === per)) {
    avisos.push('Hay un aumento de escala previsto para ' + per + ' pero no está en la hoja Escala UOM: cargalo ahí para que se aplique.');
  }
  const filas = [];
  for (const leg of d.legajos.values()) {
    if (!legajoVigente(leg, per, null)) continue;
    const n = novedadSiguiente(leg, previas.get(leg.legajo), per, d.escala, delMes, remAnterior.get(leg.legajo), d.p);
    n.nombre = leg.nombre;
    filas.push(n);
  }
  return { periodo: per, filas: filas, avisos: avisos };
}

/**
 * Proyecta un escenario desde el mes siguiente al último real hasta PROYECTAR_HASTA,
 * aplicando los aumentos previstos y las altas y bajas con fecha.
 */
function proyectar(d, reales, esc) {
  esc = esc || ESCENARIO_BASE;
  const desde = ultimoPeriodo(d.novedades), hasta = d.p.PROYECTAR_HASTA;
  if (!desde || !hasta || hasta <= desde) return [];

  const escala = d.escala.slice();
  const aumentos = d.aumentos.filter(a => aplicaEscenario(a.escenario, esc));
  const categorias = Array.from(new Set(Array.from(d.legajos.values()).filter(l => l.convenio === CONVENIO_UOM).map(l => l.categoria)));
  const ctx = { p: d.p, escala: escala, topes: d.topes };

  const remHist = new Map();
  for (const r of reales) {
    if (!remHist.has(r.legajo)) remHist.set(r.legajo, {});
    remHist.get(r.legajo)[r.periodo] = r.dias > 0 && r.dias < d.p.DIAS_MES ? r2(r.remunerativo * d.p.DIAS_MES / r.dias) : r.remunerativo;
  }

  let actuales = new Map(d.novedades.filter(n => n.periodo === desde).map(n => [n.legajo, n]));
  const conHistoria = new Set(d.novedades.map(n => n.legajo));
  const remAnterior = new Map(reales.filter(r => r.periodo === desde).map(r => [r.legajo, r.remunerativo]));
  const filas = [];

  const primero = sumarMeses(desde, 1);
  for (let per = primero; per <= hasta; per = sumarMeses(per, 1)) {
    // Un aumento de un escenario con fecha en un mes ya cargado se aplica en el primer mes proyectado.
    const delMes = aumentos.filter(a => a.desde === per || (per === primero && a.desde < per && a.escenario && a.escenario !== ESCENARIO_BASE));

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
      if (!legajoVigente(leg, per, esc)) continue;
      const prev = actuales.get(leg.legajo);
      // Sin datos del mes anterior solo se proyecta un alta nueva: ingresa después del último
      // mes cargado o tiene los importes de alta. Si no, faltan datos y no se inventan.
      const esAlta = !conHistoria.has(leg.legajo) &&
        ((leg.ingreso && periodoDe(leg.ingreso) > desde) || leg.altaBasico > 0 || leg.altaNeto > 0 || leg.altaACuenta > 0);
      if (!prev && !esAlta) continue;
      const n = novedadSiguiente(leg, prev, per, escala, delMes, remAnterior.get(leg.legajo), d.p);
      n.tipo = 'Proyectado';
      n.escenario = esc;
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
  for (const r of filas) {
    for (const conv of [r.convenio, 'Total']) {
      const k = r.periodo + '|' + r.escenario + '|' + conv;
      if (!grupos.has(k)) grupos.set(k, { periodo: r.periodo, tipo: r.tipo, escenario: r.escenario, convenio: conv, personas: 0, remunerativo: 0, sac: 0, noRem: 0, aportes: 0, neto: 0, cargas: 0, costo: 0 });
      const g = grupos.get(k);
      g.personas++;
      g.remunerativo += r.remunerativo;
      g.sac += r.sac + r.final;
      g.noRem += r.noRem;
      g.aportes += r.aportes;
      g.neto += r.neto;
      g.cargas += r.contribuciones + r.art;
      g.costo += r.costo;
    }
  }
  const orden = { [CONVENIO_UOM]: 0, [CONVENIO_FC]: 1, Total: 2 };
  const lista = Array.from(grupos.values()).sort((a, b) => {
    if (a.escenario !== b.escenario) return a.escenario < b.escenario ? -1 : 1;
    if (a.periodo !== b.periodo) return a.periodo < b.periodo ? -1 : 1;
    return orden[a.convenio] - orden[b.convenio];
  });
  // Lo real va primero; cada escenario sigue al último mes real.
  lista.sort((a, b) => (a.escenario === '' ? 0 : 1) - (b.escenario === '' ? 0 : 1));
  const anterior = {};
  const out = lista.map(g => {
    const k = g.escenario + '|' + g.convenio;
    const prev = anterior[k] !== undefined ? anterior[k] : anterior['|' + g.convenio];
    anterior[k] = g.costo;
    return [g.periodo, g.tipo, g.escenario, g.convenio, g.personas, r2(g.remunerativo), r2(g.sac), r2(g.noRem), r2(g.aportes), r2(g.neto), r2(g.cargas), r2(g.costo), prev ? g.costo / prev - 1 : ''];
  });
  return {
    encabezado: ['Período', 'Tipo', 'Escenario', 'Convenio', 'Personas', 'Total remunerativo', 'SAC y liquidaciones finales', 'No remunerativo', 'Aportes', 'Neto a cobrar', 'Contribuciones y ART', 'Costo total empresa', 'Variación costo vs mes anterior'],
    formatos: ['periodo', 'texto', 'texto', 'texto', 'num', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'pesos', 'porc'],
    filas: out,
  };
}

/** Costo total por mes de cada escenario y la diferencia contra Base. */
function tablaEscenarios(escenarios, proy) {
  const periodos = Array.from(new Set(proy.map(r => r.periodo))).sort();
  const costo = {}, personas = {};
  for (const r of proy) {
    const k = r.periodo + '|' + r.escenario;
    costo[k] = (costo[k] || 0) + r.costo;
    personas[k] = (personas[k] || 0) + 1;
  }
  const otros = escenarios.filter(e => e !== ESCENARIO_BASE);
  const encabezado = ['Período'];
  const formatos = ['periodo'];
  for (const e of escenarios) { encabezado.push('Personas — ' + e, 'Costo total — ' + e); formatos.push('num', 'pesos'); }
  for (const e of otros) { encabezado.push('Diferencia ' + e + ' vs Base', 'Diferencia %'); formatos.push('pesos', 'porc'); }
  const totales = {};
  const filas = periodos.map(per => {
    const f = [per];
    for (const e of escenarios) {
      const c = r2(costo[per + '|' + e] || 0);
      totales[e] = (totales[e] || 0) + c;
      f.push(personas[per + '|' + e] || 0, c);
    }
    const base = costo[per + '|' + ESCENARIO_BASE] || 0;
    for (const e of otros) {
      const c = costo[per + '|' + e] || 0;
      f.push(r2(c - base), base ? c / base - 1 : '');
    }
    return f;
  });
  if (periodos.length) {
    const f = ['Total'];
    for (const e of escenarios) f.push('', r2(totales[e]));
    for (const e of otros) f.push(r2(totales[e] - totales[ESCENARIO_BASE]), totales[ESCENARIO_BASE] ? totales[e] / totales[ESCENARIO_BASE] - 1 : '');
    filas.push(f);
  }
  return { encabezado, formatos, filas };
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

const CONCEPTOS_FINAL = [
  ['Indemnización', /^Indemnización/],
  ['Preaviso', /^Preaviso/],
  ['Integración mes de despido', /^Integración/],
  ['SAC s/ preaviso e integración', /^SAC sobre (preaviso|integración)/],
  ['SAC proporcional', /^SAC proporcional/],
  ['Vacaciones no gozadas', /^Vacaciones no gozadas/],
  ['SAC s/ vacaciones', /^SAC sobre vacaciones/],
];

/** Detalle de las liquidaciones finales estimadas (reales y de cada escenario). */
function tablaFinales(filas) {
  const out = filas.filter(r => r._final).map(r => {
    const f = r._final;
    const montos = CONCEPTOS_FINAL.map(([, re]) => r2(f.conceptos.filter(c => re.test(c[0])).reduce((s, c) => s + c[1], 0)));
    const antig = Math.floor(f.meses / 12) + ' años ' + (f.meses % 12) + ' meses' + (f.enPrueba ? ' (período de prueba)' : '');
    return [r.periodo, r.tipo, r.escenario, r.legajo, r.nombre, fechaCorta(f.baja), f.motivo, antig, f.mejorRem].concat(montos, [f.total, f.aportes, f.neto, f.contribuciones, f.costo]);
  });
  return {
    encabezado: ['Período', 'Tipo', 'Escenario', 'Legajo', 'Empleado', 'Fecha de baja', 'Motivo', 'Antigüedad', 'Mejor remuneración (12 meses)']
      .concat(CONCEPTOS_FINAL.map(c => c[0]), ['Total bruto', 'Aportes', 'Neto estimado', 'Contribuciones', 'Costo total']),
    formatos: ['periodo', 'texto', 'texto', 'texto', 'texto', 'texto', 'texto', 'texto', 'pesos'].concat(CONCEPTOS_FINAL.map(() => 'pesos'), ['pesos', 'pesos', 'pesos', 'pesos', 'pesos']),
    filas: out,
  };
}

/** Lo que pasa en los próximos meses: aniversarios, fin de prueba, altas, bajas, aumentos. */
function tablaAlertas(d, meses) {
  const ult = ultimoPeriodo(d.novedades);
  const out = [];
  if (!ult) return { encabezado: ['Mes', 'Tipo', 'Legajo', 'Empleado', 'Detalle'], formatos: ['periodo', 'texto', 'texto', 'texto', 'texto'], filas: out };
  const hasta = sumarMeses(ult, meses || 3);
  for (let per = sumarMeses(ult, 1); per <= hasta; per = sumarMeses(per, 1)) {
    for (const leg of d.legajos.values()) {
      if (leg.escenario) continue;
      if (leg.ingreso && periodoDe(leg.ingreso) === per) out.push([per, 'Alta', leg.legajo, leg.nombre, 'Ingresa el ' + fechaCorta(leg.ingreso) + '.']);
      if (leg.baja && periodoDe(leg.baja) === per) out.push([per, 'Baja', leg.legajo, leg.nombre, 'Se va el ' + fechaCorta(leg.baja) + (leg.motivoBaja ? ' (' + leg.motivoBaja + ').' : '. Falta el motivo para estimar la liquidación final.')]);
      if (!legajoVigente(leg, per, null) || !leg.ingreso) continue;
      if (leg.convenio === CONVENIO_UOM) {
        const antes = aniosCumplidos(leg.ingreso, sumarMeses(per, -1)), ahora = aniosCumplidos(leg.ingreso, per);
        if (ahora > antes) out.push([per, 'Antigüedad', leg.legajo, leg.nombre, 'Cumple ' + ahora + ' años: la antigüedad pasa a ' + Math.round((ahora + leg.aniosReconocidos) * d.p.ANTIGUEDAD_UOM_POR_ANIO * 1000) / 10 + '% del básico.']);
      }
      const finPrueba = sumarMeses(periodoDe(leg.ingreso), d.p.PERIODO_PRUEBA_MESES);
      if (finPrueba === per) out.push([per, 'Período de prueba', leg.legajo, leg.nombre, 'Termina el período de prueba (' + d.p.PERIODO_PRUEBA_MESES + ' meses desde el ' + fechaCorta(leg.ingreso) + ').']);
    }
    for (const a of d.aumentos.filter(x => x.desde === per && aplicaEscenario(x.escenario, ESCENARIO_BASE))) {
      const leg = a.legajo ? d.legajos.get(a.legajo) : null;
      out.push([per, 'Aumento previsto', a.legajo, leg ? leg.nombre : 'Todo ' + a.convenio, describirAumento(a) + '.']);
      if (a.tipo === AUMENTO_ESCALA && !d.escala.some(e => e.desde === per)) out.push([per, 'Escala', '', '', 'Cuando se confirme la paritaria, cargá el básico en Escala UOM.']);
    }
  }
  return { encabezado: ['Mes', 'Tipo', 'Legajo', 'Empleado', 'Detalle'], formatos: ['periodo', 'texto', 'texto', 'texto', 'texto'], filas: out };
}

/** Todo lo que se regenera con "Liquidar y actualizar todo". */
function calcularTodo(crudo) {
  const d = prepararDatos(crudo);
  const reales = liquidarReales(d);
  const porEscenario = d.escenarios.map(e => proyectar(d, reales, e));
  const proy = [].concat.apply([], porEscenario);
  const base = porEscenario[0];
  return {
    avisos: d.avisos,
    escenarios: d.escenarios,
    liquidacion: tablaDesdeObjetos(COLUMNAS_LIQ, reales),
    proyeccion: tablaDesdeObjetos(COLUMNAS_LIQ, proy),
    resumen: tablaResumen(reales.concat(proy)),
    escenariosTabla: tablaEscenarios(d.escenarios, proy),
    evolucion: tablaEvolucion(d, reales.concat(base)),
    control: tablaControl(d, reales),
    finales: tablaFinales(reales.concat(proy)),
    alertas: tablaAlertas(d, 3),
  };
}

/**
 * Estima la liquidación final de una persona con una baja hipotética, sin guardar nada.
 * Devuelve el detalle o { error }.
 */
function simularBaja(crudo, legajo, fechaBaja, motivo, vacTomadas) {
  const d = prepararDatos(crudo);
  const leg = d.legajos.get(texto(legajo));
  if (!leg) return { error: 'No encuentro el legajo ' + legajo + '.' };
  const f = fecha(fechaBaja);
  if (!f) return { error: 'La fecha de baja no es válida.' };
  Object.assign(leg, { baja: f, motivoBaja: normalizarMotivo(motivo) || MOTIVO_RENUNCIA, vacTomadas: num(vacTomadas), activo: true });
  const per = periodoDe(f);
  if (d.p.PROYECTAR_HASTA < per) d.p.PROYECTAR_HASTA = per;
  const reales = liquidarReales(d);
  const fila = reales.concat(proyectar(d, reales, ESCENARIO_BASE)).find(r => r._final && r.legajo === leg.legajo);
  if (!fila) return { error: 'No hay datos de ' + leg.nombre + ' para ' + per + ' (¿la fecha es anterior al primer mes cargado?).' };
  return Object.assign({}, fila._final, { baja: fechaCorta(f), mesNeto: r2(fila.netoSinSAC), mesDias: fila.dias });
}

/** Próximo número de legajo: U07, F23… según el convenio. */
function siguienteLegajo(d, convenio) {
  const pre = convenio === CONVENIO_UOM ? 'U' : 'F';
  let max = 0;
  for (const id of d.legajos.keys()) {
    const m = id.match(/^([A-Za-z]+)(\d+)$/);
    if (m && m[1].toUpperCase() === pre) max = Math.max(max, Number(m[2]));
  }
  return pre + dos(max + 1);
}

/**
 * Cambios en Novedades para un aumento que rige desde un mes ya cargado.
 * Devuelve [{ periodo, legajo, campo, valor }]. Para UOM el porcentaje se toma
 * sobre el bruto de cada mes y se suma a "a cuenta futuros aumentos".
 */
function cambiosPorAumento(d, a) {
  const reales = liquidarReales(d);
  const rem = new Map(reales.map(r => [r.periodo + '|' + r.legajo, r.remunerativo]));
  const cambios = [];
  for (const n of d.novedades) {
    if (n.periodo < a.desde) continue;
    const leg = d.legajos.get(n.legajo);
    if (a.legajo ? a.legajo !== n.legajo : a.convenio !== leg.convenio) continue;
    const copia = Object.assign({}, n);
    aplicarAumentos(copia, leg, [a], rem.get(n.periodo + '|' + n.legajo));
    for (const campo of ['basico', 'netoPactado', 'aCuenta', 'anticipo']) {
      if (copia[campo] !== n[campo]) cambios.push({ periodo: n.periodo, legajo: n.legajo, campo: campo, valor: copia[campo] });
    }
  }
  return cambios;
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
  fila('Período', r.periodo + (r.tipo === 'Proyectado' ? ' (proyectado' + (r.escenario && r.escenario !== ESCENARIO_BASE ? ', escenario ' + r.escenario : '') + ')' : ''));
  fila('Empleado', leg.nombre);
  fila('Legajo', leg.legajo, 'CUIL', leg.cuil);
  fila('Convenio', leg.convenio + (leg.categoria ? ' — ' + leg.categoria : ''));
  fila('Fecha de ingreso', fechaCorta(leg.ingreso), 'Antigüedad', r.anios === '' ? '' : r.anios + ' años');
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
  ];
  if (r._final) for (const c of r._final.conceptos) conceptos.push([c[0] + ' (estimado)', c[1], c[2]]);
  conceptos.push(
    ['Jubilación ' + pct(t.jub), r.jubilacion, 'D'],
    ['Ley 19.032 ' + pct(t.pami), r.ley19032, 'D'],
    ['Obra social ' + pct(t.os), r.obraSocial, 'D'],
    ['Cuota sindical UOM ' + pct(t.sind), r.cuotaSindical, 'D'],
    ['Aporte fijo UOM', r.fijoUOM, 'D'],
    ['Otros descuentos', r.descuentos, 'D']
  );
  if (r._final && r._final.aportes) conceptos.push(['Aportes sobre la liquidación final', r._final.aportes, 'D']);
  let rem = 0, noRem = 0, desc = 0;
  for (const [nombre, monto, tipo] of conceptos) {
    if (!monto) continue;
    if (tipo === 'R') { fila(nombre, monto); rem += monto; }
    else if (tipo === 'N') { fila(nombre, '', monto); noRem += monto; }
    else { fila(nombre, '', '', monto); desc += monto; }
  }
  fila('Totales', r2(rem), r2(noRem), r2(desc));
  fila('');
  fila('NETO A COBRAR', r.neto);
  fila('');
  fila('Costo para la empresa', r.costo, 'Contribuciones y ART', r2(r.costo - rem - noRem));
  fila('');
  fila('Documento interno para controlar la liquidación. El recibo oficial lo emite el estudio contable.');
  return filas;
}
