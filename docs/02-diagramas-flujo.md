# Diagramas de flujo — Reporte Comparativo Mensual

Diagramas en Mermaid. Se renderizan directamente en GitHub.

---

## 1. Visión general del sistema

```mermaid
flowchart LR
    subgraph GS["Google Sheets (dato + interfaz)"]
        MB[Monthly Budget]
        RPT[Pestana de Reporte]
        AUD[Auditoria oculta]
    end

    subgraph AS["Apps Script"]
        MENU[Menu.gs]
        AUTH[Auth.gs]
        READ[BudgetReader.gs]
        ENGINE[DeviationEngine.gs]
        SHEET[ReportSheet.gs]
        MAIL[EmailDraft.gs]
    end

    subgraph STORE["Almacenes auxiliares"]
        PROPS[(ScriptProperties<br/>hash + config)]
        CACHE[(CacheService<br/>sesion 30 min)]
    end

    GMAIL[Gmail - borrador]

    MENU --> AUTH
    AUTH <--> PROPS
    AUTH <--> CACHE
    AUTH --> AUD
    MENU --> READ
    MB --> READ
    READ --> ENGINE
    ENGINE --> SHEET
    ENGINE --> MAIL
    SHEET --> RPT
    MAIL --> GMAIL
```

**Punto clave:** `DeviationEngine` no toca `SpreadsheetApp` ni `GmailApp`. Recibe datos, devuelve
datos. Por eso se puede probar sin abrir una hoja.

---

## 2. CU-01 · Desbloqueo del menú Admin

```mermaid
flowchart TD
    A[Usuario abre la hoja] --> B["onOpen() dibuja el menu"]
    B --> C{Sesion activa<br/>en CacheService?}
    C -->|Si| D[Menu completo de admin]
    C -->|No| E[Solo opcion Desbloquear]

    E --> F[Usuario pulsa Desbloquear]
    F --> G{Bloqueado por<br/>intentos fallidos?}
    G -->|Si| H[Rechazar<br/>Espera 15 min]
    G -->|No| I[Dialogo HTML<br/>input type=password]

    I --> J[Usuario introduce el codigo]
    J --> K{Email en<br/>lista blanca?}
    K -->|No| L[Rechazar + auditar<br/>como no autorizado]
    K -->|Si| M["SHA-256(codigo + salt)"]

    M --> N{Coincide con<br/>ScriptProperties?}
    N -->|No| O[Contador +1<br/>Auditar fallo<br/>Error generico]
    N -->|Si| P[Abrir sesion 30 min<br/>Reset contador<br/>Auditar exito]

    O --> Q{5 fallos?}
    Q -->|Si| R[Bloquear 15 min]
    Q -->|No| E

    P --> D
    H --> S([Fin])
    L --> S
    R --> S
    D --> S
```

---

## 3. CU-02 · Generación del reporte

```mermaid
flowchart TD
    A[Admin - Generar Reporte] --> B{Sesion sigue<br/>siendo valida?}
    B -->|No| C[Pedir desbloqueo]
    B -->|Si| D[Dialogo: mes, umbral, destino]

    D --> E["Leer Monthly Budget<br/>UNA sola llamada getValues()"]
    E --> F{Existe la<br/>pestana?}
    F -->|No| G[Error claro. No escribir nada]
    F -->|Si| H[Reconstruir jerarquia<br/>seccion / categoria / partidas]

    H --> I[Descartar filas marcadas Hide]
    I --> J[Calcular desviacion por categoria]

    J --> K{Planned = 0?}
    K -->|Si, y Actual distinto de 0| L["Desviacion = 100%<br/>convencion del libro"]
    K -->|Si, y Actual = 0| M[Omitir partida]
    K -->|No| N["(Actual - Planned) / abs(Planned)"]

    L --> O[Clasificar Over / Under]
    N --> O
    M --> O

    O --> P{Supera<br/>el umbral?}
    P -->|No| Q[Solo fila de categoria]
    P -->|Si| R[Ordenar partidas por<br/>IMPACTO ABSOLUTO en importe]
    R --> S[Seleccionar las que<br/>explican la desviacion]

    Q --> T[Construir modelo del reporte]
    S --> T

    T --> U[Escribir pestana]
    T --> V{Hay correo<br/>de cliente?}
    V -->|Si| W[Crear BORRADOR en Gmail]
    V -->|No| X[Avisar: se omite el borrador]

    U --> Y[Resumen al consultor]
    W --> Y
    X --> Y
```

