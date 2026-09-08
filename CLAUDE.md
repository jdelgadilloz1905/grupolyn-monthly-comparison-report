# CLAUDE.md — Prueba técnica GrupoLyN

Instrucciones operativas. Léelas antes de cualquier tarea.

**Rol:** AI and Automation Specialist · **Plataforma:** Google Sheets + Apps Script
**Evaluador:** Alex, fundador de GrupoLyN. La entrega se juzga por claridad y criterio, no por volumen.

**Idioma:** responde en español. Código y nombres de función en inglés; comentarios en español.

---

## Reglas fundamentales

Definidas por el usuario. **No son negociables y aplican a toda tarea.**

### 1. Reutilizar antes de crear

Antes de escribir un componente nuevo, **busca si ya existe** en el proyecto (`Grep`/`Glob` antes de
`Write`). Si existe, reutilízalo o extiéndelo. Duplicar lógica es el fallo que más rápido degrada un
proyecto pequeño.

### 2. Dos criterios de aceptación como mínimo, antes de empezar

Toda tarea se enuncia con **al menos dos criterios de aceptación explícitos** *antes* de ejecutarla.
Al terminar, se verifica contra ellos uno por uno. «Está hecho» no es una conclusión válida sin
haberlos comprobado.

### 3. Consultar las skills antes de crear nada

Las skills de `.claude/skills/` son la fuente de verdad del proyecto. Invócalas **antes** de diseñar
o escribir. Si una skill contradice a este archivo en materia de dominio o convenciones, gana la
skill.

### 4. Verificar contra la fuente real

Todo criterio de aceptación debe declarar **cómo se comprueba**, y hay que ejecutarlo. Que una
herramienta diga «válido» no prueba que el sistema destino lo acepte. Cuando la única comprobación
posible sea visual, decirlo y pedir confirmación en vez de dar la tarea por cerrada.

*Origen: en los workflows de n8n de este mismo usuario, `validate_workflow` reportó 0 errores y el
despliegue devolvió 200, pero los nodos salían rotos en el canvas — la herramienta validaba contra
su propio catálogo, no contra la instancia real.*

---

## Skills disponibles

| Skill | Cuándo invocarla |
|---|---|
| `apps-script-conventions` | Al escribir o revisar cualquier `.gs` |
| `budget-domain-model` | Al leer la hoja, calcular desviaciones o dar formato a la salida |
| `testing-and-validation` | Al escribir tests o validar un cambio |

---

## Estructura

```
CLAUDE.md              Este archivo
.claude/skills/        Skills del proyecto
docs/
  01-casos-de-uso.md   Actores, flujos, reglas de negocio, trazabilidad
  02-diagramas-flujo.md Diagramas Mermaid
src/                   Código Apps Script (.gs, .html, appsscript.json)
```

## Entregables de la prueba

1. Menú **Admin** con protección por contraseña
2. **Reporte Comparativo Mensual** → pestaña + borrador de Gmail
3. *(Bonus)* Script de despliegue masivo a hojas de clientes
4. **Resumen para un fundador no técnico** — claridad, decisiones y valor de negocio

Se entrega una carpeta de Drive con la hoja, el código (o repo público) y el resumen.

## Seguridad y datos

- La plantilla contiene **datos financieros personales reales**. Nunca subirlos a un repositorio
  público. Al repositorio solo va **código**.
- Ningún secreto en el código fuente. El hash de la contraseña va en `ScriptProperties`.
- El sistema **crea borradores, nunca envía correo**. La decisión de comunicar es humana.
- El despliegue masivo va con `dryRun = true` por defecto.

## Terminado significa

- [ ] Se consultaron las skills relevantes antes de escribir
- [ ] Se comprobó que el componente no existía ya
- [ ] Los criterios de aceptación se enunciaron antes y se verificaron después
- [ ] `runAllTests()` en verde, con los casos límite cubiertos
- [ ] Cero secretos y cero datos de cliente en el código
- [ ] Los supuestos nuevos quedaron documentados en `docs/`
