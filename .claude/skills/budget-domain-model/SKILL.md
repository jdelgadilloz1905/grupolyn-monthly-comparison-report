---
name: budget-domain-model
description: Modelo de datos real de la hoja de GrupoLyN — jerarquía de Monthly Budget, columnas, formato del reporte de referencia y los casos límite observados en los datos. Úsala al leer la hoja, calcular desviaciones o dar formato a la salida.
---

# Modelo de dominio — Plantilla financiera de GrupoLyN

Todo lo de aquí está **observado en la hoja real**, no supuesto.

## Jerarquía de `Monthly Budget`

Tres niveles, identificados por la columna en que aparece la etiqueta:

```
Income                                    <- Sección
  Person 1                                <- Categoría
    1. Salary 1 - After Tax               <- Partida
    1. Commissions
  Total Person 1                          <- Total de categoría
  Other Income
    Family Assistance
  Total Other Income
Total Income                              <- Total de sección

Expenses & Debt Service                   <- Sección
  Shelter
    Mortgage
    Landscaping
    ...
  Total Shelter
  Food & Supplies
  ...
```

**Las filas `Total <Categoría>` son el ancla.** Son las que llevan los importes que compara el
reporte. Localízalas por el prefijo `Total `, nunca por número de fila.

### Categorías observadas

`Person 1`, `Person 2`, `Other Income` (ingresos) · `Shelter`, `Food & Supplies`, `Medical`,
`Education`, `Personal Care`, `Clothing`, `Transportation`, `Entertainment/Vacation`, `Holiday`,
`Other Expenses`, `Debt Repayment` (gastos).

> La lista **no está cerrada**: cada cliente puede añadir categorías. El lector debe descubrirlas,
> no llevarlas escritas.

## Columnas

Tras la cabecera (fila ~50) el orden observado es:

| Columna | Contenido |
|---|---|
| `Budget` | **Lo planificado.** El enunciado lo llama *Planned* |
| `Budget % of Total Income` | Porcentaje sobre ingresos |
| `Actual` | Lo realmente gastado/ingresado |
| `Actual % of Total Income` | Porcentaje sobre ingresos |
| `Variance` | Diferencia ya calculada en la hoja |
| *(repetidas)* | Las mismas en versión **YTD** |

⚠️ **`Budget` = `Planned`.** El enunciado y la hoja usan nombres distintos para lo mismo.

⚠️ Existe una columna al final con la marca **`Hide`** en las filas inactivas. Respétala: sin
filtrarla, el reporte se llena de partidas en cero.

## Selector de periodo

Arriba de la hoja hay `Year` / `Month` con `BOM` / `EOM` (inicio y fin de mes) y un `View`. La hoja
está pensada mes a mes; el reporte debe tomar por defecto el mes seleccionado ahí.

## Pestañas del libro (verificado en la copia real)

Es una plantilla de **Tiller** (de ahí `Tiller.HiddenMetadata`, `AutoCat`, `Transactions`).

| Pestaña | Rol |
|---|---|
| `Monthly Budget` | **Origen de los datos.** Presupuesto vs real del mes |
| `Jan/Feb/Apr/May/Jun Budget Comparison` | **Los cinco reportes de referencia**, hechos a mano por el cliente |
| `Cover`, `Help`, `Starter Guide` | Documentación de la plantilla |
| `Transactions`, `AutoCat`, `Categories`, `Accounts`, `Balances` | Motor de Tiller |
| `Picture Today/Tomorrow/What If`, `Past Position`, `Calculator` | Proyecciones |
| `Tiller.HiddenMetadata`, `Insights`, `Bucket Sheet` | Ocultas |

**Convención de nombre de los reportes: `{Mes} Budget Comparison`, sin año.** Se sigue tal cual,
aunque implique que enero de 2026 chocaría con el de 2025. La protección es pedir confirmación
antes de sobrescribir, no cambiar la convención del cliente.

