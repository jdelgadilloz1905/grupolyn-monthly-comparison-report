# Casos de uso — Reporte Comparativo Mensual

Documentación funcional de la prueba técnica de GrupoLyN.
Rol: *AI and Automation Specialist*. Plataforma: Google Sheets + Apps Script.

---

## Actores

| Actor | Descripción | Permisos en la hoja |
|---|---|---|
| **Consultor** (admin) | Personal de GrupoLyN. Genera y revisa los reportes | Editor + conoce el código de administrador |
| **Cliente** | Persona cuyas finanzas se planifican. Recibe el correo | Editor de su propia copia, **sin** el código |
| **Operador de despliegue** | Quien actualiza el parque de hojas de clientes | Editor en todas las copias |
| *Sistema* | Los disparadores de Apps Script (`onOpen`) | — |

> **Nota de diseño:** el Cliente también es editor de su hoja. Por eso el código de administrador
> **no puede** vivir en el código fuente: el cliente puede abrir el editor de Apps Script y leerlo.
> Ver `04-seguridad.md`.

---

## CU-01 · Desbloquear el menú Admin

**Actor:** Consultor
**Precondición:** La hoja está abierta y el menú `Admin` se ha construido.
**Postcondición:** Sesión de administrador activa durante 30 minutos.

### Flujo principal

1. El Consultor abre la hoja. El sistema ejecuta `onOpen()` y dibuja el menú `Admin`
   con una única opción: **🔓 Desbloquear**.
2. El Consultor pulsa Desbloquear.
3. El sistema muestra un diálogo HTML con un campo de contraseña **enmascarado**.
4. El Consultor introduce el código y confirma.
5. El sistema calcula `SHA-256(código + salt)` y lo compara con el hash de `ScriptProperties`.
6. Coinciden: el sistema abre sesión en `CacheService` (TTL 1800 s), registra el acceso
   en la hoja de auditoría y **reconstruye el menú** con las opciones de administrador.
7. El sistema informa: «Menú Admin desbloqueado durante 30 minutos».

### Flujos alternativos

| Id | Condición | Comportamiento |
|---|---|---|
| A1 | Código incorrecto | Incrementa el contador de fallos, registra el intento y muestra un error **genérico** (no revela si el usuario existe ni cuánto falta) |
| A2 | 5 fallos acumulados | Bloqueo de 15 minutos. Todo intento se rechaza sin evaluar el código |
| A3 | El usuario no está en la lista blanca | Se rechaza aunque el código sea correcto. Se registra como intento no autorizado |
| A4 | No hay hash configurado | El sistema pide ejecutar la función de instalación una sola vez. **No** aplica un código por defecto |
| A5 | Sesión caducada | Al invocar cualquier opción de admin, se comprueba de nuevo. Si expiró, se pide desbloquear |

### Reglas

- **R1.** El código nunca se almacena ni se transmite en claro.
- **R2.** Toda opción de administrador revalida la sesión al ejecutarse, no solo al dibujar el menú.
- **R3.** Cada intento, exitoso o no, deja rastro en auditoría con usuario, marca de tiempo y resultado.

---

## CU-02 · Generar el Reporte Comparativo Mensual

**Actor:** Consultor
**Precondición:** Sesión de administrador activa. La pestaña `Monthly Budget` existe y tiene datos.
**Postcondición:** Existe una pestaña de reporte y, opcionalmente, un borrador en Gmail.

### Flujo principal

1. El Consultor elige `Admin → Generar Reporte Comparativo Mensual`.
2. El sistema revalida la sesión (R2).
3. El sistema muestra un diálogo con: **mes** (por defecto, el del selector de la hoja),
   **umbral de desviación** (por defecto 15 %) y **destino** (pestaña / borrador / ambos).
4. El Consultor confirma.
5. El sistema lee `Monthly Budget` en **una sola** llamada `getValues()`.
6. El sistema reconstruye la jerarquía: sección → categoría → partidas, ignorando las
   filas marcadas `Hide`.
7. El sistema calcula, por categoría, la desviación en importe y en porcentaje.
8. Para cada categoría que supera el umbral, ordena sus partidas por **impacto absoluto
   en importe** y selecciona las que explican la desviación.
9. El sistema escribe la pestaña de reporte con el formato de referencia
   (`Category | Item Description | Actual | Planned | Deviation ($) | Deviation (%) | Status`).
10. El sistema crea un **borrador** en Gmail con la narrativa en lenguaje llano.
11. El sistema muestra un resumen: categorías analizadas, desviaciones encontradas, dónde quedó todo.

### Flujos alternativos

