# Sueldos: cálculo, control y proyección

Planilla de Google con un menú **Sueldos** que liquida al personal UOM y al de
fuera de convenio, da de alta y de baja, aplica aumentos generales o
individuales, proyecta los próximos meses en uno o varios escenarios y compara
contra la planilla anterior. Sirve de guía y control para el estudio contable:
no reemplaza el recibo oficial, el F.931 ni el Libro de Sueldos Digital, y no
calcula Ganancias.

Archivos:
- `Calculo.gs`: las reglas (antigüedad, aportes, aguinaldo, liquidación final, proyección, escenarios). No toca la planilla.
- `Code.gs`: el menú, la lectura y escritura de las hojas y lo que llaman los formularios.
- `Formularios.html`: los formularios de alta, baja y aumento.
- `test/`: pruebas con datos inventados (`node --test sueldos/test/*.test.js`).

## Ponerlo en marcha (una sola vez, unos 10 minutos)

La planilla "Sueldos 2026 - Cálculo, control y proyección" ya tiene los datos
cargados (legajos, novedades de enero a junio 2026, escala, aumentos previstos y
la planilla anterior para el control). Falta pegarle el programa:

1. En la planilla: menú **Extensiones → Apps Script**.
2. Borrá lo que tiene `Código.gs` y pegá el contenido completo de `Code.gs`.
3. Al lado de "Archivos" tocá **+ → Secuencia de comandos**, nombre `Calculo`, y pegá `Calculo.gs`.
4. **+ → HTML**, nombre `Formularios`, y pegá `Formularios.html`.
5. Guardá (Ctrl+S), volvé a la planilla y recargala (F5). Aparece el menú **Sueldos**.
6. **Sueldos → Liquidar y actualizar todo.** La primera vez Google pide permiso:
   **Continuar → tu cuenta → Permitir**. Si aparece "Google no verificó esta app",
   tocá **Configuración avanzada → Ir a … (no seguro)**: es tu propio script.
   Se llenan las hojas grises.

## Cada mes

1. Si hubo paritaria UOM, agregá una fila en **Escala UOM** con el nuevo básico.
2. **Sueldos → Preparar mes siguiente.** Agrega a **Novedades** una fila por persona activa
   con lo fijo del mes anterior. También aplica los aumentos previstos para ese mes, incorpora
   las altas con sus importes iniciales y descuenta del anticipo la suba de escala.
3. En **Novedades** cargá lo que cambie: horas extra, otros conceptos, descuentos.
4. **Sueldos → Liquidar y actualizar todo.**

## Altas, bajas y aumentos

- **Sueldos → Dar de alta un empleado…**: nombre, CUIL, convenio, fecha de ingreso y sueldo
  inicial (UOM: categoría y "a cuenta"; fuera de convenio: básico o neto pactado). Le asigna el
  próximo legajo. Si la fecha es futura, entra solo en la proyección hasta que llegue ese mes.
  El mes de ingreso se paga proporcional a los días.
  Con un nombre en **Escenario** es una contratación hipotética ("Contratar 2 operarios"): no
  toca la liquidación real, solo esa proyección.
- **Sueldos → Dar de baja un empleado…**: persona, fecha y motivo. Antes de confirmar muestra la
  **liquidación final estimada** (SAC y vacaciones proporcionales y, si es despido sin causa,
  indemnización, preaviso e integración del mes). Al confirmar pone la fecha en Legajos, saca de
  Novedades los meses posteriores y deja el detalle en **Liquidaciones finales**. La fecha puede
  ser futura: sigue cobrando hasta ese día.
- **Sueldos → Aumento de sueldo…**: a una persona o a todo un convenio, en porcentaje y/o monto
  fijo, desde un mes. Si ese mes ya está cargado, actualiza Novedades; si es futuro, queda en
  **Aumentos previstos** y se aplica solo al preparar el mes y en la proyección.
  Fuera de convenio sube el básico (o el neto, si se pactó en neto). En UOM el básico lo fija
  la escala, así que el aumento se suma a "a cuenta futuros aumentos".

## Proyecciones y escenarios

- **Aumentos previstos** tiene lo que se espera: aumentos de escala UOM, anticipos a cuenta
  (que se absorben con cada aumento de escala) y aumentos de sueldo generales o por legajo.
- Hasta qué mes se proyecta: **Parámetros → PROYECTAR_HASTA**.
- **Escenarios**: poné un nombre en la columna Escenario de un aumento o de un alta para que valga
  solo en ese escenario (por ejemplo "Paritaria alta" con +6% en lugar de +4%, o "Contratar 2").
  Vacío vale para todos; `Base` vale solo para el principal. La hoja **Escenarios** compara el
  costo mes a mes de cada uno contra Base, con la diferencia en pesos y en %.
- **Alertas** lista lo que pasa en los próximos 3 meses: aniversarios que suben la antigüedad UOM,
  fin del período de prueba, altas y bajas programadas, aumentos previstos y escalas por cargar.

## Las hojas

Amarillas, se cargan a mano (o con los formularios): Novedades, Legajos, Escala UOM, Aumentos
previstos, Parámetros, Topes, Planilla original.

Grises, se regeneran solas (no editarlas): Resumen, Escenarios, Alertas, Liquidación,
Proyección, Evolución, Control, Liquidaciones finales, Recibo.

## Reglas que usa

- **Antigüedad UOM**: 1% del básico por cada año cumplido al último día del mes, más los años
  reconocidos del legajo.
- **Aportes**: jubilación 11%, Ley 19.032 3%, obra social 3%, con el tope de la hoja Topes.
  Afiliados UOM: además cuota sindical 2,5% (sin tope) y el aporte fijo UOM.
- **Régimen de aportes** del legajo: `Completo`, `Solo jubilación` o `Sin aportes` (este último
  tampoco lleva contribuciones patronales ni ART).
- **Mes de alta o de baja**: se paga por los días trabajados (mes de 30 días), salvo que cargues
  los días a mano en Novedades.
- **Aguinaldo**: en junio y diciembre, 50% de la mejor remuneración del semestre, proporcional si
  la persona entró o se fue durante el semestre.
- **Liquidación final estimada**: SAC proporcional; vacaciones no gozadas proporcionales al año
  (14, 21, 28 o 35 días según antigüedad, sueldo / 25 por día) con su SAC. Despido sin causa:
  indemnización art. 245 (mejor remuneración × años, fracción mayor a 3 meses cuenta como año,
  sin tope), preaviso (1 mes, o 2 desde los 5 años; 15 días en período de prueba, sin
  indemnización) e integración del mes, con su SAC. Importes brutos aproximados.

## Para confirmar con el estudio

- Los **topes** de la hoja Topes están estimados a partir de un recibo.
- El **aporte fijo UOM** ($7.368) y los **porcentajes de contribuciones** de Parámetros.
- El **régimen de aportes** de cada legajo: hay uno sin aportes y uno solo con jubilación,
  deducidos de la planilla.
- La **categoría UOM**: todos figuran como "Única (a confirmar)". Poné el nombre real en Legajos
  y en Escala UOM (tiene que ser igual en las dos).
- La **liquidación final** no aplica el tope de convenio a la indemnización ni casos especiales
  (embarazo, accidente, etc.).

## Si hay que cambiar algo del programa

Editá los archivos acá y volvé a pegarlos en el editor de Apps Script. Antes, corré las pruebas:
`node --test sueldos/test/*.test.js`.
