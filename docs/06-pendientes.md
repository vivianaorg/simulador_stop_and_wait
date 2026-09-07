# 06 — Pendientes

Tareas abiertas. **Leer al empezar cada sesión** (junto con [00-INDEX.md](00-INDEX.md)).
Al cerrar una: se borra de acá y el detalle va a [07-historial.md](07-historial.md).

Prioridades: **P0** bloquea la entrega · **P1** se nota al demostrarlo · **P2** deuda real ·
**P3** cosmético.

Revisión completa: 2026-09-07. Entrega comprometida: **2026-09-09**.

> Este archivo lista lo **abierto**. Lo cerrado vive en `07`.

---

## Entrega

| ID | P | Tarea | Detalle / evidencia |
|---|---|---|---|
| `E-01` | P0 | Correr el **checklist de humo** del v1 completo | 8 puntos en [05-runbook.md](05-runbook.md). Nunca se corrió entero y anotado |
| `V2-01` | P0 | Correr a mano el checklist de humo del **v2**: 8 puntos del simulador y 5 de la calculadora | Verificado sin cabeza el 2026-09-07: camino de 2 saltos, alternancia 0/1, CRC roto a mano, timeout y recuperación. **Falta** probarlo con ratón y teclado: NAK, destruir, retrasar, forzar seq, quitar puntos, tema oscuro |
| `V2-02` | P1 | Modos half / full duplex dentro de la animación | El cálculo ya los distingue (`network.js`), el simulador todavía no |
| `V2-03` | P2 | Decidir qué pasa con el simulador v1 | Sigue en el repo y ya no aporta nada que el v2 no haga mejor. O se retira, o se declara como anexo |
| `V2-04` | P2 | Que el diagrama se pueda desplazar hacia atrás | Ahora solo muestra la ventana reciente; la historia anterior se pierde de vista |
| `V2-05` | P2 | Comprobar las gráficas de la calculadora con teclado y lector de pantalla | La tabla equivalente ya está; falta que el foco llegue a ella y que el `figcaption` la anuncie |
| `E-02` | P2 | Decidir si la versión Tkinter se entrega, se deja como anexo o se saca del repo | Hoy está congelada (2026-09-07) pero sigue en el repo y en el `README.md`. Es una decisión, no un olvido |

## Calidad y pipeline

| ID | P | Tarea | Detalle |
|---|---|---|---|
| `Q-01` | P2 | Tests del modelo del **v1** (`simulador_stop_and_wait_web/js/protocol.js`) | Alternancia de secuencia, descarte de duplicados, contadores. El v2 ya demostró que `node --test` no rompe la regla de cero dependencias |
| `Q-02` | P3 | Linter/formateador | Requiere tooling y contradice "cero dependencias". Solo si el proyecto sobrevive a la entrega |

## Verificación manual pendiente

| ID | P | Qué verificar | Origen |
|---|---|---|---|
| `V-01` | P1 | Entradas inválidas del formulario (nº de tramas y timeout vacíos, 0 o negativos) no rompen la simulación | Punto 7 del checklist; nunca se probó de forma sistemática |
| `V-02` | P2 | Parámetros del enlace en extremos en el **v1**: que Tt/Tp/`a`/U no muestren `NaN` ni `Infinity` | El v2 ya los rechaza con `RangeError` y mensaje; el v1 los ignora en silencio |
| `V-03` | P3 | La página en un navegador que no sea el de desarrollo | Sin dependencias el riesgo es bajo, pero no está comprobado |
