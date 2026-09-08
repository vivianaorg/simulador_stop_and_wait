# 01 — Arquitectura

Estado técnico al **2026-09-07**. Describe lo que hay, no lo que debería haber.

> **Tres carpetas, un solo proyecto vivo** (decisión del 2026-09-07):
> `simulador_stop_and_wait_v2/` es lo que se desarrolla y se entrega;
> `simulador_stop_and_wait_web/` y `simulador_stop_and_wait_python/` son el **trabajo de partida
> del grupo** y **se conservan como registro, sin mantenerse**. Conservar no es mantener: no se
> les añaden funciones, no se les escriben pruebas y sus fallos conocidos no se corrigen.
> El v2 no depende de ellas ni las enlaza (comprobado el 2026-09-07).

## Stack y decisión de fondo

| | Web (`simulador_stop_and_wait_web/`) | Escritorio (`simulador_stop_and_wait_python/`) |
|---|---|---|
| Lenguaje | JavaScript ES2015+ (clases, getters), sin módulos ES | Python 3.13 |
| UI | HTML + CSS propio + `<canvas>` 2D | Tkinter + `ttk` + `Canvas` |
| Dependencias | **ninguna** | **ninguna** (solo stdlib) |
| Build | **ninguno**: se sirve la carpeta tal cual | ninguno: `python main.py` |
| Carga | `index.html` incluye `js/protocol.js` y `js/app.js` con `<script>`; ambos definen clases en el ámbito global | `main.py` inserta su directorio en `sys.path` e importa `gui` |

**Por qué sin build ni dependencias:** es un trabajo académico que debe poder abrirse y correrse
en la máquina de quien lo evalúa, sin instalar nada. Agregar npm, un bundler o un paquete pip
rompe ese requisito. Es una regla dura, no una preferencia.

## Separación de responsabilidades

Ambas versiones usan la misma partición:

- **Modelo** — la clase `StopAndWaitProtocol`, en `js/protocol.js` y en `protocol.py`
  (esta última con `Packet` al lado).
  Dueño único de: número de secuencia (`seqNum` / `seq_num`, alterna 0↔1 con `nextSeq()`),
  secuencia esperada por el receptor (`rxExpectedSeq`), estado
  (`IDLE`, `TRANSMITTING`, `WAITING_ACK`, `TIMEOUT`, `FINISHED`), contadores de telemetría
  (`framesSent`, `acksReceived`, `framesLost`, `acksLost`, `retransmissions`) y las magnitudes
  derivadas expuestas como getters/propiedades: `totalLost`, `efficiency`, `elapsedTime`.
- **Vista y orquestación** — la clase `SimulatorApp` en `js/app.js` y `SimulatorGUI` en
  `gui.py`. Dibujan, animan, escuchan botones y **leen** el
  modelo. No recalculan reglas del protocolo.

**Regla:** un concepto derivado tiene un solo dueño. La eficiencia se lee de
`protocol.efficiency`; nadie la vuelve a calcular en la UI.

## El modelo del protocolo, en concreto

- Ventana de 1: hay como mucho un paquete en vuelo (`activePacket` / `active_packet`).
- El emisor manda `FRAME` con `seq`; el receptor acepta si coincide con `rxExpectedSeq`,
  incrementa `rxReceivedCount` y responde `ACK`. Un duplicado se descarta sin contarlo.
- **Temporizador de retransmisión:** en la web corre *siempre* desde que sale una trama hasta
  que llega su ACK o expira (`timerActive`), como en el protocolo real. `isWaitingTimeout` es
  otra cosa: marca que hubo una **pérdida explícita** provocada por el usuario, y solo controla
  el aviso de "tiempo infinito" y la etiqueta de estado. Están comentados en
  el constructor de `StopAndWaitProtocol`, junto a la declaración de ambos campos; confundirlos
  es el error fácil de este archivo.
- `efficiency` = `currentFrameIdx / framesSent · 100`: tramas entregadas sobre transmisiones
  totales. Devuelve `100.0` cuando aún no se envió nada.

## Divergencia deliberada entre las dos versiones

La versión web es la que se siguió desarrollando. **Solo la web** tiene:

