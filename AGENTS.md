# AGENTS.md — simulador_stop_and_wait

Guía de arranque para agentes y herramientas de código. **Idéntica en intención a
[CLAUDE.md](CLAUDE.md)**: si leíste uno, no necesitás el otro.

Simulador visual del protocolo Stop & Wait, en dos versiones equivalentes.
Stack: **JavaScript + HTML + CSS sin build** (web) y **Python 3 + Tkinter** (escritorio).
Sin dependencias externas.

## Antes de tocar nada

1. [docs/00-INDEX.md](docs/00-INDEX.md) — resumen del sistema y mapa de la documentación.
2. [docs/06-pendientes.md](docs/06-pendientes.md) — tareas abiertas.
3. [docs/04-convenciones.md](docs/04-convenciones.md) — reglas y excepciones declaradas
   (proyecto académico con entrega corta: el pipeline está recortado a propósito).

Detalle técnico en [docs/01-arquitectura.md](docs/01-arquitectura.md) · comandos en
[docs/05-runbook.md](docs/05-runbook.md).

## Reglas duras

- **Cero dependencias, cero build.** No agregar npm, bundlers ni paquetes pip.
- **El modelo del protocolo (`protocol.js` / `protocol.py`) es el dueño de la lógica.**
  La UI consume; no recalcula secuencias, contadores ni eficiencia.
- **Solo se toca la web.** La versión Tkinter está congelada: es cantera de ideas, no destino
  de cambios.
- **Verificación mínima verde antes de commitear** (`py_compile` + `node --check`, ver
  [docs/05-runbook.md](docs/05-runbook.md)).
- **Commit chico**, Conventional Commits con scope (`web`, `python`, `docs`).

## Al cerrar un cambio

Estado en `docs/01` / `docs/05` si cambió · entrada en `docs/07-historial.md`
(qué · por qué · cómo revertir) · abrir/cerrar en `docs/06-pendientes.md`.

**Nunca** escribir "estado de la sesión" ni pendientes dentro de este archivo o de `CLAUDE.md`.
