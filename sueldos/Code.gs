/**
 * Sueldos — menú y lectura/escritura de la planilla (Google Apps Script).
 *
 * Va pegado en el editor de Apps Script de la planilla (Extensiones > Apps Script),
 * junto con Calculo.gs (las reglas de cálculo) y Formularios.html (alta, baja y aumentos).
 *
 * Hojas que se cargan a mano: Parámetros, Legajos, Escala UOM, Topes, Novedades,
 * Aumentos previstos y Planilla original.
 * Hojas que se regeneran solas (no editarlas): Resumen, Escenarios, Liquidación,
 * Proyección, Evolución, Control, Liquidaciones finales, Alertas y Recibo.
 */

const FORMATO = {
  pesos: '#,##0.00',
  porc: '0.00%',
  num: '0',
  periodo: '@',
  texto: '@',
  fecha: 'dd/mm/yyyy',
};

function onOpen() {
  const menu = SpreadsheetApp.getUi()
    .createMenu('Sueldos')
    .addItem('Liquidar y actualizar todo', 'actualizarTodo')
    .addItem('Preparar mes siguiente', 'prepararMesSiguiente')
    .addSeparator()
    .addItem('Dar de alta un empleado…', 'abrirAlta')
    .addItem('Dar de baja un empleado…', 'abrirBaja')
    .addItem('Aumento de sueldo (individual o general)…', 'abrirAumento')
    .addSeparator()
    .addItem('Ver recibo (período y legajo de la hoja Recibo)', 'verRecibo')
    .addItem('Guardar en PDF los recibos del período', 'exportarRecibosPDF')
    .addSeparator()
    .addItem('Crear las hojas que falten', 'inicializar');
  if (typeof DATOS_INICIALES !== 'undefined') menu.addItem('Cargar datos iniciales (una sola vez)', 'cargarDatosIniciales');
  menu.addToUi();
}

// --- Acciones del menú ------------------------------------------------------------

/** Arma las hojas y carga lo que trae Datos.gs (DATOS_INICIALES). Después Datos.gs se puede borrar. */
function cargarDatosIniciales() {
  if (typeof DATOS_INICIALES === 'undefined') {
    SpreadsheetApp.getUi().alert('No está el archivo Datos.gs con los datos iniciales.');
    return;
  }
  inicializar();
  cargarDatos_(DATOS_INICIALES);
  actualizarTodo();
  // Deja armado un recibo de ejemplo del último mes.
  const d = prepararDatos(leerTodo_());
  const per = ultimoPeriodo(d.novedades);
  const n = d.novedades.find(x => x.periodo === per);
  if (n) {
    const rec = hoja_(HOJAS.recibo);
    rec.getRange('B2').setValue(per);
    rec.getRange('B3').setValue(n.legajo);
    verRecibo();
  }
  SpreadsheetApp.getActive().setActiveSheet(hoja_(HOJAS.resumen));
}