| Feature | Dónde |
|---|---|
| Parámetros físicos del enlace editables: `linkFrameBits` (L), `linkRateBps` (R), `linkDistanceKm` (D), `linkVelocityKmS` (V) | constructor de `StopAndWaitProtocol` |
| Tiempos y utilización teóricos: `transmissionTimeMs` (Tt), `propagationTimeMs` (Tp), `aRatio` (a = Tp/Tt), `utilization` (U = 1/(1+2a)), `idlePercent` | getters de `StopAndWaitProtocol` |
| **ACK retrasado** (`delayAck`) y su contador `lateAcks`, con paquete que viaja aparte (`delayedPacket`) | `delayAck()` |
| Tema claro/oscuro persistido, cola de alertas modales, canvas responsivo | `_initTheme()`, `_alert()`, `_setupCanvasResize()` |

La versión Tkinter cubre el núcleo: enviar, perder trama (`kill_frame`), perder ACK
(`kill_ack`), timeout y retransmisión, telemetría básica.
Los parámetros del enlace **no se reinician** con `resetStats()` en la web: son configuración,
no estado del run.

**Consecuencia práctica:** ninguna de las dos se mantiene ya. Lo escrito arriba describe cómo
quedaron el 2026-09-07 y por qué divergían; sirve para leerlas, no para seguir trabajándolas.

**Fallos conocidos que no se van a corregir**, anotados aquí porque el `README` los cita y porque
son parte del registro: el v1 reanuda la simulación tras cerrar una alerta aunque el usuario
hubiera pausado (alcanzable con el teclado, no con el ratón); ignora en silencio los parámetros
de enlace inválidos en vez de avisar; reconstruye la lista de tramas entera en cada actualización
de telemetría; y su estado `WAITING_ACK` solo se asigna cuando hay una pérdida explícita, no
cuando el emisor está realmente esperando. La versión Tkinter no tiene pruebas.

## Estructura de archivos

```
simulador_stop_and_wait_web/
  index.html      # marcado + iconos SVG inline; los controles se referencian por id
  css/style.css   # estilos propios, variables CSS para el tema
  js/protocol.js  # modelo
  js/app.js       # Simulator: DOM, canvas, animación, partículas, toasts
simulador_stop_and_wait_python/
  main.py         # entrypoint Tk
  gui.py          # SimulatorGUI + ToastNotification + ParticleSystem
  protocol.py     # modelo + Packet
```

`app.js` cachea el DOM en `_cacheDom()`: al agregar un control en
`index.html` hay que darle `id` y registrarlo ahí, o queda `undefined` en silencio.


---

# v2 — motor de camino multi-salto y calculadora

`simulador_stop_and_wait_v2/`. Sitio estático: **sin build, sin dependencias, sin base de datos
y sin login**. Diseño completo en
[superpowers/specs/2026-09-07-motor-multisalto-design.md](superpowers/specs/2026-09-07-motor-multisalto-design.md).

## Separación

| Archivo | Rol |
|---|---|
| `js/frame.js` | Tramas y **CRC-16/CCITT-FALSE**. Voltear bits, recalcular el CRC, generador con semilla |
| `js/network.js` | **Dueño de las fórmulas**: tiempos, utilización, probabilidades del camino |
| `js/sim.js` | **Máquina de estados del protocolo** con tiempo simulado explícito (`advance(dtMs)`) |
| `js/ui.js` | Interfaz del simulador: diagrama, cadena, inspector. **No decide nada del protocolo** |
| `js/steps.js` | **Desarrollo paso a paso como datos**: cada paso es `{titulo, formula, sustitucion, resultado, detalle[]}`, no un párrafo de texto |
| `js/calc.js` | Interfaz de la calculadora: bloques, despliegue progresivo y las dos gráficas |
| `tests/` | Las pruebas de los tres modelos, con el runner nativo de Node. El conteo vive en [05-runbook.md](05-runbook.md) |

Los tres modelos usan el mismo envoltorio UMD: el navegador los ve como `window.FrameModel`,
`window.NetworkModel` y `window.SimModel`, y Node los carga con `require`. Por eso las mismas
reglas que corren en pantalla son las que se prueban.

## Las dos páginas

`index.html` es **el simulador** y es la portada. `calculadora.html` tiene los mismos cálculos
sin animación. La calculadora dejó de ser la portada el 2026-09-07: el trabajo pedido es el
simulador.

## Modelo

