# 01 — Arquitectura

Estado técnico al **2026-09-07**. Describe lo que hay, no lo que debería haber.

> Desde el 2026-09-07 hay **dos proyectos web**: el simulador animado (`simulador_stop_and_wait_web/`,
> v1) y el nuevo motor con calculadora (`simulador_stop_and_wait_v2/`). El trabajo nuevo va al v2;
> el v1 sigue entregable y se integrará contra el motor del v2. Ver
> [el plan](superpowers/plans/2026-09-07-motor-multisalto.md).

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

**Consecuencia práctica (decisión del 2026-09-07):** el trabajo se hace **solo sobre la versión
web**; es la que se entrega y se demuestra. La versión Tkinter queda **congelada**: sirve de
referencia y de cantera —se puede leer y copiar de ahí una idea o un fragmento hacia la web—
pero no se modifica ni se mantiene sincronizada. Un cambio en la web **no** obliga a tocar
Python. Si algo de Python hiciera falta y no estuviera en la web, se porta a la web.

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
| `js/network.js` | **Dueño único de las fórmulas.** Sin DOM, exportable con UMD: el navegador lo ve como `window.NetworkModel` y Node lo carga con `require` |
| `js/calc.js` | Interfaz: lee los controles, llama a `analyze()` y pinta. **No calcula nada** |
| `tests/network.test.js` | 15 pruebas con el runner nativo de Node |

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

## Lo que el v2 todavía no tiene

Animación (sigue en el v1), dibujo de la cadena de nodos, y la integración de ambos. Es el
trabajo de las tareas 4 y 5 del plan.
