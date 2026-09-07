# Plan — Motor multi-salto y calculadora (v2)

Fecha: 2026-09-07 · Spec: [../specs/2026-09-07-motor-multisalto-design.md](../specs/2026-09-07-motor-multisalto-design.md)

Entrega comprometida: **2026-09-09**. Las tareas están en orden de valor: si el reloj
aprieta, se corta por abajo.

| # | Tarea | Archivos | Evidencia | Estado |
|---|---|---|---|---|
| 1 | Motor `network.js` + pruebas con los números del libro | `js/network.js`, `tests/network.test.js` | `node --test` → **15/15 verde** (2026-09-07) | ✅ hecho |
| 2 | Página de calculadora desplegable | `index.html`, `css/style.css`, `js/calc.js` | 25/25 `getElementById` cableados; falta prueba en navegador | ✅ hecho, sin verificar en navegador |
| 3 | Verificar la página en el navegador | — | Números en pantalla iguales a los de las pruebas | ✅ calculadora · ⬜ simulador a mano (`V2-01`) |
| 4 | **El simulador pasa a ser la portada**: diagrama tiempo-espacio, cadena de puntos editable | `index.html`, `js/ui.js` | Render sin cabeza con 2 saltos: alternancia 0/1 y timeout | ✅ hecho |
| 5 | **Detección de errores con CRC real** y NAK opcional | `js/frame.js`, `js/sim.js` | 33 pruebas verdes, incluido el volteo de los 80 bits | ✅ hecho |
| 6 | **Inspector**: voltear bits, forzar secuencia, destruir, retrasar | `js/ui.js` | Una prueba por acción en `tests/sim.test.js` | ✅ hecho |
| 7 | Modos half / full duplex dentro de la animación | — | Se ve la diferencia de utilización entre modos | ⬜ `V2-02` |
| 8 | Pérdida probabilística visible con `P` por tramo | `js/sim.js` | El ruido daña la trama y el CRC lo detecta | ✅ hecho |

**Regla de corte:** con las tareas 1–6 el trabajo ya es defendible. La 7 es mejora, no
requisito.
