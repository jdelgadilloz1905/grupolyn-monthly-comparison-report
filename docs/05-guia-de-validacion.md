# Guía de validación

Recorrido completo para comprobar que todo funciona. **Sigue el orden**: cada paso asume que el
anterior salió bien.

Cada paso indica **qué debe pasar** y **qué hacer si no pasa**.

---

## Paso 0 · Local (30 segundos, sin tocar Google)

```bash
cd "c:/Users/HP Owner/Proyectos/grupolyn-test"
node tools/run-tests-local.js
```

✅ **Esperado:** `201/201 asserts correctos` y salida con código 0.

❌ **Si falla:** los nombres de los tests que fallan indican qué se rompió. Nada de lo siguiente
tiene sentido hasta que esto esté verde.

---

## Paso 1 · Autorizar y ejecutar los tests dentro de Google

Es el paso más importante: hasta aquí **nada se ha ejecutado en el motor de Google**, solo en Node.

1. Abre tu hoja: [GrupoLyN — Plan Financiero (JD)](https://docs.google.com/spreadsheets/d/1QhR57Wkfw9_TzNd0THrMIzCLb4EKBu_6qMi3W0mtJSg/edit)
2. **Extensiones → Apps Script**
3. En el desplegable de funciones (arriba), elige **`runAllTests`**
4. Pulsa **Ejecutar**
5. Aparecerá **«Se necesita autorización»** → *Revisar permisos* → elige tu cuenta
6. Verás **«Google no ha verificado esta aplicación»**. Es normal: la app eres tú.
   → *Configuración avanzada* → *Ir a GrupoLyN Report Engine (no seguro)*
7. Revisa los permisos que pide y **Permitir**

✅ **Esperado:** en el panel de **Registro de ejecución** aparece `201/201 asserts OK`.

❌ **Si algún test falla aquí pero pasaba en local:** es una diferencia real entre el motor de Node
y el de Apps Script. Copia el nombre del test que falla y el mensaje: eso basta para localizarlo.

---

## Paso 2 · Configurar el código de administrador

1. En el editor, abre **`Menu.js`**
2. Localiza la función `setupAdmin()` al final
3. Rellena las dos constantes:
   ```javascript
   const CODIGO = 'TuCodigoSeguro2026';   // mínimo 8 caracteres
   const AUTORIZADOS = [];                 // opcional: ['tu@correo.com']
   ```
4. Guarda (Ctrl+S), elige **`setupAdmin`** en el desplegable y **Ejecutar**
5. ✅ El registro debe decir: *«Código de administrador configurado. No queda almacenado en claro.»*
6. **Vuelve a vaciar la constante** (`const CODIGO = '';`) y guarda

> El paso 6 no es cosmético: el código no debe quedar escrito en el archivo.

**Comprobación de que se guardó como huella y no en claro:**
Configuración del proyecto (⚙️) → *Propiedades del script*. Debe haber `ADMIN_CODE_HASH` y
`ADMIN_CODE_SALT`, y el hash **no debe parecerse a tu código** (44 caracteres aleatorios).

---

## Paso 3 · El menú aparece bloqueado

1. Vuelve a la hoja y **recárgala** (F5)
2. Espera unos segundos a que cargue el menú

✅ **Esperado:** aparece un menú **Admin** con una única opción: **🔓 Desbloquear…**

❌ **Si no aparece el menú:** el disparador `onOpen` no se ejecutó. Recarga otra vez; si persiste,
revisa el registro de ejecuciones en el editor.

---

## Paso 4 · El diálogo enmascara la contraseña

**Esta comprobación solo puede hacerse mirando.** Ningún test automático la detecta.

1. **Admin → 🔓 Desbloquear…**
2. Escribe cualquier cosa en el campo

✅ **Esperado:** se ven **puntos o asteriscos**, nunca el texto.

❌ **Si se ve el texto:** el diálogo no cargó `AuthDialog.html`.

---

## Paso 5 · Un código incorrecto no revela nada

1. Escribe un código erróneo → **Desbloquear**

✅ **Esperado:** mensaje rojo **«Código incorrecto.»** — sin decir cuántos intentos quedan ni por qué.

2. Repítelo hasta **5 veces**
3. Al sexto intento, **usa el código correcto**

✅ **Esperado:** lo rechaza igualmente. El bloqueo dura 15 minutos y no distingue si aciertas.

> Si no quieres esperar el bloqueo, salta este paso y ve al 6. Pero merece la pena verlo.

---

## Paso 6 · Desbloquear

1. Espera 15 minutos si te bloqueaste, o usa otra ventana
2. **Admin → 🔓 Desbloquear…** → introduce el código correcto

✅ **Esperado:**
- Aviso emergente: *«Menú Admin desbloqueado durante 30 minutos.»*
- El menú **Admin** ahora muestra **📊 Generar Reporte Comparativo Mensual** y **🔒 Bloquear menú**

---

## Paso 7 · Las pestañas de referencia están protegidas

Aquí se comprueba que el sistema **no destruye** los cinco reportes que hiciste a mano.

1. En **`Monthly Budget`**, pon el selector de mes en uno que **ya tenga reporte**: `Apr`
2. **Admin → 📊 Generar Reporte Comparativo Mensual**
3. El diálogo mostrará `Apr` / `2025` en gris (solo lectura)
4. Deja el resto por defecto y pulsa **Generar**

✅ **Esperado:** mensaje rojo diciendo que **`Apr Budget Comparison` es una pestaña de referencia y
no se sobrescribe**.

✅ **Comprueba:** la pestaña `Apr Budget Comparison` sigue **intacta**.

❌ **Si la sobrescribió:** para y avísame. Es el fallo más grave posible aquí.

---

## Paso 8 · Generar un reporte de verdad

1. En **`Monthly Budget`**, pon el selector en un mes **sin reporte previo**: `Mar`, `Jul` o similar
2. **Admin → 📊 Generar Reporte…**
3. Verifica que el diálogo muestra **ese mes**, no el anterior
4. Rellena **Correo del cliente** con **tu propia dirección** (no la de un cliente)
5. Saludo: `Hola Ana` (o lo que quieras)
6. **Generar**

✅ **Esperado:** mensaje verde tipo
*«Analizadas N categorías. X con desviación superior al 15 %. Reporte escrito en «Mar Budget
Comparison». Borrador creado para tu@correo.com.»*

---

## Paso 9 · Revisar la pestaña generada

Abre la pestaña nueva y comprueba:

| # | Qué mirar | Esperado |
|---|---|---|
| 1 | Cabecera | `Category · Item Description · Actual · Planned · Deviation ($) · Deviation (%) · Status` |
| 2 | Orden de columnas | **Actual va antes que Planned** |
| 3 | Filas de categoría | Llevan `Over` o `Under` en Status |
| 4 | Filas de partida | Status **vacío**, y el nombre en la 2ª columna |
| 5 | Separación | Una fila en blanco entre categorías |
| 6 | `Deviation ($)` | Los positivos con **`+`** |
| 7 | `Deviation (%)` | Los positivos **sin signo**, los negativos con `-` |
| 8 | Categorías desviadas | Resaltadas: rojo si `Over`, verde si `Under` |
| 9 | **Ninguna celda** | Con `#DIV/0!`, `NaN` o `Infinity` |
| 10 | Partidas listadas | Solo bajo categorías desviadas, y **ninguna con desviación 0.00** |

**Contraste final:** compara su aspecto con `Apr Budget Comparison`. Debe ser indistinguible en
formato.

---

## Paso 10 · Revisar el borrador de Gmail

1. Abre [Gmail → Borradores](https://mail.google.com/mail/u/0/#drafts)

✅ **Esperado:** un borrador con asunto *«Resumen financiero — Mar 2025»*.

Comprueba en el texto:

- Nombra **partidas concretas**, no solo categorías
- Dice **«El motivo principal es…»** con el importe presupuestado y el real
- Usa **«Gastaste»** para gastos y **«Ingresaste»** para ingresos
- Si hay algún gasto fijo grande sin cargar, avisa del **desfase de fecha**

⚠️ **Verificación crítica:** abre **Enviados**. Debe estar **vacío** de correos de esta prueba.
El sistema no envía nunca.

---

## Paso 11 · La auditoría registró todo

1. En la hoja: **Ver → Ocultas** (o clic derecho sobre las pestañas → *Mostrar ocultas*)
2. Abre **`_Admin Audit`**

✅ **Esperado:** una fila por cada intento del Paso 5 y del Paso 6, con marca de tiempo, tu correo,
`unlock`, y `OK` o `FALLO`.

---

## Paso 12 · La sesión caduca

1. **Admin → 🔒 Bloquear menú**
2. Recarga la hoja

✅ **Esperado:** el menú vuelve a mostrar solo **🔓 Desbloquear…**

---

## Paso 13 · El despliegue masivo (bonus)

Los pasos anteriores validan la herramienta dentro de **una** hoja. Este valida que se puede
poner en **muchas** sin copiar el código en ninguna.

Ya está ejecutado: hay dos hojas desplegadas de verdad. Lo que sigue es comprobarlo.

**13.1 · Abre una hoja desplegada**

[Cliente DEMO A](https://docs.google.com/spreadsheets/d/1jalBI4O0-4pIY2qvgzQTWvUt2zmd9DlN9M2fIkzgmgk/edit)
· [Cliente DEMO B](https://docs.google.com/spreadsheets/d/1o8Mbh1JfLbVqp-hY7fwmOj1k4QrRpK_sRPoMFcQo4PE/edit)

✅ **Esperado:** aparece el menú **Admin** con **🔓 Unlock…** y **❓ Help**, igual que en la hoja
principal. Son hojas vacías: no tienen presupuesto que analizar. Lo que demuestran es que el
menú llega sin que nadie haya escrito código dentro.

**13.2 · Mira lo que hay realmente dentro**

**Extensiones → Apps Script** en esa misma hoja.

✅ **Esperado:** **dos archivos y nada más** — el manifiesto y `GrupoLynBootstrap`, unas 50
líneas que solo delegan:

```javascript
function onOpen() { grupolynBind_(); GrupoLynLib.onOpen(); }
```

Ni el motor de cálculo, ni el lector de la hoja, ni el redactor del correo. Todo eso vive una
sola vez, en la biblioteca. Publicar una versión nueva actualiza a los 50 clientes sin volver a
tocar un archivo.

**13.3 · Comprueba la idempotencia tú mismo**

```bash
node tools/deploy-run.js          # simulación, no escribe
node tools/deploy-verify.js       # relee del servidor y comprueba
```

✅ **Esperado:** `ya al dia: 2` y `TODO CORRECTO`. Volver a lanzarlo no reescribe nada, porque
el arranque lleva su propia marca de versión.

Para verlo escribir de verdad hace falta `--escribir` y ser el propietario de los archivos. El
registro de la ejecución original, con los tres fallos que sacó, está en
[07-despliegue-masivo.md](07-despliegue-masivo.md).

---

## Resumen de lo que valida cada paso

| Paso | Qué demuestra |
|---|---|
| 0–1 | La lógica funciona en ambos motores, Node y Apps Script |
| 2 | El código se guarda como huella, nunca en claro |
| 3, 12 | El menú refleja el estado de la sesión |
| 4 | La contraseña no se ve al escribirla |
| 5 | No hay fuga de información ni fuerza bruta viable |
| 7 | **El trabajo del cliente no se destruye** |
| 8–9 | El reporte reproduce el formato de referencia |
| 10 | El correo explica, y **nunca se envía solo** |
| 11 | Hay rastro auditable |
| 13 | **El despliegue llega a muchas hojas sin copiar el código en ninguna** |

---

## Si algo falla

Dime **el número del paso** y qué viste. Con eso localizo el problema sin necesidad de más contexto.

Los pasos **4, 7, 9, 10 y 13.1** son los que ningún test automático puede cubrir: dependen de mirar la
pantalla. Son, por eso mismo, los que más importan de esta guía.
