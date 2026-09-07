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

## A.3 Reglas endurecidas (2026-09-07)

Añadidas tras leer la sección **ANTIDERIVA** del protocolo global, escrita después de una sesión
en la que siete afirmaciones de una documentación contradecían al código. El diagnóstico de esa
sección es el que manda aquí:

> **Si una regla de documentación no la comprueba una máquina, no es una regla: es una intención.**

Vigentes desde hoy, aunque la máquina que comprueba algunas de ellas llegue en el paso 4 del
[cierre en curso](superpowers/specs/2026-09-07-cierre-pendientes-design.md):

| # | Regla | Quién la hace cumplir |
|---|---|---|
| 1 | **Fuente única de conteos.** El número de pruebas se escribe en **un solo documento**; los demás enlazan. Un número tecleado en cuatro sitios ya está mal, solo que todavía no se sabe | Lint de documentación (paso 4) |
| 2 | **Ninguna ruta ni línea citada sin comprobar que existe.** Y se prefiere **el nombre de la función** a `archivo.js:123`: los números se pudren en la edición siguiente y aparentan más precisión de la que tienen | Lint de documentación (paso 4) |
| 3 | **Cada afirmación de la documentación se comprueba contra el código antes de commitear.** Es lo único que caza las mentiras semánticas — una frase que describe un comportamiento que el código no tiene. Ningún script las ve | Persona o agente, en la revisión |
| 4 | **Un documento fechado no se reescribe.** Los specs y las entradas de `07` son registros, no estado. Corregirlos a posteriori falsifica el archivo: lo que cambió se escribe en una entrada nueva | Persona o agente |
| 5 | **El índice enlaza, no afirma.** `00-INDEX.md` lleva punteros y, como mucho, una frase de estado por área. Si repite lo que vive en otro documento, acabará contradiciéndolo | Persona o agente |
| 6 | **Un fichero no mezcla tipos de documento.** Si explica, guía, referencia y además declara estado, se parte | Persona o agente |
| 7 | **Prohibida cualquier afirmación sobre el estado del repositorio** que deje de ser cierta un segundo después del commit que la trae: «ya está subido», «pendiente de su propio commit», «quedan dos» | Persona o agente |
| 8 | **Durante un cierre en curso no se abren fichas.** Lo que aparezca se anota como *desvío* en el spec del cierre, con qué se vio y qué lo desbloquearía, y se decide en el momento | Persona o agente |

**Lo que estas reglas no prometen:** el lint caza *mentiras mecánicas* —un número, una ruta, un
enlace, una línea—. Las semánticas solo las caza la regla 3. Escribir el script y creer que el
problema está resuelto es comprarse una falsa seguridad, que es peor que no tener script.

## A.4 Prohibiciones

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
- **El trabajo nuevo va a `simulador_stop_and_wait_v2/`.** `simulador_stop_and_wait_web/` (v1)
  se mantiene entregable y se integrará contra el motor del v2; `simulador_stop_and_wait_python/`
  está **congelada** desde el 2026-09-07: se lee y se porta de ahí, no se modifica.
- **Nada de backend.** Sin base de datos, sin login, sin sesiones, sin API. Es un sitio estático
  y así se despliega (petición explícita del usuario, 2026-09-07).
- **Las reglas viven en `frame.js`, `network.js` y `sim.js`.** `ui.js` y `calc.js` solo pintan:
  no calculan tiempos ni deciden qué hace el protocolo.
- **La detección de errores se calcula, no se finge.** Nada de banderas del tipo
  «esta trama venía mal»: el receptor recalcula el CRC. Si alguna vez hace falta un atajo, se
  discute antes, porque rompe lo que el trabajo demuestra.
- **La simulación tiene que poder repetirse:** el ruido usa un generador con semilla, nunca
  `Math.random`.
- **Sin degradados, sin sombras y sin brillos.** El color solo significa (verde entregada, azul
  confirmación, ámbar espera, rojo error); nunca decora.
- **Los colores de gráfica se validan con el script, no a ojo**, y el modo oscuro tiene sus
  propios valores en vez de un aclarado automático.
- **Toda gráfica lleva su tabla equivalente**: nadie debe depender de distinguir colores.
- **El desarrollo paso a paso es estructura, no texto pegado.** Si un número aparece en pantalla,
  tiene que poder comprobarse solo en una prueba.
- **Ninguna fórmula llega a la interfaz sin una prueba con un número publicado.** Si no se puede
  verificar contra el libro o contra su forma cerrada, no se muestra.
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

**Nivel declarado hoy: N1 parcial.** El motor del v2 tiene suite de pruebas y es obligatorio que
esté verde; el resto del repo sigue en verificación mínima. Sigue siendo una **excepción
declarada** frente al N1 global (falta lint, formateador y cobertura), no un descuido.

| Paso | Comando | Estado |
|---|---|---|
| **Pruebas del v2** | `node --test simulador_stop_and_wait_v2/tests/*.test.js` (nombrando los tres archivos) | **obligatorio** — 48 pruebas, 0 fallas al 2026-09-07 |
| Sintaxis JS | `node --check` sobre los `.js` de `simulador_stop_and_wait_web/` y `simulador_stop_and_wait_v2/` | **obligatorio** |
| Sintaxis Python (versión congelada) | `python -m py_compile simulador_stop_and_wait_python/*.py` | obligatorio mientras el archivo siga en el repo |
| Prueba manual en navegador | [05-runbook.md](05-runbook.md) § *Checklist de humo* | **obligatorio antes de entregar** |
| Tests unitarios del v1 y de la versión Tkinter | — | **no existen** (excepción declarada) |
| Cobertura · mutación · métricas | — | fuera de alcance |

**Evidencia antes que afirmación.** No se dice "funciona" sin haber corrido el comando o abierto
el navegador. Si falla, se dice que falla y se pega la salida.

## Excepciones declaradas frente a las reglas globales

| Regla global | Excepción en este repo | Motivo |
|---|---|---|
| Pipeline N1 obligatorio (type-check, lint, formateador, suite unitaria) | **Parcial**: suite unitaria sí, pero solo del motor del v2; sin lint ni formateador | Entrega el **2026-09-09** y regla de cero dependencias. El runner nativo `node --test` permitió tener pruebas sin instalar nada; lint y formateador sí exigirían tooling. Queda como `Q-02` |
| TDD: test que falla → implementación → verde | **Se aplica al motor del v2**; en la interfaz, no | La UI se verifica con el checklist de humo del runbook y con un render sin cabeza del navegador |
| Spec + plan antes de una feature | Solo para cambios que toquen la lógica del protocolo; el resto va directo | Alcance chico y una sola persona trabajando |
| Toda feature incluye su frontend | Trivial acá: el proyecto **es** un frontend | — |

Estas excepciones valen **para este proyecto y por su fecha de entrega**. No se citan como
precedente en otro repo.
