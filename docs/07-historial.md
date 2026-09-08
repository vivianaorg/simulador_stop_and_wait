# 07 — Historial

Changelog por hito: **qué** cambió · **por qué** · **cómo revertir**. Fechas absolutas, lo más
nuevo arriba. No es una crónica de sesiones. El detalle commit a commit está en `git log`.

Cuando este archivo pase de ~600 líneas, las entradas viejas se mueven a
`_archivo/historial-hasta-AAAA-MM-DD.md`.

---

## 2026-09-08 — Revisión final de la rama de la ráfaga: los bits que se cuentan son los que se enseñan

**Qué:** los siete hallazgos de la revisión final de `feat/rafaga-de-ruido`. La entrada del
2026-09-07 no se reescribe: describe lo que era cierto ese día.

- **La ráfaga arruinaba un número que dependía de la velocidad** (`0d983f9`): `burstBitsFromMs`
  trunca a bits enteros y `applyBurst` la llamaba una vez por tramo de reloj, así que cada tramo
  tiraba una fracción. A 9600 bps —la tasa de módem del capítulo 3— una ráfaga de 5 ms son 48
  bits en la calculadora, y el simulador arruinaba 45 con tramos de 1 ms y 40 con tramos de
  0,25 ms. Ahora el presupuesto se calcula **una sola vez** en `startBurst`, con la tasa del
  primer tramo (la misma que usa la calculadora), y se gasta a medida que corre el reloj: el
  total es el mismo se trocee como se trocee. De los dos caminos posibles se eligió este y no el
  acumulador de fracciones porque el número que hay que defender en clase aparece escrito una
  vez, en el sitio donde se dispara la ráfaga, en vez de emerger de una suma.
- **El contador sumaba por paquete y mordía ACKs de duración nula** (`0d983f9`): dos paquetes en
  vuelo marcaban 1000 bits donde la cuenta dice 500, y un ACK con `ackBits = 0` —el valor por
  defecto— perdía 99 bits y se descartaba por CRC. La ventana es **una**: son los mismos
  milisegundos de medio sucio, así que el contador suma una vez y cada paquete recibe la misma
  tirada; un paquete que no ocupa bits en el cable no lo alcanza.
- **La prueba que debía proteger eso pasaba trivialmente** (`0d983f9`): comparaba dos corridas
  con el mismo paso. Tres pruebas nuevas en `tests/sim.test.js` corren la misma ráfaga con
  tramos de 1 ms, de 0,1 ms y de una sola llamada, exigen el número de `N.burstBitsFromMs`, y
  atan el caso de dos paquetes y el del ACK sin duración. Contra el código anterior fallan con
  45, 90 y 100 bits donde ahora hay 48, 48 y 0.
- **Un comentario decía un número falso** (`34f005d`): la cabecera de la prueba de la ráfaga de
  17 bits agrupaba `G(x)` como `1 0000 0001 0010 0001`, que es `0x10121`. La agrupación buena
  estaba tres líneas más abajo. El array de bits siempre fue el correcto.
- **La calculadora no redondeaba el tamaño de trama** (`fb0b868`): un L de 1005 se calculaba tal
  cual mientras el simulador lo reescribía a 1008. Ahora `recalcular()` hace lo mismo que
  `rebuild()`: ajusta con `F.roundFrameBits` y lo avisa. `calculadora.html` carga `frame.js` para
  eso. **Efecto colateral asumido:** el preset de LAN trae L = 500, que no es representable, así
  que ahora se ajusta a 504 y da a = 0,0992 y U = 83,44 % en vez de 0,1 y 83,33 %. Está anotado
  en `05-runbook.md` con la alternativa (L = 1000 y d = 2 km dan a = 0,1 exacto y sí es
  representable) por si en clase hace falta el número redondo.
- **Leyenda, mínimo del formulario y bloque vacío** (`6bbfc86`, `fb0b868`): la banda de la ráfaga
  ya tiene su entrada en la leyenda, con la variable de color con la que se pinta; el campo del
  tamaño de trama anuncia `min="24"` en vez de `min="8"` y lo toma de `F.MIN_FRAME_BITS`, que era
  la única exportación de la rama sin lector; y el bloque de transferencia se oculta hasta que
  hay tamaño, como el de la ráfaga.