function actualizarTodo() {
  const res = actualizar_();
  if (res.avisos.length) {
    SpreadsheetApp.getUi().alert('Listo, con avisos', res.mensaje + '\n\n' + res.avisos.slice(0, 30).join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getActive().toast(res.mensaje, 'Sueldos', 8);
  }
}

/** Recalcula y reescribe todas las hojas de salida. Devuelve { mensaje, avisos }. */
function actualizar_() {
  const res = calcularTodo(leerTodo_());
  escribirTabla_(HOJAS.liquidacion, res.liquidacion);
  escribirTabla_(HOJAS.proyeccion, res.proyeccion);
  escribirTabla_(HOJAS.resumen, res.resumen);
  escribirTabla_(HOJAS.escenarios, res.escenariosTabla);
  escribirTabla_(HOJAS.evolucion, res.evolucion);
  escribirTabla_(HOJAS.control, res.control);
  escribirTabla_(HOJAS.finales, res.finales);
  escribirTabla_(HOJAS.alertas, res.alertas);
  const revisar = res.control.filas.filter(f => f[f.length - 1] !== 'OK').length;
  let msg = res.liquidacion.filas.length + ' liquidaciones y ' + res.proyeccion.filas.length + ' meses proyectados';
  msg += res.escenarios.length > 1 ? ' (' + res.escenarios.length + ' escenarios: ' + res.escenarios.join(', ') + ').' : '.';
  if (res.control.filas.length) msg += ' Control: ' + revisar + ' para revisar.';
  if (res.alertas.filas.length) msg += ' ' + res.alertas.filas.length + ' alertas para los próximos meses.';
  return { mensaje: msg, avisos: res.avisos };
}

function prepararMesSiguiente() {
  const ui = SpreadsheetApp.getUi();
  const d = prepararDatos(leerTodo_());
  const res = prepararMes(d);
  if (!res.periodo) {
    ui.alert('No hay ningún mes cargado en Novedades. Cargá el primero a mano.');
    return;
  }
  const aumentos = res.filas.filter(n => n.observaciones && n.observaciones !== 'Nuevo: completar el sueldo.').length;
  const ok = ui.alert(
    'Preparar ' + res.periodo,
    'Se agregan ' + res.filas.length + ' filas a Novedades para ' + res.periodo +
      ', copiando básico, neto pactado, a cuenta y anticipo del mes anterior' +
      (aumentos ? ' y aplicando los aumentos previstos (' + aumentos + ' personas)' : '') + '.\n\n' +
      (res.avisos.length ? res.avisos.join('\n') + '\n\n' : '') +
      'Antes de seguir, si cambió la escala UOM cargala en la hoja Escala UOM, así se descuenta del anticipo.',
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;
  const sh = hoja_(HOJAS.novedades);
  const enc = encabezado_(sh);
  const filas = res.filas.map(n => COLUMNAS.novedades.map(c => {
    const v = n[c[0]];
    if (c[0] === 'periodo') return res.periodo;
    return v === 0 || v === undefined ? '' : v;
  }));
  const orden = COLUMNAS.novedades.map(c => enc.indexOf(c[1].toLowerCase()));
  const ancho = Math.max(enc.length, 1);
  const salida = filas.map(f => {
    const fila = new Array(ancho).fill('');
    orden.forEach((col, i) => { if (col >= 0) fila[col] = f[i]; });
    return fila;
  });
  const desde = sh.getLastRow() + 1;
  const colPer = enc.indexOf('período') + 1;
  if (colPer > 0) sh.getRange(desde, colPer, salida.length, 1).setNumberFormat('@');
  sh.getRange(desde, 1, salida.length, ancho).setValues(salida);
  sh.activate();
  sh.setActiveRange(sh.getRange(desde, 1));
  SpreadsheetApp.getActive().toast('Cargá las horas extra y demás novedades de ' + res.periodo + ' y después usá Sueldos > Liquidar y actualizar todo.', 'Sueldos', 10);
}

function verRecibo() {
  const sh = hoja_(HOJAS.recibo);
  const per = periodo(normalizar_(sh.getRange('B2').getValue()));
  const leg = texto(sh.getRange('B3').getValue());
  if (!per || !leg) {
    SpreadsheetApp.getUi().alert('En la hoja Recibo completá el período (B2, aaaa-mm) y el legajo (B3).');
    return;
  }
  const d = prepararDatos(leerTodo_());
  const r = buscarLiquidacion_(d, per, leg);
  if (!r) {
    SpreadsheetApp.getUi().alert('No hay liquidación para el legajo ' + leg + ' en ' + per + '.');
    return;
  }
  dibujarRecibo_(sh, armarRecibo(d.legajos.get(leg), r, d.p));
  sh.activate();
}

function exportarRecibosPDF() {
  const ss = SpreadsheetApp.getActive();
  const sh = hoja_(HOJAS.recibo);
  const per = periodo(normalizar_(sh.getRange('B2').getValue()));
  if (!per) {
    SpreadsheetApp.getUi().alert('En la hoja Recibo completá el período (B2, aaaa-mm).');
    return;
  }
  const d = prepararDatos(leerTodo_());
  const reales = liquidarReales(d);
  let filas = reales.filter(r => r.periodo === per);
  if (!filas.length) filas = proyectar(d, reales, ESCENARIO_BASE).filter(r => r.periodo === per);
  if (!filas.length) {
    SpreadsheetApp.getUi().alert('No hay liquidaciones para ' + per + '.');
    return;
  }
  const padres = DriveApp.getFileById(ss.getId()).getParents();
  const base = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
  const carpeta = base.createFolder('Recibos ' + per);
  const legOriginal = sh.getRange('B3').getValue();
  for (const r of filas) {
    dibujarRecibo_(sh, armarRecibo(d.legajos.get(r.legajo), r, d.p));
    SpreadsheetApp.flush();
    carpeta.createFile(pdfDeHoja_(ss, sh).setName(per + ' - ' + r.legajo + ' - ' + r.nombre + '.pdf'));
    Utilities.sleep(400); // Google limita las exportaciones seguidas
  }
  sh.getRange('B3').setValue(legOriginal);
  SpreadsheetApp.getUi().alert(filas.length + ' recibos guardados en la carpeta "' + carpeta.getName() + '":\n' + carpeta.getUrl());
}

const INSTRUCCIONES = [
  ['SUELDOS — cálculo, control y proyección', 'titulo'],
  [''],
  ['CADA MES', 'h'],
  ['1. Si hubo paritaria UOM, agregá una fila en "Escala UOM" con el nuevo básico, desde ese período.'],
  ['2. Sueldos > Preparar mes siguiente: copia a "Novedades" lo del mes anterior para el personal activo.'],
  ['3. En "Novedades" cargá lo que cambie: horas extra, otros conceptos, descuentos, y los días si alguien entró o salió en el mes.'],
  ['   Fuera de convenio: cargá el sueldo básico (bruto) o el neto pactado. Si cargás el neto, el bruto se calcula solo.'],
  ['4. Sueldos > Liquidar y actualizar todo. Se regeneran todas las hojas grises.'],
  ['5. Para controlar o mandar al estudio: la hoja "Liquidación" filtrada por período, o los recibos en PDF desde la hoja "Recibo".'],
  [''],
  ['ALTAS, BAJAS Y AUMENTOS', 'h'],
  ['Sueldos > Dar de alta: agrega el legajo con su sueldo inicial. Si la fecha es futura, entra solo en la proyección hasta que llegue el mes.'],
  ['Sueldos > Dar de baja: pone fecha y motivo, muestra la liquidación final estimada antes de confirmar y deja de liquidarlo después de esa fecha.'],
  ['Sueldos > Aumento de sueldo: a una persona o a todo un convenio, en % o en monto fijo, desde un mes. Si el mes ya está cargado, actualiza Novedades.'],
  [''],
  ['PROYECCIONES Y ESCENARIOS', 'h'],
  ['"Aumentos previstos" tiene los aumentos esperados. Hasta qué mes se proyecta: Parámetros > PROYECTAR_HASTA.'],
  ['UOM: "Aumento de escala" sube el básico. "Anticipo a cuenta" agrega un anticipo (% del bruto del mes anterior)'],
  ['que se va absorbiendo con cada aumento de escala. "Aumento de sueldo" (UOM o fuera de convenio, general o por legajo).'],
  ['Escenarios: poné un nombre en la columna Escenario (por ejemplo "Paritaria alta") para que ese aumento valga solo en ese escenario.'],
  ['Vacío vale para todos; "Base" solo para el principal. En Legajos, un alta con escenario es hipotética (por ejemplo "Contratar 2").'],
  ['La hoja Escenarios compara el costo mes a mes de cada uno contra Base.'],
  [''],
  ['HOJAS', 'h'],
  ['Amarillas (se cargan a mano): Novedades, Legajos, Escala UOM, Aumentos previstos, Parámetros, Topes, Planilla original.'],
  ['Grises (se regeneran solas, no las edites): Resumen, Escenarios, Liquidación, Proyección, Evolución, Control,'],
  ['Liquidaciones finales, Alertas y Recibo.'],
  ['Alertas: lo que pasa en los próximos 3 meses (aniversarios que suben la antigüedad, fin de período de prueba, altas, bajas, aumentos).'],
  ['Control compara lo calculado con "Planilla original" (los brutos y netos de la planilla anterior).'],
  [''],
  ['REGLAS QUE USA', 'h'],
  ['• Antigüedad UOM: 1% del básico por cada año cumplido al último día del mes (más los años reconocidos del legajo).'],
  ['• Aportes: jubilación 11%, Ley 19.032 3%, obra social 3% (con el tope de la hoja Topes). UOM afiliados: cuota sindical 2,5% + aporte fijo.'],
  ['• Régimen de aportes del legajo: Completo, Solo jubilación o Sin aportes (sin aportes tampoco lleva contribuciones ni ART).'],
  ['• Aguinaldo: en junio y diciembre, 50% de la mejor remuneración del semestre, proporcional si entró o se fue en el semestre.'],
  ['• Mes de alta o de baja: se paga por los días trabajados (mes de 30 días), salvo que cargues los días a mano.'],
  ['• Liquidación final estimada: SAC y vacaciones proporcionales; si es despido sin causa, además indemnización (art. 245, sin tope),'],
  ['  preaviso (1 mes, o 2 desde los 5 años; 15 días en período de prueba) e integración del mes. Importes brutos aproximados.'],
  ['• Todos los porcentajes y montos fijos se cambian en Parámetros.'],
  [''],
  ['No calcula Ganancias ni reemplaza el recibo oficial, el F.931 ni el Libro de Sueldos Digital: eso lo sigue haciendo el estudio.'],
];

const ORDEN_HOJAS = ['instrucciones', 'resumen', 'escenarios', 'alertas', 'liquidacion', 'novedades', 'legajos', 'escala', 'aumentos',
  'proyeccion', 'evolucion', 'control', 'finales', 'recibo', 'parametros', 'topes', 'planilla'];

const LISTAS = {
  legajos: { convenio: [CONVENIO_UOM, CONVENIO_FC], regimen: [REGIMEN_COMPLETO, REGIMEN_SOLO_JUB, REGIMEN_SIN], afiliado: ['Sí', 'No'], estado: ['Activo', 'Baja'], motivoBaja: MOTIVOS_BAJA },
  aumentos: { convenio: [CONVENIO_UOM, CONVENIO_FC], tipo: [AUMENTO_ESCALA, AUMENTO_ANTICIPO, AUMENTO_SUELDO] },
};

/** Crea las hojas que no existan, con encabezados, formatos, listas desplegables y los parámetros por defecto. */
function inicializar() {
  const ss = SpreadsheetApp.getActive();
  const creadas = [];
  const crear = clave => {
    let sh = ss.getSheetByName(HOJAS[clave]);
    if (sh) return null;
    sh = ss.insertSheet(HOJAS[clave]);
    creadas.push(HOJAS[clave]);
    return sh;
  };
  for (const clave of Object.keys(COLUMNAS)) {
    const sh = crear(clave);
    if (!sh) continue;
    const cols = COLUMNAS[clave];
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(c => c[1])])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3864').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    sh.setTabColor('#ffc000');
    cols.forEach((c, i) => {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(FORMATO[c[2]] || '@');
      sh.setColumnWidth(i + 1, c[0] === 'nombre' || c[0] === 'descripcion' || c[0] === 'observaciones' ? 280 : 130);
      const opciones = (LISTAS[clave] || {})[c[0]];
      if (opciones) {
        sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
          .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones, true).setAllowInvalid(false).build());
      }
    });
    if (clave === 'parametros') {
      sh.getRange(2, 2, PARAMETROS_DEFECTO.length, 1).setNumberFormat('General');
      sh.getRange(2, 1, PARAMETROS_DEFECTO.length, 3).setValues(PARAMETROS_DEFECTO);
      PARAMETROS_DEFECTO.forEach((d, i) => {
        if (typeof d[1] === 'number') sh.getRange(i + 2, 2).setNumberFormat(d[1] < 1 ? '0.00%' : '#,##0.00');
      });
      sh.setColumnWidth(1, 220);
      sh.setColumnWidth(3, 600);
    }
  }
  for (const clave of ['resumen', 'escenarios', 'alertas', 'liquidacion', 'proyeccion', 'evolucion', 'control', 'finales', 'recibo']) {
    const sh = crear(clave);
    if (sh) sh.setTabColor('#999999');
  }
  const ins = crear('instrucciones');
  if (ins) {
    ins.getRange(1, 1, INSTRUCCIONES.length, 1).setValues(INSTRUCCIONES.map(f => [f[0]]));
    INSTRUCCIONES.forEach((f, i) => {
      if (f[1]) ins.getRange(i + 1, 1).setFontWeight('bold').setFontColor('#1f3864').setFontSize(f[1] === 'titulo' ? 14 : 11);
    });
    ins.setColumnWidth(1, 1000);
  }
  const rec = ss.getSheetByName(HOJAS.recibo);
  if (creadas.indexOf(HOJAS.recibo) >= 0) {
    rec.getRange('A1').setValue('Elegí período y legajo y usá Sueldos > Ver recibo').setFontColor('#666666');
    rec.getRange('A2:A3').setValues([['Período (aaaa-mm)'], ['Legajo']]).setFontWeight('bold');
    rec.getRange('B2').setNumberFormat('@');
    rec.getRange('B2:B3').setBackground('#fff2cc');
  }
  const legs = ss.getSheetByName(HOJAS.legajos);
  const lista = SpreadsheetApp.newDataValidation().requireValueInRange(legs.getRange('A2:A'), true).setAllowInvalid(true).build();
  rec.getRange('B3').setDataValidation(lista);
  const novs = ss.getSheetByName(HOJAS.novedades);
  const colLeg = encabezado_(novs).indexOf('legajo') + 1;
  if (colLeg > 0) novs.getRange(2, colLeg, novs.getMaxRows() - 1, 1).setDataValidation(lista);

  // Ordena las pestañas y saca la hoja vacía que trae una planilla nueva.
  ORDEN_HOJAS.forEach((clave, i) => {
    const sh = ss.getSheetByName(HOJAS[clave]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  for (const sh of ss.getSheets()) {
    const esNuestra = Object.keys(HOJAS).some(k => HOJAS[k] === sh.getName());
    if (!esNuestra && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  }
  ss.setActiveSheet(ss.getSheetByName(HOJAS.instrucciones));
  ss.toast(creadas.length ? 'Hojas creadas: ' + creadas.join(', ') : 'No faltaba ninguna hoja.', 'Sueldos', 8);
}

/**
 * Carga datos en las hojas de entrada vacías. datos: { legajos: [...], novedades: [...], ... }
 * con objetos que usan las claves de COLUMNAS. Lo usa Datos.gs la primera vez.
 */
function cargarDatos_(datos) {
  const ss = SpreadsheetApp.getActive();
  for (const clave of Object.keys(datos)) {
    if (!COLUMNAS[clave] || clave === 'parametros') continue;
    const sh = hoja_(HOJAS[clave]);
    const filas = datos[clave];
    if (!filas.length) continue;
    if (sh.getLastRow() > 1) throw new Error('La hoja "' + HOJAS[clave] + '" ya tiene datos. Los datos iniciales se cargan una sola vez, en hojas vacías.');
    const enc = encabezado_(sh);
    const ancho = enc.length;
    const salida = filas.map(o => {
      const fila = new Array(ancho).fill('');
      COLUMNAS[clave].forEach(c => {
        const i = enc.indexOf(c[1].toLowerCase());
        if (i >= 0 && o[c[0]] !== undefined && o[c[0]] !== null) fila[i] = o[c[0]];
      });
      return fila;
    });
    sh.getRange(2, 1, salida.length, ancho).setValues(salida);
  }
  SpreadsheetApp.flush();
  ss.toast('Datos cargados.', 'Sueldos', 5);
}

// --- Formularios: alta, baja y aumento ------------------------------------------------

function abrirAlta() { abrirFormulario_('alta', 'Dar de alta un empleado'); }
function abrirBaja() { abrirFormulario_('baja', 'Dar de baja un empleado'); }
function abrirAumento() { abrirFormulario_('aumento', 'Aumento de sueldo'); }

function abrirFormulario_(modo, titulo) {
  const t = HtmlService.createTemplateFromFile('Formularios');
  t.modo = modo;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(480).setHeight(640), titulo);
}

/** Lo que necesitan los formularios para armar sus listas. */
function datosFormulario() {
  const d = prepararDatos(leerTodo_());
  const ult = ultimoPeriodo(d.novedades);
  const sig = ult ? sumarMeses(ult, 1) : '';
  const vigentes = Array.from(d.legajos.values())
    .filter(l => !l.escenario && ((ult && legajoVigente(l, ult, null)) || (sig && legajoVigente(l, sig, null))))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return {
    legajos: vigentes.map(l => ({ legajo: l.legajo, nombre: l.nombre, convenio: l.convenio, baja: fechaCorta(l.baja) })),
    categorias: Array.from(new Set(d.escala.map(e => e.categoria))),
    escenarios: d.escenarios,
    motivos: MOTIVOS_BAJA,
    convenios: [CONVENIO_UOM, CONVENIO_FC],
    ultimoPeriodo: ult,
    siguientePeriodo: sig,
  };
}

/** Agrega un legajo. Si entra en un mes ya cargado, también lo agrega a Novedades. */
function guardarAlta(f) {
  const d = prepararDatos(leerTodo_());
  const convenio = normalizarConvenio(f.convenio) || CONVENIO_FC;
  const nombre = texto(f.nombre);
  const ingreso = fecha(f.ingreso);
  const escenario = normalizarEscenario(f.escenario);
  if (!nombre) throw new Error('Falta el apellido y nombre.');
  if (!ingreso) throw new Error('Falta la fecha de ingreso.');
  if (convenio === CONVENIO_UOM && !texto(f.categoria)) throw new Error('Falta la categoría UOM.');
  if (convenio === CONVENIO_FC && !num(f.altaBasico) && !num(f.altaNeto)) throw new Error('Cargá el sueldo básico o el neto pactado.');
  const id = siguienteLegajo(d, convenio);
  const leg = {
    legajo: id, nombre: nombre, cuil: texto(f.cuil), convenio: convenio,
    categoria: convenio === CONVENIO_UOM ? texto(f.categoria) : '',
    ingreso: f.ingreso, regimen: normalizarRegimen(f.regimen),
    afiliado: convenio === CONVENIO_UOM ? (siNo(f.afiliado, true) ? 'Sí' : 'No') : '',
    estado: 'Activo',
    altaBasico: convenio === CONVENIO_FC ? num(f.altaBasico) || '' : '',
    altaNeto: convenio === CONVENIO_FC ? num(f.altaNeto) || '' : '',
    altaACuenta: num(f.altaACuenta) || '',
    escenario: escenario,
    observaciones: texto(f.observaciones),
  };
  agregarFilas_(HOJAS.legajos, COLUMNAS.legajos, [leg]);
  const ult = ultimoPeriodo(d.novedades);
  const per = periodoDe(ingreso);
  const filas = [];
  if (!escenario && ult && per <= ult) {
    for (let m = per; m <= ult; m = sumarMeses(m, 1)) {
      filas.push({ periodo: m, legajo: id, nombre: nombre, basico: leg.altaBasico, netoPactado: leg.altaNeto, aCuenta: leg.altaACuenta });
    }
    agregarFilas_(HOJAS.novedades, COLUMNAS.novedades, filas);
  }
  const res = actualizar_();
  let msg = 'Alta cargada: ' + id + ' — ' + nombre + (escenario ? ', solo en el escenario "' + escenario + '"' : '') + '.';
  if (filas.length) msg += ' Se agregó a Novedades de ' + per + (per < ult ? ' a ' + ult : '') + '.';
  else if (!escenario) msg += ' Entra en la proyección desde ' + per + ' y en Novedades cuando prepares ese mes.';
  return { mensaje: msg, detalle: res.mensaje, avisos: res.avisos };
}

/** Estimación de la liquidación final sin guardar nada (para mostrar antes de confirmar). */
function simularBajaFormulario(f) {
  return simularBaja(leerTodo_(), f.legajo, f.fecha, f.motivo, f.vacTomadas);
}

/** Registra la baja en Legajos y saca de Novedades los meses posteriores a la baja. */
function guardarBaja(f) {
  const d = prepararDatos(leerTodo_());
  const leg = d.legajos.get(texto(f.legajo));
  const baja = fecha(f.fecha);
  if (!leg) throw new Error('Elegí a la persona.');
  if (!baja) throw new Error('Falta la fecha de baja.');
  if (leg.ingreso && diaNumero(baja) < diaNumero(leg.ingreso)) throw new Error('La fecha de baja es anterior al ingreso.');
  actualizarFila_(HOJAS.legajos, COLUMNAS.legajos, 'legajo', leg.legajo, {
    estado: 'Baja', baja: f.fecha, motivoBaja: normalizarMotivo(f.motivo) || MOTIVO_RENUNCIA, vacTomadas: num(f.vacTomadas) || '',
  });
  const per = periodoDe(baja);
  const borradas = borrarNovedades_(n => n.legajo === leg.legajo && periodo(n.periodo) > per);
  const res = actualizar_();
  let msg = 'Baja registrada: ' + leg.nombre + ' el ' + fechaCorta(baja) + '. La liquidación final estimada está en la hoja Liquidaciones finales.';
  if (borradas) msg += ' Se sacaron ' + borradas + ' filas de Novedades posteriores a la baja.';
  return { mensaje: msg, detalle: res.mensaje, avisos: res.avisos };
}

/**
 * Agrega un aumento a "Aumentos previstos". Si rige desde un mes ya cargado (y es del
 * escenario principal), además actualiza esos meses en Novedades.
 */
function guardarAumento(f) {
  const d = prepararDatos(leerTodo_());
  const legajo = texto(f.legajo);
  const leg = legajo ? d.legajos.get(legajo) : null;
  if (legajo && !leg) throw new Error('No encuentro el legajo ' + legajo + '.');
  const ult = ultimoPeriodo(d.novedades);
  const escenario = normalizarEscenario(f.escenario);
  let desde = periodo(f.desde);
  if (!desde) throw new Error('Falta desde qué mes rige.');
  const a = {
    desde: desde,
    convenio: leg ? leg.convenio : normalizarConvenio(f.convenio),
    legajo: legajo,
    tipo: AUMENTO_SUELDO,
    porcentaje: num(f.porcentaje) / 100,
    monto: num(f.monto),
    escenario: escenario,
    observaciones: texto(f.observaciones),
  };
  if (!a.convenio) throw new Error('Elegí una persona o un convenio.');
  if (!a.porcentaje && !a.monto) throw new Error('Cargá un porcentaje o un monto.');
  const principal = aplicaEscenario(escenario, ESCENARIO_BASE);
  let msg = 'Aumento cargado' + (leg ? ' para ' + leg.nombre : ' para todo ' + a.convenio) + ' desde ' + desde + '.';
  if (ult && desde <= ult) {
    if (principal) {
      const cambios = cambiosPorAumento(d, a);
      actualizarNovedades_(cambios);
      const meses = new Set(cambios.map(c => c.periodo)).size;
      a.observaciones = (a.observaciones ? a.observaciones + ' ' : '') + 'Aplicado a Novedades.';
      msg += ' Se aplicó a ' + meses + (meses === 1 ? ' mes' : ' meses') + ' ya cargados en Novedades.';
    } else {
      a.desde = sumarMeses(ult, 1);
      msg = 'Aumento cargado en el escenario "' + escenario + '" desde ' + a.desde + ' (el primer mes proyectado).';
    }
  }
  agregarFilas_(HOJAS.aumentos, COLUMNAS.aumentos, [a]);
  const res = actualizar_();
  return { mensaje: msg, detalle: res.mensaje, avisos: res.avisos };
}

// --- Lectura ---------------------------------------------------------------------------

function leerTodo_() {
  return {
    parametros: leerTabla_(HOJAS.parametros, COLUMNAS.parametros),
    legajos: leerTabla_(HOJAS.legajos, COLUMNAS.legajos),
    escala: leerTabla_(HOJAS.escala, COLUMNAS.escala),
    topes: leerTabla_(HOJAS.topes, COLUMNAS.topes, true),
    novedades: leerTabla_(HOJAS.novedades, COLUMNAS.novedades),
    aumentos: leerTabla_(HOJAS.aumentos, COLUMNAS.aumentos, true),
    planilla: leerTabla_(HOJAS.planilla, COLUMNAS.planilla, true),
  };
}

function hoja_(nombre) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Usá Sueldos > Crear las hojas que falten.');
  return sh;
}

function encabezado_(sh) {
  const ancho = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, ancho).getValues()[0].map(h => String(h).trim().toLowerCase());
}

