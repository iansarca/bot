// Pruebas de Calculo.gs con datos inventados. Correr con: node --test sueldos/test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Calculo.gs'), 'utf8'), ctx);
const g = expr => vm.runInContext(expr, ctx);
const { calcularTodo, prepararDatos, liquidar, prepararMes, aniosCumplidos, fecha, calcularSAC, sumarMeses, periodo } = ctx;

const cerca = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

function base() {
  return {
    parametros: [{ clave: 'PROYECTAR_HASTA', valor: '2026-12' }],
    legajos: [
      { legajo: 'U1', nombre: 'Operaria Uno', convenio: 'UOM', categoria: 'Operario', ingreso: '2019-07-20', regimen: 'Completo', afiliado: 'Sí', estado: 'Activo' },
      { legajo: 'U2', nombre: 'Operario Dos', convenio: 'UOM', categoria: 'Operario', ingreso: '2026-03-16', regimen: 'Completo', afiliado: 'No', estado: 'Activo' },
      { legajo: 'F1', nombre: 'Administrativa', convenio: 'Fuera de convenio', ingreso: '2014-02-10', regimen: 'Completo', estado: 'Activo' },
      { legajo: 'F2', nombre: 'Socio', convenio: 'Fuera de convenio', ingreso: '2008-01-15', regimen: 'Sin aportes', estado: 'Activo' },
      { legajo: 'F3', nombre: 'Ex empleado', convenio: 'Fuera de convenio', ingreso: '2016-05-05', estado: 'Baja' },
    ],
    escala: [
      { desde: '2026-01', categoria: 'Operario', basico: 800000 },
      { desde: '2026-04', categoria: 'Operario', basico: 840000 },
    ],
    topes: [],
    novedades: [],
    aumentos: [],
    planilla: [],
  };
}

function nov(periodo, legajo, extra) {
  return Object.assign({ periodo, legajo }, extra || {});
}

test('fechas y períodos', () => {
  assert.equal(periodo('2026-3'), '2026-03');
  assert.equal(periodo('03/2026'), '2026-03');
  assert.equal(periodo('15/03/2026'), '2026-03');
  assert.equal(sumarMeses('2026-11', 3), '2027-02');
  assert.equal(sumarMeses('2026-01', -1), '2025-12');
});

test('antigüedad: años cumplidos al último día del mes', () => {
  const ing = fecha('2019-07-20');
  assert.equal(aniosCumplidos(ing, '2026-06'), 6);
  assert.equal(aniosCumplidos(ing, '2026-07'), 7);
  assert.equal(aniosCumplidos(fecha('2025-06-30'), '2026-06'), 1);
  assert.equal(aniosCumplidos(fecha('2026-05-04'), '2026-05'), 0);
});

test('UOM afiliado: básico de escala + antigüedad, aportes 19,5% + fijo', () => {
  const c = base();
  c.novedades = [nov('2026-05', 'U1', { aCuenta: 210000 })];
  const d = prepararDatos(c);
  const r = liquidar(d.legajos.get('U1'), d.novedades[0], { p: d.p, escala: d.escala, topes: d.topes });
  assert.equal(r.basico, 840000);
  assert.equal(r.antiguedad, 50400); // 6 años
  assert.equal(r.remunerativo, 1100400);
  assert.equal(r.jubilacion, 121044);
  assert.equal(r.cuotaSindical, 27510);
  assert.equal(r.fijoUOM, 7368);
  cerca(r.neto, 1100400 * 0.805 - 7368);
  assert.equal(r.neto, r.netoSinSAC);
});

test('UOM no afiliado: sin cuota sindical ni fijo; mes de ingreso proporcional', () => {
  const c = base();
  c.novedades = [nov('2026-03', 'U2', { dias: 15 })];
  const d = prepararDatos(c);
  const r = liquidar(d.legajos.get('U2'), d.novedades[0], { p: d.p, escala: d.escala, topes: d.topes });
  assert.equal(r.basico, 400000);
  assert.equal(r.cuotaSindical, 0);
  assert.equal(r.fijoUOM, 0);
  assert.equal(r.neto, 400000 * 0.83);
});

test('fuera de convenio: neto pactado se convierte a bruto, con y sin tope', () => {
  const c = base();
  c.novedades = [nov('2026-04', 'F1', { netoPactado: 1245000 })];
  let d = prepararDatos(c);
  let r = liquidar(d.legajos.get('F1'), d.novedades[0], { p: d.p, escala: d.escala, topes: d.topes });
  cerca(r.basico, 1245000 / 0.83);
  cerca(r.neto, 1245000);

  c.topes = [{ desde: '2026-01', tope: 3000000 }];
  c.novedades = [nov('2026-04', 'F1', { netoPactado: 5000000 })];
  d = prepararDatos(c);
  r = liquidar(d.legajos.get('F1'), d.novedades[0], { p: d.p, escala: d.escala, topes: d.topes });
  assert.equal(r.jubilacion, 330000);
  cerca(r.neto, 5000000);
  cerca(r.basico, 5000000 + 3000000 * 0.17);
});