- **`buildTransfer` calculaba** (`f34ba1f`): `cycleMs = totalMs / frames` tres líneas después de
  declarar que ahí no se calcula nada. `N.transferAnalysis` lo devuelve y `steps.js` lo lee.
- **El banco de interfaz mentía** (`9f1a4c7`): la comprobación del CRC paso a paso esperaba 8
  filas (el `payloadBytes` fijo que desapareció al unificar el tamaño de trama; con L = 1000 son
  123 bytes) y llevaba en rojo desde entonces sin que nadie lo viera. Corregida, más la del
  tamaño de trama de la calculadora: **54 comprobaciones, 0 problemas**, sin errores de consola.

**Por qué:** la ráfaga es determinista como algoritmo, pero lo que enseñaba la pantalla no
coincidía con lo que enseña la cuenta y se movía con el control de velocidad. Eso anula el
propósito de la funcionalidad delante de un aula: la primera pregunta la tumba.

**Cómo revertir:** `git revert` de los commits citados, en orden inverso. Se pueden revertir por
separado; el único acoplamiento es que revertir `fb0b868` (redondeo en la calculadora) deja sin
lector a `F.MIN_FRAME_BITS` en esa página y sin sentido el `<script src="js/frame.js">` de
`calculadora.html`, y que revertir `0d983f9` **deja en rojo** las tres pruebas nuevas de
`tests/sim.test.js`, que hay que quitar en el mismo movimiento. Revertir la corrección del banco
(`9f1a4c7`) devuelve una comprobación a rojo permanente.

---

## 2026-09-07 — Cierre de la ráfaga de ruido: trama única, tira agrupada, calculadora y advertencia de reversión

**Qué:** las siete tareas del plan `2026-09-07-rafaga-de-ruido-y-transferencia` que rodean a la
ventana de reloj de la entrada de abajo («La ráfaga de ruido entra en el reloj del simulador»),
que **no se reescribe** (`04-convenciones.md` §A.3 regla 4). Esta entrada la complementa y le
añade lo único que le faltaba: la advertencia de reversión.

- **El tramo contiguo de bits** (`15ca30b`): `F.flipRun(frame, startBit, count)` en `frame.js`,
  que voltea un tramo y dice cuántos bits llegó a tocar si se sale del final de la trama. Sin
  generador: nada que sortear. Contra el libro (Tanenbaum, códigos polinomiales): ninguna ráfaga
  de longitud ≤ 16 sobrevive al CRC-16, y la de 17 bits igual a `G(x) = 0x11021` sí se cuela —dos
  pruebas nuevas en `tests/frame.test.js`.
- **La conversión declarada** (`c1e35e4`): `N.burstBitsFromMs` (`bits = R · t`, análisis
  dimensional, no una cita) y `N.burstDamage` (reparte esos bits sobre tramas de L bits) en
  `network.js`.
- **Un solo tamaño de trama** (`7e5bf9b`, `d68d5cd`): hasta entonces `frameBits` (lo que
  alimentaba `Tt`/`Tp`/`a`) y la trama real de `createFrame` (`payloadBytes` fijo a 8, 80 bits
  siempre) eran dos hechos distintos con el mismo nombre. Ahora `frameBits` manda: la interfaz
  deriva la carga con `F.payloadBytesFor(frameBits)` en vez de pasar `payloadBytes` a mano, tanto
  en `js/ui.js` como en `js/sim.js`. Un valor no representable se ajusta con
  `F.roundFrameBits(frameBits)` y la interfaz **avisa** del ajuste.
- **La tira se agrupa por bytes** (`243de6b`, `563b540`): por encima de 128 bits
  (`BITS_MAX_INDIVIDUALES` en `js/ui.js`) cada casilla pasa a ser un byte en hexadecimal, y el
  rótulo dice la verdad en los dos modos —incluido cuántos bytes son el CRC en modo agrupado.