/** Lee una hoja como lista de objetos, ubicando cada columna por su encabezado. */
function leerTabla_(nombre, columnas, opcional) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!sh) {
    if (opcional) return [];
    throw new Error('Falta la hoja "' + nombre + '". Usá Sueldos > Crear las hojas que falten.');
  }
  const valores = sh.getDataRange().getValues();
  if (valores.length < 2) return [];
  const enc = valores[0].map(h => String(h).trim().toLowerCase());
  const pos = columnas.map(c => enc.indexOf(c[1].toLowerCase()));
  const faltan = columnas.filter((c, i) => pos[i] < 0 && c[0] !== 'observaciones' && c[0] !== 'nombre' && c[0] !== 'descripcion');
  if (faltan.length && !opcional) {
    throw new Error('En la hoja "' + nombre + '" no encuentro la columna "' + faltan[0][1] + '". Revisá el encabezado de la fila 1.');
  }
  const filas = [];
  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    if (fila.every(v => v === '' || v === null)) continue;
    const o = {};
    columnas.forEach((c, j) => { o[c[0]] = pos[j] >= 0 ? normalizar_(fila[pos[j]]) : ''; });
    filas.push(o);
  }
  return filas;
}

/** Las fechas de la hoja pasan a texto en la zona horaria de la planilla, para no correrse un día. */
function normalizar_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return v;
}

