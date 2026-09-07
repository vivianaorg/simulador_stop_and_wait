# 07 — Historial

Changelog por hito: **qué** cambió · **por qué** · **cómo revertir**. Fechas absolutas, lo más
nuevo arriba. No es una crónica de sesiones. El detalle commit a commit está en `git log`.

Cuando este archivo pase de ~600 líneas, las entradas viejas se mueven a
`_archivo/historial-hasta-AAAA-MM-DD.md`.

---

## 2026-09-07 — Documentación adoptada y alcance reducido a la versión web

**Qué:** se montó `docs/` (`00`, `01`, `04`, `05`, `06`, `07`) y se escribieron `CLAUDE.md` y
`AGENTS.md` en la raíz, siguiendo las plantillas de `~/.claude/templates/`. Dos decisiones
quedaron declaradas en el proceso:

- **El desarrollo sigue solo en `simulador_stop_and_wait_web/`.** `simulador_stop_and_wait_python/`
  queda **congelada**: se lee y se puede portar algo de ahí a la web, pero no se modifica.
- **Pipeline declarado N0** (sintaxis + checklist de humo manual) en vez del N1 global, con la
  excepción escrita en [04-convenciones.md](04-convenciones.md).

**Por qué:** el repo no tenía documentación de estado ni reglas escritas, y la entrega es el
2026-09-09. Montar tests y tooling en dos días habría contradicho además la regla de "cero
dependencias" que hace que el simulador se pueda abrir sin instalar nada. La deuda queda
**anotada** (`Q-01`, `Q-02` en [06-pendientes.md](06-pendientes.md)), no disimulada.

**Evidencia (baseline real, 2026-09-07):**

- `node --check js/protocol.js` y `node --check js/app.js` → limpios (Node v24.11.1).
- `python -m py_compile simulador_stop_and_wait_python/*.py` → limpio (Python 3.13.14).
- Tests: **no existe ninguno** en el repo.
- Tamaño: web 2 349 líneas · Python 872 líneas (`wc -l`).

**Cómo revertir:** `git rm -r docs CLAUDE.md AGENTS.md`. No se tocó nada de `simulador_*`,
así que revertir la documentación no afecta al simulador.

**Lección:** las dos versiones no son un puerto que haya que mantener en paralelo; tratarlas
como tal habría duplicado el trabajo restante antes de la entrega.
