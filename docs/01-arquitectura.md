# 01 — Arquitectura

Estado técnico al **2026-09-07**. Describe lo que hay, no lo que debería haber.

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
