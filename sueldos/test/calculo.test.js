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
  assert.equal(res.filas.find(f => f.legajo === 'U2').observaciones, ''); // UOM nuevo: el básico sale de la escala
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
  assert.equal(fila('2026-07', 'U2'), undefined); // ingresó antes y no tiene datos: no se inventa
  assert.ok(out.resumen.filas.some(f => f[0] === '2026-09' && f[3] === 'Total'));
});

test('constantes expuestas', () => {
  assert.equal(g('HOJAS.novedades'), 'Novedades');
});

test('aumento individual: % y monto, solo a esa persona; UOM va a "a cuenta"', () => {
  const c = base();
  c.parametros.push({ clave: 'PROYECTAR_HASTA', valor: '2026-08' });
  c.novedades = [nov('2026-06', 'U1', { aCuenta: 100000 }), nov('2026-06', 'F1', { basico: 2000000 }), nov('2026-06', 'U2', {})];
  c.aumentos = [
    { desde: '2026-07', legajo: 'F1', tipo: 'Aumento de sueldo', porcentaje: 0.1, monto: 5000 },
    { desde: '2026-08', legajo: 'U1', tipo: 'Aumento de sueldo', monto: 30000 },
    { desde: '2026-07', legajo: 'U1', tipo: 'Aumento de escala', porcentaje: 0.1 }, // inválido
  ];
  const out = calcularTodo(c);
  assert.equal(out.avisos.length, 1);
  const col = h => out.proyeccion.encabezado.indexOf(h);
  const fila = (per, leg) => out.proyeccion.filas.find(f => f[0] === per && f[col('Legajo')] === leg);
  assert.equal(fila('2026-07', 'F1')[col('Básico')], 2205000);
  assert.equal(fila('2026-08', 'F1')[col('Básico')], 2205000);
  assert.equal(fila('2026-07', 'U1')[col('A cuenta futuros aumentos')], 100000);
  assert.equal(fila('2026-08', 'U1')[col('A cuenta futuros aumentos')], 130000);
  assert.equal(fila('2026-08', 'U2')[col('A cuenta futuros aumentos')], 0);
});

test('escenarios: Base y uno alternativo con un alta hipotética; tabla comparativa', () => {
  const c = base();
  c.parametros.push({ clave: 'PROYECTAR_HASTA', valor: '2026-08' });
  c.legajos.push({ legajo: 'N1', nombre: 'Operario a contratar', convenio: 'UOM', categoria: 'Operario', ingreso: '2026-08-01', estado: 'Activo', escenario: 'Contratar' });
  c.novedades = [nov('2026-06', 'U1', {}), nov('2026-06', 'F1', { basico: 1000000 })];
  c.aumentos = [
    { desde: '2026-07', convenio: 'Fuera de convenio', tipo: 'Aumento de sueldo', porcentaje: 0.05, escenario: 'Base' },
    { desde: '2026-07', convenio: 'Fuera de convenio', tipo: 'Aumento de sueldo', porcentaje: 0.1, escenario: 'Contratar' },
  ];
  const out = calcularTodo(c);
  assert.equal(JSON.stringify(out.escenarios), '["Base","Contratar"]');
  const col = h => out.proyeccion.encabezado.indexOf(h);
  const fila = (per, leg, esc) => out.proyeccion.filas.find(f => f[0] === per && f[col('Legajo')] === leg && f[col('Escenario')] === esc);
  assert.equal(fila('2026-07', 'F1', 'Base')[col('Básico')], 1050000);
  assert.equal(fila('2026-07', 'F1', 'Contratar')[col('Básico')], 1100000);
  assert.equal(fila('2026-08', 'N1', 'Base'), undefined);
  assert.equal(fila('2026-08', 'N1', 'Contratar')[col('Básico')], 840000);
  // La liquidación real no incluye la persona hipotética
  assert.ok(!out.liquidacion.filas.some(f => f[3] === 'N1'));
  const t = out.escenariosTabla;
  assert.equal(t.encabezado.slice(0, 5).join('|'), 'Período|Personas — Base|Costo total — Base|Personas — Contratar|Costo total — Contratar');
  const ago = t.filas.find(f => f[0] === '2026-08');
  assert.equal(ago[1], 2); // U1 y F1 (los demás no tienen datos cargados)
  assert.equal(ago[3], 3); // + la persona a contratar
  assert.ok(ago[5] > 0);
  assert.equal(t.filas[t.filas.length - 1][0], 'Total');
});