---

## 4. Secuencia: del clic al borrador

```mermaid
sequenceDiagram
    actor C as Consultor
    participant M as Menu.gs
    participant A as Auth.gs
    participant R as BudgetReader
    participant E as DeviationEngine
    participant S as ReportSheet
    participant G as EmailDraft

    C->>M: Admin - Generar Reporte
    M->>A: isSessionValid()
    A-->>M: true
    M->>C: Dialogo (mes, umbral, destino)
    C-->>M: Abril 2025, 15%, ambos

    M->>R: read('Monthly Budget', 'Apr')
    R->>R: getValues() una vez
    R-->>M: BudgetModel

    M->>E: analyze(model, 15)
    E->>E: desviacion por categoria
    E->>E: ordenar partidas por impacto
    E-->>M: ReportModel

    M->>S: render(reportModel)
    S-->>M: pestana creada
    M->>G: createDraft(reportModel)
    G-->>M: draftId
    M->>C: Resumen: 4 desviaciones, borrador listo

    Note over C,G: El sistema NUNCA envia. Solo borradores.
```

---

## 5. CU-04 · Despliegue masivo (bonus)

```mermaid
flowchart TD
    A[Lista de URLs de clientes] --> B["Ejecutar con dryRun = true<br/>POR DEFECTO"]
    B --> C[Para cada archivo]

    C --> D{URL valida?}
    D -->|No| E[Registrar y CONTINUAR]
    D -->|Si| F{Hay permiso?}
    F -->|No| E
    F -->|Si| G[Leer version instalada]

    G --> H{Ya en la<br/>version objetivo?}
    H -->|Si| I[Omitir - idempotencia]
    H -->|No| J{dryRun?}

    J -->|Si| K[Registrar que HARIA<br/>sin escribir]
    J -->|No| L[Vincular biblioteca<br/>+ inyectar arranque]

    L --> M{Ha ido bien?}
    M -->|No| E
    M -->|Si| N[Marcar version + auditar]

    E --> O{Quedan archivos?}
    I --> O
    K --> O
    N --> O
    O -->|Si| C
    O -->|No| P[Informe final:<br/>actualizadas / al dia / fallidas]
```

**Las tres reglas que hacen esto seguro:** `dryRun` por defecto, idempotencia, y que **un archivo
que falla nunca aborta el lote**.

---

## 6. Estrategia de pruebas

```mermaid
flowchart TD
    subgraph N1["Nivel 1 - Unitario (la base)"]
        A1[Tests.gs sobre DeviationEngine]
        A2["Casos limite: Planned=0,<br/>negativos, desviacion extrema"]
        A3[Sin tocar la hoja. Segundos]
    end

    subgraph N2["Nivel 2 - Integracion (el nucleo)"]
        B1[Ejecutar la generacion real]
        B2["Leer la pestana con la API<br/>y comparar con lo esperado"]
        B3[Valida el pipeline completo]
    end

    subgraph N3["Nivel 3 - UI con Playwright (superficie)"]
        C1[Menu Admin - es DOM, funciona]
        C2[Dialogo de contrasena - iframe, funciona]
        C3[Capturas para la entrega]
        C4["NO: leer celdas.<br/>La cuadricula es canvas"]
    end

    N1 --> N2 --> N3
```

| Nivel | Qué valida | Coste | Fiabilidad |
|---|---|---|---|
| **1 · Unitario** | La lógica de desviaciones y los casos límite | Bajo | Alta |
| **2 · Integración** | Que el pipeline escribe lo correcto | Medio | Alta |
| **3 · Playwright** | Que el menú y el diálogo funcionan; capturas | Alto | Media |

**Por qué Playwright queda arriba y no abajo:** la cuadrícula de Sheets se dibuja en **canvas**, así
que no se pueden leer celdas por selector; y automatizar el **login de Google** dispara detección de
bots y 2FA. Es una herramienta de humo y evidencia visual, no el bucle de desarrollo.