Un camino es una **cadena de N enlaces en serie** con store-and-forward: cada nodo intermedio
recibe la trama entera antes de reenviarla, así que paga `Tt` otra vez. Un enlace suelto es
simplemente una cadena de 1, así que el caso del libro y el multi-salto comparten código.

```
ciclo = (Σ Tt + Σ Tp + proceso) + (Σ Tt_ack + Σ Tp + proceso) + (half duplex ? 2·Σ turnaround : 0)
U     = Tt(emisor) / ciclo          a = Σ Tp / Σ Tt
```

Con un salto y ACK despreciable esto se reduce **exactamente** a `U = 1/(1+2a)`; hay una prueba
que lo comprueba con tolerancia `1e-12`, así que no puede divergir sin que falle el pipeline.

## Modos de canal

`network.js` expone `DUPLEX.HALF` y `DUPLEX.FULL` en su objeto `DUPLEX`, y **no** un modo "simplex": simplex es el
sentido del tráfico de datos, no un modo de canal. El motivo, con las citas del libro, está en el
spec. Half duplex suma el tiempo de vuelta del medio **dos veces por ciclo** y deja el RTT intacto.

## Errores

Cada tramo tiene `errorProbData` y `errorProbAck` independientes. Se componen:
`P(éxito) = Π(1−P_datos_i) · Π(1−P_ack_i)`. De ahí salen la utilización efectiva `U·(1−P)`, las
transmisiones esperadas `1/(1−P)` y el caudal útil. El emisor **no distingue** si se perdió la
trama o el ACK: hay una prueba que lo fija.

## El diagrama tiempo-espacio

Es la pieza principal, y es deliberado: el simulador v1 animaba un paquete que iba, volvía y
**se borraba**, así que al terminar no quedaba rastro de lo ocurrido. El diagrama acumula la
historia y produce en pantalla la misma figura con la que el libro explica el protocolo
(trama, ACK, timeout, duplicada). El tiempo baja; cada vertical es un punto del camino.

Referencia de la forma: los *bounce diagrams* de las herramientas de traza y el visualizador de
actividad de ruta de OMNeT++/INET, que dibuja polilíneas de origen a destino **atravesando los
nodos intermedios**.

## Detección de errores

Real, no simulada con una bandera. El emisor calcula el CRC y lo mete en la trama; el receptor
**recalcula** el suyo y compara (`frame.js`, `isIntact`). Voltear un bit desde el inspector hace
que el CRC deje de cuadrar por sí solo. Hay una prueba que voltea **cada uno** de los 80 bits y
exige que todos se detecten.

Dos comportamientos, con interruptor:

| NAK | Qué pasa | De dónde sale |
|---|---|---|
| Apagado | El receptor descarta en silencio; el emisor se entera al expirar el temporizador | Protocolo 3 de Tanenbaum |
| Encendido | El receptor manda NAK y el emisor retransmite sin esperar | Variante ARQ con NAK |

## Un solo tamaño de trama

Hasta el 2026-09-07 había dos tamaños de trama que no se hablaban: `frameBits` (el que escribe
el usuario, que solo alimentaba los tiempos `Tt`/`Tp`/`a`) y la trama real que construye
`createFrame` en `frame.js`, con `payloadBytes` fijo a 8 (80 bits siempre, viniera lo que
viniera en el formulario). Ahora **`frameBits` manda**: la interfaz deriva la carga con
`payloadBytesFor(frameBits)` y ya no pasa `payloadBytes` a mano (`js/ui.js`, `js/sim.js`).

Como el CRC son 16 bits fijos (`CRC_BITS`), no todo valor de `frameBits` es representable: hace
falta que la carga quede en bytes enteros. `roundFrameBits(frameBits)` ajusta al múltiplo válido
más cercano y la interfaz **avisa** del ajuste en vez de rechazar el valor o mentir sobre qué
calculó.

**El redondeo es del simulador, no de la calculadora, y esa asimetría es deliberada.** El
redondeo es una restricción de la trama *real*: la que construye `createFrame`, con la carga en
bytes enteros más los 16 bits del CRC. El simulador no tiene más remedio que aplicarlo porque
construye tramas y las dibuja. La calculadora **no construye ninguna**: solo calcula tiempos, y
`Tt = L / R` funciona igual de bien con L = 500 que con L = 504. Imponerle ahí el redondeo
rompía el ejemplo de LAN del libro —10 Mbps, 1 km, tramas de 500 bits, a = 0,1 y U = 83,33 %—,
que es un número publicado contra el que está probado el proyecto: con 504 sale 0,0992 y
83,44 %.