- **Controles, banda y contador** (`74b55b0`, `b1353f1`): el botón *Ráfaga de ruido* y su campo en
  milisegundos en `index.html`; la banda horizontal en el diagrama y el contador *Bits arruinados
  por ráfaga* en `js/ui.js`. El segundo commit corrigió que la ventana viajara como suceso
  `"BURST"` del propio modelo —igual que `TURN` y `TIMEOUT`— en vez de que la interfaz llevara su
  propia cuenta, y que el control ya no dependiera de tener una trama en vuelo seleccionada: la
  ráfaga es del canal, no de una trama.
- **Bloque de ráfaga en la calculadora** (`328aae3`): en `calculadora.html`, con el mismo patrón
  de desarrollo plegable que los demás bloques (`js/steps.js` produce, `js/calc.js` pinta).
- **Bloque de transferencia** (`4a8aad3`, `5fe835c`): `N.transferAnalysis` (tramas =
  `⌈total / L⌉`, tiempo = tramas × ciclo, sin reenvíos) y `N.bitsFromSize` (bits, KB y MB
  decimales) en `network.js`, con su prueba de tamaños fraccionarios.

**Por qué:** el ruido por probabilidad no sirve para explicar nada delante de un aula —puede
pasar o no pasar—; hacía falta un daño que ocurra siempre, medible en milisegundos, y el ejercicio
de "cuántos bits arruina una ráfaga de t ms sobre un canal de R bps, y cuántas tramas" que hoy no
se podía contestar ni en el simulador ni en la calculadora. El detalle de motivos y alternativas
descartadas está en el [spec](superpowers/specs/2026-09-07-rafaga-de-ruido-y-transferencia-design.md).

**Cómo revertir — la advertencia que le faltaba a la entrada de abajo.** `git revert` normal
sirve para las siete tareas de esta entrada: son independientes entre sí y ninguna toca el reloj.
**La excepción es `ba18b6a`** (la entrada siguiente, «La ráfaga de ruido entra en el reloj del
simulador»): ese commit mete el cierre de la ventana de la ráfaga dentro de
`proximoSucesoMs` (`js/sim.js`), que es el cálculo que decide **cuánto avanza el reloj en cada
paso de la simulación entera**, no solo durante una ráfaga. Revertir ese commit entero con
`git revert` es seguro. Lo que **no** es seguro es tocar `proximoSucesoMs` a mano para quitar
solo la parte de la ráfaga sin entender el resto de la función: un error ahí no rompe el ruido,
dado que el ruido es solo una de las ramas que compiten por el mínimo — deja el simulador **sin
avanzar en absoluto**, porque ese mínimo es el que gobierna cada paso de `advance()`, ráfaga o no.

**Verificación:** los cinco archivos de `tests/` → fuente única del conteo en
[05-runbook.md](05-runbook.md). `node tools/lint-docs.js` limpio. `node --check` de los seis
módulos del v2 limpio. **Dos comprobaciones visuales quedan pendientes** (ningún agente de esta
sesión tiene navegador): que la ráfaga se ve y se entiende en pantalla (banda, contador, trama
descartada por CRC) y que dos dígitos hexadecimales se leen bien en la tira agrupada con una
trama de 1000 bits. Quedan en el checklist de humo de [05-runbook.md](05-runbook.md) marcadas
como pendientes, para que alguien con navegador las tache.

---

## 2026-09-07 — La ráfaga de ruido entra en el reloj del simulador

**Qué:** `sim.js` gana `startBurst(sim, durationMs)`: abre una ventana `sim.burst = { endsAtMs,
cursorPorPaquete }` que, mientras dura, muerde bits contiguos de cada paquete en vuelo según la
tasa de su enlace (`N.burstBitsFromMs` + `F.flipRun`), acumulando en el contador nuevo
`sim.stats.burstBitsRuined`. El cierre de la ventana entra en `proximoSucesoMs` junto al
temporizador, así que el reloj nunca se salta el instante en que la ráfaga termina. No usa
ningún generador: es determinista por construcción.