function buscarLiquidacion_(d, per, leg) {
  const reales = liquidarReales(d);
  return reales.find(r => r.periodo === per && r.legajo === leg) ||
    proyectar(d, reales, ESCENARIO_BASE).find(r => r.periodo === per && r.legajo === leg);
}

// --- Escritura -------------------------------------------------------------------------

/** Agrega filas al final de una hoja de entrada, ubicando cada valor por su encabezado. */
function agregarFilas_(nombre, columnas, objetos) {
  if (!objetos.length) return;
  const sh = hoja_(nombre);
  const enc = encabezado_(sh);
  const salida = objetos.map(o => {
    const fila = new Array(enc.length).fill('');
    columnas.forEach(c => {
      const i = enc.indexOf(c[1].toLowerCase());
      if (i >= 0 && o[c[0]] !== undefined && o[c[0]] !== null) fila[i] = o[c[0]];
    });
    return fila;
  });
  const desde = sh.getLastRow() + 1;
  columnas.forEach(c => {
    const i = enc.indexOf(c[1].toLowerCase());
    if (i >= 0 && c[2] === 'periodo') sh.getRange(desde, i + 1, salida.length, 1).setNumberFormat('@');
  });
  sh.getRange(desde, 1, salida.length, enc.length).setValues(salida);
}

