# 04 — Convenciones (obligatorias)

Aplican a personas y a agentes por igual. Cambiar una regla de acá es una decisión explícita.

Base global: [`~/.claude/dev-rules.md`](file:///C:/Users/gogam/.claude/dev-rules.md) (código) y
[`~/.claude/docs-protocol.md`](file:///C:/Users/gogam/.claude/docs-protocol.md) (documentación).
Acá va lo propio de este repo y, sobre todo, las **excepciones declaradas** — que en este
proyecto son varias y son deliberadas.

---

# Parte A — Reglas de documentación

## A.1 Ciclo por cambio

**ANTES** — leer [00-INDEX.md](00-INDEX.md) y [06-pendientes.md](06-pendientes.md).

**DURANTE** — un cambio a la vez · nada se da por bueno sin haberlo abierto en el navegador.

**DESPUÉS** — si cambió el AHORA, actualizar [01-arquitectura.md](01-arquitectura.md) o
[05-runbook.md](05-runbook.md) · entrada en [07-historial.md](07-historial.md)
(qué · por qué · cómo revertir) · [06-pendientes.md](06-pendientes.md) al día.

## A.2 Escritura

Fechas absolutas (`2026-09-07`, nunca "hoy") · un archivo = un propósito · no duplicar un hecho
entre archivos: se enlaza · corto · referencias a código como `ruta/archivo.ext:línea`.

## A.3 Prohibiciones

- ❌ Estado de sesión o pendientes dentro de `CLAUDE.md` / `AGENTS.md`.
- ❌ Duplicar el mismo bloque en `CLAUDE.md` y `AGENTS.md`.
- ❌ Enlazar documentos que no existen.
- ❌ Cerrar un pendiente sin evidencia.
- ❌ Renumerar documentos (un número archivado queda vacante).

---

# Parte B — Reglas de código

## B.1 Innegociables del stack

- **Cero dependencias externas y cero build.** Nada de npm, bundlers, CDNs, frameworks ni
  paquetes pip. Quien evalúa el trabajo tiene que poder servir la carpeta y verlo funcionar.
- **Solo se desarrolla `simulador_stop_and_wait_web/`.** `simulador_stop_and_wait_python/` está
  **congelada** desde el 2026-09-07: se puede leer y portar una idea desde ahí hacia la web,
  pero no se la modifica ni se busca paridad de features.
- **`js/protocol.js` es el dueño de la lógica del protocolo.** Secuencias, contadores, tiempos
  del enlace y eficiencia se calculan ahí y `js/app.js` los **consume**. Si la UI necesita un
  número derivado, se agrega un getter al modelo; no se recalcula en la vista.
- Un control nuevo en `index.html` necesita `id` y su línea en `_cacheDom()`
  (`js/app.js:141`), o queda `undefined` sin avisar.
- No se commitea `__pycache__/` (ya está en `.gitignore`). Sin secretos: el proyecto no tiene.

## B.2 Estilo

Nombres con intención · funciones que hacen una sola cosa · sin código muerto ni comentado ·
sin números mágicos sueltos (las constantes visuales van arriba de su método) · comentarios solo
para lo no obvio: una regla del protocolo o una decisión que sorprende al leerla.
Prohibidos como nombre: `tmp`, `data`, `obj`, `manager`, `helper`, `util`.

## B.3 Flujo por cambio

1. Cambio chico y acotado; un tema por commit.
2. **Verificación mínima verde antes de commitear** (Parte C).
3. Conventional Commits con scope: `feat(web): …`, `fix(web): …`, `docs: …`.
4. Refactor = sin cambio de comportamiento observable. Si al probarlo algo se comporta distinto,
   se para y se consulta.

---

# Parte C — Pipeline de verificación

**Nivel declarado hoy: N0 — verificación mínima.** No es el N1 de las reglas globales, y eso es
una **excepción declarada**, no un descuido (motivo abajo).

| Paso | Comando | Estado |
|---|---|---|
| Sintaxis JS | `node --check simulador_stop_and_wait_web/js/protocol.js && node --check simulador_stop_and_wait_web/js/app.js` | **obligatorio** |
| Sintaxis Python (versión congelada) | `python -m py_compile simulador_stop_and_wait_python/*.py` | obligatorio mientras el archivo siga en el repo |
| Prueba manual en navegador | [05-runbook.md](05-runbook.md) § *Checklist de humo* | **obligatorio antes de entregar** |
| Tests unitarios | — | **no existen** (excepción declarada) |
| Cobertura · mutación · métricas | — | fuera de alcance |

**Evidencia antes que afirmación.** No se dice "funciona" sin haber corrido el comando o abierto
el navegador. Si falla, se dice que falla y se pega la salida.

## Excepciones declaradas frente a las reglas globales

| Regla global | Excepción en este repo | Motivo |
|---|---|---|
| Pipeline N1 obligatorio (type-check, lint, formateador, suite unitaria) | **N0**: solo chequeo de sintaxis + prueba manual guiada | Trabajo académico con entrega el **2026-09-09**. Montar Node/tooling contradice además la regla de "cero dependencias". Queda como pendiente `Q-01`, no como deuda oculta |
| TDD: test que falla → implementación → verde | **No se aplica**: no hay framework de tests | Mismo motivo. El reemplazo es el **checklist de humo** del runbook, que se corre entero antes de entregar |
| Spec + plan antes de una feature | Solo para cambios que toquen la lógica del protocolo; el resto va directo | Alcance chico y una sola persona trabajando |
| Toda feature incluye su frontend | Trivial acá: el proyecto **es** un frontend | — |

Estas excepciones valen **para este proyecto y por su fecha de entrega**. No se citan como
precedente en otro repo.
