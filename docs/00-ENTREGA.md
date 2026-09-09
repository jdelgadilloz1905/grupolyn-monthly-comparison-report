# Reporte Comparativo Mensual — Entrega

**Prueba técnica · GrupoLyN · AI and Automation Specialist**
Plataforma: Google Sheets + Apps Script

---

## Qué contiene esta entrega

| | |
|---|---|
| **La hoja** | `GrupoLyN — Plan Financiero (JD)`, con el menú `Admin` funcionando y una pestaña `Mar Budget Comparison` generada por la herramienta |
| **El código** | 15 archivos de Apps Script, más 153 comprobaciones automáticas |
| **Este documento** | El enfoque, las decisiones y los supuestos |

---

## El problema, en términos de negocio

Cada mes alguien de vuestro equipo abre la hoja de cada cliente, compara lo planificado
con lo real, busca qué categoría se desvió, investiga **qué gasto concreto** la causó, y
escribe un correo explicándolo.

Entre 30 y 45 minutos por cliente. Con 50 clientes, **una semana de trabajo al mes**, todos
los meses. Y cuando algo se hace 50 veces seguidas, se escapan cosas.

Eso es lo que he automatizado. El consultor pulsa una opción de menú y obtiene el análisis
hecho y el correo redactado. **Lo que no he automatizado es el envío**, y esa decisión la
explico más abajo porque es deliberada.

---

## Cómo se usa

1. En `Monthly Budget`, seleccionar el **mes** a analizar.
2. **Admin → 🔓 Unlock…** e introducir el código de administrador.
3. **Admin → 📊 Generate Monthly Comparison Report**.
4. Elegir el umbral, el destino y el correo del cliente.
5. Revisar el borrador en Gmail y enviarlo.

Hay una opción **❓ Help** en el propio menú, disponible incluso sin desbloquear, que
explica todo esto dentro de la hoja. Quien herede este archivo no necesita este documento
para entender qué hace.

---

## La decisión más importante que tomé

Cuando una categoría se desvía, hay que decidir **qué partidas se le enseñan al cliente**.
Parece un detalle de implementación y es lo que separa un informe útil de una lista de
números.

Dos gastos:

- **Café** — $10 presupuestados, $40 gastados. Un **+300 %**.
- **Vivienda** — $3.000 presupuestados, $3.600 gastados. Un **+20 %**.

Si el sistema ordenara por porcentaje, le diría al cliente que su problema es el café. Y no:
el café son $30, la vivienda son $600.

**El sistema ordena por impacto en dólares, no por porcentaje.** Al cliente le importa dónde
se fue el dinero, no qué partida tiene el número más llamativo.

---

## El correo explica, no enumera

Un informe que dice «Personal Care: +60 %» obliga al cliente a investigar por su cuenta. El
que genera el sistema dice:

> You spent $600.00 more than planned on Personal Care (60% over budget). The main driver is
> Gym: $200.00 was budgeted and the actual came in at $700.00, **which alone accounts for 83%
> of the gap**. Also above plan: Dry Cleaners ($300.00 vs $150.00).

Tres cosas que hace y que un informe automático corriente no hace:

**Cuantifica cuánto pesa cada causa.** Ese «83 %» no es adorno: le dice al cliente que
resolviendo una sola cosa, resuelve el problema.

**Distingue ingresos de gastos.** Gastar de menos es bueno; ingresar de menos es malo. La
aritmética es idéntica —la resta es la misma— pero el texto no puede tratarlas igual. El
sistema usa *over budget* para gastos y *below plan* para ingresos.

**Desconfía de los ahorros que no son ahorros.** Si un gasto fijo grande no registró ningún
cargo —una hipoteca, un alquiler—, el sistema **no lo celebra**: avisa de que probablemente
es un desfase de fecha y que ese cargo volverá. Un cliente que ve «has ahorrado $3.500» y
se lo gasta tiene un problema el mes siguiente.

---

## Por qué el sistema no envía correos

Crea borradores. Nunca envía.

No es una limitación técnica, es una decisión: **automatizar el análisis es seguro,
automatizar la comunicación con un cliente no lo es.** Un dato mal interpretado, un mes
atípico, una circunstancia personal que el sistema no conoce — y el correo ya salió.

Sobre esto conviene ser exacto, porque es fácil prometer de más. El sistema pide el permiso
`gmail.compose`, que es **el más restringido de los que permiten crear borradores**. Pero Google
lo describe como *«administrar borradores y enviar correo electrónico»*: **técnicamente sí
permitiría enviar**. No existe un permiso de Gmail que deje crear borradores y prohíba enviarlos.

Así que la garantía no viene del permiso, viene del código: **no contiene ninguna llamada de
envío**, solo `createDraft()`. Y hay una prueba automática que **falla si alguien añade una**.

Lo aclaro porque en una primera redacción afirmaba que el permiso hacía imposible el envío. Al
verificarlo contra la pantalla de permisos de Google resultó no ser cierto, y prefiero corregirlo
antes que dejar una garantía que no se sostiene.

