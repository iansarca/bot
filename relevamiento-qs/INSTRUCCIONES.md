# Relevamiento de uso de Quality Soft

Página donde cada persona de la empresa marca qué pantallas de Quality Soft usa
y con qué frecuencia. Entran con su cuenta de Google de la empresa
(`@diestroweb.com`), así que se sabe quién respondió sin pedirle nada. Las
respuestas quedan en una planilla de Google Sheets en tu Drive.

Archivos:
- `Code.gs`: la parte que guarda y lee de la planilla.
- `Index.html`: la página que ve la gente (las 403 pantallas del árbol de menús).

## Ponerlo en marcha (una sola vez, unos 10 minutos)

Hacelo con tu cuenta de la empresa (`@diestroweb.com`), no con un Gmail personal.

1. **Creá la planilla.** Entrá a [sheets.new](https://sheets.new) y ponele de
   nombre `Relevamiento Quality Soft`.
2. **Abrí el editor de código.** En la planilla: menú **Extensiones → Apps Script**.
   Se abre una pestaña nueva con un archivo `Código.gs`.
3. **Pegá `Code.gs`.** Borrá todo lo que tiene `Código.gs` y pegá el contenido
   completo de `Code.gs`.
4. **Creá la página.** A la izquierda, al lado de "Archivos", tocá **+ → HTML**.
   Ponele de nombre exactamente `Index` (sin `.html`, Google lo agrega solo).
   Borrá lo que trae y pegá el contenido completo de `Index.html`.
5. **Guardá.** Ícono del disquete (o Ctrl+S).
6. **Publicala.** Arriba a la derecha: **Implementar → Nueva implementación**.
   - En "Seleccionar tipo" (el engranaje) elegí **Aplicación web**.
   - Descripción: `Relevamiento v1`.
   - **Ejecutar como:** `Yo (tu mail)`.
   - **Quién tiene acceso:** `Cualquier usuario de Diestro…` (la opción con el
     nombre de la empresa). **No** elijas "Cualquier usuario", porque ahí la página no
     puede saber quién responde.
   - Tocá **Implementar**.
7. **Autorizá.** Google te pide permiso para que el script use la planilla:
   **Autorizar acceso → elegí tu cuenta → Permitir**. Si aparece "Google no
   verificó esta app", tocá **Configuración avanzada → Ir a … (no seguro)**: es
   tu propio script.
8. **Copiá el link.** Te muestra la "URL de la aplicación web" (termina en
   `/exec`). Ese es el link que mandás.
9. **Probalo vos primero.** Abrí el link, marcá un par de pantallas y fijate que
   en la planilla aparezcan las hojas `Respuestas`, `Pantallas` y `Matriz`.

## Mandarlo

Mandá el link de la aplicación web por WhatsApp o mail. Cada uno lo abre, entra
con su cuenta de la empresa si no estaba logueado, y listo. No necesitan acceso
a la planilla.

## Dónde ver las respuestas

- En la página, pestaña **Resultados**: lo más usado primero, quién usa cada
  pantalla, lo que nadie usa y lo que se hace por fuera del sistema.
- En la planilla:
  - **Matriz**: una fila por pantalla, una columna por persona y la cantidad de
    personas que la usan. Se puede filtrar y ordenar. Se regenera sola en cada
    respuesta, así que no la edites a mano.
  - **Respuestas**: una fila por persona (los datos crudos).
  - **Pantallas**: el catálogo de pantallas. No lo borres.

## Si hay que cambiar algo de la página

Pegá el código nuevo en el editor de Apps Script, guardá y después
**Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión →
Implementar**. El link sigue siendo el mismo.