- `applyBurst(sim, dtMs)` se llama en `avanzarTramo`, justo después de `sim.clockMs += dtMs`:
  es el único punto donde ya se sabe cuánto avanzó el reloj en este tramo exacto (los tramos
  están recortados por `proximoSucesoMs`, así que un tramo nunca cruza el cierre de la ventana).
- `reset()` también limpia `sim.burst`, para que una simulación reiniciada no arrastre una
  ventana con un `endsAtMs` relativo al reloj anterior.
- Export nuevo: `proximoSucesoMs` (ya existía, pero no se exportaba) y `startBurst`.

**Por qué:** tarea 5 del plan `2026-09-07-rafaga-de-ruido-y-transferencia`. El ruido por
probabilidad ya existente se aplica una sola vez al entrar en un tramo; la ráfaga necesita
persistir en el tiempo, así que su cierre tenía que volverse un suceso más del reloj.

**Desvío sobre el brief:** las pruebas del brief creaban el paquete en vuelo con
`S.sendFrame(sim)` a secas. Con eso `sim.running` queda en `false` (`sendFrame` no lo toca) y
`advance()` no mueve el reloj —es el mismo guardián que usa "Pausar detiene el reloj"—, así que
la ráfaga nunca llegaba a morder nada por una razón ajena a este cambio. Se cambiaron esas tres
llamadas a `S.start(sim)` (que sí deja `running = true` y de paso ya pone la trama en el cable);
la cuarta prueba, que solo mira `proximoSucesoMs` sin avanzar el reloj, no necesitaba el cambio y
se dejó tal cual venía.

**Cómo revertir:** `git revert` del commit. Toca `simulador_stop_and_wait_v2/js/sim.js`,
`simulador_stop_and_wait_v2/tests/sim.test.js` y el conteo en `docs/05-runbook.md`.

**Verificación:** `node --test` con los cinco archivos de `tests/` → 102 pruebas verdes, 0
fallas (antes 98; el brief preveía 102). `node tools/lint-docs.js` limpio. Comprobación explícita
de que una simulación sin ráfaga no cambió: se comparó `createSimulation` + `S.start` +
`advance` en bucle, con y sin el cambio (via `git stash`), para el mismo camino y 5 tramas —
mismo `state` (`FINISHED`), mismo `clockMs` (150 ms), mismo número de eventos (10), mismo
`rxDelivered` (5) y mismas estadísticas de protocolo. No se comprobó en navegador (fuera de
alcance de este entorno): queda para quien revise.

---

## 2026-09-07 — La tira de paquetes ya se ve entera: el escenario cabe en la ventana

**Qué:** el `.stage` medía 924 px dentro de un `.work` de 848 y la tira de paquetes se salía
77 px por debajo del borde inferior — invisible sin scroll, y el scroll de la página ya no
existe. La causa: los canvas tienen **tamaño intrínseco** (el atributo `height` que les escribe
`resizeCanvases`), y con `height: 100%` sobre una caja de altura automática ese tamaño
realimentaba la altura de la fila del grid, que crecía por encima de la ventana.

- Los dos canvas pasan a `position: absolute; inset: 0`, así que ya no aportan altura.
- `.work` acota su fila con `grid-template-rows: minmax(0, 1fr)` y `.stage` lleva
  `min-height: 0; overflow: hidden`.
- La tira de paquetes escala con la ventana: `height: clamp(104px, 15vh, 132px)`. Nunca se
  sacrifica; el diagrama toma lo que sobre.

**Por qué:** el usuario no veía la parte de los paquetes y pidió que la pantalla se rellene
entera, con el diagrama como único elemento que hace falta recorrer.

**Cómo revertir:** `git revert` del commit. Solo toca `css/style.css` (`.work`, `.stage`,
`.diagram-wrap`, `.chain-wrap` y la media query de 980 px).

**Verificación:** medido con Chromium por CDP en 1920×912, 1366×600, 1280×800 y 1024×1366. En
las cuatro, el borde inferior del escenario coincide exactamente con el alto de la ventana y la
página no scrollea (`docScroll: 0`); la tira mide entre 104 y 132 px según el caso. Las pruebas
de rueda, Ctrl+rueda y doble clic siguen en verde.

