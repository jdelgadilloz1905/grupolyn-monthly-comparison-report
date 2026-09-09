# El despliegue masivo, ejecutado

Registro de la ejecución real del bonus (T-11). No es un plan: es lo que pasó, con los
identificadores y las salidas tal cual.

**Fecha:** 8 de septiembre de 2026
**Resultado:** biblioteca publicada, dos hojas de cliente desplegadas, idempotencia comprobada
sobre archivos reales, y **tres fallos encontrados que ninguna lectura del código habría
detectado**.

---

## Qué se montó

| Pieza | Para qué | Identificador |
|---|---|---|
| **Master Script Library** | Proyecto standalone con todo el código. Los clientes lo invocan, no lo copian | `1shu0EmR7Ap5ng9qD658tXppMoCmi0MldtgPYLiQox64O1E9fW6GT2ZKb` (v1) |
| **Cliente DEMO A** | Hoja de prueba, script vinculado creado para el despliegue | script `1sK0ib1evqLL3znyNQgHuh3gySdF44phSN4_9zgrB4ND55GMkkjyxLTcr` |
| **Cliente DEMO B** | Igual que A, para probar el lote | script `1LZrOEAgxnXRgffyauag12OcFe7w63av5AvOcvJAgZ_pb_LlkUoPO8WLA` |

Son **hojas creadas para esto**, no copias de ningún archivo real. Nada del despliegue tocó la
hoja entregada ni ningún archivo del cliente.

### Por qué las hojas son nuevas y no copias

Es la limitación de Google, vista desde dentro: **Drive no lista los scripts vinculados a un
documento**. La consulta devuelve cero.

```
proyectos de Apps Script visibles: 0
```

Es decir, de una hoja que ya existe no se puede averiguar el identificador de su script. La
única forma de tener un destino direccionable es que el script lo cree quien despliega, que es
lo que se hizo aquí. Para un parque de copias que ya existe, la respuesta es el mapa explícito
`cliente → script` que implementa `Deployer.js`, o publicar la herramienta como complemento del
Workspace y no inyectar nada.

---

## Antes de tocar nada

La hoja de trabajo lleva **dos** scripts vinculados: el nuestro y un `Prospr Script` que venía
con la plantilla. El segundo no tenía copia en ningún sitio, y por lo anterior su identificador
tampoco es alcanzable.

Se resolvió por el otro lado: **copiar la hoja entera**. Google duplica los scripts vinculados
junto con el documento, así que la copia conserva los dos.

> `RESPALDO 2026-09-08 — Plan Financiero + scripts vinculados (NO TOCAR)`
> Guardada en Mi unidad, fuera de la carpeta de entrega para no ensuciarla.

---

## Los tres fallos que salieron al ejecutarlo

Los tres se manifiestan **en tiempo de ejecución, dentro de la hoja del cliente**. Ninguno da
error al escribir el código, y ninguna prueba de escritorio los habría visto.

### 1 · El menú llamaba a una función que no existía

`Menu.js` ofrece **❓ Help**, y el menú invoca las funciones **por nombre**. El arranque
generado definía seis funciones y `showHelpDialog` no estaba entre ellas: la opción se dibujaba
y al pulsarla daba «no se encontró la función».

El mismo problema afecta a los diálogos. Cuando la biblioteca abre una ventana modal,
`google.script.run` resuelve contra el **script del cliente**, nunca contra la biblioteca. Todo
lo que un diálogo llame tiene que estar en el arranque.

### 2 · El manifiesto salía sin permisos

Apps Script deduce los permisos leyendo el código. El arranque solo contiene llamadas
`GrupoLynLib.…`: **a través de una biblioteca no hay nada que deducir**. El resultado era un
cliente con el menú dibujado y todo lo demás fallando en cuanto tocara la hoja o Gmail.

Ahora `mergeManifest` los declara explícitamente, **añadiéndolos** a los que el cliente ya
tuviera —una hoja puede llevar otro script encima con necesidades propias.

### 3 · Los 50 clientes habrían compartido un solo código de administrador

El más serio de los tres.

Una biblioteca que llama a `PropertiesService.getScriptProperties()` lee **las propiedades de la
biblioteca**, no las de la hoja que la invoca. El código de administrador, la lista blanca y el
contador de intentos fallidos son propiedades del script.

Consecuencia: un único código para todos, y —peor— un único contador de intentos. **Un usuario
se equivoca cinco veces y deja bloqueados a los otros 49.**

La corrección es que cada hoja le entregue sus propios almacenes a la biblioteca al invocarla.
El arranque generado lo hace en cada punto de entrada:

