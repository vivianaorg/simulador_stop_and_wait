# 07 — Historial

Changelog por hito: **qué** cambió · **por qué** · **cómo revertir**. Fechas absolutas, lo más
nuevo arriba. No es una crónica de sesiones. El detalle commit a commit está en `git log`.

Cuando este archivo pase de ~600 líneas, las entradas viejas se mueven a
`_archivo/historial-hasta-AAAA-MM-DD.md`.

---

## 2026-09-07 — Paso 2 cerrado: half duplex en la animación, diagrama con historia y gráficas descritas

**Qué:**

- **Half duplex en el simulador** (`V2-02`). Selector de canal y **tiempo de vuelta por tramo**.
  El motor cobra la inversión del medio **antes** de transmitir, no durante el viaje: el ACK
  existe pero espera, y lo mismo la trama siguiente. La primera no la paga. Cada inversión queda
  registrada como evento y se dibuja como un tramo vertical grueso sobre la línea del punto.
- **Diagrama desplazable** (`V2-04`): la rueda del ratón mira hacia atrás con un aviso del
  instante que se está viendo; doble clic vuelve al presente.
- **Gráficas descritas** (`V2-05`): la tabla de la curva es alcanzable con el tabulador y tiene
  foco visible; cada gráfica lleva un `aria-label` con **sus números**, no solo su título.

**Por qué:** el cálculo ya distinguía half de full duplex desde el 2026-09-07, pero la animación
no, así que la diferencia más didáctica —mismo protocolo, mismo enlace, distinta utilización solo
por el modo del canal— no se podía enseñar. El diagrama, por su parte, perdía de vista justo lo
que servía para explicar lo ocurrido.

**Evidencia:**

- **48 pruebas, 0 fallas** (5 nuevas): el ciclo crece exactamente 2 × el tiempo de vuelta
  mientras el RTT no cambia; el ACK espera con `turnRemainingMs > 0` y `elapsedMs = 0`; cada
  inversión dura lo que debe y ocurre en un punto, no entre dos; full duplex no paga ninguna; la
  primera trama tampoco.
- Navegador sin cabeza: con half duplex se ven las barras de inversión antes de cada ACK y de
  cada trama; con la rueda aparece el aviso «histórico · 86.0 ms — doble clic para volver».

**Cómo revertir:** `git revert` de este commit. Las tres mejoras son independientes entre sí.

**Lección:** el selector de canal se cortaba en pantalla («Half duple») porque la columna de los
controles estaba fijada a 96 px. Se vio en la captura, no en el código: por eso el paso 3 —mirar
la pantalla— no es opcional por mucho que las pruebas estén verdes.

---

## 2026-09-07 — Paso 1 cerrado: el v1 y la versión Tkinter se conservan, sin mantenerse

**Qué:** decisión del usuario sobre las dos carpetas de partida
(`simulador_stop_and_wait_web/` y `simulador_stop_and_wait_python/`): **se quedan en el
repositorio como registro del trabajo del grupo, y no se mantienen**. Ejecutado el mismo día:

- `README.md` describe ahora las tres carpetas, cuál se entrega y de dónde vienen las otras dos,
  con el comando de `git log` que muestra su autoría.
- `01-arquitectura.md` recoge la decisión y anota los **fallos conocidos del v1 que no se van a
  corregir**, para que el registro sea honesto en vez de silencioso.
- `CLAUDE.md`, `AGENTS.md` y `00-INDEX.md` dicen lo mismo: se lee, no se toca.
- Cerrados `V2-03`, `E-02` (por la decisión) y `E-01`, `Q-01`, `V-01`, `V-02` (**no aplica**:
  solo tenían sentido sobre código que se mantiene). Seis de doce pendientes, sin escribir código.

**Por qué:** el spec del cierre planteaba tres opciones —retirar, anexar o mantener— y daba
«mantener» por imposible antes de la entrega. Le faltaba una distinción que aportó el usuario:
**conservar no es mantener**. El trabajo de partida es de sus compañeros de grupo, y el
repositorio debe mostrar de dónde viene la versión mejorada; eso no obliga a probar, testear ni
arreglar ese código. Queda anotado como desvío en el propio spec, que no se reescribe.

**Evidencia:**

- `grep -rn "simulador_stop_and_wait_web\|simulador_stop_and_wait_python" simulador_stop_and_wait_v2/`
  → sin resultados: el v2 no depende de lo conservado ni lo enlaza.
- `git log` sobre esas dos carpetas muestra los commits del grupo, anteriores a esta sesión.

**Cómo revertir:** `git revert` de este commit devuelve las seis fichas a `06`. El código no se
tocó: conservar era, precisamente, no tocarlo.

**Lección:** una opción que falta en la tabla de opciones vale por un error de diseño. El spec
cerraba el paso con tres salidas y ninguna era la buena, porque mezclaba dos cosas distintas —
tener el código en el repositorio y hacerse cargo de él. La tabla parecía completa, y por eso
nadie la habría cuestionado.

---