---

## 2026-09-07 — La rueda sobre el diagrama recorre de verdad, y Ctrl+rueda acerca

**Qué:** el retroceso del diagrama se limitaba a `clockMs`, no a lo que de verdad queda fuera de
la ventana visible. Con el escenario por defecto —120 ms de simulación y una ventana de 108 ms—
casi todo cabía en pantalla: la rueda movía el número del aviso pero no el dibujo, así que
parecía muerta. Ahora:

- El tope del retroceso es `clockMs - ventanaVisible` (`retrocesoMaximo()`): cada paso de rueda
  que se acepta mueve el diagrama, y cuando no queda nada hacia atrás el gesto se deja pasar.
- **Ctrl + rueda acerca o aleja la escala de tiempo** (`zoom`, de 1× a 32×, dividiendo la ventana
  visible). Acercado, el recorrido hacia atrás existe siempre, que era lo que faltaba.
- El aviso de la esquina dice también el acercamiento; el doble clic vuelve al presente **y** a
  1×. Reconstruir la simulación resetea ambos.

**Por qué:** el usuario reportó que ya no podía subir ni bajar el diagrama. Medido con Chromium
por CDP: el recorrido pandeable eran 12 ms sobre 120. No era un fallo del navegador ni del
`preventDefault` —eso ya estaba bien— sino que no había casi nada que recorrer y ninguna forma de
acercar.

**Cómo revertir:** `git revert` del commit. Toca el manejador `wheel`, `ventanaVisibleMs()`,
`retrocesoMaximo()` y el aviso en `js/ui.js`, más el texto de la leyenda en `index.html`.

**Verificación:** Chromium headless por CDP (`Input.dispatchMouseEvent` con `mouseWheel`),
comparando la mitad inferior del canvas para no confundir el dibujo con el aviso: la rueda sola
mueve el diagrama, Ctrl+rueda acerca, acercado la rueda recorre el histórico, y el doble clic
deja el canvas idéntico al de partida. El MCP de Playwright no arranca en este PC porque busca
Chrome de escritorio; el binario de Chromium de Playwright sí está y es el que se usó.

---

## 2026-09-07 — El panel del simulador ya ocupa la ventana y la rueda scrollea

**Qué:** tres arreglos de maquetación en el v2, todos salidos de mirar la pantalla (paso 3).

- **`.work` ya no resta una altura fija.** Tenía `height: calc(100vh - 47px)`, con los 47 px de
  la barra superior escritos a mano; como la barra lleva `flex-wrap`, en cuanto la ventana
  estrechaba (o había zoom) pasaba a dos líneas y el panel se salía por abajo: el diagrama no
  llenaba y el final quedaba cortado. Ahora `body.app` es una columna flex de `100dvh` y el
  `.work` toma lo que quede, sea cual sea la altura real de la barra.
- **La bitácora deja de tener scroll propio.** Tenía `max-height: 190px; overflow-y: auto`
  anidado dentro del `.rail`, que también scrollea: dos barras superpuestas y la rueda movía la
  que no tocaba. El único scroll de la columna derecha es el del `.rail`.
- **La rueda sobre el diagrama solo se secuestra si hay historia que mirar.** El `wheel` hacía
  `preventDefault()` siempre, incluso sin simulación arrancada; como el diagrama ocupa la mayor
  parte de la pantalla, la rueda no movía nada y había que arrastrar la barra a clic. Ahora, si
  el gesto no cambia el retroceso (sin simulación, o ya en un extremo), se deja pasar.

Debajo de 980 px `body.app` vuelve a flujo normal y manda el scroll de la página.

**Por qué:** eran los tres síntomas que reportó el usuario —«los scrolls se solapan», «no ocupa
todo», «toca hacer scroll con clic y no con la rueda»— y los tres tenían la misma raíz: medidas
fijas y scrolls anidados en vez de dejar que el alto lo decida el contenedor.

