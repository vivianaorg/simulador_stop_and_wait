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
- `simulador_stop_and_wait_python/` — Tkinter sobre la stdlib de Python 3. **Congelada desde el
  2026-09-07**: no se desarrolla más; queda como referencia de la que se puede portar algo a la
  web si hace falta.

Tamaño real (2026-09-07, `wc -l`): web **2 349 líneas** (`app.js` 1 204 · `style.css` 764 ·
`index.html` 258 · `protocol.js` 123) · Python **872 líneas** (`gui.py` 774 · `protocol.py` 76 ·
`main.py` 21). Sin `package.json`, sin `requirements.txt`.

Estado de calidad verificado el 2026-09-07:
`python -m py_compile simulador_stop_and_wait_python/*.py` → limpio ·
`node --check` sobre `js/protocol.js` y `js/app.js` → limpio ·
**suite de tests: no existe** (decisión declarada, ver [04-convenciones.md](04-convenciones.md)).

Trabajo en curso: cerrar la entrega. Ver [06-pendientes.md](06-pendientes.md).

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
No hay `docs/_archivo/` ni `docs/superpowers/` todavía; se crean el día que hagan falta.

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