/** Cambia algunos campos de la fila cuya columna `clave` vale `valor`. */
function actualizarFila_(nombre, columnas, clave, valor, campos) {
  const sh = hoja_(nombre);
  const datos = sh.getDataRange().getValues();
  const enc = datos[0].map(h => String(h).trim().toLowerCase());
  const col = k => enc.indexOf(columnas.find(c => c[0] === k)[1].toLowerCase());
  const fila = datos.findIndex((f, i) => i > 0 && texto(f[col(clave)]) === valor);
  if (fila < 0) throw new Error('No encuentro "' + valor + '" en la hoja ' + nombre + '.');
  for (const k of Object.keys(campos)) {
    const c = col(k);
    if (c < 0) throw new Error('En la hoja ' + nombre + ' falta la columna de ' + k + '.');
    sh.getRange(fila + 1, c + 1).setValue(campos[k]);
  }
}

/** Escribe en Novedades los cambios [{ periodo, legajo, campo, valor }]. */
function actualizarNovedades_(cambios) {
  if (!cambios.length) return;
  const sh = hoja_(HOJAS.novedades);
  const datos = sh.getDataRange().getValues();
  const enc = datos[0].map(h => String(h).trim().toLowerCase());
  const col = k => enc.indexOf(COLUMNAS.novedades.find(c => c[0] === k)[1].toLowerCase());
  const filas = new Map();
  datos.forEach((f, i) => { if (i > 0) filas.set(periodo(normalizar_(f[col('periodo')])) + '|' + texto(f[col('legajo')]), i + 1); });
  for (const c of cambios) {
    const r = filas.get(c.periodo + '|' + c.legajo);
    if (r) sh.getRange(r, col(c.campo) + 1).setValue(c.valor);
  }
}