**Cómo revertir:** `git revert` del commit. Toca `css/style.css` (bloques `body`, `.work`,
`.rail`, `.log` y la media query de 980 px), la clase `app` del `<body>` en `index.html` y el
manejador `wheel` de `js/ui.js`.

**Verificación:** `node --check` de `ui.js` y `sim.js`, y los cuatro ficheros de `tests/` en
verde. **La comprobación visual no se hizo aquí**: Playwright no tiene navegador instalado en
este PC, así que el encuadre lo confirma el usuario en pantalla.

---

## 2026-09-07 — Ruido opcional, error a mano y el CRC paso a paso

**Qué:** tres peticiones del usuario, y una de ellas resultó estar ya hecha.

- **Ruido del canal con interruptor.** Ya estaba apagado de hecho —todas las probabilidades
  venían a cero— pero no se veía. Ahora hay un interruptor explícito: apagado, las probabilidades
  de los tramos se ignoran y sus campos se deshabilitan; encendido, funcionan con el generador de
  semilla de siempre.
- **Error a mano: ya existía**, pulsando cualquier bit del inspector. El texto no lo decía con
  claridad, así que se reescribió, y se añadió el botón *Dañar un bit al azar* para cuando da
  igual qué bit sea.
- **CRC paso a paso** (nuevo): `crc16Trace()` en `frame.js` devuelve el registro antes y después
  de cada byte y los ocho desplazamientos de cada uno, diciendo cuándo tocó aplicar el polinomio.
  El inspector lo pinta con su veredicto final: qué calcula el receptor, qué trae la trama, y si
  la acepta.

**Por qué:** «ruido opcional» y «error a mano» eran, en realidad, un problema de que la interfaz
no contaba lo que ya sabía hacer. El CRC paso a paso sí era nuevo, y es lo que convierte la
detección de errores en algo que se puede explicar en una defensa en vez de afirmar.

**Dos fallos encontrados por el camino, ambos reales:**

1. **El inspector se quedaba con los datos de la trama anterior** cuando el canal se vaciaba: el
   tipo, la secuencia y el CRC seguían en pantalla como si hubiera algo volando. Ahora se limpian.
2. **Una probabilidad imposible se aceptaba en silencio** si el ruido estaba apagado, y solo
   reventaba al encender el interruptor. Ahora los valores del formulario se validan siempre, y
   lo que depende del interruptor es únicamente si se aplican.

**Evidencia:** 86 pruebas verdes —tres nuevas exigen que el desarrollo del CRC llegue exactamente
al mismo valor que el cálculo directo, que los ocho desplazamientos de cada byte estén encadenados
y que dañar la carga rompa la coincidencia—; banco de interfaz **54 comprobaciones, 0 problemas**,
repetible en dos pasadas.

**Cómo revertir:** `git revert` de este commit. Las tres cosas son independientes.

**Lección:** dos de las tres peticiones se resolvían enseñando mejor lo que ya había. Antes de
construir, mirar si el problema es de función o de comunicación — y aquí era de comunicación en
dos de tres.

---

## 2026-09-07 — Pruebas hostiles: tres fallos reales del motor y un banco de interfaz

**Qué:** se intentó romper el simulador a propósito, en dos frentes.

- **`tests/bordes.test.js`** (nuevo, 35 pruebas): valores extremos y usos absurdos — distancia
  cero, enlace a 1 Tbit/s, trama de mil millones de bits, diez saltos, ACK mayor que la trama,
  probabilidad de error 1, texto donde va un número, pasos de tiempo de 10 segundos, timeouts
  imposibles, destruir dos veces, reiniciar en mitad del vuelo, pausar y continuar en bucle.
- **`banco-interfaz.html`** (nuevo): maneja el simulador y la calculadora en dos iframes como lo
  haría una persona y comprueba lo que queda en pantalla. **42 comprobaciones, 0 problemas.**

**Tres fallos reales encontrados y corregidos, todos en `sim.js`:**

