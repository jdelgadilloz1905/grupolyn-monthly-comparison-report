# Monthly Comparison Report — GrupoLyN

Herramienta de Google Apps Script que compara el presupuesto planificado contra el real de una
hoja de planificación financiera, identifica **qué gastos concretos** causaron cada desviación, y
deja el resumen escrito en una pestaña y en un borrador de correo.

> Prueba técnica para el rol de *AI and Automation Specialist*.
> **[📄 Leer el documento de entrega](docs/00-ENTREGA.md)** — el enfoque, las decisiones y los supuestos.

---

## Qué resuelve

Revisar manualmente el presupuesto de un cliente lleva entre 30 y 45 minutos: comparar categoría
por categoría, encontrar la partida responsable, y redactar el correo. Con 50 clientes son unas
**40 horas al mes**, repetitivas y propensas a que algo se escape.

Esto lo reduce a un clic. El análisis y la redacción se automatizan; **el envío no**, y esa
decisión es deliberada.

## Cómo funciona

```
Monthly Budget ──> BudgetReader ──> DeviationEngine ──> ReportSheet ──> pestaña
                                          │
                                          └──────────> EmailDraft ───> borrador Gmail
```

`DeviationEngine` no conoce Google: recibe datos y devuelve datos. Por eso se puede probar
entero sin abrir una hoja de cálculo.

## La decisión de diseño central

Cuando una categoría se desvía, hay que decidir **qué partidas se muestran**.

| Partida | Presupuesto | Real | Porcentaje | Importe |
|---|---|---|---|---|
| Café | $10 | $40 | **+300 %** | +$30 |
| Vivienda | $3.000 | $3.600 | +20 % | **+$600** |

Ordenar por porcentaje diría que el problema es el café. **El sistema ordena por importe**,
porque al cliente le importa dónde se fue el dinero, no qué número es más llamativo.

## El bonus, ejecutado

El despliegue masivo no se quedó en diseño: se desplegó de verdad sobre dos hojas creadas para
la prueba. Cada una acabó con **dos archivos** —el manifiesto y 50 líneas de arranque que solo
delegan en la biblioteca compartida—, y la segunda pasada no escribió nada.

Ejecutarlo sacó **tres fallos invisibles a la lectura del código**, entre ellos que los 50
clientes habrían compartido un único código de administrador y un único contador de intentos.
El registro completo está en [07-despliegue-masivo.md](docs/07-despliegue-masivo.md).

```bash
node tools/deploy-run.js               # simulación: informa y no escribe
node tools/deploy-run.js --escribir    # despliega
node tools/deploy-verify.js            # relee del servidor y comprueba
```

## Estructura

```
src/
  DeviationEngine.js   Cálculo de desviaciones. Sin dependencias de Google
  BudgetReader.js      Lee la hoja. Localiza por contenido, nunca por coordenada
  ReportSheet.js       Pinta la pestaña con el formato de referencia
  EmailDraft.js        Redacta el borrador. Nunca envía
  Auth.js              Hash, sesión, bloqueo por intentos y auditoría
  Menu.js              Menú Admin y puntos de entrada
  Orchestrator.js      Une las piezas
  Deployer.js          Despliegue masivo por biblioteca (bonus). EJECUTADO
  Config.js            Umbrales, formatos y convenciones
  Tests.js             201 comprobaciones
  Fixtures.js          Datos de prueba SINTÉTICOS
  *.html               Diálogos (contraseña, parámetros, ayuda)

tools/                 Andamiaje local. No se sube a Apps Script
  run-tests-local.js   Suite completa contra dobles de los servicios de Google
  deploy-run.js        Lanza el despliegue masivo. Simula por defecto
  deploy-verify.js     Relee del servidor y comprueba lo desplegado
docs/                  Entrega, casos de uso, diagramas, plan y guía de validación
```

## Pruebas

```bash
node tools/run-tests-local.js     # 201 asserts, menos de un segundo
```

Los mismos tests corren dentro de Apps Script ejecutando `runAllTests()` desde el editor. En
local se sustituyen los servicios de Google por dobles con **reloj controlable**, lo que permite
verificar que la sesión caduca a los 30 minutos y que el bloqueo dura 15 sin esperar 45 minutos
reales.

Los casos cubiertos salen de revisar los datos de una hoja real: presupuesto en cero con gasto
—que rompería el cálculo al dividir—, devoluciones con importe negativo, desviaciones de cinco
cifras porcentuales, y que **insertar filas o columnas no rompa nada**.

## Desarrollo

```bash
npm install -g @google/clasp
clasp login
clasp push          # sube src/ al proyecto vinculado a la hoja
```

## Seguridad

El código de administrador es una **barrera de conveniencia, no un control de seguridad**:
cualquiera con permiso de edición sobre la hoja puede abrir el editor de Apps Script. Lo que sí
aporta está documentado en la [entrega](docs/00-ENTREGA.md#sobre-la-contraseña-del-menú-lo-que-protege-y-lo-que-no).

- La contraseña se guarda como **hash con salt**, nunca en claro.
- Bloqueo tras 5 intentos, sesión de 30 minutos, auditoría de cada acceso.
- El sistema **no envía correo**: usa `createDraft()` y no contiene ninguna llamada de envío.
  Un test falla si alguien añade una. El scope `gmail.compose` es el más restringido que permite
  crear borradores, pero **Google lo describe como «administrar borradores y enviar correo»**: la
  garantía es el código, no el permiso.

**Este repositorio no contiene ningún dato del cliente.** Los fixtures son sintéticos y
reproducen solo la *forma* de cada caso límite.

## Documentación

| Documento | Contenido |
|---|---|
| [00-ENTREGA.md](docs/00-ENTREGA.md) | **Empieza aquí.** Enfoque, decisiones y supuestos |
| [01-casos-de-uso.md](docs/01-casos-de-uso.md) | Actores, flujos alternativos y reglas de negocio |
| [02-diagramas-flujo.md](docs/02-diagramas-flujo.md) | Diagramas Mermaid |
| [03-plan-de-tareas.md](docs/03-plan-de-tareas.md) | Tareas con criterios de aceptación |
| [05-guia-de-validacion.md](docs/05-guia-de-validacion.md) | Recorrido de validación paso a paso |
| [07-despliegue-masivo.md](docs/07-despliegue-masivo.md) | El bonus ejecutado: registro real y los tres fallos que sacó |