test('baja con fecha: proporcional en el mes, deja de liquidarse y estima la liquidación final', () => {
  const c = base();
  c.parametros.push({ clave: 'PROYECTAR_HASTA', valor: '2026-10' });
  c.legajos[0].baja = '2026-08-15';
  c.legajos[0].motivoBaja = 'Despido sin causa';
  c.novedades = [nov('2026-06', 'U1', {}), nov('2026-06', 'F1', { basico: 1000000 })];
  const out = calcularTodo(c);
  const col = h => out.proyeccion.encabezado.indexOf(h);
  const ago = out.proyeccion.filas.find(f => f[0] === '2026-08' && f[col('Legajo')] === 'U1');
  assert.equal(ago[col('Días')], 15);
  assert.equal(ago[col('Básico')], 420000);
  assert.ok(ago[col('Liquidación final (estimada)')] > 0);
  assert.ok(!out.proyeccion.filas.some(f => f[0] === '2026-09' && f[col('Legajo')] === 'U1'));
  const fin = out.finales.filas.find(f => f[3] === 'U1');
  const fc = h => out.finales.encabezado.indexOf(h);
  // Ingreso 20/07/2019 -> 7 años: indemnización 7 × mejor remuneración (840.000 + 7% = 898.800)
  assert.equal(fin[fc('Mejor remuneración (12 meses)')], 898800);
  assert.equal(fin[fc('Indemnización')], 898800 * 7);
  assert.equal(fin[fc('Preaviso')], 898800 * 2); // 5 años o más: 2 meses
  assert.equal(fin[fc('Integración mes de despido')], r2v(898800 * 15 / 30));
  assert.ok(fin[fc('SAC proporcional')] > 0);
  assert.ok(fin[fc('Vacaciones no gozadas')] > 0);
});

test('renuncia y despido en período de prueba', () => {
  const c = base();
  c.legajos.push({ legajo: 'F9', nombre: 'Nuevo', convenio: 'Fuera de convenio', ingreso: '2026-04-01', estado: 'Activo' });
  c.novedades = [nov('2026-06', 'F9', { basico: 1000000 }), nov('2026-06', 'F1', { basico: 1000000 })];
  const prueba = ctx.simularBaja(c, 'F9', '2026-07-31', 'Despido sin causa', 0);
  assert.equal(prueba.enPrueba, true);
  assert.ok(!prueba.conceptos.some(x => /^Indemnización/.test(x[0])));
  assert.ok(prueba.conceptos.some(x => /^Preaviso \(15 días/.test(x[0])));
  const renuncia = ctx.simularBaja(c, 'F1', '2026-07-31', 'Renuncia', 0);
  assert.equal(renuncia.conceptos.map(x => x[0].split(' (')[0]).join('|'), 'SAC proporcional|Vacaciones no gozadas|SAC sobre vacaciones no gozadas');
  // 12 años al 31/12 -> 28 días de vacaciones; trabajó 212 de 365 días
  cerca(renuncia.conceptos[1][1], (1000000 / 25) * (28 * 212 / 365), 0.05);
  assert.ok(ctx.simularBaja(c, 'XX', '2026-07-31', 'Renuncia').error);
});

test('preparar mes aplica aumentos previstos y usa los importes de alta', () => {
  const c = base();
  c.legajos.push({ legajo: 'F8', nombre: 'Ingresa', convenio: 'Fuera de convenio', ingreso: '2026-07-10', estado: 'Activo', altaBasico: 1500000 });
  c.novedades = [nov('2026-06', 'F1', { basico: 1000000 }), nov('2026-06', 'U1', {})];
  c.aumentos = [
    { desde: '2026-07', legajo: 'F1', tipo: 'Aumento de sueldo', porcentaje: 0.2 },
    { desde: '2026-07', convenio: 'UOM', tipo: 'Aumento de escala', porcentaje: 0.03 },
    { desde: '2026-07', legajo: 'F1', tipo: 'Aumento de sueldo', porcentaje: 0.5, escenario: 'Optimista' },
  ];
  const res = prepararMes(prepararDatos(c));
  assert.equal(res.filas.find(f => f.legajo === 'F1').basico, 1200000);
  assert.equal(res.filas.find(f => f.legajo === 'F8').basico, 1500000);
  assert.equal(res.avisos.length, 1); // escala prevista sin cargar en Escala UOM
  const d = prepararDatos(Object.assign(c, { novedades: c.novedades.concat(res.filas) }));
  const r = ctx.liquidarReales(d).find(x => x.legajo === 'F8');
  assert.equal(r.dias, 21); // del 10 al 30
});

test('alertas: aniversario, fin de prueba, altas, bajas y aumentos', () => {
  const c = base();
  c.legajos[0].baja = '2026-08-31';
  c.legajos.push({ legajo: 'F7', nombre: 'Prueba', convenio: 'Fuera de convenio', ingreso: '2026-02-01', estado: 'Activo' });
  c.novedades = [nov('2026-06', 'U1', {}), nov('2026-06', 'F7', { basico: 1 })];
  c.aumentos = [{ desde: '2026-08', convenio: 'UOM', tipo: 'Aumento de escala', porcentaje: 0.04 }];
  const tipos = calcularTodo(c).alertas.filas.map(f => f[0] + ' ' + f[1] + ' ' + f[2]);
  assert.ok(tipos.includes('2026-07 Antigüedad U1'));
  assert.ok(tipos.includes('2026-08 Período de prueba F7'));
  assert.ok(tipos.includes('2026-08 Baja U1'));
  assert.ok(tipos.includes('2026-08 Aumento previsto '));
});

function r2v(x) { return Math.round(x * 100) / 100; }