---

## Sobre la contraseña del menú: lo que protege y lo que no

Prefiero ser directo, porque es fácil vender esto como más de lo que es.

**El código de administrador es una barrera de conveniencia, no un control de seguridad.**
En una hoja de cálculo, cualquiera con permiso de edición puede abrir el editor de código y
leerlo todo. No existe ningún secreto que se pueda esconder ahí.

Lo que sí aporta, y no es poco:

- Evita que alguien genere o modifique algo **por accidente**.
- La contraseña **no se guarda**: se guarda una huella irreversible. Si ese código se
  reutiliza en otro sitio, aquí no queda expuesto.
- Se bloquea solo tras 5 intentos fallidos, y la sesión caduca a los 30 minutos.
- **Queda registro** de cada intento —quién, cuándo, si acertó— en una pestaña oculta.
- El mensaje de error es siempre el mismo, sin decir cuántos intentos quedan ni si el
  problema fue el código o el usuario. No sirve como oráculo.

Si en algún momento necesitáis protección real —no disuasión—, el camino es mover estas
operaciones a un servicio que se ejecute con vuestros permisos y no con los del cliente. Es
más trabajo, no entraba en el alcance de esta prueba, y conviene que sepáis que existe.

---

## Supuestos que tomé

Donde el enunciado dejaba margen, decidí y lo dejo por escrito.

| Supuesto | Por qué |
|---|---|
| Umbral por defecto **15 %** | El enunciado decía «15–20 %». Es configurable en cada ejecución |
| Pestañas llamadas `{Mes} Budget Comparison` | Es la convención que **ya usáis** en las cinco que tenéis hechas. No inventé otra |
| **Las cinco pestañas existentes no se sobrescriben** | Son la especificación del formato. El sistema se niega y explica cómo proceder |
| El periodo lo manda la hoja, no el diálogo | Si no coincidieran, el reporte llevaría datos de un mes etiquetados como otro |
| Desviaciones por debajo de **$50** no se comentan en el correo | Un +300 % sobre $10 es ruido, no información |
| Si lo planificado es 0 y hay gasto, la desviación es **100 %** | Es la convención que aparece en **vuestros propios reportes**. Nunca se divide por cero |
| Una partida que cuadra exactamente no se lista | No explica nada. Vuestros reportes tampoco las listan |
| Una categoría sin ningún movimiento se omite | Saldría como `$0.00 / $0.00` y solo añade ruido |
| **Todo lo que ve el cliente va en inglés** | La hoja, las categorías y los cinco reportes de referencia están en inglés. Mezclar idiomas quedaría incoherente |

Una limitación heredada que conviene conocer: **vuestra convención de nombres no incluye el
año**, así que un reporte de enero de 2026 chocaría con el de enero de 2025. Respeté vuestra
convención en lugar de cambiarla por mi cuenta; la protección es que el sistema no
sobrescribe sin que se le renombre antes la pestaña.

---

## Cómo sé que funciona

Escribí **153 comprobaciones automáticas** que se ejecutan en segundos. No prueban que el
código «parece bien»: prueban casos concretos que encontré revisando vuestros datos reales.

Los que más me preocupaban:

- Partidas **sin presupuestar** pero con gasto — dividir por cero rompería el cálculo.
- **Devoluciones**, que aparecen como importes negativos y producen porcentajes extraños.
- Desviaciones de **cuatro y cinco cifras porcentuales**, correctas e inútiles sin contexto.
- Que insertar una fila o una columna **no rompa nada** — porque va a pasar.

Ese último merece una nota. El sistema **no busca los datos por posición** («la celda E115»),
sino por contenido («la fila que dice *Total Shelter*»). Un sistema que dependa de posiciones
se rompe la primera vez que alguien añade una categoría, y falla **en silencio**, que es peor
que fallar ruidosamente. Hay pruebas que insertan filas y columnas a propósito para
verificarlo.

Además, el sistema se ejecutó de verdad sobre vuestra hoja: la pestaña `Mar Budget
Comparison` que acompaña esta entrega la generó la herramienta, y verifiqué su contenido
celda a celda —columnas, signos, ausencia de errores de cálculo— contra el formato de
vuestros reportes de referencia.

---

## El bonus: despliegue a muchas copias

**El código está construido y probado; lo que falta es infraestructura vuestra para
ejecutarlo.** Conviene separar las dos cosas, porque no son lo mismo.

Lo que hay escrito vincula la biblioteca compartida sin duplicarla, es idempotente —ejecutarlo
dos veces deja el mismo estado—, no aborta el lote si un archivo falla, y **no escribe nada
salvo que se le pida explícitamente**: el modo de simulación es el valor por defecto. Su lógica
está cubierta por pruebas.

Lo que no pude hacer es **ejecutarlo de verdad**, y por dos razones distintas.