Lo que sí hace la calculadora es **decirlo**: cuando el tamaño no es construible, una nota bajo
los datos (`notaDeTramaReal` en `js/calc.js`) avisa de qué tamaño usaría el simulador. Es una
nota sobre la otra página, no un aviso de validación: no cambia ningún resultado y no se pinta
como los errores. La prueba «El ejemplo de LAN llega al desarrollo del libro» en
`tests/steps.test.js` recorre la misma cadena que la calculadora (`Steps.build` sobre un enlace
con `frameBits: 500`) y se pone roja si alguien vuelve a meter un redondeo por encima del modelo.

Por lo mismo, el `min` del campo difiere entre las dos páginas y no es un descuido: en
`index.html` es `24` (`F.MIN_FRAME_BITS`, que `js/ui.js` reescribe desde el modelo) porque el
simulador necesita una trama construible; en `calculadora.html` es `1`, porque la única
restricción de la fórmula es L > 0.

Consecuencia visible: la tira de bits de la trama en vuelo ahora refleja de verdad el tamaño que
se pidió (hasta miles de bits, no 80 fijos), lo que hace falta para que una ráfaga medida en
milisegundos tenga trama real donde morder.

## El ruido por probabilidad existe en el modelo, pero la interfaz no lo enciende

Dos formas de dañar una trama en el modelo, y conviene no confundirlas:

| | Cómo | Para qué |
|---|---|---|
| **A mano** | Pulsar cualquier bit del inspector, o el botón *Dañar un bit al azar* | Enseñar el caso exacto que quieres, cuando quieres |
| **Ruido del canal** | `errorProbData`/`errorProbAck` de cada tramo, en `network.js` | Ver el comportamiento a lo largo de muchos ciclos |

El interruptor *Ruido del canal*, el campo de semilla y las columnas de probabilidad por tramo se
quitaron de `index.html` (2026-09-08): en un aula, «puede que pase» no sirve para explicar. El
modelo no se tocó —`applyChannelNoise` en `sim.js`, `errorProbData`/`errorProbAck` en
`network.js` y `seededRandom` en `frame.js` siguen intactos, con sus pruebas— pero `ui.js` ya no
tiene forma de ponerlos por encima de 0: `rebuild()` construye cada tramo sin pasar esos
parámetros, así que `createLink()` los da por 0 igual que antes hacía el interruptor apagado.
Quien quiera esa probabilidad tiene que llamar al modelo directamente, no desde el formulario.
Cómo revertirlo, en `docs/07-historial.md` (entrada del 2026-09-08).

El botón *Dañar un bit al azar* no depende de esto: **no es probabilístico** —el bit se voltea
siempre, solo el índice es aleatorio— y sigue usando el generador con semilla de `frame.js`. Sin
campo de formulario que la fije, `ui.js` le pasa una semilla constante (`SEMILLA_BIT_AL_AZAR`).

## El CRC, paso a paso

El inspector despliega cómo se llega al CRC de la trama que está en el canal: el polinomio, el
registro inicial, una fila por byte de la carga con el registro antes y después, y —al desplegar
una fila— los ocho desplazamientos de ese byte, diciendo en cada uno si salió un uno por la
izquierda y por tanto tocó aplicar el polinomio.

Termina con el veredicto: qué calcula el receptor, qué trae la trama, y si por tanto la acepta o
la descarta. Al dañar un bit, el veredicto cambia solo.

El desarrollo lo produce `crc16Trace()`, que **no** es quien calcula el CRC de verdad: hay una
prueba que exige que ambos lleguen al mismo valor, para que la explicación no pueda desviarse del
cálculo.

## Alterar la trama en vuelo

Con la simulación en pausa (o en marcha, si se prefiere) el inspector permite: voltear cualquier
bit —incluidos los del CRC—, forzar el número de secuencia, destruir la trama o retrasarla. Cada
acción tiene su prueba en `tests/sim.test.js`, así que lo que se enseña en clase es lo que el
motor hace de verdad.

## Estética

Plana a propósito: sin degradados, sin sombras y sin brillos. Un borde de 1 px separa las zonas
y el color **solo significa** — verde trama aceptada, azul confirmación, ámbar espera, rojo
error. Los números van en monoespaciada de ancho tabular para que no bailen al actualizarse.

