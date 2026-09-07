# 06 — Pendientes

Tareas abiertas. **Leer al empezar cada sesión** (junto con [00-INDEX.md](00-INDEX.md)).
Al cerrar una: se borra de acá y el detalle va a [07-historial.md](07-historial.md).

Prioridades: **P0** bloquea la entrega · **P1** se nota al demostrarlo · **P2** deuda real ·
**P3** cosmético.

Revisión completa: 2026-09-07. Entrega comprometida: **2026-09-09**.

> **Cierre en curso.** Los 12 pendientes se cierran en cuatro pasos, en el orden 1 → 2 → 3 → 4:
> [spec](superpowers/specs/2026-09-07-cierre-pendientes-design.md) ·
> [plan](superpowers/plans/2026-09-07-cierre-pendientes.md).
> **Mientras dure, no se abren fichas nuevas**: lo que aparezca se anota como *desvío* en el
> spec y se decide en el momento. Esta tabla solo dice qué queda abierto y en qué paso cae; el
> detalle vive en el spec y no se repite aquí.

---

## Paso 1 · Podar — decidir qué pasa con el v1 y con la versión Tkinter

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `V2-03` | P2 | Decidir qué pasa con el simulador v1 | Con la decisión, no con trabajo |
| `E-02` | P2 | Decidir si la versión Tkinter se entrega, se anexa o se retira | Ídem |
| `E-01` | P0 | Checklist de humo del v1 | Cae si el v1 se retira o se anexa |
| `Q-01` | P2 | Tests del modelo del v1 | Cae con el v1 |
| `V-01` | P1 | Entradas inválidas del formulario del v1 | Cae con el v1 |
| `V-02` | P2 | Parámetros extremos en el v1: `NaN` e `Infinity` | Cae con el v1 |

## Paso 2 · Terminar el v2

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `V2-02` | P1 | Modos half / full duplex dentro de la animación | Código + prueba |
| `V2-04` | P2 | Diagrama tiempo-espacio desplazable hacia atrás | Código + comprobación en navegador |
| `V2-05` | P2 | Gráficas de la calculadora accesibles por teclado | Código + recorrido con tabulador |

## Paso 3 · Probarlo a mano

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `V2-01` | P0 | Checklist de humo del v2 completo, con ratón y teclado | Cada punto anotado con lo que se vio |
| `V-03` | P3 | Probarlo en un segundo navegador | Diferencias anotadas |

## Paso 4 · Blindar

| ID | P | Tarea | Cómo se cierra |
|---|---|---|---|
| `Q-02` | P3 | Linter y formateador de código | **Se rechaza por escrito**: choca con la regla de cero dependencias. En su lugar entra el lint de documentación |
