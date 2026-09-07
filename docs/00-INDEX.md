# 00 — Índice maestro · simulador_stop_and_wait

**Leer PRIMERO en cada sesión, junto con [06-pendientes](06-pendientes.md).**
Última actualización: 2026-09-07.

## Resumen en 30 segundos

Simulador visual del protocolo de control de flujo **Stop & Wait**, para una materia de redes.
Muestra el envío de tramas, los ACKs, las pérdidas provocadas por el usuario, el temporizador de
retransmisión y la telemetría del enlace. Es una herramienta de demostración: **no hay red real,
todo se simula en memoria**. Estado: **funcional, en entrega** (proyecto académico, entrega el
2026-09-09).

Dos versiones equivalentes en concepto pero **no idénticas en features**
(detalle en [01-arquitectura.md](01-arquitectura.md)):

- `simulador_stop_and_wait_web/` — HTML + CSS + JavaScript puro, canvas 2D, **sin build ni
  dependencias**. Es la versión **más avanzada** y la que se demuestra.
- `simulador_stop_and_wait_v2/` — **donde se trabaja ahora**. Simulador con diagrama
  tiempo-espacio, camino de N puntos editable, inspector de la trama en vuelo y detección de
  errores por CRC; más una calculadora en su propia página. Sitio estático, sin build, sin base
  de datos y sin login. Ver [01-arquitectura.md](01-arquitectura.md).
- `simulador_stop_and_wait_python/` — Tkinter sobre la stdlib de Python 3. **Congelada desde el
  2026-09-07**: no se desarrolla más; queda como referencia de la que se puede portar algo a la
  web si hace falta.

Tamaño real (2026-09-07, `wc -l`): web **2 349 líneas** (`app.js` 1 204 · `style.css` 764 ·
`index.html` 258 · `protocol.js` 123) · Python **872 líneas** (`gui.py` 774 · `protocol.py` 76 ·
`main.py` 21). Sin `package.json`, sin `requirements.txt`.

Estado de calidad verificado el 2026-09-07:
`node --test` sobre los dos archivos de `simulador_stop_and_wait_v2/tests/` →
**33 pruebas, 0 fallas** ·
`node --check` sobre los siete `.js` → limpio ·
`python -m py_compile simulador_stop_and_wait_python/*.py` → limpio.
El v1 y la versión Tkinter **siguen sin tests**; los tests cubren el motor del v2.

Trabajo en curso: **simulador v2** (motor multi-salto, CRC y diagrama tiempo-espacio).
[Spec](superpowers/specs/2026-09-07-motor-multisalto-design.md) ·
[Plan](superpowers/plans/2026-09-07-motor-multisalto.md) ·
[06-pendientes.md](06-pendientes.md).

## Mapa de la documentación

| Archivo | Rol | Cuándo se toca |
|---|---|---|
| [00-INDEX.md](00-INDEX.md) | Este índice: resumen + mapa | Cuando cambia la estructura de docs |
| [01-arquitectura.md](01-arquitectura.md) | Estado técnico: módulos, modelo del protocolo, divergencias web/Tkinter | Cuando cambia una decisión técnica |
| [04-convenciones.md](04-convenciones.md) | **Reglas obligatorias + excepciones declaradas** | Casi nunca; cambiar una regla es decisión explícita |
| [05-runbook.md](05-runbook.md) | Comandos, ejecución, gotchas | Cuando cambia un comando o un procedimiento |
| [06-pendientes.md](06-pendientes.md) | **Tareas abiertas** con prioridad | En cada sesión |
| [07-historial.md](07-historial.md) | **Changelog**: qué, por qué, cómo revertir | Después de cada cambio relevante |

`02` y `03` no existen: el proyecto no tiene subsistemas con vida propia que documentar aparte.
`docs/superpowers/` sí existe ya: [specs y planes](superpowers/README.md). No hay `_archivo/`.

### Fuera de `docs/`

| Archivo | Rol |
|---|---|
| `CLAUDE.md` (raíz) | Contrato de arranque: reglas duras + punteros a esta carpeta |
| `AGENTS.md` (raíz) | Lo mismo para otros agentes |
| `README.md` (raíz) | Presentación del proyecto y cómo ejecutarlo (público, para quien lo recibe) |
| `~/.claude/dev-rules.md` · `~/.claude/docs-protocol.md` | Reglas globales del PC |

## Regla de oro de esta documentación

**Un hecho vive en un solo sitio.** Estado (`01`, `04`, `05`) ≠ historial (`07`) ≠
pendientes (`06`). Detalle en [04-convenciones.md](04-convenciones.md).

> **Números vacantes:** ninguno todavía.
