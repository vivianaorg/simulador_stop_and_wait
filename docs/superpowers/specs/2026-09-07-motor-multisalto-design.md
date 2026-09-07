# Spec — Motor de camino multi-salto y calculadora Stop & Wait

Fecha: 2026-09-07 · Estado: **aprobado, tarea 1 implementada**

## Problema

El simulador v1 modela **un solo enlace** y solo el Protocolo 3 (PAR) de Tanenbaum. Se pide:

- Precisión verificable contra el libro.
- Camino de **N saltos** (casa → satélite → casa), con distancia, tasa y velocidad por tramo.
- Modo **calculadora**: tiempos, utilización, caudal, con el desarrollo paso a paso.
- **Modos de canal** y **probabilidad de error** por tramo.
- Tamaño de trama configurable.

## Decisiones tomadas (con quién y por qué)

| Decisión | Motivo |
|---|---|
| **Cadena de N saltos en serie**, no grafo libre ni sesiones paralelas | Es lo que reproduce el caso "casa → satélite → casa" y es lo abordable antes del 2026-09-09 |
| **Solo Stop & Wait.** Sin Go-Back-N ni Selective Repeat | Fuera del alcance de la asignatura (decisión del usuario, 2026-09-07) |
| **Precisión por encima de features** | Cada fórmula de la interfaz tiene una prueba con un número publicado. Si no se puede verificar, no entra |
| **Proyecto nuevo en `simulador_stop_and_wait_v2/`**, sin tocar el v1 | Red de seguridad: si el v2 no llega a tiempo, el v1 sigue siendo entregable |
| **Sin base de datos, sin login, sin backend** | Petición explícita del usuario. Sitio estático puro |

## Simplex, half duplex y full duplex — lo que dice el libro

Se verificó la redacción de Tanenbaum antes de diseñar el selector, porque la
terminología se presta a error:

- El tráfico de datos es **simplex** (solo A→B): de ahí el nombre del Protocolo 2/3.
- El canal, en cambio, **debe ser bidireccional** para que vuelva el ACK. Textual:
  *"Although data traffic in this example is simplex … frames do travel in both directions"* y
  *"A half-duplex physical channel would suffice here"*.
- **Duplex no es un tercer modo**: es el paraguas de *half* y *full*. Los tres modos de
  transmisión son simplex · half duplex · full duplex.
- El **full duplex con piggybacking** es el Protocolo 4, que el libro cataloga bajo
  *sliding window* (ventana de 1 bit). Su mecanismo es Stop & Wait, pero **la etiqueta del
  libro lo pone en el capítulo excluido**, así que el piggybacking queda como extra opcional
  y declarado, nunca como base del trabajo.

Consecuencia de diseño: el modelo expone **dos modos de canal** (`half`, `full`) y trata
"simplex" como lo que es, el sentido del tráfico de datos.

## Modelo

```
Link { rateBps, distanceKm, velocityKmS, errorProbData, errorProbAck, turnaroundMs }
Path { frameBits, ackBits, links[], duplexMode, processingMsPerHop }
```

Store-and-forward: cada nodo intermedio recibe la trama entera antes de reenviarla,
así que paga `Tt` otra vez.

```
Tt_i    = L / R_i                 Tp_i = d_i / V_i
ida     = Σ Tt_i + Σ Tp_i + procesamiento
vuelta  = Σ Tt(ACK)_i + Σ Tp_i + procesamiento
RTT     = ida + vuelta
ciclo   = RTT + (half duplex ? 2 × Σ turnaround_i : 0)
a       = Σ Tp_i / Σ Tt_i
U       = Tt(emisor) / ciclo
P_ciclo = 1 − Π(1−P_datos_i) · Π(1−P_ack_i)
U_efect = U · (1 − P_ciclo)
intentos esperados = 1 / (1 − P_ciclo)
BDP     = R_emisor × RTT
```

## Criterios de aceptación

| Dado | Cuando | Entonces |
|---|---|---|
| Un enlace con ACK despreciable | se calcula U | `U == 1/(1+2a)` exacto |
| 50 kbps, 1000 bits, Tp = 250 ms (satélite del libro) | se calcula | Tt = 20 ms · ciclo = 520 ms · **U = 3,846 %** · BDP = 26 tramas |
| 10 Mbps, 1 km, V = 2·10⁸ m/s, 500 bits (LAN) | se calcula | **a = 0,1 · U = 0,8333** |
| Cadena de 2 tramos | se calcula | RTT = suma de los tramos; un salto extra siempre empeora RTT y U |
| Canal half duplex con turnaround T | se calcula | ciclo crece exactamente 2·T; el **RTT no cambia** |
| Un tramo con P = 0,2 | se calcula | `U_efect = (1−P)/(1+2a)` · intentos = 1/(1−P) |
| P en dos tramos | se calcula | las probabilidades se componen: éxito = Π(1−P_i) |
| Parámetro inválido (R = 0, V = 0, P > 1, cero enlaces) | se construye el modelo | lanza `RangeError` con mensaje, **nunca falla en silencio** |

## Fuera de alcance

Ventana deslizante · corrupción con CRC/NAK · piggybacking como base · varias sesiones
simultáneas · persistencia de escenarios.