## Half duplex en la animación

El selector *Canal* del simulador cambia el modo, y cada tramo tiene su **tiempo de vuelta del
medio**. En half duplex el medio va en un sentido a la vez: antes de que salga el ACK, y antes de
la siguiente trama, hay que invertirlo. Esa espera se paga **antes** de empezar a transmitir, no
durante el viaje, y aparece en el diagrama como un tramo vertical grueso sobre la línea del
punto. La primera trama no la paga: el medio ya está en su sentido.

Consecuencia que conviene enseñar: **el RTT no cambia** por ser half duplex; lo que crece es el
ciclo. Hay una prueba que lo fija.

## La ráfaga de ruido, determinista

Distinta del ruido por probabilidad: no se tira, ocurre siempre igual. Se dispara a mano
(*Ráfaga de ruido*, con su campo en milisegundos) y no necesita trama seleccionada —es del
canal, no de una trama concreta. Mientras dura, cada paquete en vuelo pierde un tramo **contiguo**
de bits (`F.flipRun` voltea el tramo).

Los bits que arruina se calculan **una sola vez**, al dispararla (`startBurst` en `js/sim.js`,
con `N.burstBitsFromMs` y la tasa del primer tramo), y se gastan a medida que corre el reloj.
Convertir a bits el `dt` de cada tramo parecía equivalente y no lo era: `burstBitsFromMs` trunca
a bits enteros, así que trocear el reloj tiraba una fracción en cada tramo y el total se movía
con el control de velocidad —48 bits en la calculadora, 45 con tramos de 1 ms y 40 con tramos de
0,25 ms a 9600 bps—. Con el presupuesto fijado de entrada, el total es siempre el que publica la
calculadora, se trocee como se trocee.

La ventana es **una sola** aunque haya varios paquetes en el cable: son los mismos milisegundos
de medio sucio, así que el contador suma una vez y cada paquete recibe la misma tirada de bits,
en vez de repartirse el presupuesto o multiplicarlo. Un paquete que no ocupa bits en el cable
—el ACK de duración despreciable, `ackBits = 0`— no lo alcanza: una ventana de tiempo no puede
morder algo que no está en el medio. No usa ningún generador: la conversión `bits = R · t` es
análisis dimensional, no una fórmula del libro (Tanenbaum mide las ráfagas en bits, no en tiempo).

Lo que sí es del libro, y es lo que hace demostrable el límite del CRC: un código con `r` bits de
verificación detecta **todas** las ráfagas de longitud ≤ r; una ráfaga de `r + 1` solo pasa
desapercibida si reproduce exactamente `G(x)`. Con CRC-16/CCITT eso es `r = 16` y, en forma
completa (los 17 bits, con el término x¹⁶ explícito), `G(x) = 0x11021`. `frame.js` usa la forma
**truncada** `0x1021` (`POLYNOMIAL`, 16 bits) porque el algoritmo ya deja ese término implícito;
son el mismo polinomio, escrito de dos formas, y solo la completa tiene los 17 bits de la
ráfaga que se cuela. Hay pruebas contra ambos hechos en `tests/frame.test.js`.

La ventana viaja como un suceso más del reloj de la simulación (`kind: "BURST"`, igual que
`TURN` y `TIMEOUT`) y se dibuja en el diagrama como una banda horizontal; el contador *Bits
arruinados por ráfaga* sube mientras dura. El mecanismo por el que la ventana se cierra en el
instante correcto —y el riesgo de tocarlo mal— está descrito en `docs/07-historial.md` (entrada
del 2026-09-07, «La ráfaga de ruido entra en el reloj del simulador»): no se repite aquí para no
duplicar la misma explicación en dos archivos.

## La tira de bits siempre pinta bits, agrupados visualmente por byte

