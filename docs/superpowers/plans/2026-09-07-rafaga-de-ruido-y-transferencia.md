# Ráfaga de ruido determinista y bloque de transferencia — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que el simulador tenga un ruido que se pueda enseñar —una ráfaga de N milisegundos,
sin azar, que arruina exactamente `R · t` bits contiguos— y que la calculadora conteste los dos
ejercicios clásicos: cuántos bits y tramas arruina una ráfaga, y cuánto tarda una transferencia.

**Arquitectura:** las fórmulas entran en `network.js`, el volteo de bits en `frame.js`, la ventana
de reloj en `sim.js`, y `ui.js` / `calc.js` solo pintan. El cambio estructural es unificar el
tamaño de trama: `frameBits` pasa a ser la fuente y la trama real se construye a partir de él, en
vez de los 8 bytes fijos de hoy.

**Stack:** JavaScript sin build, `node --test` nativo. Cero dependencias.

**Spec:** [`../specs/2026-09-07-rafaga-de-ruido-y-transferencia-design.md`](../specs/2026-09-07-rafaga-de-ruido-y-transferencia-design.md)

## Restricciones globales

Aplican a todas las tareas. Salen de [`04-convenciones.md`](../../04-convenciones.md).

- **Cero dependencias externas y cero build.** Nada de npm, bundlers, CDNs ni frameworks.
- **Solo se toca `simulador_stop_and_wait_v2/`.** El v1 y la versión Tkinter están congelados.
- **Las reglas viven en `frame.js`, `network.js` y `sim.js`.** `ui.js` y `calc.js` no calculan.
- **La detección de errores se calcula, no se finge.** El receptor recalcula el CRC.
- **Ninguna fórmula llega a la interfaz sin una prueba con un número publicado.**
- **Sin degradados, sin sombras, sin brillos.** El color solo significa: rojo = error.
- **Toda gráfica lleva su tabla equivalente.**
- **Un control nuevo en el HTML necesita `id` y su línea en el cacheo del DOM**, o queda
  `undefined` sin avisar.
- **Commits pequeños**, Conventional Commits con scope: `feat(v2): …`, `fix(v2): …`, `docs: …`.

**Comando de pruebas** (nombrar los archivos, nunca la carpeta — `node --test tests/` falla en
este equipo):

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
```

**Baseline al empezar este plan: 86 pruebas, todas verdes.**

## Estructura de archivos

| Archivo | Responsabilidad tras el plan |
|---|---|
| `js/frame.js` | Añade el volteo de un tramo contiguo y la conversión entre `frameBits` y bytes de carga |
| `js/network.js` | Añade `burstDamage` y `transferAnalysis` |
| `js/sim.js` | Añade la ventana de ráfaga en el reloj y su contador |
| `js/ui.js` | Control de ráfaga, banda en el diagrama, telemetría, tamaño de trama derivado |
| `js/steps.js` | Desarrollo paso a paso de los dos bloques nuevos |
| `js/calc.js` | Pinta los dos bloques nuevos |
| `index.html` | Botón y campo de ráfaga |
| `calculadora.html` | Campos de duración de ráfaga y de tamaño de transferencia |
| `tests/frame.test.js` | **Nuevo.** Hoy `frame.js` no tiene archivo propio de pruebas |
| `tests/network.test.js` | Casos de las fórmulas nuevas |
| `tests/sim.test.js` | Comportamiento de la ráfaga en el reloj |

---

## Tarea 0 · Decidir la fuente publicada (bloquea las tareas 2, 8 y 9)

**No se escribe código en esta tarea.** Es una decisión del usuario y hay que resolverla antes de
que ninguna fórmula llegue a la interfaz.

`04` §B.1 exige un número publicado por fórmula visible. La búsqueda del 2026-09-07 **no encontró
el ejercicio en Tanenbaum**. Lo que sí hay publicado es la misma fórmula resuelta en Forouzan,
*Data Communications and Networking*, cap. 10: una ráfaga de 2 ms a 1500 bps afecta a 3 bits, y a
100 kbps afecta a 200 bits.

- [ ] **Paso 1: Preguntar al usuario cuál de las tres fuentes se usa**

| Opción | Qué se escribe en la prueba |
|---|---|
| **A** — el usuario aporta el pasaje de Tanenbaum | Capítulo y enunciado textual, como ya hace `tests/network.test.js` con el ejemplo del satélite |
| **B** — se cita Forouzan | «Forouzan, *Data Communications and Networking*, cap. 10» y sus números. Es un libro publicado, pero **no** el de la asignatura, y así hay que decirlo |
| **C** — forma cerrada | `R · t` se justifica por análisis dimensional: bits/s × s = bits. No hace falta libro. **Solo vale para `burstDamage`**, no para el bloque de transferencia |

- [ ] **Paso 2: Anotar la decisión en el spec, en una línea nueva de la tabla de decisiones**

No se reescribe ninguna línea existente: `04` §A.3 regla 4 prohíbe reescribir un documento
fechado.

- [ ] **Paso 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-07-rafaga-de-ruido-y-transferencia-design.md
git commit -m "docs: fuente publicada para las formulas de rafaga y transferencia"
```