El enunciado plantea pasar una lista de **URLs de hojas** y que el script las vincule a la
biblioteca compartida. Al implementarlo encontré un límite del propio Google: **de la URL de
una hoja no se puede obtener el identificador de su script**. Los scripts vinculados a un
documento no aparecen en Drive ni los expone ninguna API pública.

Y hay un agravante que vi en vuestra propia plantilla: **una hoja puede tener más de un
script vinculado**. La copia con la que trabajé tiene dos, el mío y uno que venía con la
plantilla. Aunque se pudiera resolver «hoja → script», la respuesta no sería única, y
equivocarse significaría sobrescribir código del proveedor.

Tres caminos, de mejor a peor:

1. **Que las copias nuevas salgan de una plantilla que ya tenga la biblioteca vinculada.**
   Entonces no hay nada que inyectar.
2. **Publicar la funcionalidad como complemento (Add-on) del Workspace.** Se instala una vez
   y la tienen todas las copias, sin tocar ningún archivo. Es la respuesta correcta a escala.
3. **Mantener un mapa `cliente → script`,** rellenado una vez por cliente. Es lo único viable
   sobre las copias que ya existen, y es lo que implementa el código entregado.

Para ejecutarlo hacen falta dos cosas que solo vosotros podéis dar: el identificador de la
Master Script Library y un proyecto de Google Cloud con la API de Apps Script habilitada.

---

## Para probarlo tú mismo

**Ábrela directamente en Google Sheets, en línea.** La herramienta vive dentro del documento,
no en el archivo que se descarga: bajarla como Excel deja los datos y las fórmulas, pero ni el
menú ni el reporte. Y si prefieres trabajar sobre una copia, ten en cuenta que la
configuración de acceso no se duplica —Google no copia las propiedades del script—, así que en
la copia habría que volver a instalar el código de administrador.

Hecha esa aclaración, tres cosas que conviene saber antes de abrir la hoja, o parecerá que no
funciona:

**1 · El código de administrador.** Va aparte de este documento. Sin él el menú no se
desbloquea y no se puede generar nada.

**2 · Google te avisará de que «no ha verificado esta aplicación».** Es lo normal en
cualquier Apps Script sin publicar en el Marketplace, no una señal de alarma. El camino es
*Configuración avanzada → Ir a GrupoLyN Report Engine → Permitir*. Lo aviso porque, sin
contexto, esa pantalla parece que algo va mal.

**3 · El borrador aparece en TU Gmail**, no en el mío. Apps Script se ejecuta con la cuenta
de quien pulsa la opción, así que el correo se redacta desde la tuya. Para probar sin enviar
nada a nadie, pon tu propia dirección en el campo de cliente.

Y una recomendación: **genera primero un mes que no tenga reporte hecho a mano** —marzo o
julio—. Si eliges uno de los cinco que ya tenéis, el sistema se negará a sobrescribirlo, que
es el comportamiento correcto pero no el que quieres para una primera prueba.

---

## Lo que no está terminado

- **La ejecución real del despliegue masivo**, por lo anterior. El código está; falta el
  entorno donde correrlo.
- **No he ejecutado nada sobre hojas de clientes reales**, solo sobre mi copia.
- El correo de prueba se generó contra mi propia dirección, no contra la de ningún cliente.

---

## Cómo traté los datos de la plantilla

**No hay ni una cifra de la plantilla en el código que entrego.** Los datos de prueba son
inventados y reproducen únicamente la *forma* de cada caso: una partida sin presupuestar,
una devolución, un gasto fijo sin cargar. Si el código acaba en un repositorio público, no
lleva nada del archivo original.

Fue una decisión consciente desde el principio, y tuvo un coste: varias pruebas que al
principio verificaban la fidelidad numérica contra vuestros reportes tuvieron que
reescribirse. Esa verificación no desapareció, se movió a donde le corresponde —comprobar
contra la hoja real en ejecución— en lugar de vivir como cifras guardadas en un repositorio.

### Una observación que dejo como aportación

La plantilla compartida contiene lo que tiene forma de detalle financiero personal: nombres
propios en partidas de regalos, pensión alimenticia, importes concretos. **Doy por hecho que
son datos de demostración**; desde fuera no tengo manera de distinguirlo.

Lo menciono porque, si en algún caso fueran reales, compartir el archivo con candidatos
externos sería una exposición evitable. Un juego de datos sintético que conserve la forma
—las mismas categorías, los mismos casos límite, los mismos importes cero y negativos—
permite evaluar exactamente lo mismo sin ese riesgo. De hecho, es lo que construí para las
pruebas de este proyecto, así que sé que la sustitución es viable.

Lo planteo como aportación y no como reproche: si el puesto implica manejar hojas de
clientes a diario, esta es justo la clase de decisión que conviene tener tomada de
antemano. Y aplicada al producto: si vais a escalar esto a decenas de copias, merece la
pena definir pronto quién puede ver qué.