`renderInspector` en `js/ui.js` pinta un cuadradito por bit, siempre — con 24 o con 1000. Se
probó agrupar por byte en hexadecimal por encima de un umbral (`BITS_MAX_INDIVIDUALES`) para que
mil cuadraditos no fueran ilegibles, pero eso convertía la tira de bits en una tira de bytes: la
vista existe para señalar bits volteados y seguir el CRC bit a bit, y el hexadecimal escondía
justo eso. El umbral se quitó (2026-09-08): la tira de bits `.bits` es una rejilla CSS de 16
columnas fija (`grid-template-columns: repeat(16, 1fr)` en `style.css`), así que cada fila son
exactamente dos bytes y la trama por defecto de 1000 bits cae en 63 filas dentro de un panel que
ya scrollea verticalmente. Cada casilla marca si abre un byte (`data-byte-start`) y `style.css`
le pone un borde izquierdo más grueso: la carga y el CRC se leen en bloques de ocho sin dejar de
ser bits. El CRC se sigue marcando igual que antes: los últimos `CRC_BITS` bits, en azul — con
`CRC_BITS = 16`, la última fila entera.

## Transferencia y ráfaga en la calculadora

Dos bloques nuevos en `calculadora.html`, con el mismo patrón que los demás: `steps.js` produce
la estructura, `calc.js` solo pinta.

- **Transferencia** (`N.transferAnalysis`): a partir de un tamaño total (bits, KB o MB
  decimales, vía `N.bitsFromSize`) y el tamaño de trama del camino, da el número de tramas
  (`⌈total / L⌉`) y el tiempo total (`N × ciclo`), sin contar reenvíos.
- **Ráfaga** (`N.burstDamage`): a partir de una duración en milisegundos da los bits arruinados
  (`N.burstBitsFromMs`) y cuántas tramas abarca.

El ciclo que enseña el bloque de transferencia lo devuelve `N.transferAnalysis` (`cycleMs`), no
se reconstruye dividiendo el total entre las tramas: `steps.js` no calcula. Los dos bloques se
ocultan mientras su campo esté vacío o en cero, para no enseñar una sección vacía.

## Mirar hacia atrás en el diagrama

La rueda del ratón sobre el diagrama desplaza la ventana visible hacia el pasado y aparece un
aviso con el instante que se está mirando; doble clic vuelve al presente. Sin esto, la historia
salía de pantalla justo cuando servía para explicar lo ocurrido.

## Lo que el v2 todavía no tiene

Piggybacking, ventana deslizante, exportar el diagrama y guardar escenarios: **ninguno está
pendiente**, están fuera de alcance por decisión.


## La calculadora, por bloques

Rehecha el 2026-09-07 siguiendo cómo presentan los resolutores el proceso, no solo el resultado.
Antes era un `<pre>` con el desarrollo pegado; ahora son datos que la interfaz decide cómo
enseñar.

| Bloque | Qué contiene |
|---|---|
| Datos | Los controles: trama, canal y los tramos del camino |
| Cómo se han leído los datos | Confirma la interpretación antes de dar ningún número |
| Resultado | El titular, con la utilización en grande, y la barra de reparto del ciclo |
| Desarrollo | Un paso por bloque: fórmula → sustitución → resultado, con detalle plegado |
| Dónde cae este enlace | La curva `U = 1/(1+2a)` con este enlace marcado, y la misma información en tabla |

Dos reglas tomadas de Wolfram|Alpha, con su motivo declarado —*"keeping the step-by-step
solutions readable, while still providing all relevant information"*—: se puede avanzar **de un
paso a la vez**, y **solo hay un detalle abierto**; abrir otro cierra el anterior.

`steps.js` no sabe nada de la pantalla: devuelve la estructura y `calc.js` la pinta. Por eso las
pruebas comprueban cada número por separado (`porId(s, "u").resultado === "3,846 %"`) en vez de
buscar dentro de un bloque de texto.

## Las dos gráficas

Hechas a mano sobre canvas, sin librerías. Los acentos (`--chart-1`, `--chart-2`) se eligieron
con el validador del skill de dataviz, no a ojo: la pareja verde + ámbar que parecía natural
**falla** la separación para daltonismo protán (ΔE 5,7), y en modo oscuro los tonos aclarados se
salen de la banda de luminosidad. Por eso el modo oscuro tiene sus propios valores en vez de un
aclarado automático.

- **Reparto del ciclo**: una sola magnitud sobre una pista neutra, con etiquetas directas. No son
  dos categorías compitiendo, así que no necesita un segundo color.
- **Curva de utilización**: serie única, eje de `a` logarítmico de 0,01 a 1000, el punto de este
  enlace con anillo del color del fondo, cruz de puntero al pasar el ratón y **tabla equivalente
  debajo**: la gráfica no puede ser el único camino al dato.