## 2026-09-07 — Los 12 pendientes pasan a un cierre en cuatro pasos, y las reglas se endurecen

**Qué:**

- [Spec](superpowers/specs/2026-09-07-cierre-pendientes-design.md) y
  [plan](superpowers/plans/2026-09-07-cierre-pendientes.md) que cubren **todos** los pendientes
  abiertos, agrupados en cuatro pasos con orden obligatorio: podar → terminar el v2 → probarlo a
  mano → blindar.
- `06-pendientes.md` reescrito: las doce fichas se agrupan por paso y **el detalle deja de estar
  ahí**; vive en el spec y se enlaza.
- `04-convenciones.md` gana ocho **reglas endurecidas** (A.3), tomadas de la sección ANTIDERIVA
  del protocolo global: fuente única de conteos, nada de rutas ni líneas sin comprobar,
  comprobar cada afirmación contra el código, no reescribir documentos fechados, el índice
  enlaza en vez de afirmar, un fichero no mezcla tipos, prohibidas las frases sobre el estado del
  repositorio que caducan al commitear, y no abrir fichas durante un cierre.

**Por qué:** doce fichas sueltas y dos días de plazo daban una lista que parecía doce trabajos.
No lo era: **seis pertenecían a código que ya no se desarrolla**, y su coste dependía de una
decisión que nadie había tomado. Agrupar por decisión en vez de por ficha convierte seis
pendientes en una pregunta. Y la regla de «un desvío no es un pendiente» es lo que impide que la
lista vuelva a crecer mientras se cierra.

**Evidencia:** los doce identificadores originales aparecen exactamente una vez en el reparto por
pasos (6 + 3 + 2 + 1 = 12). Ningún enlace roto entre documentos.

**Cómo revertir:** `git revert` de este commit. No se tocó código: es solo documentación.

**Lección:** el conteo «43 pruebas» estaba escrito a mano en cuatro documentos. Ninguno mentía
todavía, y por eso el problema pasaba desapercibido: son cuatro oportunidades de mentir en cuanto
alguien añada una prueba. Un número tecleado en varios sitios ya está mal, solo que aún no se
sabe. La corrección —declarar la fuente única y borrar las copias— es trabajo del paso 4, y hasta
entonces la deuda queda escrita en vez de disimulada.

---

## 2026-09-07 — La calculadora deja de ser un texto pegado

**Qué:** `calculadora.html` rehecha por bloques, al estilo de un resolutor:

- **`js/steps.js`** (nuevo): el desarrollo es ahora **estructura**, no prosa. Cada paso es
  `{titulo, formula, sustitucion, resultado, detalle[], nota}`. La interfaz decide cómo
  enseñarlo; las pruebas comprueban cada número por separado.
- Bloques: *Datos* → *Cómo se han leído los datos* → *Resultado* (titular grande + reparto del
  ciclo) → *Desarrollo* → *Dónde cae este enlace*.
- **Despliegue progresivo**: *Mostrar el siguiente paso* / *Mostrar todos* / *Ocultar*, con
  contador "Paso N de M", y **un solo detalle abierto a la vez**.
- **Dos gráficas** dibujadas a mano sobre canvas, sin librerías: reparto del ciclo y la curva
  `U = 1/(1+2a)` con este enlace marcado, cruz de puntero y **tabla equivalente** debajo.

**Por qué:** el desarrollo era un `<pre>` con todo volcado de golpe: ilegible y, peor, imposible
de comprobar por partes. Los resolutores tipo Wolfram|Alpha lo resuelven con bloques y detalle
bajo demanda, y su motivo está escrito: mantener el desarrollo legible **sin** esconder
información.

**Evidencia (2026-09-07):**

- `tests/steps.test.js`: 10 pruebas nuevas (43 en total, 0 fallas). Comprueban cada resultado
  por su identificador —`u` → `3,846 %`, `bdp` → `26.000 bits`—, que la sustitución contiene los
  datos de entrada, que los pasos de error solo aparecen si hay probabilidad de error, y que la
  curva cumple `1/(1+2a)` en **todos** sus puntos.
- Página renderizada con el Chromium sin cabeza: los 10 pasos, el detalle desplegado del paso 3
  con la forma cerrada `a = (R·d)/(V·L)`, la curva con el punto en a = 12,5 → 3,846 % y la tabla
  con la fila de este enlace resaltada.
- Paleta de las gráficas validada con el script del skill de dataviz.

**Cómo revertir:** `git revert` de este commit. `network.js` y sus pruebas no cambiaron.

**Lección:** la pareja de colores que parecía obvia para "transmitiendo / esperando" (verde y
ámbar) **falla** la separación para daltonismo protán: ΔE 5,7 cuando el mínimo es 8. Se resolvió
sin sacrificar nada, dibujando una sola magnitud sobre una pista neutra con etiquetas directas.
Y en modo oscuro no vale aclarar los mismos tonos: se salen de la banda de luminosidad y hay que
re-elegirlos contra el fondo oscuro.

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
