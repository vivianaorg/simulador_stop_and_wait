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
| `V2-01` | P0 | Correr el checklist de humo del **v2**: presets LAN y multi-salto, quitar saltos, valores inválidos, half duplex | Solo se verificó el preset del satélite, con render sin cabeza (2026-09-07). Los otros dos presets no se han visto en pantalla |
| `V2-02` | P1 | Tarea 4 del plan: dibujar la cadena de N nodos | Las coordenadas del canvas del v1 están cableadas (`app.js:117-125`) |
| `V2-03` | P1 | Tarea 5: integrar la animación del v1 contra `network.js` | El v1 pasa a ser "cadena de 1" y no debe cambiar de comportamiento |
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