---

## Tarea 1 · Volteo de un tramo contiguo de bits

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/frame.js`
- Crear: `simulador_stop_and_wait_v2/tests/frame.test.js`

**Interfaces:**
- Consume: `flipBit(frame, bitIndex)` y `totalBits(frame)`, que ya existen en `frame.js`.
- Produce: `flipRun(frame, startBit, count)` → devuelve **el número de bits realmente volteados**,
  que es menor que `count` si el tramo se sale del final de la trama. Lo usan las tareas 4 y 5.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `simulador_stop_and_wait_v2/tests/frame.test.js`:

```js
// frame.test.js — tramas, CRC y daño manual.
// `node --test tests/frame.test.js`

const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/frame.js");

function trama(payloadBytes) {
  return F.createFrame({ kind: F.KIND.FRAME, seq: 0, frameIdx: 0, payloadBytes });
}

test("flipRun voltea un tramo contiguo y lo deja registrado", () => {
  const f = trama(8);
  const tocados = F.flipRun(f, 4, 3);

  assert.equal(tocados, 3);
  assert.deepEqual(f.flippedBits, [4, 5, 6]);
  assert.equal(F.isIntact(f), false, "el CRC ya no puede cuadrar");
});

test("flipRun se corta en el final de la trama y dice cuántos tocó", () => {
  const f = trama(8); // 8*8 + 16 = 80 bits
  const tocados = F.flipRun(f, 78, 10);

  assert.equal(tocados, 2, "solo quedaban dos bits");
  assert.deepEqual(f.flippedBits, [78, 79]);
});

test("flipRun es determinista: mismo tramo, mismos bits, sin generador", () => {
  const a = trama(8);
  const b = trama(8);
  F.flipRun(a, 10, 20);
  F.flipRun(b, 10, 20);

  assert.deepEqual(a.flippedBits, b.flippedBits);
  assert.deepEqual(Array.from(a.payload), Array.from(b.payload));
  assert.equal(a.crc, b.crc);
});

