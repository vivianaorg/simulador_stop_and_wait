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

- **Modelo** — `js/protocol.js:4` (`StopAndWaitProtocol`) · `protocol.py:16`
  (`StopAndWaitProtocol`, más `Packet` en `protocol.py:4`).
  Dueño único de: número de secuencia (`seqNum` / `seq_num`, alterna 0↔1 con `nextSeq()`),
  secuencia esperada por el receptor (`rxExpectedSeq`), estado
  (`IDLE`, `TRANSMITTING`, `WAITING_ACK`, `TIMEOUT`, `FINISHED`), contadores de telemetría
  (`framesSent`, `acksReceived`, `framesLost`, `acksLost`, `retransmissions`) y las magnitudes
  derivadas expuestas como getters/propiedades: `totalLost`, `efficiency`, `elapsedTime`.
- **Vista y orquestación** — `js/app.js` (clase `SimulatorApp`, `js/app.js:98`) ·
  `gui.py` (`SimulatorGUI`, `gui.py:105`). Dibujan, animan, escuchan botones y **leen** el
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
  `js/protocol.js:13-21`; confundirlos es el error fácil de este archivo.
- `efficiency` = `currentFrameIdx / framesSent · 100`: tramas entregadas sobre transmisiones
  totales. Devuelve `100.0` cuando aún no se envió nada.

## Divergencia deliberada entre las dos versiones

La versión web es la que se siguió desarrollando. **Solo la web** tiene:

| Feature | Dónde |
|---|---|
| Parámetros físicos del enlace editables: `linkFrameBits` (L), `linkRateBps` (R), `linkDistanceKm` (D), `linkVelocityKmS` (V) | `js/protocol.js:43-46` |
| Tiempos y utilización teóricos: `transmissionTimeMs` (Tt), `propagationTimeMs` (Tp), `aRatio` (a = Tp/Tt), `utilization` (U = 1/(1+2a)), `idlePercent` | `js/protocol.js:55-84` |
| **ACK retrasado** (`delayAck`) y su contador `lateAcks`, con paquete que viaja aparte (`delayedPacket`) | `js/app.js:722` |
| Tema claro/oscuro persistido, cola de alertas modales, canvas responsivo | `js/app.js:281`, `:369`, `:304` |

La versión Tkinter cubre el núcleo: enviar, perder trama (`kill_frame`, `gui.py:616`),
perder ACK (`kill_ack`, `gui.py:638`), timeout y retransmisión, telemetría básica.
Los parámetros del enlace **no se reinician** con `resetStats()` en la web: son configuración,
no estado del run (`js/protocol.js:42`).

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

`app.js` cachea el DOM en `_cacheDom()` (`js/app.js:141`): al agregar un control en
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
| `tests/` | 43 pruebas con el runner nativo de Node |

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

`network.js:29` expone `DUPLEX.HALF` y `DUPLEX.FULL`, y **no** un modo "simplex": simplex es el
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

## Alterar la trama en vuelo

Con la simulación en pausa (o en marcha, si se prefiere) el inspector permite: voltear cualquier
bit —incluidos los del CRC—, forzar el número de secuencia, destruir la trama o retrasarla. Cada
acción tiene su prueba en `tests/sim.test.js`, así que lo que se enseña en clase es lo que el
motor hace de verdad.

## Estética

Plana a propósito: sin degradados, sin sombras y sin brillos. Un borde de 1 px separa las zonas
y el color **solo significa** — verde trama aceptada, azul confirmación, ámbar espera, rojo
error. Los números van en monoespaciada de ancho tabular para que no bailen al actualizarse.

## Lo que el v2 todavía no tiene

Modos de canal half/full duplex dentro de la animación (el cálculo sí los tiene), y la
integración del simulador v1, que sigue existiendo aparte.


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