/** Borra de Novedades las filas que cumplen la condición. Devuelve cuántas borró. */
function borrarNovedades_(condicion) {
  const sh = hoja_(HOJAS.novedades);
  const datos = sh.getDataRange().getValues();
  const enc = datos[0].map(h => String(h).trim().toLowerCase());
  const iPer = enc.indexOf('período'), iLeg = enc.indexOf('legajo');
  let borradas = 0;
  for (let i = datos.length - 1; i >= 1; i--) {
    if (condicion({ periodo: normalizar_(datos[i][iPer]), legajo: texto(datos[i][iLeg]) })) {
      sh.deleteRow(i + 1);
      borradas++;
    }
  }
  return borradas;
}

/** Reemplaza todo el contenido de una hoja de salida por la tabla. */
function escribirTabla_(nombre, tabla) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  sh.clear();
  const ancho = tabla.encabezado.length;
  sh.getRange(1, 1, 1, ancho).setValues([tabla.encabezado]).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  if (tabla.filas.length) {
    tabla.formatos.forEach((f, i) => sh.getRange(2, i + 1, tabla.filas.length, 1).setNumberFormat(FORMATO[f] || '@'));
    sh.getRange(2, 1, tabla.filas.length, ancho).setValues(tabla.filas);
  }
  sh.setFrozenColumns(Math.min(4, ancho));
}

