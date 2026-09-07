# Spec — Cierre de los 12 pendientes en cuatro pasos

Fecha: 2026-09-07 · Estado: **propuesto** · Entrega comprometida: **2026-09-09**

Cubre **todos** los pendientes abiertos de [06-pendientes.md](../../06-pendientes.md) al
2026-09-07. Sustituye a la gestión ficha a ficha: mientras dure este cierre **no se abren
pendientes nuevos**; lo que aparezca se anota abajo, en *Desvíos*.

## Problema

Doce pendientes abiertos y dos días. Repartidos ficha a ficha parecen doce trabajos, pero no lo
son: **seis pertenecen a código que ya no se desarrolla** (el simulador v1 y la versión Tkinter),
y su coste real depende de una decisión que nadie ha tomado todavía. Trabajar en ese orden
—probar y testear primero, decidir después— es hacer trabajo que se puede tirar.

## Decisiones ya tomadas (no re-litigar)

| Decisión | Fecha | Motivo |
|---|---|---|
| Solo Stop & Wait; nada de ventana deslizante | 2026-09-07 | Fuera del alcance de la asignatura |
| Cero dependencias, cero build, sin base de datos ni login | 2026-09-07 | Quien evalúa tiene que poder servir la carpeta y verlo |
| El trabajo nuevo va al v2; la versión Tkinter está congelada | 2026-09-07 | Un solo frente de trabajo antes de la entrega |
| Precisión por encima de features: cada fórmula con su prueba | 2026-09-07 | Es lo que sostiene el trabajo en una defensa |
| El simulador es la portada; la calculadora, su propia página | 2026-09-07 | Lo pedido era un simulador |
| La detección de errores se calcula (CRC), no se finge con banderas | 2026-09-07 | Es lo que hace el trabajo demostrable |

## Regla que gobierna este cierre

> **Cada paso termina con una decisión o con evidencia. Nunca con una ficha nueva.**

Y su corolario, que es lo que impide que la lista vuelva a crecer:

> **Un desvío no es un pendiente.** Lo que aparezca durante los cuatro pasos se escribe en
> *Desvíos* con lo que se vio y qué lo desbloquearía, y se decide en el momento: entra en el paso
> en curso, o se descarta por escrito. No hay tercera opción antes de la entrega.

---

## Paso 1 · Podar

**Cierra:** `V2-03` `E-02` `E-01` `Q-01` `V-01` `V-02`

Decidir qué pasa con `simulador_stop_and_wait_web/` (v1) y con
`simulador_stop_and_wait_python/` (Tkinter), y ejecutar la decisión el mismo día.

Las tres opciones, con su consecuencia sobre los otros cinco pendientes:

| Opción | Qué pasa con los pendientes del v1 |
|---|---|
| **Retirar del repo** (queda en el historial de git) | `E-01`, `Q-01`, `V-01` y `V-02` **desaparecen**: no se prueba ni se testea lo que no se entrega |
| **Declarar anexo**, sin mantenimiento | Los mismos cuatro se cierran como *no aplica*, y se escribe en el `README` que el anexo no se mantiene |
| **Mantener** | Los cuatro siguen abiertos y hay que hacerlos. **Esta opción no cabe antes del 2026-09-09** |

**Criterios de aceptación**

| Dado | Cuando | Entonces |
|---|---|---|
| La decisión tomada | Se ejecuta | El `README.md` de la raíz describe exactamente lo que hay en el repo, sin mencionar código que ya no está |
| Cualquiera de las dos primeras opciones | Se cierra el paso | `E-01`, `Q-01`, `V-01` y `V-02` salen de `06` con su motivo en `07`, **no** por haberlos hecho |
| El repo tras la poda | Se sirve `simulador_stop_and_wait_v2/` | Sigue funcionando: ningún enlace del v2 apunta al código retirado |

**Trampa conocida:** `simulador_stop_and_wait_v2/index.html` enlazaba al v1. Ese enlace ya no
existe, pero hay que comprobarlo antes de dar el paso por cerrado, no suponerlo.

---

## Paso 2 · Terminar el v2

**Cierra:** `V2-02` `V2-04` `V2-05`

Lo único que queda que sea escribir código. En este orden, porque es el de valor decreciente:

**2.1 · Modos de canal en la animación (`V2-02`).** `network.js` ya distingue half y full duplex;
el simulador no. Falta el selector y que la animación respete el tiempo de vuelta del medio: en
half duplex el ACK no puede empezar a viajar hasta que el sentido se invierte.

**2.2 · Diagrama desplazable (`V2-04`).** Hoy el diagrama tiempo-espacio solo muestra la ventana
reciente y la historia anterior se pierde de vista. Justo la parte que sirve para explicar lo que
pasó.

**2.3 · Gráficas accesibles (`V2-05`).** La tabla equivalente ya existe; falta que se llegue a
ella con el teclado y que el `figcaption` la anuncie.

**Criterios de aceptación**