⚠️ **Las cinco pestañas `* Budget Comparison` no se sobrescriben**: son la especificación del
formato de salida. `Config.isReferenceSheet()` las protege y `ReportSheet.render()` se niega a
tocarlas sin un `allowOverwriteReference` explícito.

## Formato de salida de referencia

**El libro ya contiene el reporte hecho a mano para varios meses.** Es la especificación del
formato, no un adorno. Replícalo.

```
Category | Item Description | Actual | Planned | Deviation ($) | Deviation (%) | Status
```

Ejemplo con importes SINTÉTICOS que reproducen la forma exacta del original:

```
Shelter        |                     | $460.00   | $2,000.00 | -1540.00 | -77.00%  | Under
               | Alquiler            | $0.00     | $1,500.00 | -1500.00 | -100.00% |
               | Jardineria          | $100.00   | $400.00   | -300.00  | -75.00%  |
               | Reparaciones        | $360.00   | $100.00   | +260.00  | 260.00%  |
                                                                                       <- fila en blanco
Personal Care  |                     | $1,600.00 | $1,000.00 | +600.00  | 60.00%   | Over
               | Gimnasio            | $700.00   | $200.00   | +500.00  | 250.00%  |
```

Convenciones a respetar:
- Fila de **categoría** con `Status` (`Over` / `Under`); filas de **partida** con `Status` vacío.
- **Fila en blanco** entre categorías.
- Importes con formato de moneda; desviación en importe **con signo explícito** (`+`/`-`).

## Casos límite (observados en los datos reales, descritos sin cifras)

| # | Caso | Forma en que aparece | Tratamiento |
|---|---|---|---|
| 1 | `Planned = 0`, `Actual ≠ 0` | Ayuda recibida sin presupuestar | Desviación = **100 %**. Nunca dividir por cero |
| 2 | `Planned = 0`, `Actual = 0` | Muchas partidas inactivas | Omitir la partida |
| 3 | **Importe negativo** | Devoluciones de compras | Es un **reembolso**. Válido. Produce porcentajes por debajo de -100 % |
| 4 | Desviación extrema | Presupuesto simbólico con gasto real muy superior: desviaciones de cuatro y cinco cifras porcentuales | Correcta pero inútil sin contexto. El texto debe explicarla en importe, no en porcentaje |
| 5 | Ingreso vs gasto | Un gasto por debajo de lo previsto es bueno; un ingreso por debajo es malo | El signo se calcula igual; **la interpretación se invierte** |
| 6 | Ahorro engañoso | Un gasto fijo grande que no registró ningún cargo en el mes | No es ahorro: es un cargo pendiente. El texto debe señalarlo |

El caso 6 es el que distingue un informe útil de un volcado de números.

## Reglas de cálculo

```
desviacionImporte  = actual - planned
desviacionPct      = planned === 0
                        ? (actual === 0 ? null : 100)
                        : ((actual - planned) / Math.abs(planned)) * 100
status             = desviacionImporte > 0 ? 'Over' : 'Under'
esSignificativa    = Math.abs(desviacionPct) >= umbral   // por defecto 15
```

**Orden de las partidas dentro de una categoría: por `Math.abs(desviacionImporte)` descendente**, no
por porcentaje. Un +300 % sobre $10 es ruido; un +20 % sobre $3.000 es la noticia. Esta es la
decisión de diseño más importante del motor y hay que explicarla en el resumen ejecutivo.

## Aviso sobre los datos

La plantilla contiene detalle financiero personal real: pensión alimenticia, nombres propios en
partidas de regalos, e importes concretos de una persona identificable.

- **Nunca** subir la hoja ni sus datos a un repositorio público. Esta skill usa importes
  SINTÉTICOS a propósito: conservan la forma de cada caso, no las cifras del cliente.
- En el repositorio solo va **código**.
- Para capturas de la entrega, preferir datos de ejemplo o difuminar los nombres.
