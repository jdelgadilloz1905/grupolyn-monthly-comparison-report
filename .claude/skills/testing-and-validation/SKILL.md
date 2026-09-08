---
name: testing-and-validation
description: Estrategia de pruebas en tres niveles para Apps Script — unitario sobre lógica pura, integración leyendo la hoja generada, y Playwright MCP para menús, diálogos y capturas. Incluye qué NO se puede automatizar en Google Sheets y por qué. Úsala al escribir tests o validar cambios.
---

# Pruebas y validación

## La pirámide, y por qué en este orden

```
        Playwright  <- superficie: menús, diálogos, capturas
      Integración   <- el pipeline escribe lo correcto
    Unitario        <- la lógica y sus casos límite   (la base)
```

Cuanto más abajo, más rápido y más fiable. Empieza siempre por abajo.

---

## Nivel 1 · Unitario (donde vive el valor)

`DeviationEngine` no depende de `SpreadsheetApp`. Eso permite probarlo con datos inventados, en
segundos, sin abrir una hoja.

```javascript
/** Tests.gs — ejecutable desde el editor de Apps Script. */
function runAllTests() {
  const r = [];
  r.push(test_plannedCero_devuelve100());
  r.push(test_plannedYActualCero_seOmite());
  r.push(test_importeNegativo_esReembolso());
  r.push(test_ordenPorImporteNoPorPorcentaje());

  const fallos = r.filter((x) => !x.ok);
  Logger.log(`${r.length - fallos.length}/${r.length} OK`);
  fallos.forEach((f) => Logger.log(`FALLA: ${f.name} — ${f.msg}`));
}

function assertEquals(actual, esperado, nombre) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado);
  return { ok, name: nombre, msg: ok ? '' : `esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(actual)}` };
}

function test_plannedCero_devuelve100() {
  return assertEquals(
    DeviationEngine.percent(1500, 0), 100,
    'Planned=0 con Actual>0 devuelve 100, no Infinity'
  );
}

function test_ordenPorImporteNoPorPorcentaje() {
  const items = [
    { name: 'Café',   actual: 40,   planned: 10 },    // +300 %, +$30
    { name: 'Alquiler', actual: 3600, planned: 3000 }, // +20 %,  +$600
  ];
  const orden = DeviationEngine.rankItems(items).map((i) => i.name);
  return assertEquals(orden, ['Alquiler', 'Café'], 'Ordena por importe absoluto, no por porcentaje');
}
```

**Casos límite obligatorios** (todos observados en los datos reales, ver `budget-domain-model`):
`Planned = 0` · `Planned = 0` y `Actual = 0` · importes negativos (reembolsos) · desviaciones
extremas (+10.794 %) · ingresos frente a gastos · categorías nuevas no previstas.

---

## Nivel 2 · Integración (el bucle real de desarrollo)

Ejecutar la generación de verdad y **verificar lo que quedó escrito**, sin navegador.

Opciones, de más a menos cómoda:

1. **`clasp run`** — ejecuta una función del proyecto y devuelve su valor. Requiere un proyecto de
   GCP propio y la Apps Script API habilitada. Es el bucle más rápido una vez configurado.
2. **API de Drive/Sheets desde fuera** — generar el reporte y luego leer la pestaña resultante para
   compararla con lo esperado.
3. **Función de autodiagnóstico dentro del script** que genere el reporte sobre datos conocidos y
   devuelva un veredicto por `Logger`.

Lo importante es que la aserción sea sobre **el contenido de la pestaña generada**, no sobre lo que
creemos que hizo la función.

---

## Nivel 3 · Playwright MCP

### Qué sí funciona

| Objetivo | Viable | Nota |
|---|---|---|
| Abrir la hoja por URL | ✅ | |
| Clicar el menú `Admin` | ✅ | La barra de menús **es DOM** |
| Escribir en el diálogo de contraseña | ✅ | HtmlService renderiza en un `iframe` accesible |
| Comprobar que el menú cambia tras desbloquear | ✅ | Es la prueba de humo más valiosa |
| Captura de pantalla para la entrega | ✅ | Útil como evidencia en el documento |
| **Leer el valor de una celda** | ❌ | La cuadrícula se dibuja en **canvas**, no en DOM |
| **Login automático de Google** | ❌ | Detección de bots y 2FA. Es donde se atasca todo el mundo |

### Cómo sortear el login

No lo automatices. Usa un **perfil de navegador ya autenticado** y reutiliza la sesión. Si el MCP
abre un navegador limpio en cada ejecución, la sesión se pierde y no hay forma limpia de recuperarla.

**Por eso Playwright no puede ser el bucle de desarrollo.** Es para humo y evidencia visual al final,
no para iterar.

### Flujo recomendado

```
1. mcp__playwright__browser_navigate   -> URL de la hoja (sesión ya iniciada)
2. mcp__playwright__browser_snapshot   -> localizar el menú Admin
3. mcp__playwright__browser_click      -> Admin
4. mcp__playwright__browser_click      -> Desbloquear
5. mcp__playwright__browser_type       -> código en el diálogo
6. mcp__playwright__browser_snapshot   -> verificar que el menú se reconstruyó
7. mcp__playwright__browser_take_screenshot -> evidencia para la entrega
```

### Qué comprobar aquí y en ningún otro sitio

- Que `onOpen` dibuja el menú.
- Que el diálogo **enmascara** la contraseña (`type="password"`) — es visual, no se ve en un test unitario.
- Que un código incorrecto muestra un error genérico.
- Que tras desbloquear aparecen las opciones de administrador.

---

## Qué validar antes de dar algo por terminado

- [ ] `runAllTests()` en verde, con los seis casos límite cubiertos
- [ ] El reporte generado coincide con el formato de referencia del libro
- [ ] Ninguna partida con `Planned = 0` produce `Infinity` ni `NaN`
- [ ] Las partidas se ordenan por importe absoluto, no por porcentaje
- [ ] Los ingresos no se describen con el mismo lenguaje que los gastos
- [ ] El sistema crea un **borrador**, nunca envía
- [ ] Ningún secreto en el código fuente
- [ ] El despliegue masivo, ejecutado dos veces, deja el mismo estado
