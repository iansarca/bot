# Sueldos: cálculo, control y proyección

Planilla de Google con un menú **Sueldos** que liquida al personal UOM y al de
fuera de convenio, compara con la planilla anterior y proyecta los próximos
meses con los aumentos que cargues. Sirve de guía y control para el estudio
contable: no reemplaza el recibo oficial, el F.931 ni el Libro de Sueldos
Digital, y no calcula Ganancias.

Archivos:
- `Calculo.gs`: las reglas (antigüedad, aportes, aguinaldo, proyección). No toca la planilla.
- `Code.gs`: el menú y la lectura/escritura de las hojas.
- `Datos.gs` (no está en el repositorio): los datos iniciales sacados de la
  planilla "Análisis de sueldos enero–junio 2026". Se usa una vez y se borra.
- `test/`: pruebas con datos inventados (`node --test sueldos/test/*.test.js`).

## Ponerlo en marcha (una sola vez, unos 10 minutos)

Con tu cuenta de la empresa (`@diestroweb.com`).

1. **Abrí la planilla** "Sueldos 2026" (o creá una vacía en [sheets.new](https://sheets.new)).
2. **Abrí el editor de código.** Menú **Extensiones → Apps Script**.
3. **Pegá `Code.gs`.** Borrá todo lo que tiene `Código.gs` y pegá el contenido completo de `Code.gs`.
4. **Agregá `Calculo.gs`.** A la izquierda, al lado de "Archivos", tocá **+ → Secuencia de comandos**,
   ponele de nombre `Calculo` y pegá el contenido completo de `Calculo.gs`.
5. **Agregá `Datos.gs`.** Igual que el anterior: **+ → Secuencia de comandos**, nombre `Datos`,
   y pegá el contenido de `Datos.gs`.
6. **Guardá** (ícono del disquete o Ctrl+S).
7. **Volvé a la planilla y recargala** (F5). Aparece el menú **Sueldos** arriba, al lado de "Ayuda".
8. **Cargá los datos.** **Sueldos → Cargar datos iniciales (una sola vez)**. Google pide permiso
   la primera vez: **Continuar → elegí tu cuenta → Permitir**. Si aparece "Google no verificó esta
   app", tocá **Configuración avanzada → Ir a … (no seguro)**: es tu propio script.
   Tarda unos segundos y te deja en la hoja **Resumen**.
9. **Borrá `Datos.gs`** del editor de Apps Script (los tres puntitos al lado del archivo → Eliminar).
   Los datos ya quedaron en las hojas.

## Cada mes

1. Si hubo paritaria UOM, agregá una fila en **Escala UOM** con el nuevo básico (columna
   "Desde período" en formato `aaaa-mm`).
2. **Sueldos → Preparar mes siguiente.** Agrega a **Novedades** una fila por persona activa, con
   lo fijo del mes anterior (básico, neto pactado, a cuenta, anticipo). Si subió la escala, el
   anticipo absorbible baja en lo mismo.
3. En **Novedades** cargá lo que cambie: horas extra, otros conceptos, descuentos, y "Días
   trabajados" si alguien entró o se fue en el mes. Para fuera de convenio podés cargar el sueldo
   básico (bruto) o el **neto pactado**: si cargás el neto, el bruto se calcula solo.
4. **Sueldos → Liquidar y actualizar todo.** Se regeneran Liquidación, Proyección, Resumen,
   Evolución y Control.
5. Para controlar o mandarle al estudio: la hoja **Liquidación** filtrada por período, o los
   recibos en PDF (hoja **Recibo**: poné el período en B2 y usá **Sueldos → Guardar en PDF los
   recibos del período**; quedan en una carpeta "Recibos aaaa-mm" al lado de la planilla).

Altas y bajas: en **Legajos**. Para una baja poné Estado `Baja`; deja de aparecer en los meses
siguientes y en la proyección.

## Las hojas

Amarillas, se cargan a mano:
- **Novedades**: una fila por persona y por mes.
- **Legajos**: datos de cada persona, convenio, régimen de aportes, si está afiliada a UOM.
- **Escala UOM**: básico por categoría y desde qué mes rige.
- **Aumentos previstos**: lo que se espera para proyectar (UOM: "Aumento de escala" o
  "Anticipo a cuenta"; fuera de convenio: "Aumento de sueldo").
- **Parámetros**: porcentajes de aportes y contribuciones, montos fijos, hasta qué mes proyectar.
- **Topes**: tope de la base de aportes por mes.
- **Planilla original**: brutos y netos de la planilla anterior, para el control.

Grises, se regeneran solas (no las edites):
- **Resumen**: por mes y por convenio, personas, bruto, aguinaldo, aportes, neto, cargas
  sociales y costo total, con la variación contra el mes anterior.
- **Liquidación**: el detalle por persona de los meses reales.
- **Proyección**: lo mismo para los meses que vienen.
- **Evolución**: bruto y neto de cada persona mes a mes.
- **Control**: lo calculado contra la planilla anterior, con "OK" o "Revisar".
- **Recibo**: detalle de una persona en un mes.

## Reglas que usa

- **Antigüedad UOM**: 1% del básico por cada año cumplido al último día del mes, más los
  "años de antigüedad reconocidos" del legajo.
- **Aportes**: jubilación 11%, Ley 19.032 3%, obra social 3%, con el tope de la hoja Topes.
  Afiliados UOM: además cuota sindical 2,5% (sin tope) y el aporte fijo UOM.
- **Régimen de aportes** del legajo: `Completo`, `Solo jubilación` o `Sin aportes` (este último
  tampoco lleva contribuciones patronales ni ART).
- **Aguinaldo**: en junio y diciembre, 50% de la mejor remuneración del semestre, proporcional
  si la persona entró durante el semestre.
- **Contribuciones patronales y ART**: los porcentajes y montos de la hoja Parámetros.
- **Anticipo a cuenta (UOM)**: un porcentaje del bruto del mes anterior que se va absorbiendo
  con cada aumento de escala.

## Para confirmar con el estudio

- Los **topes** de la hoja Topes están estimados a partir de un recibo. El valor oficial cambia
  todos los meses.
- El **aporte fijo UOM** ($7.368) y los **porcentajes de contribuciones** de Parámetros.
- El **régimen de aportes** de cada legajo: hay uno sin aportes y uno solo con jubilación,
  deducidos de la planilla.
- La **categoría UOM**: todos figuran como "Única (a confirmar)". Poné el nombre real en Legajos
  y en Escala UOM (tiene que ser igual en las dos).

## Si hay que cambiar algo del programa

Editá `Code.gs` o `Calculo.gs` acá y volvé a pegarlos en el editor de Apps Script. Antes de
pegarlos, corré las pruebas: `node --test sueldos/test/*.test.js`.
