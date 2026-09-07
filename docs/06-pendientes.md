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
| `E-01` | P0 | Correr el **checklist de humo** completo sobre la web servida | 8 puntos en [05-runbook.md](05-runbook.md). Nunca se corrió entero y anotado; sin eso no hay evidencia de que la entrega funcione |
| `E-02` | P2 | Decidir si la versión Tkinter se entrega, se deja como anexo o se saca del repo | Hoy está congelada (2026-09-07) pero sigue en el repo y en el `README.md`. Es una decisión, no un olvido |

## Calidad y pipeline

| ID | P | Tarea | Detalle |
|---|---|---|---|
| `Q-01` | P2 | Subir de N0 a N1: tests del modelo (`js/protocol.js`) | Alternancia de secuencia, descarte de duplicados, contadores y `efficiency`. Chocaría con la regla de "cero dependencias" salvo que se use el runner nativo de Node (`node --test`), que no agrega paquetes. **Después de la entrega**; excepción declarada en [04-convenciones.md](04-convenciones.md) |
| `Q-02` | P3 | Linter/formateador | Requiere tooling y contradice "cero dependencias". Solo si el proyecto sobrevive a la entrega |

## Verificación manual pendiente

| ID | P | Qué verificar | Origen |
|---|---|---|---|
| `V-01` | P1 | Entradas inválidas del formulario (nº de tramas y timeout vacíos, 0 o negativos) no rompen la simulación | Punto 7 del checklist; nunca se probó de forma sistemática |
| `V-02` | P2 | Parámetros del enlace en extremos (R muy alto, V=0, D enorme): que Tt/Tp/`a`/U no muestren `NaN` ni `Infinity` en pantalla | El modelo devuelve `0` o `Infinity` en las divisiones límite (`js/protocol.js:55-84`); falta ver cómo lo pinta la UI |
| `V-03` | P3 | La página en un navegador que no sea el de desarrollo | Sin dependencias el riesgo es bajo, pero no está comprobado |
