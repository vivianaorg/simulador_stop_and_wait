# Plan — Motor multi-salto y calculadora (v2)

Fecha: 2026-09-07 · Spec: [../specs/2026-09-07-motor-multisalto-design.md](../specs/2026-09-07-motor-multisalto-design.md)

Entrega comprometida: **2026-09-09**. Las tareas están en orden de valor: si el reloj
aprieta, se corta por abajo.

| # | Tarea | Archivos | Evidencia | Estado |
|---|---|---|---|---|
| 1 | Motor `network.js` + pruebas con los números del libro | `js/network.js`, `tests/network.test.js` | `node --test` → **15/15 verde** (2026-09-07) | ✅ hecho |
| 2 | Página de calculadora desplegable | `index.html`, `css/style.css`, `js/calc.js` | 25/25 `getElementById` cableados; falta prueba en navegador | ✅ hecho, sin verificar en navegador |
| 3 | Verificar la página en el navegador con los tres presets | — | Los números en pantalla deben coincidir con los de las pruebas | ⬜ `V2-01` |
| 4 | Canvas de N nodos (hoy las coordenadas del v1 están cableadas) | `js/*` | La cadena se dibuja con 1, 2 y 3 saltos | ⬜ |
| 5 | Integrar la animación del v1 contra este motor | — | El v1 pasa a ser "cadena de 1" y no cambia de comportamiento | ⬜ |
| 6 | Modos de canal en la animación (half / full) + pérdida probabilística | — | Se ve la diferencia de utilización entre modos | ⬜ |
| 7 | Piggybacking como casilla opcional declarada | — | Se puede apagar sin que se caiga nada | ⬜ opcional |

**Regla de corte:** las tareas 1–3 más la calculadora son la entrega mínima defendible.
La 4 y la 5 son las caras.
