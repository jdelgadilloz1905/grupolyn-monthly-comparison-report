# Actualización de la entrega — Tarea 3 completada

Nota para el evaluador. Resume qué se añadió después de la entrega inicial y cómo comprobarlo.

---

## Qué se añadió

**La tercera tarea, el despliegue masivo, está ejecutada.**

En la entrega inicial estaba construida y con sus pruebas, pero no ejecutada. Completarla me
pareció parte del trabajo, así que la puse en marcha de verdad: publiqué la biblioteca compartida
y la desplegué sobre dos hojas de cliente creadas para la prueba.

Las tres tareas del enunciado están ahora funcionando y se pueden abrir y comprobar.

---

## Cómo verlo en dos minutos

**1 · Abre una de las hojas desplegadas**

- [Cliente DEMO A](https://docs.google.com/spreadsheets/d/1jalBI4O0-4pIY2qvgzQTWvUt2zmd9DlN9M2fIkzgmgk/edit)
- [Cliente DEMO B](https://docs.google.com/spreadsheets/d/1o8Mbh1JfLbVqp-hY7fwmOj1k4QrRpK_sRPoMFcQo4PE/edit)

Verás el menú **Admin** arriba, funcionando igual que en la hoja principal.

**2 · Mira lo que hay dentro**

En esa misma hoja: **Extensiones → Apps Script**.

Dentro no hay más que el manifiesto y unas 50 líneas que delegan en la biblioteca compartida. Ni
una línea de lógica de negocio. Esa es la idea completa del despliegue: el código vive **una sola
vez**, y publicar una versión nueva de la biblioteca actualiza a los 50 clientes sin volver a
abrir un solo archivo.

Son hojas vacías a propósito, sin presupuesto que analizar. Lo que demuestran es que el menú llegó
hasta ahí sin que nadie escribiera código dentro.

**3 · Compruébalo tú mismo, si quieres**

Desde el repositorio:

```bash
node tools/deploy-run.js        # simulación: informa y no escribe nada
node tools/deploy-verify.js     # relee del servidor y comprueba lo desplegado
```

El despliegue es **idempotente**: volver a lanzarlo informa de que todo está al día y no reescribe
nada. Y no escribe salvo que se le pida explícitamente — la simulación es el valor por defecto.

---

## Lo que aportó ejecutarlo

Ponerlo en marcha de verdad permitió afinar tres puntos que solo se manifiestan en tiempo de
ejecución, dentro de la hoja del cliente, y que ninguna revisión de código habría mostrado:

| | |
|---|---|
| **Las funciones del menú** | El arranque generado ahora expone todas las opciones que el menú invoca, incluida la ayuda |
| **Los permisos** | Apps Script los deduce leyendo el código, y a través de una biblioteca no hay nada que deducir. Ahora el manifiesto de cada cliente los declara de forma explícita |
| **El aislamiento entre clientes** | Cada hoja conserva su propia contraseña y su propio contador de intentos. Sin esto, una biblioteca compartida usaría los suyos y todos los clientes quedarían enlazados entre sí |

Los tres quedaron cubiertos con pruebas que los reproducen, verificadas revirtiendo cada
corrección para confirmar que efectivamente fallan. **El total pasó de 164 a 201 comprobaciones.**

El registro completo de la ejecución, con las salidas reales, está en
[07-despliegue-masivo.md](https://github.com/jdelgadilloz1905/grupolyn-monthly-comparison-report/blob/main/docs/07-despliegue-masivo.md).

---

## Lo demás, también al día

| | |
|---|---|
| **Código fuente** | Actualizado en OneDrive y en el [repositorio de GitHub](https://github.com/jdelgadilloz1905/grupolyn-monthly-comparison-report) |
| **«Enfoque y supuestos»** | El documento principal de la entrega, revisado para recoger esta última parte |
| **Guía de validación** | Incluye ahora el recorrido de comprobación del despliegue |
| **La hoja principal** | Su código sincronizado con el repositorio, para que ambos coincidan exactamente |

Nada de esto cambia el funcionamiento de lo que ya se había entregado: el menú, el reporte y el
borrador de correo se comportan igual.

---

Quedo atento a cualquier duda.
