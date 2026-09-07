# Plan — Cierre de los 12 pendientes

Fecha: 2026-09-07 · Spec: [../specs/2026-09-07-cierre-pendientes-design.md](../specs/2026-09-07-cierre-pendientes-design.md)

**Orden obligatorio: 1 → 2 → 3 → 4.** El paso 1 puede eliminar trabajo del 2 y del 3; hacerlo al
revés es probar y testear cosas que quizá se retiran.

Una tarea = un commit. Ningún paso se da por cerrado sin la evidencia de su fila.

## Paso 1 · Podar

| # | Tarea | Toca | Evidencia para cerrar | Estado |
|---|---|---|---|---|
| 1.1 | Decidir: retirar, anexar o mantener el v1 y la versión Tkinter | — | La decisión escrita en `07`, con su motivo | ✅ **conservar sin mantener** (2026-09-07) |
| 1.2 | Ejecutar la decisión | `README.md`, `docs/01`, `CLAUDE.md`, `AGENTS.md` | El `README` describe las tres carpetas y de dónde vienen las dos de partida | ✅ |
| 1.3 | Cerrar `E-01`, `Q-01`, `V-01`, `V-02` como *no aplica* | `06`, `07` | Cada uno con su motivo en `07`; ninguno en `06` | ✅ |
| 1.4 | Comprobar que el v2 no enlaza al código conservado | `simulador_stop_and_wait_v2/` | `grep -rn "simulador_stop_and_wait_web\|simulador_stop_and_wait_python" simulador_stop_and_wait_v2/` → sin resultados (2026-09-07) | ✅ |

## Paso 2 · Terminar el v2

| # | Tarea | Toca | Evidencia para cerrar | Estado |
|---|---|---|---|---|
| 2.1 | Selector half/full duplex en el simulador | `js/sim.js`, `js/ui.js`, `index.html` | Prueba: el ciclo crece 2 × el tiempo de vuelta y el RTT no cambia | ✅ |
| 2.2 | Que el ACK espere la inversión del medio en half duplex | `js/sim.js` | Prueba: el ACK existe con `turnRemainingMs > 0` y `elapsedMs = 0` | ✅ |
| 2.3 | Diagrama desplazable hacia atrás | `js/ui.js` | Navegador: rueda → aviso «histórico · 86 ms»; doble clic vuelve | ✅ |
| 2.4 | Foco y anuncio de las tablas de las gráficas | `calculadora.html`, `js/calc.js`, `css/style.css` | Tabla con `tabindex`, foco visible, y `aria-label` con los números | ✅ pendiente de repaso con teclado en el paso 3 |

## Paso 3 · Probarlo tú

| # | Tarea | Toca | Evidencia para cerrar | Estado |
|---|---|---|---|---|
| 3.1 | Checklist del simulador, 8 puntos, con ratón y teclado | — | Cada punto anotado con lo que se vio | ⬜ |
| 3.2 | Checklist de la calculadora, 8 puntos | — | Ídem | ⬜ |
| 3.3 | Repetir lo esencial en un segundo navegador | — | Diferencias anotadas, aunque sean cosméticas | ⬜ |
| 3.4 | Arreglar en el momento lo que sea de un clic | lo que toque | Pruebas verdes tras el arreglo | ⬜ |

## Paso 4 · Blindar

| # | Tarea | Toca | Evidencia para cerrar | Estado |
|---|---|---|---|---|
| 4.1 | Rechazar `Q-02` por escrito (linter de código) | `06`, `07` | El motivo en `07`: choca con cero dependencias | ⬜ |
| 4.2 | Declarar la **fuente única** del conteo de pruebas y borrar las copias | `00`, `04`, `05`, `README` del v2 | El número aparece en un solo sitio | ⬜ |
| 4.3 | Escribir el lint de documentación | `tools/lint-docs.js` | Falla a propósito con una ruta inventada; pasa con la doc real | ⬜ |
| 4.4 | Convertir las citas `archivo:línea` en nombres de función | `01` | El lint no encuentra ninguna cita de línea | ⬜ |
| 4.5 | Meter el lint en el comando de verificación | `05` | Corre junto a las pruebas, documentado | ⬜ |

## Regla de corte

Si el reloj aprieta, el orden de sacrificio es **4 → 2 → 3 → 1**. El paso 1 es el único que no se
puede saltar: entregar un repo con código muerto que nadie sabe si se mantiene es peor que
entregar menos.