| Dado | Cuando | Entonces |
|---|---|---|
| Un camino con tiempo de vuelta > 0 | Se elige half duplex | El ciclo crece exactamente 2 × ese tiempo, el RTT **no** cambia, y se ve en la animación que el ACK espera antes de salir |
| Una simulación con varios ciclos ya ocurridos | Se desplaza el diagrama hacia atrás | Se ven los eventos antiguos con su marca de tiempo, y al soltar vuelve a seguir el presente |
| La página de la calculadora | Se recorre solo con el tabulador | El foco llega a la tabla de cada gráfica y el lector de pantalla anuncia qué representa |
| Cualquiera de los tres | Se termina | Las 43 pruebas siguen verdes y las nuevas cubren lo que se pueda probar sin navegador |

**Lo que NO entra en este paso**, por si tienta: piggybacking, ventana deslizante, exportar el
diagrama, guardar escenarios. Nada de eso está pendiente y no se va a abrir.

---

## Paso 3 · Probarlo tú

**Cierra:** `V2-01` `V-03`

Una sola sesión, sin programar. El checklist de humo del v2 al completo —8 puntos del simulador
y 8 de la calculadora, en [05-runbook.md](../../05-runbook.md)— con ratón y teclado, en el
navegador de siempre y en uno más.

Hasta hoy la verificación se ha hecho **sin cabeza**: sirve para comprobar números, pero no ha
tocado un botón. Todo lo que depende de un clic —NAK, destruir, retrasar, forzar secuencia,
quitar puntos, tema oscuro, desplegar pasos— está sin comprobar.

**Criterios de aceptación**

| Dado | Cuando | Entonces |
|---|---|---|
| El checklist completo | Se recorre entero | Cada punto queda anotado con lo que se vio, no con un visto |
| Un punto que falla | Se encuentra | Se arregla dentro de este paso si es de un clic; si no, se anota como desvío y se decide en el momento |
| Los dos navegadores | Se comparan | Cualquier diferencia queda escrita, aunque sea cosmética |
| El paso terminado | Se cierra | La entrada en `07` dice **qué se probó y en qué navegadores**, con fecha |

---

## Paso 4 · Blindar

**Cierra:** `Q-02`

`Q-02` pedía linter y formateador. Se resuelve **como decisión, no como trabajo**: un linter de
código exige tooling y contradice la regla de cero dependencias, que es la que hace que el
trabajo se pueda abrir sin instalar nada. Se rechaza por escrito.

Lo que sí entra, porque no necesita ninguna dependencia y ataca el modo de fallo real de este
repo —que la documentación mienta— es un **lint de documentación** de unas cincuenta líneas de
Node, ejecutado con el resto de la verificación:

- una **ruta citada en la documentación que no existe** hace fallar el lint;
- una cita del tipo `archivo.js:NN` con la **línea fuera de rango** hace fallar el lint;
- un **conteo de pruebas fuera de su fuente única** hace fallar el lint;
- los **enlaces rotos** entre documentos hacen fallar el lint.

La segunda comprobación tiene deuda propia que arreglar: `01-arquitectura.md` cita hoy varias
líneas concretas (`js/protocol.js:13-21`, `app.js:141`…), y el protocolo global pide **preferir
el nombre de la función al número de línea**, porque los números se pudren en la siguiente
edición y aparentan más precisión de la que tienen. El paso 4 las convierte en nombres.

Hoy el conteo «43 pruebas» está escrito a mano en cuatro sitios (`00-INDEX`, `04`, `05` y el
`README` del v2). Son cuatro oportunidades de mentir en cuanto se añada una prueba. El paso 4
declara **una sola fuente** y borra las demás.

**Criterios de aceptación**

| Dado | Cuando | Entonces |
|---|---|---|
| Un documento que cita una ruta inexistente | Se ejecuta el lint | Falla, y dice qué documento y qué ruta |
| Un documento que cita una línea fuera de rango | Se ejecuta el lint | Falla |
| Un conteo de pruebas escrito fuera de su fuente única | Se ejecuta el lint | Falla |
| La documentación tal como está hoy | Se ejecuta el lint por primera vez | Pasa, después de haber corregido lo que señale |
| El lint | Se añade | Está en el comando de verificación de [05-runbook.md](../../05-runbook.md), no solo en la cabeza de quien lo escribió |

**Lo que este paso no promete:** el lint caza *mentiras mecánicas* (un número, una ruta, un
enlace). **No caza mentiras semánticas** — una frase que describe un comportamiento que el código
no tiene. Para eso solo sirve leer el texto contra el código, y así está escrito en las reglas
endurecidas de `04`. Creer que el script lo resuelve todo es comprar una falsa seguridad.

---

## Definición de terminado

Este cierre está terminado cuando, y solo cuando:

1. Los cuatro pasos están hechos **en orden**.
2. `06-pendientes.md` no tiene ninguna fila de las doce originales.
3. Cada cierre tiene su motivo en `07-historial.md`: **hecho** o **descartado**, nunca en blanco.
4. Las pruebas están verdes con la salida vista, y el lint de documentación pasa.
5. No se ha abierto ninguna ficha nueva.

## Desvíos

Aquí se anota lo que aparezca durante los cuatro pasos: qué se vio, qué lo desbloquearía y qué se
decidió. **No es una lista de pendientes**: cada línea nace decidida.

| Fecha | Paso | Qué apareció | Decisión |
|---|---|---|---|
| — | — | Sin desvíos todavía | — |