| Id | Condición | Comportamiento |
|---|---|---|
| B1 | No existe `Monthly Budget` | Error claro indicando la pestaña que falta. No se crea nada |
| B2 | El mes elegido no tiene datos reales | Se genera el reporte indicando «sin actividad registrada», en vez de un informe de ceros |
| B3 | Ninguna categoría supera el umbral | Se genera igualmente, con el mensaje «todas las categorías dentro de lo previsto» |
| B4 | Ya existe la pestaña de ese mes, y es **una de las cinco de referencia** | Se **rechaza** con un mensaje que explica cómo proceder desde la interfaz. No hay forma de forzarlo desde el diálogo: es deliberado |
| B4b | Ya existe la pestaña, pero **no** es de referencia | Se regenera sin preguntar. Volver a generar tu propio reporte es una operación normal y segura; pedir confirmación cada vez solo entrena al usuario a aceptar sin leer |
| B5 | No hay correo de cliente configurado | Se crea la pestaña y se avisa de que se omitió el borrador |
| B6 | Falla la cuota de Gmail | La pestaña se conserva. El error se reporta sin perder el trabajo hecho |

### Reglas de cálculo

- **R4.** `Desviación % = (Actual − Planned) / |Planned| × 100`.
- **R5.** Si `Planned = 0` y `Actual ≠ 0` → la desviación se expresa como **100 %**
  (convención tomada de los ejemplos existentes en el libro). No se divide por cero.
- **R6.** Si `Planned = 0` y `Actual = 0` → la partida se omite.
- **R7.** Los importes negativos son **reembolsos** y son válidos. No se tratan como error.
- **R8.** En **gastos**, `Actual > Planned` es desfavorable. En **ingresos** es favorable.
  El signo se calcula igual, pero el texto explicativo debe invertir la interpretación.
- **R9.** El umbral se aplica a la desviación **porcentual**, pero el orden de las partidas
  se hace por **importe absoluto**: un 300 % sobre $10 importa menos que un 20 % sobre $3.000.

---

## CU-03 · Enviar el reporte al cliente

**Actor:** Consultor
**Precondición:** Existe el borrador en Gmail.

1. El Consultor abre Gmail y localiza el borrador.
2. Revisa el contenido y ajusta el tono si procede.
3. Envía.

> **R10. El sistema nunca envía correo por su cuenta.** Solo crea borradores. La decisión de
> comunicarse con un cliente es humana. Esto es deliberado y se explica en el resumen ejecutivo.

---

## CU-04 · Desplegar la funcionalidad en las hojas de clientes *(bonus)*

**Actor:** Operador de despliegue
**Precondición:** Lista de URLs de hojas de cliente y acceso a la Master Script Library.

### Flujo principal

1. El Operador prepara la lista de URLs.
2. Ejecuta el script de despliegue **en modo `dryRun` (por defecto)**.
3. El sistema recorre cada archivo, comprueba a qué versión está y **reporta qué haría**,
   sin escribir nada.
4. El Operador revisa el informe y relanza con `dryRun = false`.
5. Por cada hoja, el sistema vincula la biblioteca compartida e inyecta el código de arranque.
6. El sistema emite un informe final: actualizadas, ya al día, fallidas y por qué.

### Flujos alternativos

| Id | Condición | Comportamiento |
|---|---|---|
| D1 | Sin permiso sobre un archivo | Se registra y **se continúa con los demás** |
| D2 | La hoja ya está en la versión objetivo | Se omite. La operación es idempotente |
| D3 | URL inválida | Se registra y continúa |
| D4 | Falla a mitad del lote | Los ya procesados permanecen. Reejecutar retoma sin duplicar |

### Reglas

- **R11.** `dryRun = true` por defecto. Escribir requiere un acto explícito.
- **R12.** Idempotencia: ejecutarlo dos veces deja el mismo estado que ejecutarlo una.
- **R13.** Aislamiento de errores: un archivo que falla no aborta el lote.
- **R14.** Todo despliegue deja registro de qué archivo, qué versión y qué resultado.

---

## Matriz de trazabilidad

| Requisito del enunciado | Caso de uso |
|---|---|
| Menú «Admin» con protección por contraseña | CU-01 |
| Reporte comparativo mensual | CU-02 |
| Totales reales vs planificados por categoría | CU-02 · pasos 6–7 |
| Explicación entre categorías con desviación significativa | CU-02 · paso 8 |
| Resaltar los conceptos responsables | CU-02 · paso 8, R9 |
| Salida en pestaña o borrador de Gmail | CU-02 · pasos 9–10 |
| Script de despliegue masivo (bonus) | CU-04 |
