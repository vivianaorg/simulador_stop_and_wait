# 06 — Pendientes

Tareas abiertas. **Leer al empezar cada sesión** (junto con [00-INDEX.md](00-INDEX.md)).
Al cerrar una: se borra de acá y el detalle va a [07-historial.md](07-historial.md).

Prioridades: **P0** bloquea la entrega · **P1** se nota al demostrarlo · **P2** deuda real ·
**P3** cosmético.

Revisión completa: 2026-09-07. Entrega comprometida: **2026-09-09**.

> **Cierre en curso**, en cuatro pasos y en el orden 1 → 2 → 3 → 4. **Pasos 1 y 2 cerrados el
> 2026-09-07.** Lo que queda abierto son las filas de abajo:
> [spec](superpowers/specs/2026-09-07-cierre-pendientes-design.md) ·
> [plan](superpowers/plans/2026-09-07-cierre-pendientes.md).
> **Mientras dure, no se abren fichas nuevas**: lo que aparezca se anota como *desvío* en el
> spec y se decide en el momento. Esta tabla solo dice qué queda abierto y en qué paso cae; el
> detalle vive en el spec y no se repite aquí.

---

## Paso 1 · Podar — **cerrado el 2026-09-07**

Se conservan el simulador v1 y la versión Tkinter, **sin mantenerlos**: son el trabajo de partida
del grupo y quedan como registro. Con eso se cerraron `V2-03`, `E-02`, `E-01`, `Q-01`, `V-01` y
`V-02`. El motivo, en [07-historial.md](07-historial.md).

## Paso 2 · Terminar el v2 — **cerrado el 2026-09-07**

Half duplex en la animación, diagrama desplazable y gráficas con foco y descripción.
Cerró `V2-02`, `V2-04` y `V2-05`. El detalle, en [07-historial.md](07-historial.md).

## Paso 3 · Probarlo a mano

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `V2-01` | P0 | Checklist de humo del v2 completo, con ratón y teclado | Cada punto anotado con lo que se vio |
| `V-03` | P3 | Probarlo en un segundo navegador | Diferencias anotadas |

## Paso 4 · Blindar

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `Q-02` | P3 | Linter y formateador de código | **Se rechaza por escrito**: choca con la regla de cero dependencias. En su lugar entra el lint de documentación |