1. **Un paso de tiempo grande se comía sucesos.** Al llegar un paquete a un nodo se descartaba el
   tiempo sobrante del paso, así que un delta grande procesaba como mucho una llegada. Con
   `advance(10000)` la simulación entregaba una trama de dos y dejaba otra colgada. Ahora el
   delta se parte en tramos que terminan justo en el siguiente suceso: un paso grande da
   exactamente el mismo resultado que muchos pequeños, y hay una prueba que compara pasos de
   0,1 · 0,5 · 1 y 5 ms. **No era teórico:** la animación usa deltas de hasta 80 ms.
2. **El diagrama crecía sin límite.** El recorte a 600 eventos vivía dentro de `emitEvent`, pero
   los timeouts y las inversiones del medio se añadían por su cuenta. Con un timeout de 1 ms se
   acumulaban **3000 eventos**. Ahora todos pasan por `pushEvent`, que es el único sitio que
   añade y el único que recorta.
3. **«Un paso» no servía antes de arrancar.** Desde parado no hacía nada útil. Ahora el primer
   paso arranca la simulación y la deja en pausa, que es lo que se espera de un botón así.

**Dos expectativas mías que estaban mal, y se corrigieron en la prueba, no en el código:** con un
timeout menor que el tiempo de transmisión no puede haber duplicados —la trama no llega nunca— y
el estado tras un timeout no se queda en `TIMEOUT`, porque el reintento sale inmediatamente.

**Evidencia:** 83 pruebas verdes; banco de interfaz 42/42 en dos pasadas seguidas; lint de
documentación limpio.

**Cómo revertir:** `git revert` de este commit. Los arreglos de `sim.js` son independientes entre
sí.

**Lección:** la primera versión del banco daba resultados distintos en cada pasada porque esperaba
un tiempo fijo a que cargaran los iframes. Una prueba que a veces pasa es peor que no tenerla: se
cambió por esperar a que la interfaz esté montada de verdad. Y el fallo del paso de tiempo llevaba
ahí desde el principio, con toda la suite en verde: ninguna prueba usaba pasos grandes porque
todas imitaban la animación.

---

## 2026-09-07 — Paso 4 cerrado: la documentación pasa a comprobarse con una máquina

**Qué:**

- **`Q-02` rechazado por escrito.** Un linter y un formateador de código exigen tooling y
  contradicen la regla de cero dependencias, que es la que permite abrir el trabajo sin instalar
  nada. No se hace, y queda dicho por qué.
- **`tools/lint-docs.js`** (nuevo, sin dependencias): comprueba enlaces rotos, rutas citadas que
  no existen, citas del tipo `archivo.js:NN` y el conteo de pruebas.
- **Fuente única del conteo:** el número de pruebas vive solo en `05-runbook.md`. Los demás
  documentos lo enlazan, y el lint compara ese número con las pruebas que hay de verdad en el
  repositorio, contando las llamadas a `test(`.
- **Doce citas por número de línea convertidas en nombres de función** en `01`, `04` y `05`.

**Por qué:** el modo de fallo real de este repositorio no es que el código se rompa —hay pruebas—
sino que la documentación mienta. El conteo «pruebas» estaba escrito a mano en cuatro sitios y
las citas por línea se pudren en la siguiente edición. Sin una máquina que lo compruebe, esas
reglas eran intenciones.

**Evidencia:**

- Con la documentación real: **15 documentos revisados, sin problemas**, y 48 pruebas contadas
  en el repositorio, que es lo que declara el runbook.
- Con una ruta inventada y un conteo falso metidos a propósito: **2 problemas y salida 1**.
- El propio lint encontró **26 problemas la primera vez que se ejecutó**, todos reales.

**Cómo revertir:** `git revert` de este commit. El lint es un archivo aparte; quitarlo del
runbook basta para dejar de ejecutarlo.

**Lección, y es incómoda:** de los cuatro documentos con el conteo repetido, **ninguno mentía
todavía**. Por eso el problema era invisible: no era un error, era una trampa esperando a la
siguiente edición. Y al revés, el lint tuvo que aprender a **no** comprobar los documentos
fechados: un spec que cita un archivo ya borrado no está mintiendo, está describiendo su momento.
Corregirlo habría falsificado el archivo.

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
