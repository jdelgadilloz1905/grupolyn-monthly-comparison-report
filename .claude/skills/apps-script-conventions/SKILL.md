---
name: apps-script-conventions
description: Convenciones y trampas de Google Apps Script (runtime V8) para este proyecto — lectura por lotes, PropertiesService, HtmlService, menús, cuotas y modularidad. Úsala al escribir o revisar cualquier archivo .gs.
---

# Convenciones de Apps Script — GrupoLyN

## Runtime

V8, declarado en `appsscript.json` (`"runtimeVersion": "V8"`). Usa ES6+: `const`/`let`, arrow
functions, template literals, destructuring, clases. **Nunca** patrones del viejo runtime Rhino.

## Regla nº 1: leer y escribir por lotes

La causa número uno de scripts lentos en Apps Script son las llamadas al servicio de Sheets dentro
de un bucle. Cada `getRange().getValue()` es un viaje de red.

```javascript
// MAL — un viaje por celda. Con 200 filas, 200 llamadas.
for (let i = 1; i <= n; i++) {
  const v = sheet.getRange(i, 5).getValue();
}

// BIEN — un viaje, y luego memoria.
const values = sheet.getDataRange().getValues();
for (const row of values) {
  const v = row[4];
}
```

Lo mismo al escribir: acumula un array 2D y haz **un** `setValues()`.

## Regla nº 2: nunca posiciones fijas

La hoja es dato **e** interfaz: el usuario inserta filas y todo se desplaza. Localiza por contenido,
no por coordenada.

```javascript
// MAL — se rompe en cuanto alguien añade una categoría.
const total = sheet.getRange('E115').getValue();

// BIEN — busca la fila por su etiqueta.
const rowIdx = values.findIndex((r) => String(r[2]).trim() === 'Total Shelter');
```

Igual con las columnas: localiza la fila de cabecera y deduce los índices de `Budget` y `Actual`.

## Secretos y configuración

- `PropertiesService.getScriptProperties()` → configuración e **hashes**. Compartido por todos los
  usuarios del script.
- `CacheService.getUserCache()` → estado efímero por usuario (la sesión de admin). TTL máximo 6 h.
- **Nunca** un secreto en el código fuente.
- **Consciencia crítica:** las Script Properties **son visibles** en el editor de Apps Script para
  cualquiera con acceso de edición. Guardar un hash en vez de texto plano protege frente a la
  reutilización de la contraseña en otros sitios, no frente a un editor decidido. Ver `04-seguridad.md`.

## Diálogos: HtmlService, no `ui.prompt`

`SpreadsheetApp.getUi().prompt()` **muestra en pantalla lo que se escribe**. Para una contraseña eso
es inaceptable. Usa `HtmlService` con `<input type="password">`.

```javascript
const html = HtmlService.createHtmlOutputFromFile('AuthDialog')
  .setWidth(320)
  .setHeight(180);
SpreadsheetApp.getUi().showModalDialog(html, 'Acceso de administrador');
```

El HTML devuelve al servidor con `google.script.run.withSuccessHandler(...)`.

## Menús

`onOpen(e)` es un disparador simple: corre **sin autorización** y no puede acceder a
`PropertiesService` ni a servicios que requieran permisos en algunos contextos. Construye el menú de
forma defensiva y deja el trabajo pesado para cuando el usuario pulse algo.

```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Admin');
  if (isSessionValid()) {
    menu.addItem('Generar Reporte Comparativo Mensual', 'showReportDialog')
        .addSeparator()
        .addItem('🔒 Bloquear', 'lockAdmin');
  } else {
    menu.addItem('🔓 Desbloquear', 'showAuthDialog');
  }
  menu.addToUi();
}
```

**El menú es cosmético.** Toda función de administrador debe revalidar la sesión al ejecutarse: un
usuario puede invocar la función desde el editor sin pasar por el menú.

## Modularidad

Un archivo por responsabilidad. En Apps Script todos los `.gs` comparten un único ámbito global, así
que **prefija las funciones internas** o encapsula en objetos para evitar colisiones.

```javascript
const DeviationEngine = {
  analyze(model, threshold) { /* ... */ },
  _percent(actual, planned) { /* ... */ },
};
```

**Regla de oro del proyecto:** la lógica de negocio (`DeviationEngine`) no importa `SpreadsheetApp`
ni `GmailApp`. Recibe estructuras de datos y devuelve estructuras de datos. Eso es lo que la hace
testeable.

## Cuotas que importan aquí

| Servicio | Límite (cuenta gratuita) | Impacto |
|---|---|---|
| `GmailApp.createDraft` | 100 borradores/día | Limita el despliegue masivo de reportes |
| Tiempo de ejecución | 6 min por ejecución | El despliegue masivo debe trocearse por lotes |
| `UrlFetchApp` | 20.000 llamadas/día | Relevante solo para la Apps Script API |

Si el despliegue masivo puede pasar de 6 minutos, guarda el progreso en `ScriptProperties` y
continúa con un disparador temporal.

## Errores

Usa excepciones con mensajes accionables. El consultor debe saber qué hacer, no leer un stack trace.

```javascript
if (!sheet) {
  throw new Error('No se encontró la pestaña "Monthly Budget". Verifica que no se haya renombrado.');
}
```

En operaciones por lotes, **aísla**: captura el error de cada elemento, regístralo y sigue con el
siguiente.

## appsscript.json

Declara los scopes explícitamente, con el mínimo necesario. Pedir de más es una señal negativa en
una revisión de código.

```json
{
  "timeZone": "America/New_York",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/gmail.compose"
  ]
}
```

`gmail.compose` permite crear borradores pero **no enviar**. Es deliberado y refuerza la regla de
que el sistema nunca envía correo por su cuenta.
