# CLAUDE.md

**simulador_stop_and_wait** — simulador visual del protocolo de control de flujo Stop & Wait
(tramas, ACKs, pérdidas simuladas, timeout y métricas de eficiencia). Dos versiones equivalentes:
**JavaScript/HTML/CSS sin build** (web) y **Python 3 + Tkinter** (escritorio).

Este archivo es **corto a propósito**. La documentación vive en `docs/`.
Estado de sesión, pendientes o "lo que se hizo" **no van acá**: van en
`docs/06-pendientes.md` y `docs/07-historial.md`.

---

## Al empezar cualquier sesión (obligatorio)

1. **[docs/00-INDEX.md](docs/00-INDEX.md)** — resumen del sistema + mapa de la documentación.
2. **[docs/06-pendientes.md](docs/06-pendientes.md)** — qué está abierto.
3. Antes de escribir código, **[docs/04-convenciones.md](docs/04-convenciones.md)** — reglas
   y **excepciones declaradas** (este es un proyecto académico con fecha de entrega: el
   pipeline está recortado a propósito y eso está escrito allí).

Reglas globales de este PC: `~/.claude/dev-rules.md` · `~/.claude/docs-protocol.md`.
Donde contradigan a `docs/04-convenciones.md`, **manda el repo**.

| Necesito… | Voy a |
|---|---|
| Stack y decisiones técnicas | [docs/01-arquitectura.md](docs/01-arquitectura.md) |
| Un comando o una gotcha | [docs/05-runbook.md](docs/05-runbook.md) |

## Comandos mínimos

```bash
# Web (no hay build): servir la carpeta y abrir http://localhost:8000
python -m http.server 8000 --directory simulador_stop_and_wait_web

# Escritorio
python simulador_stop_and_wait_python/main.py

# Verificación mínima obligatoria antes de commitear
python -m py_compile simulador_stop_and_wait_python/*.py
node --check simulador_stop_and_wait_web/js/protocol.js
node --check simulador_stop_and_wait_web/js/app.js
```

El resto: [docs/05-runbook.md](docs/05-runbook.md).

## Reglas duras (violarlas rompe cosas)

- **Cero dependencias y cero build.** La web se abre sirviendo la carpeta; el escritorio corre
  con la stdlib de Python. No agregar npm, bundlers ni paquetes pip.
- **El modelo del protocolo vive en `protocol.js` / `protocol.py`.** Contadores, secuencia,
  eficiencia y tiempos se calculan ahí. La UI (`app.js`, `gui.py`) **consume, no recalcula**.
- **Se trabaja solo sobre `simulador_stop_and_wait_v2/`.** `simulador_stop_and_wait_web/` y
  `simulador_stop_and_wait_python/` son el trabajo de partida del grupo y **se conservan como
  registro, sin mantenerse** (2026-09-07): se leen, no se tocan. Conservar no es mantener. Ver
  [docs/01-arquitectura.md](docs/01-arquitectura.md).
- **Verificación mínima verde antes de cada commit** (los tres comandos de arriba).
- Commit chico, Conventional Commits con scope: `feat(web): …`, `fix(python): …`, `docs: …`.
- `__pycache__/` no se commitea (ya está en `.gitignore`).

## Cierre de cada cambio (obligatorio)

1. Estado que haya cambiado → `docs/01` / `docs/05`.
2. Entrada en `docs/07-historial.md`: qué · por qué · cómo revertir.
3. `docs/06-pendientes.md`: cerrar lo hecho, dar de alta lo que quedó abierto.
