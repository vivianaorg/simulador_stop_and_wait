# 07 — Historial

Changelog por hito: **qué** cambió · **por qué** · **cómo revertir**. Fechas absolutas, lo más
nuevo arriba. No es una crónica de sesiones. El detalle commit a commit está en `git log`.

Cuando este archivo pase de ~600 líneas, las entradas viejas se mueven a
`_archivo/historial-hasta-AAAA-MM-DD.md`.

---

## 2026-09-07 — El simulador pasa a ser lo principal: diagrama tiempo-espacio, CRC real y puntos editables

**Qué:**

- `index.html` es ahora **el simulador**; la calculadora se movió a `calculadora.html`.
- **Diagrama tiempo-espacio** como pieza central (`js/ui.js`): el tiempo baja, cada vertical es
  un punto del camino y las flechas cruzan entre ellas. La historia se acumula en pantalla en
  vez de borrarse, y produce la misma figura con la que el libro explica el protocolo.
- **`js/frame.js`**: tramas con **CRC-16/CCITT-FALSE**. El receptor recalcula y compara; no hay
  ninguna bandera de "esta venía dañada".
- **`js/sim.js`**: máquina de estados de Stop & Wait sobre N saltos con tiempo simulado
  explícito (`advance(dtMs)`), generador de ruido con semilla y bitácora de eventos.
- **Inspector de la trama en vuelo**: se puede voltear cualquiera de sus 80 bits —incluidos los
  16 del CRC—, forzar el número de secuencia, destruirla o retrasarla.
- **Puntos del camino editables** desde la propia página, con distancia, tasa, velocidad y
  probabilidad de error por tramo.
- **Interruptor de NAK**: apagado es el Protocolo 3 (descarte silencioso, el emisor se entera
  por el temporizador); encendido, la variante ARQ con NAK.
- Estética rehecha en plano: fuera degradados, sombras y brillos; el color solo significa.

**Por qué:** lo pedido era un simulador, no una calculadora, y el v1 tenía tres límites de
fondo: un solo enlace, la animación se borraba sin dejar registro, y las "pérdidas" eran
banderas, no errores detectables. El CRC real es lo que convierte el trabajo en algo
demostrable: se voltea un bit delante de quien evalúa y el receptor lo rechaza solo.

**Evidencia (2026-09-07):**

- `node --test` sobre los dos archivos de pruebas → **33 pruebas, 0 fallas**. Entre ellas: el
  CRC detecta el volteo de **cada uno** de los 80 bits; sin NAK se espera al temporizador y con
  NAK no; un ACK dañado deja al emisor esperando y su copia se descarta como duplicada; el
  tiempo que mide la simulación coincide con el RTT que calcula `network.js`.
- Simulador renderizado de verdad con el Chromium sin cabeza, empujado con el botón *Un paso*:
  dibuja el ciclo completo con dos saltos, la alternancia 0/1 y el timeout provocado al dañar
  un bit.

**Cómo revertir:** `git revert` de este commit. El motor de cálculo (`network.js`) y sus pruebas
no cambiaron.

**Lección:** el timeout por defecto estaba fijado a 60 ms mientras el RTT de un camino de dos
saltos es exactamente 60 ms, así que el emisor retransmitía justo cuando el ACK llegaba y todo
se veía como duplicados. No era un fallo del dibujo sino una configuración imposible: ahora el
timeout se calcula del camino (RTT + 50 %) mientras el usuario no escriba uno propio. Un valor
por defecto que contradice al modelo se lee como un error del programa.

---

## 2026-09-07 — v2: motor de camino multi-salto y calculadora, con pruebas contra el libro

**Qué:** proyecto nuevo `simulador_stop_and_wait_v2/` — sitio estático sin build, sin
dependencias, **sin base de datos y sin login**. Contiene:

- `js/network.js`: modelo de un camino de **N saltos en serie** con store-and-forward. Calcula
  Tt, Tp, `a`, RTT, ciclo, utilización, utilización efectiva con probabilidad de error,
  transmisiones esperadas, caudal útil, BDP y timeout mínimo. Modos de canal half y full duplex.
- `tests/network.test.js`: **15 pruebas** con el runner nativo de Node.
- `index.html` + `js/calc.js` + `css/style.css`: calculadora con saltos editables, tres presets
  verificados y el desarrollo paso a paso de cada fórmula.

Decisiones que quedaron fijadas (detalle en el
[spec](superpowers/specs/2026-09-07-motor-multisalto-design.md)): cadena de N saltos en vez de
grafo libre · **solo Stop & Wait**, sin ventana deslizante · precisión por encima de features ·
proyecto aparte para no poner en riesgo el v1.

**Por qué:** el v1 modelaba un solo enlace y no podía responder "casa → satélite → casa", ni
servir de calculadora, ni justificar sus números. Se pidió precisión respecto al libro, y la
única forma de sostenerla es que cada fórmula tenga una prueba con un número publicado.

**Evidencia (2026-09-07):**

- `node --test simulador_stop_and_wait_v2/tests/network.test.js` → **15 pruebas, 0 fallas**.
  Incluye el satélite de Tanenbaum (Tt = 20 ms, ciclo = 520 ms, **U = 3,846 %**, BDP = 26 tramas)
  y la LAN (**a = 0,1 · U = 0,8333**).
- Página renderizada de verdad con el Chromium de Playwright sin cabeza: muestra
  `U = 3.85 %`, `ocioso 96.15 %`, `RTT 520.000 ms`, `BDP 26000 bits · 26.00 tramas`.
- Cableado del DOM: 25 de 25 `getElementById` tienen su `id` en el HTML.

**Cómo revertir:** `git rm -r simulador_stop_and_wait_v2` y quitar la sección "v2" de
`docs/01-arquitectura.md`. El v1 y la versión Tkinter no se tocaron.

**Lección:** el runner `node --test` da suite de pruebas **sin instalar nada**, así que la regla
de "cero dependencias" nunca fue una excusa válida para no tener tests. Y verificar la
terminología del libro antes de diseñar evitó un error de bulto: *duplex* no es un tercer modo
junto a half y full, y *simplex* describe el tráfico de datos, no el canal.

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