test("flipRun de cero bits no toca nada y deja la trama intacta", () => {
  const f = trama(8);
  assert.equal(F.flipRun(f, 0, 0), 0);
  assert.equal(F.isIntact(f), true);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js
```

Esperado: FALLA con `F.flipRun is not a function`.

- [ ] **Paso 3: Implementar lo mínimo**

En `js/frame.js`, justo después de `flipBit`:

```js
  /**
   * Voltea `count` bits contiguos a partir de `startBit`, como hace una ráfaga
   * de ruido: ensucia un intervalo de tiempo, y en el cable el tiempo es
   * posición. No recibe generador porque no hay nada que sortear.
   *
   * Si el tramo se sale del final de la trama se corta ahí. Devuelve cuántos
   * bits llegó a tocar, que es lo que el simulador necesita para saber si a la
   * ráfaga le sobró alcance para la trama siguiente.
   */
  function flipRun(frame, startBit, count) {
    const total = totalBits(frame);
    if (!Number.isInteger(startBit) || startBit < 0) {
      throw new RangeError(`Índice de bit fuera de rango: ${startBit}`);
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Número de bits inválido: ${count}`);
    }

    const hasta = Math.min(startBit + count, total);
    let tocados = 0;
    for (let i = startBit; i < hasta; i++) {
      flipBit(frame, i);
      tocados++;
    }
    return tocados;
  }
```

Y añadir `flipRun` al objeto que devuelve el módulo, junto a `flipBit`.

- [ ] **Paso 4: Ejecutar y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js
```

Esperado: 4 pruebas, todas verdes.

- [ ] **Paso 5: Añadir el archivo nuevo al comando de pruebas del runbook**

En `docs/05-runbook.md`, las dos apariciones del comando pasan a incluir
`simulador_stop_and_wait_v2/tests/frame.test.js`. Y el conteo de pruebas de su fuente única sube
de 86 a 90.

- [ ] **Paso 6: Suite completa verde**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
node tools/lint-docs.js
```

Esperado: 90 pruebas verdes y el lint sin problemas.

- [ ] **Paso 7: Commit**

```bash
git add simulador_stop_and_wait_v2/js/frame.js simulador_stop_and_wait_v2/tests/frame.test.js docs/05-runbook.md
git commit -m "feat(v2): volteo de un tramo contiguo de bits, sin azar"
```

---

## Tarea 2 · La fórmula de la ráfaga

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/network.js`
- Modificar: `simulador_stop_and_wait_v2/tests/network.test.js`

**Interfaces:**
- Produce: `burstDamage({ rateBps, burstMs, frameBits })` → `{ bits, frames }`. Lo usan las
  tareas 5, 6 y 8.

**Depende de la tarea 0:** el comentario de la prueba cita la fuente que se haya decidido allí.
Abajo va redactado para la opción **B**; si salió **A**, se sustituye por el pasaje de Tanenbaum,
y si salió **C**, por la justificación dimensional.

- [ ] **Paso 1: Escribir la prueba que falla**

Al final de `tests/network.test.js`:

```js
test("Ráfaga de ruido: los bits arruinados son R · t (Forouzan, cap. 10)", () => {
  // Forouzan, Data Communications and Networking, cap. 10: una ráfaga de 2 ms
  // sobre un canal de 1500 bps afecta a 3 bits; sobre uno de 100 kbps, a 200.
  assert.equal(N.burstDamage({ rateBps: 1500, burstMs: 2, frameBits: 1000 }).bits, 3);
  assert.equal(N.burstDamage({ rateBps: 100000, burstMs: 2, frameBits: 1000 }).bits, 200);
});

test("Ráfaga de ruido: las tramas abarcadas salen de repartir los bits sobre L", () => {
  // 10 ms a 100 kbps son 1000 bits. Con tramas de 500 bits, dos tramas.
  const r = N.burstDamage({ rateBps: 100000, burstMs: 10, frameBits: 500 });
  assert.equal(r.bits, 1000);
  assert.equal(r.frames, 2);

  // Con tramas de 1000 bits, una sola.
  assert.equal(N.burstDamage({ rateBps: 100000, burstMs: 10, frameBits: 1000 }).frames, 1);

  // Una ráfaga que no llega a una trama entera sigue arruinando esa trama.
  assert.equal(N.burstDamage({ rateBps: 100000, burstMs: 1, frameBits: 1000 }).frames, 1);
});

test("Ráfaga de duración cero no arruina nada", () => {
  const r = N.burstDamage({ rateBps: 100000, burstMs: 0, frameBits: 1000 });
  assert.equal(r.bits, 0);
  assert.equal(r.frames, 0);
});

test("Ráfaga con parámetros imposibles se rechaza", () => {
  assert.throws(() => N.burstDamage({ rateBps: 0, burstMs: 10, frameBits: 1000 }), RangeError);
  assert.throws(() => N.burstDamage({ rateBps: 1000, burstMs: -1, frameBits: 1000 }), RangeError);
  assert.throws(() => N.burstDamage({ rateBps: 1000, burstMs: 10, frameBits: 0 }), RangeError);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: FALLA con `N.burstDamage is not a function`.

- [ ] **Paso 3: Implementar lo mínimo**

En `js/network.js`, junto a las demás fórmulas:

```js
  /**
   * Daño de una ráfaga de ruido, la cuenta del libro: un intervalo sucio de t
   * segundos sobre un canal de R bits/s arruina R·t bits.
   *
   * `frames` reparte esos bits sobre tramas de L bits. Supone que la ráfaga
   * empieza justo donde empieza una trama: una ráfaga a caballo entre dos
   * puede tocar una más. Es la misma suposición que hace el enunciado.
   */
  function burstDamage(spec) {
    if (!isPositive(spec.rateBps)) throw new RangeError("la tasa R debe ser > 0 bits/s");
    if (!Number.isFinite(spec.burstMs) || spec.burstMs < 0) {
      throw new RangeError("la duración de la ráfaga no puede ser negativa");
    }
    if (!isPositive(spec.frameBits)) throw new RangeError("el tamaño de trama L debe ser > 0 bits");

    const bits = Math.floor((spec.rateBps * spec.burstMs) / MS_PER_S);
    return { bits, frames: Math.ceil(bits / spec.frameBits) };
  }
```

Y exportarla junto a las demás.

- [ ] **Paso 4: Ejecutar y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: verde, 4 pruebas más que antes.

- [ ] **Paso 5: Actualizar el conteo de pruebas en su fuente única** (`docs/05-runbook.md`): 94.

- [ ] **Paso 6: Suite completa y lint verdes**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
node tools/lint-docs.js
```

- [ ] **Paso 7: Commit**

```bash
git add simulador_stop_and_wait_v2/js/network.js simulador_stop_and_wait_v2/tests/network.test.js docs/05-runbook.md
git commit -m "feat(v2): formula de la rafaga de ruido, R por t"
```

---

## Tarea 3 · Un solo tamaño de trama

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/frame.js`
- Modificar: `simulador_stop_and_wait_v2/js/ui.js`
- Modificar: `simulador_stop_and_wait_v2/tests/frame.test.js`

**Interfaces:**
- Produce: `payloadBytesFor(frameBits)` → bytes de carga, y `roundFrameBits(frameBits)` → el valor
  representable más cercano. Los usan las tareas 4 y 6.

Hoy `frameBits` alimenta los tiempos y la trama real mide 8 bytes fijos. Son dos hechos con el
mismo nombre. Aquí se unifican.

- [ ] **Paso 1: Escribir la prueba que falla**

En `tests/frame.test.js`:

```js
test("El tamaño de trama manda: la carga sale de frameBits menos el CRC", () => {
  // 1000 bits de trama - 16 de CRC = 984 bits = 123 bytes de carga.
  assert.equal(F.payloadBytesFor(1000), 123);
  assert.equal(F.payloadBytesFor(24), 1, "el mínimo representable");
});

test("Un tamaño no representable se redondea al múltiplo válido más cercano", () => {
  // Válidos: 24, 32, 40 ... es decir 16 + 8k con k >= 1.
  assert.equal(F.roundFrameBits(1000), 1000, "ya era válido");
  assert.equal(F.roundFrameBits(1001), 1000);
  assert.equal(F.roundFrameBits(1005), 1008);
  assert.equal(F.roundFrameBits(1), 24, "por debajo del mínimo, sube al mínimo");
  assert.equal(F.roundFrameBits(0), 24);
});

test("Una trama construida con el tamaño derivado mide lo que dice frameBits", () => {
  const f = F.createFrame({
    kind: F.KIND.FRAME,
    seq: 0,
    frameIdx: 0,
    payloadBytes: F.payloadBytesFor(1000),
  });
  assert.equal(F.totalBits(f), 1000);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js
```

Esperado: FALLA con `F.payloadBytesFor is not a function`.

- [ ] **Paso 3: Implementar lo mínimo**

En `js/frame.js`, junto a `totalBits`:

```js
  // El tamaño de trama del formulario manda, y la carga sale de restarle el
  // CRC. No todo valor es representable: hacen falta bytes enteros de carga,
  // así que L válido es 16 + 8k con k >= 1.
  const MIN_FRAME_BITS = CRC_BITS + 8;

  function payloadBytesFor(frameBits) {
    return (roundFrameBits(frameBits) - CRC_BITS) / 8;
  }

  function roundFrameBits(frameBits) {
    if (!Number.isFinite(frameBits) || frameBits <= MIN_FRAME_BITS) return MIN_FRAME_BITS;
    const bytes = Math.round((frameBits - CRC_BITS) / 8);
    return CRC_BITS + Math.max(1, bytes) * 8;
  }
```

Exportar `payloadBytesFor`, `roundFrameBits` y `MIN_FRAME_BITS`. `totalBits` y `CRC_BITS` ya
están exportados.

- [ ] **Paso 4: Ejecutar y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js
```

- [ ] **Paso 5: Conectarlo a la interfaz**

En `js/ui.js`, dentro de `rebuild()`, la línea `payloadBytes: 8` pasa a:

```js
      payloadBytes: F.payloadBytesFor(Number(dom.frameBits.value)),
```

Y justo antes de construir el camino, si el valor tecleado no era representable, se ajusta el
campo y se avisa en el mismo sitio donde ya se muestran los errores del formulario:

```js
    // El tamaño de trama tiene que caber en bytes enteros de carga más el CRC.
    // Se ajusta y se dice: pelearse con el formulario no ayuda a nadie, pero
    // mentir sobre qué se calculó, menos.
    const pedidos = Number(dom.frameBits.value);
    const validos = F.roundFrameBits(pedidos);
    if (validos !== pedidos) {
      dom.frameBits.value = String(validos);
      dom.timeoutHint.textContent =
        `Tamaño de trama ajustado a ${validos} bits: la carga va en bytes enteros más 16 de CRC.`;
    }
```

- [ ] **Paso 6: Comprobar en el navegador**

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

Abrir `http://localhost:8000`, escribir `1001` en el tamaño de trama y comprobar que se ajusta a
`1000` con el aviso visible. Escribir `1000` y comprobar que la tira de bits ya no muestra 80
casillas.

**Esta comprobación se anota con lo que se vio, no se da por hecha.**

- [ ] **Paso 7: Suite completa y lint verdes; anotar el conteo nuevo** (97) en `docs/05-runbook.md`.

- [ ] **Paso 8: Commit**

```bash
git add simulador_stop_and_wait_v2/js/frame.js simulador_stop_and_wait_v2/js/ui.js simulador_stop_and_wait_v2/tests/frame.test.js docs/05-runbook.md
git commit -m "feat(v2): el tamano de trama del formulario manda sobre la trama real"
```

---

## Tarea 4 · La tira de bits, legible con tramas grandes

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/ui.js`

Sin la tarea 3 la tira dibujaba 80 casillas. Con ella puede tener 1000, y 1000 cuadritos no se
leen. **No hay prueba unitaria de esto: es dibujo.** Se verifica en el navegador, que es como `04`
declara que se verifica la interfaz.

- [ ] **Paso 1: Agrupar por bytes por encima del umbral**

En la función que pinta la tira de bits, si `F.totalBits(frame) > 128`, cada casilla representa un
byte en vez de un bit, y se pinta en rojo de error si **alguno** de sus ocho bits está en
`frame.flippedBits`. Por debajo del umbral, todo sigue igual que hoy.

La constante va arriba del método, no suelta:

```js
  // Por encima de este tamaño la tira pasa a una casilla por byte: 1000
  // cuadritos no se leen, y para enseñar una ráfaga el bloque dice más que el
  // bit suelto.
  const BITS_MAX_INDIVIDUALES = 128;
```

- [ ] **Paso 2: Que el clic siga sirviendo**

Con la tira agrupada, un clic sobre una casilla voltea **el primer bit de ese byte**, no los ocho.
El daño de un bit tiene que seguir siendo de un bit: es el otro modo que el usuario pidió
conservar.

- [ ] **Paso 3: Comprobar en el navegador**

Tamaño de trama 1000. Comprobar: la tira se lee, un clic voltea un bit y solo uno, y el CRC deja
de cuadrar. Anotar lo que se vio.

- [ ] **Paso 4: Suite y lint verdes**

- [ ] **Paso 5: Commit**

```bash
git add simulador_stop_and_wait_v2/js/ui.js
git commit -m "feat(v2): la tira de bits se agrupa por bytes cuando la trama es grande"
```

---

## Tarea 5 · La ráfaga en el reloj del simulador

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/sim.js`
- Modificar: `simulador_stop_and_wait_v2/tests/sim.test.js`

**Interfaces:**
- Consume: `F.flipRun` (tarea 1) y `N.burstDamage` (tarea 2).
- Produce: `startBurst(sim, durationMs)`, el estado `sim.burst`, y el contador
  `sim.stats.burstBitsRuined`. Los usa la tarea 6.

**Es la tarea con riesgo del plan.** Toca `proximoSucesoMs`, que es lo que hace avanzar el
simulador entero. Si se rompe, no se rompe el ruido: se rompe todo. Por eso va con prueba antes
que código y con verificación en el navegador inmediatamente después.

- [ ] **Paso 1: Escribir la prueba que falla**

En `tests/sim.test.js`:

```js
test("La ráfaga arruina bits de lo que esté viajando, sin generador", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.sendFrame(sim); // que haya algo en el cable
  S.startBurst(sim, 5);
  correr(sim, 20, 1);

  assert.ok(sim.stats.burstBitsRuined > 0, "la ráfaga tiene que haber mordido algo");
});

test("La ráfaga es determinista: dos corridas iguales arruinan lo mismo", () => {
  function corrida() {
    const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
    S.sendFrame(sim);
    S.startBurst(sim, 5);
    correr(sim, 20, 1);
    return sim.stats.burstBitsRuined;
  }
  assert.equal(corrida(), corrida());
});

test("La ventana de la ráfaga se cierra sola y deja de morder", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.sendFrame(sim);
  S.startBurst(sim, 5);
  correr(sim, 20, 1);
  const trasCerrarse = sim.stats.burstBitsRuined;

  correr(sim, 50, 1);
  assert.equal(sim.stats.burstBitsRuined, trasCerrarse, "ya no debería morder nada");
  assert.equal(sim.burst, null, "la ventana quedó cerrada");
});

test("El cierre de la ráfaga entra en el próximo suceso", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.sendFrame(sim);
  S.startBurst(sim, 1);
  // El reloj no puede saltarse el final de la ventana.
  assert.ok(S.proximoSucesoMs(sim) <= 1);
});
```

`caminoSimple()` y `correr(sim, msTotales, pasoMs)` ya existen en `sim.test.js`: se reutilizan, no
se duplican.

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/sim.test.js
```

Esperado: FALLA con `S.startBurst is not a function`.

- [ ] **Paso 3: Implementar lo mínimo**

En `js/sim.js`:

```js
  /**
   * Ensucia el canal durante `durationMs` de reloj simulado. A diferencia del
   * ruido por probabilidad, esto no se tira: ocurre. Cada paquete que viaje
   * dentro de la ventana pierde los bits que le corresponden por su tasa.
   */
  function startBurst(sim, durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new RangeError("la ráfaga tiene que durar más de 0 ms");
    }
    sim.burst = { endsAtMs: sim.clockMs + durationMs, cursorPorPaquete: new Map() };
    note(sim, "ERROR", `Ráfaga de ruido: el canal queda sucio ${durationMs} ms`);
    return sim;
  }

  // Muerde lo que haya en el cable durante los `dtMs` que acaban de pasar. El
  // cursor por paquete hace que los bits arruinados sean contiguos: una ráfaga
  // ensucia un intervalo, no bits sueltos repartidos.
  function applyBurst(sim, dtMs) {
    if (!sim.burst || dtMs <= 0) return;

    for (const packet of sim.wire) {
      const link = linkFor(sim, packet);
      const { bits } = N.burstDamage({
        rateBps: link.rateBps,
        burstMs: dtMs,
        frameBits: F.totalBits(packet.frame),
      });
      if (bits <= 0) continue;

      const desde = sim.burst.cursorPorPaquete.get(packet) || 0;
      const tocados = F.flipRun(packet.frame, desde, bits);
      sim.burst.cursorPorPaquete.set(packet, desde + tocados);
      sim.stats.burstBitsRuined += tocados;
    }
  }
```

En el contador de estadísticas, junto a los que ya hay, `burstBitsRuined: 0`. En el estado inicial
de la simulación, `burst: null`.

En `proximoSucesoMs`, junto al temporizador:

```js
    if (sim.burst) minimo = Math.min(minimo, sim.burst.endsAtMs - sim.clockMs);
```

Y en el punto del avance donde el reloj ya se movió `dt`, llamar a `applyBurst(sim, dt)` y cerrar
la ventana cuando toque:

```js
    applyBurst(sim, dt);
    if (sim.burst && sim.clockMs >= sim.burst.endsAtMs) {
      sim.burst = null;
      note(sim, "INFO", "La ráfaga terminó: el canal vuelve a estar limpio");
    }
```

Exportar `startBurst` y `proximoSucesoMs`.

- [ ] **Paso 4: Ejecutar y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/sim.test.js
```

- [ ] **Paso 5: Comprobar que el simulador sigue avanzando**

Suite entera verde **y** el navegador: arrancar una simulación sin tocar la ráfaga y ver que
termina como antes. Es lo que caza que `proximoSucesoMs` se haya roto.

- [ ] **Paso 6: Conteo nuevo en `docs/05-runbook.md`** (101) y lint verde.

- [ ] **Paso 7: Commit**

```bash
git add simulador_stop_and_wait_v2/js/sim.js simulador_stop_and_wait_v2/tests/sim.test.js docs/05-runbook.md
git commit -m "feat(v2): rafaga de ruido como ventana del reloj"
```

---

## Tarea 6 · La ráfaga en la interfaz

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/index.html`
- Modificar: `simulador_stop_and_wait_v2/js/ui.js`

**Consume:** `S.startBurst` y `sim.stats.burstBitsRuined` (tarea 5).

Sin prueba unitaria: es interfaz. Se verifica en el navegador.

- [ ] **Paso 1: Los controles**

En `index.html`, junto a los botones de daño manual que ya existen:

```html
<label for="burst-ms">Ráfaga (ms)</label>
<input type="number" id="burst-ms" min="1" step="1" value="5">
<button class="btn btn-danger" id="btn-burst">Ráfaga de ruido</button>
```

- [ ] **Paso 2: Cachear e enlazar**

`04` §B.1: un control nuevo sin su línea en el cacheo del DOM queda `undefined` sin avisar. En
`cacheDom()`:

```js
      burstMs: id("burst-ms"),
      btnBurst: id("btn-burst"),
```

Y en el enlace de eventos. **No pasa por `actOnSelected`**: la ráfaga es del canal, no de una
trama, y esa es justamente la diferencia con los otros botones.

```js
    dom.btnBurst.addEventListener("click", () => {
      S.startBurst(sim, Number(dom.burstMs.value));
      render();
    });
```

- [ ] **Paso 3: La banda en el diagrama**

En el bucle que pinta los eventos, antes de las flechas, una banda horizontal del alto del
intervalo sucio y del ancho del escenario, en el rojo de error ya declarado. Sin degradados.

- [ ] **Paso 4: La telemetría**

Fila nueva en `index.html` (`<dt>Bits arruinados por ráfaga</dt><dd class="num" id="tel-burst">0</dd>`),
su línea en el cacheo, y su escritura donde se escriben las demás.

- [ ] **Paso 5: Comprobar en el navegador**

Arrancar, apretar la ráfaga con una trama viajando, y ver: la banda aparece donde corresponde, el
contador sube, la trama llega dañada y el receptor la descarta por CRC. Repetir con los mismos
pasos y comprobar que **sale idéntico**. Anotar lo que se vio.

- [ ] **Paso 6: Suite y lint verdes**

- [ ] **Paso 7: Commit**

```bash
git add simulador_stop_and_wait_v2/index.html simulador_stop_and_wait_v2/js/ui.js
git commit -m "feat(v2): control, banda y contador de la rafaga de ruido"
```

---

## Tarea 7 · El bloque de ráfaga en la calculadora

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/calculadora.html`
- Modificar: `simulador_stop_and_wait_v2/js/steps.js`
- Modificar: `simulador_stop_and_wait_v2/js/calc.js`
- Modificar: `simulador_stop_and_wait_v2/tests/steps.test.js`

**Consume:** `N.burstDamage` (tarea 2).

- [ ] **Paso 1: Escribir la prueba que falla**

En `tests/steps.test.js`:

```js
test("El desarrollo de la ráfaga trae sus números, no solo el rótulo", () => {
  const pasos = Steps.buildBurst({ rateBps: 100000, burstMs: 10, frameBits: 500 });

  const texto = JSON.stringify(pasos);
  assert.match(texto, /1000/, "los bits arruinados");
  assert.match(texto, /2/, "las tramas abarcadas");
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: FALLA con `Steps.buildBurst is not a function`.

- [ ] **Paso 3: Implementar**

`buildBurst` en `js/steps.js` devuelve pasos con el mismo `paso(spec)` que ya usa `build`: uno con
`bits = R · t` sustituyendo los números, y otro con el reparto sobre L. `steps.js` no inventa la
cuenta: llama a `N.burstDamage`.

Exportar `buildBurst` junto a `build`.

- [ ] **Paso 4: Ejecutar y ver que pasa**

- [ ] **Paso 5: Pintarlo**

Campo `id="burst-ms"` en `calculadora.html`, su línea en el cacheo del DOM de `calc.js`, su
`addEventListener("change", recalcular)`, y el bloque nuevo pintado con el mismo patrón plegable
que los demás. `calc.js` no calcula nada.

- [ ] **Paso 6: Comprobar en el navegador**

`http://localhost:8000/calculadora.html`, 100 kbps y 10 ms → 1000 bits, 2 tramas con L = 500.
Anotar lo que se vio.

- [ ] **Paso 7: Conteo nuevo en `docs/05-runbook.md`** (102) y lint verde.

- [ ] **Paso 8: Commit**

```bash
git add simulador_stop_and_wait_v2/calculadora.html simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/js/calc.js simulador_stop_and_wait_v2/tests/steps.test.js docs/05-runbook.md
git commit -m "feat(v2): bloque de rafaga en la calculadora"
```

---

## Tarea 8 · El bloque de transferencia

**Esta es la tarea que se corta si el 2026-09-09 aprieta.** Nada más depende de ella.

**Archivos:**
- Modificar: `simulador_stop_and_wait_v2/js/network.js`
- Modificar: `simulador_stop_and_wait_v2/calculadora.html`
- Modificar: `simulador_stop_and_wait_v2/js/steps.js`
- Modificar: `simulador_stop_and_wait_v2/js/calc.js`
- Modificar: `simulador_stop_and_wait_v2/tests/network.test.js`

**Interfaces:**
- Produce: `transferAnalysis(path, totalBits)` → `{ frames, totalMs, goodputBps }`.

**Depende de la tarea 0:** necesita número publicado, y la opción C (forma cerrada) **no le
sirve**. Si en la tarea 0 salió C, esta tarea no se hace hasta acordar una fuente.

- [ ] **Paso 1: Escribir la prueba que falla**

En `tests/network.test.js`, sobre el ejemplo del satélite que el archivo ya usa:

```js
test("Transferencia: un fichero se parte en tramas y el tiempo es N ciclos", () => {
  // Mismo enlace satelital de la primera prueba: Tt = 20 ms, ciclo = 520 ms.
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({
        name: "Enlace satelital",
        rateBps: 50000,
        distanceKm: 50000,
        velocityKmS: 200000,
      }),
    ],
  });

  const r = N.transferAnalysis(path, 10000); // 10 000 bits

  assert.equal(r.frames, 10, "10 000 / 1000");
  closeTo(r.totalMs, 5200, 1e-9, "10 ciclos de 520 ms");
  closeTo(r.goodputBps, 10000 / 5.2, 1e-6, "caudal conseguido");
});

test("Transferencia: la última trama cuenta entera aunque vaya a medias", () => {
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({ name: "Enlace", rateBps: 50000, distanceKm: 50000, velocityKmS: 200000 }),
    ],
  });

  assert.equal(N.transferAnalysis(path, 10001).frames, 11);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

- [ ] **Paso 3: Implementar**

```js
  /**
   * Transferir un fichero entero con Stop & Wait: se parte en tramas de L bits
   * y cada una cuesta un ciclo completo, porque el emisor no puede adelantar
   * trabajo. La última cuenta entera aunque vaya a medias.
   *
   * No cuenta reenvíos: este bloque supone canal limpio. Meter 1/(1-p) es otra
   * fórmula y está declarada fuera del alcance en el spec.
   */
  function transferAnalysis(path, totalBits) {
    if (!isPositive(totalBits)) throw new RangeError("el tamaño a transferir debe ser > 0 bits");

    const r = analyze(path);
    const frames = Math.ceil(totalBits / path.frameBits);
    const totalMs = frames * r.cycleMs;
    return { frames, totalMs, goodputBps: totalBits / (totalMs / MS_PER_S) };
  }
```

- [ ] **Paso 4: Ejecutar y ver que pasa**

- [ ] **Paso 5: Pintarlo**

Campo de tamaño total en `calculadora.html` con su selector de unidad (bits / KB / MB), su línea
en el cacheo del DOM, su evento, y `buildTransfer` en `steps.js` con el desarrollo. Como toda
gráfica lleva tabla, si este bloque añade alguna, lleva la suya.

- [ ] **Paso 6: Comprobar en el navegador y anotar lo que se vio**

- [ ] **Paso 7: Conteo nuevo en `docs/05-runbook.md`** (104) y lint verde.

- [ ] **Paso 8: Commit**

```bash
git add simulador_stop_and_wait_v2/js/network.js simulador_stop_and_wait_v2/calculadora.html simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/js/calc.js simulador_stop_and_wait_v2/tests/network.test.js docs/05-runbook.md
git commit -m "feat(v2): bloque de transferencia en la calculadora"
```

---

## Tarea 9 · Cierre documental

**Archivos:**
- Modificar: `docs/01-arquitectura.md`, `docs/05-runbook.md`, `docs/07-historial.md`

- [ ] **Paso 1: Estado en `01` y `05`**

`01`: que el tamaño de trama es uno solo y de dónde sale la trama real. `05`: la ráfaga en el
checklist de humo, y `tests/frame.test.js` en el comando de pruebas si la tarea 1 no lo dejó ya.

- [ ] **Paso 2: Entrada en `07-historial.md`**

Qué, por qué y **cómo revertir**. El «cómo revertir» de este cambio no es solo `git revert`: hay
que decir que la ráfaga vive en `proximoSucesoMs` y que quitarla mal deja el simulador sin
avanzar.

- [ ] **Paso 3: Nada en `06-pendientes.md`**

El cierre del 2026-09-07 sigue en curso y su regla prohíbe abrir fichas. Esto ya está anotado como
desvío en el spec del cierre. **Si al implementar aparece algo nuevo, va allí, no en `06`.**

- [ ] **Paso 4: Verificación completa**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
node --check simulador_stop_and_wait_v2/js/frame.js
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/sim.js
node --check simulador_stop_and_wait_v2/js/steps.js
node --check simulador_stop_and_wait_v2/js/ui.js
node --check simulador_stop_and_wait_v2/js/calc.js
node tools/lint-docs.js
```

- [ ] **Paso 5: Commit**

```bash
git add docs/
git commit -m "docs: estado e historial de la rafaga de ruido y la transferencia"
```