test('sin aportes: neto = bruto y sin cargas patronales', () => {
  const c = base();
  c.novedades = [nov('2026-01', 'F2', { basico: 9000000 })];
  const d = prepararDatos(c);
  const r = liquidar(d.legajos.get('F2'), d.novedades[0], { p: d.p, escala: d.escala, topes: d.topes });
  assert.equal(r.neto, 9000000);
  assert.equal(r.costo, 9000000);
});

test('SAC: 50% de la mejor remuneración, proporcional al ingreso', () => {
  const leg = { ingreso: fecha('2026-04-01') };
  const sac = calcularSAC(leg, '2026-06', { '2026-04': 1000000, '2026-05': 1200000, '2026-06': 1100000 });
  cerca(sac, 600000 * (91 / 181));
  assert.equal(calcularSAC({ ingreso: fecha('2020-01-01') }, '2026-12', { '2026-07': 100, '2026-12': 300 }), 150);
});

test('junio liquida SAC y el control compara sin SAC', () => {
  const c = base();
  for (const m of ['01', '02', '03', '04', '05', '06']) c.novedades.push(nov('2026-' + m, 'F1', { basico: 1000000 + Number(m) }));
  c.planilla = [{ periodo: '2026-06', legajo: 'F1', bruto: 1000006, neto: 830004.98 }];
  const out = calcularTodo(c);
  const col = h => out.liquidacion.encabezado.indexOf(h);
  const junio = out.liquidacion.filas.find(f => f[0] === '2026-06');
  assert.equal(junio[col('SAC (aguinaldo)')], 500003);
  assert.equal(out.control.filas[0][10], 'OK');
});

test('preparar mes: copia lo fijo, absorbe la suba de escala y saltea bajas', () => {
  const c = base();
  c.novedades = [
    nov('2026-03', 'U1', { aCuenta: 100000, anticipo: 50000, horasExtra: 9999 }),
    nov('2026-03', 'F1', { basico: 2000000 }),
    nov('2026-03', 'F3', { basico: 1 }),
  ];
  const res = prepararMes(prepararDatos(c));
  assert.equal(res.periodo, '2026-04');
  const u1 = res.filas.find(f => f.legajo === 'U1');
  assert.equal(u1.aCuenta, 100000);
  assert.equal(u1.anticipo, 10000); // la escala subió 40.000
  assert.equal(u1.horasExtra, 0);
  assert.ok(!res.filas.some(f => f.legajo === 'F3'));
  assert.equal(res.filas.find(f => f.legajo === 'U2').observaciones, 'Nuevo: completar.');
});

test('proyección: anticipo sobre el bruto, escala que lo absorbe y aumento de sueldo', () => {
  const c = base();
  c.parametros.push({ clave: 'PROYECTAR_HASTA', valor: '2026-09' });
  c.novedades = [nov('2026-06', 'U1', { aCuenta: 100000 }), nov('2026-06', 'F1', { basico: 2000000 })];
  c.aumentos = [
    { desde: '2026-07', convenio: 'UOM', tipo: 'Anticipo a cuenta', porcentaje: 0.05 },
    { desde: '2026-08', convenio: 'UOM', tipo: 'Aumento de escala', porcentaje: 0.04 },
    { desde: '2026-07', convenio: 'Fuera de convenio', tipo: 'Aumento de sueldo', porcentaje: 0.1 },
    { desde: '2026-07', convenio: 'Fuera de convenio', tipo: 'Aumento de escala', porcentaje: 0.1 },
  ];
  const out = calcularTodo(c);
  assert.equal(out.avisos.length, 1); // el tipo que no corresponde
  const col = h => out.proyeccion.encabezado.indexOf(h);
  const fila = (per, leg) => out.proyeccion.filas.find(f => f[0] === per && f[col('Legajo')] === leg);
  // Junio: 840.000 + 6% + 100.000 = 990.400 -> anticipo 5% = 49.520
  assert.equal(fila('2026-07', 'U1')[col('Anticipo absorbible')], 49520);
  // Agosto: básico 873.600 (+33.600), el anticipo baja a 15.920
  assert.equal(fila('2026-08', 'U1')[col('Básico')], 873600);
  assert.equal(fila('2026-08', 'U1')[col('Anticipo absorbible')], 15920);
  assert.equal(fila('2026-08', 'U1')[col('Antigüedad')], 61152);
  assert.equal(fila('2026-09', 'F1')[col('Básico')], 2200000);
  assert.equal(fila('2026-07', 'U1')[col('Tipo')], 'Proyectado');
  assert.equal(fila('2026-07', 'U2'), undefined); // sin datos del último mes real no se proyecta
  assert.ok(out.resumen.filas.some(f => f[0] === '2026-09' && f[2] === 'Total'));
});

test('constantes expuestas', () => {
  assert.equal(g('HOJAS.novedades'), 'Novedades');
});
