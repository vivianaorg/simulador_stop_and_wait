# Simulador Stop &amp; Wait — v2

Sitio estático. **Sin build, sin dependencias, sin base de datos y sin login.**
Se despliega copiando esta carpeta.

Dos páginas:

- `index.html` — **el simulador**. Diagrama tiempo-espacio (el mismo dibujo con el que el libro
  explica el protocolo), cadena de puntos editable, inspector de la trama en vuelo con sus bits,
  detección de errores por CRC y bitácora.
- `calculadora.html` — los mismos cálculos sin animación, por bloques: interpretación de los
  datos, resultado, desarrollo paso a paso (de uno en uno, con detalle plegable) y la curva de
  utilización con este enlace marcado.

## Ejecutar en local

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

Abrir `http://localhost:8000`.

> Servir la carpeta, no abrir `index.html` con doble clic: con `file://` el navegador
> aplica restricciones que no reflejan cómo se verá desplegado.

## Desplegar

Cualquier hosting estático sirve tal cual: GitHub Pages, Netlify, Vercel, Cloudflare Pages.
No hay paso de compilación ni variables de entorno.

- **GitHub Pages:** publicar la rama y apuntar Pages a esta carpeta. El archivo `.nojekyll`
  ya está para que no se filtren rutas.
- **Netlify / Vercel:** *publish directory* = `simulador_stop_and_wait_v2`, *build command* = vacío.

## Pruebas

El motor de cálculo (`js/network.js`) se prueba con el runner nativo de Node —**no añade
ninguna dependencia**:

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js
```

El conteo y el baseline viven en [`../docs/05-runbook.md`](../docs/05-runbook.md), que es su
fuente única. (Pasar una carpeta a `node --test` falla en este equipo; hay que nombrar los
archivos.)

Cada fórmula que aparece en la interfaz tiene su caso con un número publicado:

| Caso | Comprobación |
|---|---|
| Satélite de Tanenbaum: 50 kbps, 1000 bits, 500 ms de RTT | Tt = 20 ms, ciclo = 520 ms, **U = 3,846 %** |
| LAN: 10 Mbps, 1 km, V = 2·10⁸ m/s, 500 bits | **a = 0,1 · U = 0,8333** |
| Reducción a la forma del libro | `U = 1/(1+2a)` con un salto y ACK despreciable |
| `a` frente a su forma cerrada | `a = (R·d)/(V·L)` |
| Cadena casa → satélite → casa | RTT = suma de tramos (store-and-forward) |
| Half duplex | + 2 × tiempo de vuelta por ciclo |
| Con errores | `U_efectiva = (1−P)/(1+2a)`, intentos = `1/(1−P)` |
| BD del libro (satélite) | 12 500 bits = **12,5 tramas** en un sentido (Tanenbaum, p. 201) |
| Ventana para llenar el canal | 2·BD + 1 = **26 tramas** (la que un protocolo de ventana deslizante necesitaría) |
| CRC-16/CCITT | detecta el volteo de **cualquiera** de los 80 bits de la trama |
| Protocolo | la secuencia alterna 0,1,0 · el ciclo dura Tt + 2·Tp · el tiempo medido coincide con el RTT calculado |
| Errores | trama dañada descartada y no entregada · sin NAK se espera al timeout · con NAK se retransmite antes · ACK dañado deja al emisor esperando · la copia se descarta como duplicada |
| Repetibilidad | la misma semilla produce exactamente la misma simulación |
| Casos raros | distancia cero, enlace absurdamente rápido, diez saltos, ACK mayor que la trama, P = 1, paso de tiempo gigante, timeout imposible, reinicios en mitad del vuelo |

## Estructura

```
index.html          simulador
banco-interfaz.html banco de pruebas de la interfaz (no forma parte del simulador)
calculadora.html    calculadora
css/style.css       estilos propios
js/frame.js         tramas y CRC-16/CCITT
js/network.js       tiempos, utilización y probabilidades del camino
js/steps.js         el desarrollo paso a paso, como datos
js/sim.js           máquina de estados del protocolo, con tiempo simulado
js/ui.js            interfaz del simulador
js/calc.js          interfaz de la calculadora
tests/              pruebas de los tres modelos
```

Las reglas viven en `frame.js`, `network.js` y `sim.js`. `ui.js` y `calc.js` **solo pintan**.

## Alcance

Protocolo 3 de Tanenbaum (**Stop &amp; Wait con ARQ**). No entra ventana deslizante
(Go-Back-N, Selective Repeat): queda fuera del alcance de la asignatura.

La detección de errores **no está simulada con una bandera**: la trama lleva su CRC y el
receptor lo recalcula. Si volteas un bit desde el inspector, el CRC deja de cuadrar solo.
El interruptor de NAK enseña las dos variantes: descarte silencioso (Protocolo 3, el emisor
se entera por el temporizador) o NAK inmediato.

El **ruido del canal es opcional y viene apagado**: por defecto, el único error posible es el que
metes tú desde el inspector, pulsando un bit o con *Dañar un bit al azar*. El inspector también
despliega el **CRC paso a paso**: polinomio, registro por byte, los ocho desplazamientos de cada
uno y el veredicto del receptor.

Documentación del proyecto: [`../docs/00-INDEX.md`](../docs/00-INDEX.md).