function dibujarRecibo_(sh, filas) {
  const leg = sh.getRange('B3').getValue(), per = sh.getRange('B2').getValue();
  sh.getRange(5, 1, Math.max(sh.getMaxRows() - 4, 1), 4).clear();
  sh.getRange('A1').setValue('Elegí período y legajo y usá Sueldos > Ver recibo').setFontColor('#666666');
  sh.getRange('A2:A3').setValues([['Período (aaaa-mm)'], ['Legajo']]).setFontWeight('bold');
  sh.getRange('B2').setNumberFormat('@').setValue(per);
  sh.getRange('B3').setValue(leg);
  // El encabezado va como texto para que Sheets no convierta el período ni la fecha en fechas.
  const titulo = filas.findIndex(f => f[0] === 'Concepto');
  sh.getRange(5, 1, Math.max(titulo, 1), 4).setNumberFormat('@');
  sh.getRange(5, 1, filas.length, 4).setValues(filas);
  sh.getRange(5 + titulo + 1, 2, filas.length - titulo - 1, 3).setNumberFormat(FORMATO.pesos).setHorizontalAlignment('right');
  sh.getRange(5, 1).setFontWeight('bold').setFontSize(13);
  if (titulo >= 0) sh.getRange(5 + titulo, 1, 1, 4).setFontWeight('bold').setBackground('#e8eaed');
  const neto = filas.findIndex(f => f[0] === 'NETO A COBRAR');
  if (neto >= 0) sh.getRange(5 + neto, 1, 1, 2).setFontWeight('bold').setFontSize(12);
  const tot = filas.findIndex(f => f[0] === 'Totales');
  if (tot >= 0) sh.getRange(5 + tot, 1, 1, 4).setFontWeight('bold').setBorder(true, null, null, null, null, null);
  sh.setColumnWidth(1, 260);
  sh.setColumnWidths(2, 3, 140);
}

function pdfDeHoja_(ss, sh) {
  const ultima = sh.getLastRow();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf' +
    '&gid=' + sh.getSheetId() + '&range=A5:D' + ultima +
    '&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED' +
    '&top_margin=0.6&bottom_margin=0.6&left_margin=0.6&right_margin=0.6';
  const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('No se pudo generar el PDF (código ' + resp.getResponseCode() + '). Probá de nuevo en un minuto.');
  return resp.getBlob();
}
