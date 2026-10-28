// Pruebas de Code.gs contra una simulación de Google Sheets, con datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { crearEntorno, carpeta } = require('./fake-apps-script');

const DATOS = `const DATOS_INICIALES = ${JSON.stringify({
  legajos: [
    { legajo: 'U1', nombre: 'Operaria Uno', convenio: 'UOM', categoria: 'Operario', ingreso: '2019-07-20', regimen: 'Completo', afiliado: 'Sí', estado: 'Activo' },
    { legajo: 'F1', nombre: 'Administrativa', convenio: 'Fuera de convenio', ingreso: '2014-02-10', regimen: 'Completo', estado: 'Activo' },
    { legajo: 'F2', nombre: 'Ex empleado', convenio: 'Fuera de convenio', ingreso: '2016-05-05', estado: 'Baja' },
  ],
  escala: [{ desde: '2026-01', categoria: 'Operario', basico: 800000 }, { desde: '2026-04', categoria: 'Operario', basico: 840000 }],
  topes: [],
  novedades: [
    { periodo: '2026-05', legajo: 'U1', aCuenta: 100000, anticipo: 50000 },
    { periodo: '2026-05', legajo: 'F1', basico: 2000000 },
    { periodo: '2026-06', legajo: 'U1', aCuenta: 100000, anticipo: 50000, horasExtra: 1000 },
    { periodo: '2026-06', legajo: 'F1', netoPactado: 1660000 },
  ],
  aumentos: [{ desde: '2026-08', convenio: 'UOM', tipo: 'Aumento de escala', porcentaje: 0.04 }],
  planilla: [{ periodo: '2026-05', legajo: 'F1', bruto: 2000000, neto: 1660000 }],
})};`;

function entorno() {
  return crearEntorno([path.join(carpeta, 'Calculo.gs'), path.join(carpeta, 'Code.gs'), DATOS]);
}

test('cargar datos iniciales arma todas las hojas y liquida', () => {
  const e = entorno();
  e.ctx.onOpen();
  e.ctx.cargarDatosIniciales();
  assert.deepEqual(e.alertas, []);
  const nombres = e.ss.getSheets().map(s => s.getName());
  assert.equal(nombres[0], 'Cómo se usa');
  assert.ok(!nombres.includes('Hoja 1'));
  for (const h of ['Resumen', 'Liquidación', 'Proyección', 'Evolución', 'Control', 'Recibo', 'Parámetros']) assert.ok(nombres.includes(h), h);

  const liq = e.valores('Liquidación');
  assert.equal(liq.length, 5); // encabezado + 4
  const col = liq[0].indexOf('Neto a cobrar');
  const f1jun = liq.find(f => f[0] === '2026-06' && f[2] === 'F1');
  assert.ok(Math.abs(f1jun[liq[0].indexOf('Neto sin SAC')] - 1660000) < 0.02);
  assert.ok(f1jun[col] > 1660000); // incluye aguinaldo
  assert.equal(e.valores('Control')[1][10], 'OK');

  // Las fechas de ingreso quedaron como fecha y los períodos como texto.
  const leg = e.valores('Legajos');
  assert.equal(Object.prototype.toString.call(leg[1][leg[0].indexOf('Fecha de ingreso')]), '[object Date]');
  assert.equal(typeof e.valores('Novedades')[1][0], 'string');

  const rec = e.valores('Recibo');
  assert.ok(rec.some(f => f[0] === 'NETO A COBRAR'));
});

test('cargar datos iniciales dos veces no duplica', () => {
  const e = entorno();
  e.ctx.cargarDatosIniciales();
  assert.throws(() => e.ctx.cargarDatosIniciales(), /ya tiene datos/);
});

test('preparar mes siguiente agrega julio sin las bajas y liquida', () => {
  const e = entorno();
  e.ctx.cargarDatosIniciales();
  e.ctx.prepararMesSiguiente();
  const nov = e.valores('Novedades');
  const julio = nov.filter(f => f[0] === '2026-07');
  assert.deepEqual(julio.map(f => f[1]).sort(), ['F1', 'U1']);
  const u1 = julio.find(f => f[1] === 'U1');
  assert.equal(u1[nov[0].indexOf('Horas extra')], '');
  assert.equal(u1[nov[0].indexOf('Anticipo absorbible')], 50000);
  assert.equal(u1[nov[0].indexOf('Empleado')], 'Operaria Uno');
  e.ctx.actualizarTodo();
  assert.ok(e.valores('Liquidación').some(f => f[0] === '2026-07' && f[2] === 'F1'));
});

test('recibos en PDF del período', () => {
  const e = entorno();
  e.ctx.cargarDatosIniciales();
  e.ctx.exportarRecibosPDF();
  assert.deepEqual(e.pdfs.sort(), ['2026-06 - F1 - Administrativa.pdf', '2026-06 - U1 - Operaria Uno.pdf']);
});