```javascript
function grupolynBind_() {
  GrupoLynLib.bindHost(
    PropertiesService.getScriptProperties(),
    CacheService.getUserCache()
  );
}

function onOpen() { grupolynBind_(); GrupoLynLib.onOpen(); }
```

En la instalación clásica —el código vive dentro de la hoja— nadie llama a `bindHost` y se usan
los almacenes de siempre. La corrección no cambia el comportamiento de lo entregado.

### Que las pruebas realmente muerden

Se comprobó revirtiendo las tres correcciones a la vez y volviendo a pasar la suite:

```
--- con 3 mutaciones introducidas ---
HAY FALLOS — 195/199 asserts correctos
--- restaurando ---
  201/201 asserts correctos
```

Una prueba que no falla cuando el fallo vuelve no está probando nada.

---

## La ejecución

### Simulación

El modo por defecto. Informa de lo que haría y no escribe.

```
=== DESPLIEGUE (simulacion) ===
dryRun:     true
actualizados: 2
   Cliente DEMO A: sin instalar -> 1.1.0  [cambia: appsscript, GrupoLynBootstrap]
   Cliente DEMO B: sin instalar -> 1.1.0  [cambia: appsscript, GrupoLynBootstrap]
fallidos:   0
```

Releyendo los destinos **desde el servidor**, seguían vírgenes:

```
Cliente DEMO A
  archivos:  appsscript
  librerias: []
  permisos:  0 declarados
  arranque:  NO EXISTE
```

### El cortafuegos

Antes de escribir se probó que la salvaguarda funciona. Se puso a propósito el identificador del
script de la hoja ya entregada en la lista de destinos, y se lanzó **con `--escribir`**:

```
ABORTADO: el destino "Cliente DEMO B" apunta a GrupoLyN Report Engine — el script de la hoja ya entregada
codigo de salida: 1
```

Abortó antes de la primera llamada de red.

### Despliegue real

```
=== DESPLIEGUE **REAL** ===
dryRun:     false
actualizados: 2
   Cliente DEMO A: sin instalar -> 1.1.0
   Cliente DEMO B: sin instalar -> 1.1.0
fallidos:   0
```

### Idempotencia, sobre archivos reales

Segunda pasada, misma orden de escritura:

```
actualizados: 0
ya al dia:  2
   Cliente DEMO A: ya en 1.1.0
   Cliente DEMO B: ya en 1.1.0
```

Ninguna escritura. La marca de versión que el propio arranque lleva dentro es lo que lo decide.

---

## Verificación

Releyendo el contenido **desde el servidor**, no desde lo que el script creía haber enviado:

```
Cliente DEMO A
  OK     el arranque existe en el servidor
  OK     y coincide byte a byte con buildBootstrap()
  OK     una sola dependencia, sin duplicar
  OK     apunta a la biblioteca correcta
  OK     declara los 4 permisos
  OK     no se colo codigo de mas: solo manifiesto y arranque
Cliente DEMO B
  (idéntico)

Biblioteca (v1)
  OK     expone bindHost() como funcion de nivel superior
  OK     expone onOpen() … showReportDialog() … installAdminCode()

TODO CORRECTO
```

La última comprobación importa por un detalle de Apps Script: **una biblioteca expone sus
funciones de nivel superior, no sus objetos**. `const Auth = {…}` no forma parte del contrato
público, así que todo lo que el arranque invoca está declarado como función suelta en `Menu.js`.

Cada hoja desplegada contiene exactamente **dos archivos**: el manifiesto y 50 líneas de
arranque que solo delegan. Ni una línea de lógica. Publicar una versión nueva de la biblioteca
actualiza a los 50 clientes sin volver a tocar un solo archivo.

---

## Lo que sigue siendo manual

**El código de administrador hay que instalarlo una vez por hoja.** Google no copia las
propiedades del script al duplicar un documento, y no hay API para escribirlas desde fuera. El
arranque desplegado incluye `setupAdmin()`; alguien tiene que abrirlo y ejecutarlo una vez en
cada cliente.

No es un descuido: es el límite real. Y es un argumento más a favor del complemento de
Workspace, donde la configuración vive en el complemento y no en cada copia.

---

## Un supuesto que resultó falso

Escribí en el código que el despliegue necesitaba «un proyecto de Google Cloud con la API de
Apps Script habilitada». Antes de darlo por bueno lo comprobé, y **no es cierto**: la API
responde con las credenciales normales de `clasp`.

```
=== GET /projects/{id}/content  (solo lectura) ===
  HTTP 200
  archivos leidos: 15
```

Lo que sí hace falta es que la biblioteca esté **compartida** con las cuentas que la invocan.
