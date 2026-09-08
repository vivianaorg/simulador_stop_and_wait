# Calculadora granular — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la calculadora enseñe el razonamiento completo —cancelación de unidades, el factor 1000, fórmulas apiladas como en el libro— y que deje de afirmar cosas que el libro no dice.

**Architecture:** El motor (`network.js`) gana tres cantidades que hoy no expone y que corrigen defectos reales: `aEfectiva`, el `BD` del libro separado de la ventana `2BD+1`, y una cabecera que hace honesto el goodput de un fichero. `steps.js` deja de emitir una línea por paso y emite una **derivación**: varios renglones, cada uno con su motivo. Dos módulos nuevos sin DOM —`unidades.js` y `mathml.js`— convierten esa derivación en magnitudes escaladas y en MathML nativo. `calc.js` solo pinta.

**Tech Stack:** JavaScript sin build, patrón UMD como el resto de `js/`, `node --test` de la stdlib, MathML nativo del navegador. **Cero dependencias nuevas.**

**Spec:** [`docs/superpowers/specs/2026-09-08-calculadora-granular-design.md`](../specs/2026-09-08-calculadora-granular-design.md)

## Global Constraints

- **Cero dependencias y cero build.** Prohibido npm, bundlers, pip, CDNs y vendorizar librerías. MathML es nativo del navegador: no se carga ningún fichero.
- **El modelo calcula, la UI consume.** Toda fórmula vive en `network.js`. `steps.js` estructura, `calc.js` pinta. Si `calc.js` calcula un número, está mal.
- **`steps.js` devuelve datos, nunca markup.** Su cabecera lo declara. Emite estructuras; `mathml.js` las traduce.
- **`node --test tests/` falla en este equipo.** Hay que nombrar los ficheros uno a uno. Comando completo en cada tarea.
- **Un documento fechado no se reescribe.** `07-historial.md` y los specs son registros: se añade entrada nueva, no se corrigen a posteriori.
- **El conteo de pruebas se escribe solo en `docs/05-runbook.md`.** Ningún otro documento lo repite.
- **No se abren fichas en `06-pendientes.md`.** Lo que aparezca va como *desvío* al spec del cierre, decidido en el momento.
- **Ante cualquier duda de teoría, se abre el libro**: `referencia/` en este PC, `pdftotext` disponible, **página PDF = página del libro + 26**.
- **No se tocan** `js/sim.js`, `js/ui.js`, `index.html`, `simulador_stop_and_wait_web/` ni `simulador_stop_and_wait_python/`.
- **Todo commit termina con estas dos líneas**, que en adelante se abrevian como `<ATRIBUCIÓN>`:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019mmuskokkzjTBCHX3MDj9Y
```

- **Verificación mínima antes de cada commit:**

```bash
cd C:/Users/gogam/Desktop/Universidad/simulador_stop_and_wait
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/steps.js
node --check simulador_stop_and_wait_v2/js/calc.js
node tools/lint-docs.js
```

## Estructura de ficheros

| Fichero | Responsabilidad | Estado |
|---|---|---|
| `js/network.js` | Todas las fórmulas y tiempos. Sin DOM | Modificar (tareas 1, 2, 3) |
| `js/unidades.js` | Escalera de magnitudes y notación científica. Sin DOM, sin fórmulas del protocolo | **Crear** (tarea 6) |
| `js/mathml.js` | Estructura de fórmula → descripción de nodos → MathML. Sin lógica de protocolo | **Crear** (tarea 7) |
| `js/steps.js` | Convierte el análisis en derivación estructurada. Sin DOM, sin markup | Modificar (tareas 2, 4, 8) |
| `js/calc.js` | Lee controles, pinta. No calcula | Modificar (tareas 3, 5, 8, 9) |
| `calculadora.html` | Estructura de la página | Modificar (tareas 4, 5, 9) |
| `css/style.css` | Estilo de la derivación y del MathML | Modificar (tarea 8) |
| `tests/unidades.test.js` | — | **Crear** (tarea 6) |
| `tests/mathml.test.js` | — | **Crear** (tarea 7) |
| `tests/network.test.js` | — | Modificar (tareas 1, 2, 3) |
| `tests/steps.test.js` | — | Modificar (tareas 2, 4, 8) |
| `tests/bordes.test.js` | — | Modificar (tareas 3, 5) |
| `banco-interfaz.html` | Comprobaciones de interfaz en navegador | Modificar (tarea 9) |

**`mathml.js` se parte en dos capas a propósito.** Una función pura estructura → descripción de nodos (objetos planos), comprobable con `node --test`; y un constructor de ~15 líneas que recorre esa descripción con `createElementNS`. Sin la partición habría que meter jsdom, que es una dependencia, o dejar el módulo sin pruebas.

**Orden deliberado:** tareas 1–5 corrigen defectos reales; 6–9 son la mejora visual. Si el 2026-09-09 aprieta y hay que parar, lo que queda fuera es lo decorativo, no lo incorrecto.

---

### Task 1: `aEfectiva` — que el punto caiga sobre la curva

Hoy la gráfica «Dónde cae este enlace» planta el punto en `(a, U)` con `a = ΣTp/ΣTt`, pero `U = Tt₁/ciclo`. Con varios tramos no se corresponden: en el barrido de verificación apareció un camino de 4 saltos donde la curva decía 99,95 % y `U` real era 0,00088 %.

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/network.js` (dentro de `analyze()`, junto a `aRatio`)
- Modify: `simulador_stop_and_wait_v2/js/steps.js` (`graficas()`, y el detalle del paso `a`)
- Test: `simulador_stop_and_wait_v2/tests/network.test.js`

**Interfaces:**
- Consumes: `N.analyze(path)`, `N.createPath`, `N.createLink` (ya existen)
- Produces: `resultado.aEfectiva` — número. Cumple `1/(1+2·aEfectiva) === utilization` para todo camino válido. `Infinity` si `senderTtMs === 0`.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir al final de `simulador_stop_and_wait_v2/tests/network.test.js`:

```js
// El punto de la gráfica tiene que caer SOBRE la curva U = 1/(1+2a), y con la
// `a` agregada (ΣTp/ΣTt) no cae: mide una cosa y U mide otra. `aEfectiva` se
// define para que la identidad se cumpla por construcción, no por suerte.
test("aEfectiva reproduce U en caminos aleatorios de 1 a 5 saltos", () => {
  let semilla = 987654321;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  const logEntre = (lo, hi) => Math.pow(10, Math.log10(lo) + rnd() * (Math.log10(hi) - Math.log10(lo)));

  let peor = 0;
  for (let i = 0; i < 500; i++) {
    const saltos = 1 + Math.floor(rnd() * 5);
    const enlaces = [];
    for (let h = 0; h < saltos; h++) {
      enlaces.push(
        N.createLink({
          name: `t${h}`,
          rateBps: logEntre(1e4, 1e9),
          distanceKm: logEntre(1, 4e4),
          velocityKmS: 200000,
        })
      );
    }
    const r = N.analyze(
      N.createPath({
        frameBits: Math.round(logEntre(64, 1e6)),
        ackBits: Math.round(logEntre(1, 1000)),
        processingMsPerHop: rnd() * 5,
        links: enlaces,
      })
    );
    const porLaCurva = 1 / (1 + 2 * r.aEfectiva);
    peor = Math.max(peor, Math.abs(porLaCurva - r.utilization) / r.utilization);
  }
  assert.ok(peor < 1e-12, `la identidad U = 1/(1+2·aEfectiva) se rompe: desvío ${peor}`);
});

test("con un salto y ACK despreciable, aEfectiva es la `a` de siempre", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 1000, ackBits: 0,
    rateBps: 50000, distanceKm: 50000, velocityKmS: 200000,
  });
  assert.ok(Math.abs(r.aEfectiva - r.aRatio) < 1e-12, `aEfectiva=${r.aEfectiva} aRatio=${r.aRatio}`);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
cd C:/Users/gogam/Desktop/Universidad/simulador_stop_and_wait
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: FALLA. `r.aEfectiva` es `undefined`, así que `1/(1+2·undefined)` da `NaN` y la comparación revienta el `assert`.

- [ ] **Step 3: Implementar**

En `js/network.js`, dentro de `analyze()`, justo debajo de la línea que define `aRatio`, añadir:

```js
    // `a` que SÍ reproduce U. Despejando de U = Tt(emisor)/ciclo:
    //   U = 1/(1+2a)  ->  a = (ciclo − Tt(emisor)) / (2 · Tt(emisor))
    // Con un solo salto y ACK despreciable coincide con aRatio, así que el caso
    // del libro no cambia. Con varios tramos es la única de las dos que puede
    // dibujarse sobre la curva sin mentir: aRatio mide ΣTp/ΣTt, y U mide otra
    // cosa. Es el defecto 1 del spec del 2026-09-08.
    const aEfectiva = senderTtMs > 0 ? (cycleMs - senderTtMs) / (2 * senderTtMs) : Infinity;
```

Y añadir `aEfectiva,` al objeto devuelto, en la línea siguiente a `aRatio,`.

- [ ] **Step 4: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: PASA, incluidas las que ya había.

- [ ] **Step 5: Usarla en la gráfica**

En `js/steps.js`, función `graficas(r)`, cambiar el campo `actual`:

```js
      curva: {
        puntos,
        // aEfectiva y no aRatio: con varios tramos aRatio no reproduce U y el
        // punto salía disparado fuera de la curva. Ver defecto 1 del spec.
        actual: Number.isFinite(r.aEfectiva) ? { a: r.aEfectiva, u: r.utilization } : null,
      },
```

En el mismo fichero, en el paso `a`, sustituir la rama `else` de `detalle` por:

```js
          : [
              "Con varios tramos se usan los totales del camino: a = ΣTp / ΣTt.",
              `a = ${ms(r.tpTotalMs)} / ${ms(r.ttDataTotalMs)} = ${redondear(r.aRatio)}`,
              `Ojo: con varios tramos esta a NO reproduce U, porque U mide solo el tramo del emisor. La que se dibuja en la curva es a efectiva = (ciclo − Tt del emisor) / (2 · Tt del emisor) = ${redondear(r.aEfectiva)}.`,
            ],
```

- [ ] **Step 6: Verificar y commitear**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/steps.test.js
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/steps.js
git add simulador_stop_and_wait_v2/js/network.js simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/tests/network.test.js
git commit -m "fix(v2): el punto de la curva cae sobre la curva, tambien con varios saltos

<ATRIBUCIÓN>"
```

---

### Task 2: El `BD` del libro, separado de la ventana `2BD+1`

`bandwidthDelayProductBits` calcula `R·RTT = 26.000 bits` y la interfaz lo llama BDP. El BD del libro (p. 201) es `R·Tp = 12,5 kbit = 12,5 tramas`, y **26 tramas es la ventana `2BD+1`**. Coinciden por la identidad `R·RTT = 2·BD + L`, no por ser la misma cosa.

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/network.js`
- Modify: `simulador_stop_and_wait_v2/js/steps.js`
- Test: `simulador_stop_and_wait_v2/tests/network.test.js`, `simulador_stop_and_wait_v2/tests/steps.test.js`

**Interfaces:**
- Consumes: `resultado.tpTotalMs`, `resultado.perLink[0].rateBps` (ya existen)
- Produces: `resultado.bandwidthDelayBits` (número, `R·Tp` de un sentido) y `resultado.windowFrames` (número, `2·BD/L + 1`, sin redondear). `bandwidthDelayProductBits` se conserva sin tocar: `R·RTT` es una cantidad legítima, solo estaba mal nombrada en la interfaz.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `simulador_stop_and_wait_v2/tests/network.test.js`:

```js
// Libro, p. 201: enlace de 50 kbps con tránsito en un sentido de 250 ms ->
// BD = 12,5 kbit = 12,5 tramas de 1000 bits, y la ventana es 2BD+1 = 26 tramas.
// El código llamaba BDP a las 26, que es la ventana, no el producto.
test("satelite del libro: BD son 12,5 tramas y la ventana 26", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 1000, ackBits: 0,
    rateBps: 50000, distanceKm: 50000, velocityKmS: 200000,
  });
  assert.equal(r.tpTotalMs, 250);
  assert.equal(r.bandwidthDelayBits, 12500);
  assert.equal(r.bandwidthDelayBits / r.frameBits, 12.5);
  assert.equal(r.windowFrames, 26);
});

test("identidad R·RTT = 2·BD + L en un enlace con ACK despreciable", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 1000, ackBits: 0,
    rateBps: 50000, distanceKm: 50000, velocityKmS: 200000,
  });
  assert.equal(r.bandwidthDelayProductBits, 2 * r.bandwidthDelayBits + r.frameBits);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: FALLA con `undefined !== 12500`.

- [ ] **Step 3: Implementar**

En `js/network.js`, sustituir el bloque de `bandwidthDelayProductBits` por:

```js
    // Producto ancho de banda-retardo. Hay dos cantidades distintas que la
    // gente llama igual, y confundirlas fue el defecto 2 del spec del
    // 2026-09-08:
    //
    //   BD (el del libro, p. 201) = R · Tp de UN sentido. En el satélite son
    //   12,5 kbit, o 12,5 tramas de 1000 bits.
    //
    //   R · RTT = bits que caben en un viaje de ida y vuelta. En el satélite
    //   son 26.000. Coincide con la ventana porque R·RTT = 2·BD + L, no
    //   porque sea el mismo concepto.
    //
    // La ventana que el libro pide para llenar el canal es 2BD+1 tramas.
    const bandwidthDelayBits = perLink[0].rateBps * (tpTotalMs / MS_PER_S);
    const bandwidthDelayProductBits = perLink[0].rateBps * (rttMs / MS_PER_S);
    const windowFrames = (2 * bandwidthDelayBits) / path.frameBits + 1;
```

Y añadir `bandwidthDelayBits,` y `windowFrames,` al objeto devuelto, junto a `bandwidthDelayProductBits`.

- [ ] **Step 4: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: PASA.

- [ ] **Step 5: Partir el paso `bdp` en dos filas honestas**

En `js/steps.js`, sustituir el `paso({ id: "bdp", ... })` entero por:

```js
    pasos.push(
      paso({
        id: "bd",
        titulo: "Producto ancho de banda por retardo",
        formula: "BD = R · Tp",
        sustitucion: `${crudo(r.perLink[0].rateBps)} · ${redondear(r.tpTotalMs / 1000)} s`,
        resultado: `${entero(r.bandwidthDelayBits)} bits`,
        detalle: [
          `Son ${redondear(r.bandwidthDelayBits / r.frameBits)} tramas de ${crudo(r.frameBits)} bits.`,
          "Es lo que cabe en el canal en UN sentido: los bits que ya salieron y todavía no han llegado.",
          "El libro lo llama BD y lo mide con el tiempo de tránsito en un sentido, no con el de ida y vuelta.",
        ],
      })
    );

    pasos.push(
      paso({
        id: "ventana",
        titulo: "Ventana que haría falta para llenar el canal",
        formula: "ventana = 2 · BD + 1",
        sustitucion: `2 · ${redondear(r.bandwidthDelayBits / r.frameBits)} + 1`,
        resultado: `${redondear(r.windowFrames)} tramas`,
        detalle: [
          "Es lo que un protocolo de ventana deslizante necesitaría tener en vuelo para no parar nunca.",
          "Stop & Wait tiene ventana 1: deja ese hueco vacío, y eso es exactamente lo que mide U.",
          `El «+1» sale de que el receptor no manda el ACK hasta recibir la trama entera. En bits, esto es ${entero(r.bandwidthDelayProductBits)} = 2·BD + L.`,
        ],
      })
    );
```

- [ ] **Step 6: Ajustar la prueba de `steps.js` que buscaba el paso `bdp`**

En `simulador_stop_and_wait_v2/tests/steps.test.js`, buscar con `grep -n '"bdp"' tests/steps.test.js` y cambiar el identificador por `"bd"` en la llamada a `porId`. Si la prueba comprobaba las 26 tramas, mover esa comprobación al paso `"ventana"`:

```js
test("el desarrollo separa el BD del libro de la ventana 2BD+1", () => {
  const s = Steps.build(satelite());
  assert.match(porId(s, "bd").resultado, /12\.?500 bits/);
  assert.match(porId(s, "ventana").resultado, /26 tramas/);
});
```

- [ ] **Step 7: Verificar y commitear**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/steps.test.js
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/steps.js
git add simulador_stop_and_wait_v2/js/network.js simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/tests/
git commit -m "fix(v2): el BD del libro deja de confundirse con la ventana 2BD+1

Se llamaba BDP a R·RTT = 26.000 bits. El BD del libro (p. 201) es R·Tp =
12,5 kbit = 12,5 tramas; 26 tramas es la ventana 2BD+1. Coinciden por la
identidad R·RTT = 2·BD + L, no por ser la misma cosa.

<ATRIBUCIÓN>"
```

---

### Task 3: Cabecera — que el goodput de un fichero deje de mentir

`tramas = ⌈fichero/L⌉` supone que los `L` bits son todos datos. El libro usa 40 bits de cabecera y 3960 de datos en sus ejercicios. Sin cabecera, el goodput de un fichero sale inflado.

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/network.js` (`createPath`, `validatePath`, `transferAnalysis`)
- Test: `simulador_stop_and_wait_v2/tests/network.test.js`, `simulador_stop_and_wait_v2/tests/bordes.test.js`

**Interfaces:**
- Consumes: `N.createPath`, `N.transferAnalysis` (ya existen)
- Produces: `path.headerBits` (número, por defecto `0`), y `transferAnalysis()` devuelve además `payloadBitsPerFrame` (número). Con `headerBits === 0` ningún número cambia respecto de hoy.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `simulador_stop_and_wait_v2/tests/network.test.js`:

```js
function caminoSimple(extra) {
  return N.createPath({
    frameBits: 4000,
    ackBits: 0,
    links: [N.createLink({ rateBps: 1000000, distanceKm: 100, velocityKmS: 200000 })],
    ...(extra || {}),
  });
}

test("sin cabecera los numeros no cambian", () => {
  const t = N.transferAnalysis(caminoSimple(), 40000);
  assert.equal(t.payloadBitsPerFrame, 4000);
  assert.equal(t.frames, 10);
});

// Libro, cap. 3, ejercicio 33: tramas de 40 bits de cabecera y 3960 de datos.
test("con cabecera de 40 bits caben 3960 de datos por trama", () => {
  const t = N.transferAnalysis(caminoSimple({ headerBits: 40 }), 39600);
  assert.equal(t.payloadBitsPerFrame, 3960);
  assert.equal(t.frames, 10);
  assert.ok(t.goodputBps < N.transferAnalysis(caminoSimple(), 39600).goodputBps);
});

test("una cabecera que se come la trama entera se rechaza", () => {
  assert.throws(() => caminoSimple({ headerBits: 4000 }), RangeError);
  assert.throws(() => caminoSimple({ headerBits: -1 }), RangeError);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Esperado: FALLA. `payloadBitsPerFrame` es `undefined` y `createPath` acepta una cabecera de 4000 sin protestar.

- [ ] **Step 3: Implementar**

En `js/network.js`, en `createPath()`, añadir al objeto `path`:

```js
      headerBits: spec.headerBits === undefined ? 0 : spec.headerBits,
```

En `validatePath()`, añadir antes del `return`:

```js
    if (!Number.isFinite(path.headerBits) || path.headerBits < 0) {
      problems.push("la cabecera no puede ser negativa");
    }
    if (path.headerBits >= path.frameBits) {
      problems.push("la cabecera tiene que caber en la trama: no puede llegar a L");
    }
```

Sustituir el cuerpo de `transferAnalysis()` por:

```js
  function transferAnalysis(path, totalBits) {
    if (!isPositive(totalBits)) throw new RangeError("el tamaño a transferir debe ser > 0 bits");

    const r = analyze(path);
    // De cada trama de L bits, la cabecera no lleva datos del fichero. Con
    // headerBits = 0 esto es exactamente lo de antes.
    const payloadBitsPerFrame = path.frameBits - path.headerBits;
    const frames = Math.ceil(totalBits / payloadBitsPerFrame);
    const totalMs = frames * r.cycleMs;
    return {
      frames,
      payloadBitsPerFrame,
      cycleMs: r.cycleMs,
      totalMs,
      goodputBps: totalBits / (totalMs / MS_PER_S),
    };
  }
```

- [ ] **Step 4: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
```

Esperado: PASA. Si alguna prueba de `bordes.test.js` construye un camino con `frameBits` muy pequeño, comprobar que no le mete cabecera por accidente.

- [ ] **Step 5: Commitear**

```bash
node --check simulador_stop_and_wait_v2/js/network.js
git add simulador_stop_and_wait_v2/js/network.js simulador_stop_and_wait_v2/tests/network.test.js
git commit -m "feat(v2): cabecera por trama, para que el goodput de un fichero no mienta

<ATRIBUCIÓN>"
```

---

### Task 4: Atribuciones — decir de qué libro sale cada cosa, y de cuál no

Tres afirmaciones falsas: que `U = 3,846 %` es el número del libro (dice 4 %), que el preset LAN es de Tanenbaum (no aparece en sus 820 páginas; es formulación de Stallings), y que `U` con varios saltos es «del canal» (es la del enlace del emisor).

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/steps.js`
- Modify: `simulador_stop_and_wait_v2/calculadora.html`
- Test: `simulador_stop_and_wait_v2/tests/steps.test.js`

**Interfaces:**
- Consumes: `r.hops`, `r.utilization`, `r.aRatio` (ya existen)
- Produces: nada nuevo. Solo cambian textos y el `titulo` del paso `u`.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `simulador_stop_and_wait_v2/tests/steps.test.js`:

```js
// El libro (p. 200) dice "sólo se usó 4% del ancho de banda". El 3,846 % es
// nuestro 20/520 exacto: correcto, pero no es una cita. Decir cuál es cuál.
test("el desarrollo distingue el 4 % del libro del 3,846 % exacto", () => {
  const s = Steps.build(satelite());
  const u = porId(s, "u");
  const texto = [u.resultado, ...u.detalle, u.nota].join(" ");
  assert.match(texto, /3,846/);
  assert.match(texto, /4 ?%/);
  assert.match(texto, /redondea/i);
});

test("con varios saltos U se llama la del enlace del emisor, no la del canal", () => {
  const dos = N.analyze(
    N.createPath({
      frameBits: 1000, ackBits: 0,
      links: [
        N.createLink({ name: "A", rateBps: 1000000, distanceKm: 35786, velocityKmS: 300000 }),
        N.createLink({ name: "B", rateBps: 500000, distanceKm: 35786, velocityKmS: 300000 }),
      ],
    })
  );
  assert.match(porId(Steps.build(dos), "u").titulo, /emisor/i);
  assert.match(porId(Steps.build(satelite()), "u").titulo, /^Utilización del canal$/);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: FALLA. No hay ningún «4 %» ni la palabra «redondea», y el título es siempre `Utilización del canal`.

- [ ] **Step 3: Implementar el título y la nota del 4 %**

En `js/steps.js`, en el paso `u`, cambiar `titulo` y añadir la nota del libro. Sustituir el bloque `const detalleU = [...]` y el `paso({ id: "u", ... })` por:

```js
    const detalleU = [
      `El emisor solo transmite datos ${ms(r.senderTtMs)} de cada ${ms(r.cycleMs)}.`,
    ];
    if (unSalto && r.ackBits === 0 && !conVuelta) {
      detalleU.push(
        `Comprobación con la forma cerrada: U = 1 / (1 + 2a) = 1 / (1 + 2 · ${redondear(r.aRatio)}) = ${pct(1 / (1 + 2 * r.aRatio))}`
      );
      detalleU.push(
        "Esa forma cerrada, y la letra a, son de Stallings. Tanenbaum razona con tiempos crudos y nunca define a: para el satélite dice que el emisor está bloqueado 500/520 = 96 % del tiempo y redondea a «sólo se usó 4 %». El valor exacto que sale aquí es el mismo número sin redondear."
      );
    } else {
      detalleU.push(
        "Con varios tramos, ACK con tamaño o canal half duplex, la forma 1/(1+2a) ya no basta: hay que dividir por el ciclo real."
      );
    }
    if (!unSalto) {
      detalleU.push(
        "Con varios tramos esta U es la del enlace del emisor: mide qué fracción del ciclo pasa ese primer tramo empujando bits. Los tramos siguientes tienen la suya, y no es la misma."
      );
    }

    pasos.push(
      paso({
        id: "u",
        titulo: unSalto ? "Utilización del canal" : "Utilización del enlace del emisor",
        formula: "U = Tt(emisor) / ciclo",
        sustitucion: `${ms(r.senderTtMs)} / ${ms(r.cycleMs)}`,
        resultado: pct(r.utilization),
        detalle: detalleU,
        nota: `El canal queda ocioso el ${pct(r.idleFraction)} del tiempo.`,
      })
    );
```

- [ ] **Step 4: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: PASA.

- [ ] **Step 5: Separar el preset LAN y corregir el pie de página**

En `calculadora.html`, sustituir el bloque `<div class="presets">` entero por:

```html
    <div class="presets">
      <span class="presets-label">Ejemplos del libro:</span>
      <button type="button" class="btn-ghost btn-small" data-preset="satelite">Satélite · Tanenbaum p. 200</button>
      <button type="button" class="btn-ghost btn-small" data-preset="casa-satelite-casa">Casa → satélite → casa</button>
    </div>
    <div class="presets">
      <span class="presets-label">Ejemplo de clase:</span>
      <button type="button" class="btn-ghost btn-small" data-preset="lan">LAN 10 Mbps · 1 km</button>
      <span class="hint">No sale de Tanenbaum: la letra <em>a</em> y la forma U = 1/(1+2a) son de Stallings.</span>
    </div>
```

Y sustituir el `<p>` del `<footer>` por:

```html
  <p>
    Protocolo, ejemplos y CRC: Tanenbaum &amp; Wetherall, <em>Redes de computadoras</em>, 5.ª ed., cap. 3.
    El parámetro <em>a</em> y la forma cerrada U = 1/(1+2a) son de Stallings, no de Tanenbaum.
    Cada resultado de esta página tiene una prueba automática.
  </p>
```

- [ ] **Step 6: Corregir el comentario mentiroso de la prueba de LAN**

En `simulador_stop_and_wait_v2/tests/steps.test.js`, el comentario que empieza por `// El ejemplo de LAN del libro (Tanenbaum, cap. 3: 10 Mbps, 1 km, ...)` afirma algo falso. Sustituir esa primera línea por:

```js
// El ejemplo de LAN de clase (10 Mbps, 1 km, V = 2·10^8 m/s, tramas de 500
// bits). NO es de Tanenbaum: se buscó `83,3` y `1 + 2a` en las 820 páginas de
// la 5.ª edición y no aparecen. Es formulación de Stallings. Se recorre por el
// mismo camino que la calculadora, que es donde se rompió:
```

Y renombrar el `test(...)` correspondiente quitándole «del libro»: buscar con `grep -n "del libro" tests/steps.test.js` y dejar `"El ejemplo de LAN de clase llega al desarrollo: a = 0,1 y U = 83,33 %"`.

- [ ] **Step 7: Verificar y commitear**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
node --check simulador_stop_and_wait_v2/js/steps.js
git add simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/calculadora.html simulador_stop_and_wait_v2/tests/steps.test.js
git commit -m "fix(v2): decir de que libro sale cada formula, y de cual no

El preset LAN y la forma U = 1/(1+2a) se atribuian a Tanenbaum. Se busco
'83,3' y '1 + 2a' en las 820 paginas de la 5.a edicion: no aparecen. Es
Stallings. El satelite si es suyo (p. 200), y alli el libro redondea a 4 %.

<ATRIBUCIÓN>"
```

---

### Task 5: Quitar `P error trama` y `P error ACK` de la calculadora

Solo de la calculadora. `sim.js` y `ui.js` conservan su ruido entero. No hay que borrar los pasos de `steps.js`: sin las P, `conErrores` es falso y se apagan solos.

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/calc.js` (constante `CAMPOS`, `PRESETS`, `anadirTramo`, `recalcular`)
- Modify: `simulador_stop_and_wait_v2/js/steps.js` (el paso `caudal`)
- Test: `simulador_stop_and_wait_v2/tests/bordes.test.js`, `simulador_stop_and_wait_v2/tests/steps.test.js`

**Interfaces:**
- Consumes: nada nuevo
- Produces: `CAMPOS` en `calc.js` pasa de 7 a 5 entradas. Los enlaces que construye la calculadora ya no pasan `errorProbData` ni `errorProbAck`, así que `createLink` los da por 0.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `simulador_stop_and_wait_v2/tests/steps.test.js`:

```js
// Sin probabilidades de error, el caudal es L/ciclo a secas. Arrastrar un
// "· (1 − P)" con P = 0 es ruido en la pizarra.
test("sin errores el caudal no arrastra el (1 - P)", () => {
  const s = Steps.build(satelite());
  const caudal = porId(s, "caudal");
  assert.equal(caudal.formula, "caudal = L / ciclo");
  // Ojo con comprobar esto buscando un "1": la sustitucion es "1000 / 520 ms" y
  // lleva unos de sobra. Lo que no debe aparecer es el producto por (1 - P).
  assert.ok(!caudal.sustitucion.includes("·"), `sobra el factor: ${caudal.sustitucion}`);
});

test("con errores el caudal sigue mostrando el (1 - P)", () => {
  const s = Steps.build(satelite({ errorProbData: 0.1 }));
  assert.equal(porId(s, "caudal").formula, "caudal = L · (1 − P) / ciclo");
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: FALLA. La fórmula es siempre `caudal = L · (1 − P) / ciclo`.

- [ ] **Step 3: Implementar el caudal condicional**

En `js/steps.js`, sustituir el `paso({ id: "caudal", ... })` por:

```js
    pasos.push(
      paso({
        id: "caudal",
        titulo: "Caudal útil",
        formula: conErrores ? "caudal = L · (1 − P) / ciclo" : "caudal = L / ciclo",
        sustitucion: conErrores
          ? `${crudo(r.frameBits)} · ${redondear(r.cycleSuccessProb)} / ${ms(r.cycleMs)}`
          : `${crudo(r.frameBits)} / ${ms(r.cycleMs)}`,
        resultado: bps(r.throughputBps),
        detalle: [
          `De los ${bps(r.perLink[0].rateBps)} que da el primer tramo, en la práctica se aprovechan ${bps(r.throughputBps)}.`,
        ],
      })
    );
```

- [ ] **Step 4: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: PASA.

- [ ] **Step 5: Quitar los dos campos de la calculadora**

En `js/calc.js`, borrar de la constante `CAMPOS` estas dos líneas:

```js
    { key: "errorProbData", label: "P error trama (0–1)", type: "number", min: 0, max: 1, step: 0.01 },
    { key: "errorProbAck", label: "P error ACK (0–1)", type: "number", min: 0, max: 1, step: 0.01 },
```

En la misma constante, dejar arriba este comentario:

```js
  // Sin probabilidades de error: la calculadora calcula tiempos de un canal
  // limpio (decisión del usuario, 2026-09-08). El ruido vive en el simulador,
  // en sim.js y ui.js, y ahí no se ha tocado nada.
```

En `PRESETS`, quitar `errorProbData: 0, errorProbAck: 0,` de los cuatro enlaces. En `anadirTramo()`, cambiar la línea de valores por defecto por:

```js
      turnaroundMs: 0,
```

- [ ] **Step 6: Comprobar que `recalcular()` no los sigue leyendo**

```bash
grep -n "errorProb" simulador_stop_and_wait_v2/js/calc.js
```

Esperado: **ninguna línea**. Si `recalcular()` pasa `errorProbData: v.errorProbData` a `N.createLink`, borrar esas dos líneas: sin ellas `createLink` las da por 0.

- [ ] **Step 7: Ajustar las pruebas de borde que metían las P por la calculadora**

```bash
grep -n "errorProb" simulador_stop_and_wait_v2/tests/bordes.test.js
```

Las que llaman al modelo directamente (`N.createLink({... errorProbData ...})`) **se quedan como están**: el modelo sigue soportando errores y el simulador los usa. Solo se retiran las que afirmen que la calculadora ofrece esos campos.

- [ ] **Step 8: Verificar y commitear**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
node --check simulador_stop_and_wait_v2/js/calc.js
node --check simulador_stop_and_wait_v2/js/steps.js
git add simulador_stop_and_wait_v2/js/calc.js simulador_stop_and_wait_v2/js/steps.js simulador_stop_and_wait_v2/tests/
git commit -m "feat(v2): la calculadora deja de pedir probabilidades de error

Decision del usuario: la calculadora calcula un canal limpio. El simulador
conserva su ruido entero; sim.js y ui.js no se tocan. Los pasos de error de
steps.js no se borran: sin las P se apagan solos.

<ATRIBUCIÓN>"
```

---

### Task 6: `unidades.js` — la escalera de magnitudes, con la conversión a la vista

Hoy `20 ms` aparece sin decir que salen de `0,02 s × 1000 ms/s`. Este módulo devuelve la conversión, no solo el resultado.

**Files:**
- Create: `simulador_stop_and_wait_v2/js/unidades.js`
- Test: `simulador_stop_and_wait_v2/tests/unidades.test.js`

**Interfaces:**
- Consumes: nada. Módulo hoja, sin DOM y sin lógica de protocolo.
- Produces:
  - `escalarTiempo(ms)` → `{ valor, unidad, factorDesdeMs, simboloBase: "ms" }`. Unidades: `ns`, `µs`, `ms`, `s`. `valor === ms * factorDesdeMs`.
  - `escalarBits(bits)` → `{ valor, unidad, factorDesdeBits }`. Unidades: `bits`, `Kb`, `Mb`, `Gb`, decimales (1000).
  - `cientifica(v)` → `{ mantisa, exponente }` con `1 ≤ |mantisa| < 10`, o `{ mantisa: 0, exponente: 0 }` si `v === 0`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `simulador_stop_and_wait_v2/tests/unidades.test.js`:

```js
// unidades.test.js — la escalera de magnitudes.
// `node --test tests/unidades.test.js`

const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../js/unidades.js");

test("escalarTiempo elige la unidad y deja ver el factor", () => {
  assert.deepEqual(U.escalarTiempo(20), { valor: 20, unidad: "ms", factorDesdeMs: 1, simboloBase: "ms" });
  assert.deepEqual(U.escalarTiempo(520), { valor: 520, unidad: "ms", factorDesdeMs: 1, simboloBase: "ms" });
  assert.deepEqual(U.escalarTiempo(2000), { valor: 2, unidad: "s", factorDesdeMs: 0.001, simboloBase: "ms" });
  assert.deepEqual(U.escalarTiempo(0.05), { valor: 50, unidad: "µs", factorDesdeMs: 1000, simboloBase: "ms" });
  assert.deepEqual(U.escalarTiempo(0.00005), { valor: 50, unidad: "ns", factorDesdeMs: 1000000, simboloBase: "ms" });
});

test("el factor reconstruye el valor original", () => {
  for (const ms of [0.00001, 0.003, 1, 47, 999, 1000, 86400000]) {
    const e = U.escalarTiempo(ms);
    assert.ok(Math.abs(e.valor / e.factorDesdeMs - ms) < 1e-9 * Math.max(1, ms), `${ms} no se reconstruye`);
  }
});

test("escalarBits usa la escalera decimal, no la de 1024", () => {
  assert.deepEqual(U.escalarBits(500), { valor: 500, unidad: "bits", factorDesdeBits: 1 });
  assert.deepEqual(U.escalarBits(8000), { valor: 8, unidad: "Kb", factorDesdeBits: 0.001 });
  assert.equal(U.escalarBits(1024).unidad, "Kb");
  assert.equal(U.escalarBits(1024).valor, 1.024);
  assert.equal(U.escalarBits(2500000).unidad, "Mb");
  assert.equal(U.escalarBits(7e9).unidad, "Gb");
});

test("cientifica parte el numero en mantisa y exponente", () => {
  assert.deepEqual(U.cientifica(0.02), { mantisa: 2, exponente: -2 });
  assert.deepEqual(U.cientifica(1000), { mantisa: 1, exponente: 3 });
  assert.deepEqual(U.cientifica(0), { mantisa: 0, exponente: 0 });
  const c = U.cientifica(83.33);
  assert.equal(c.exponente, 1);
  assert.ok(Math.abs(c.mantisa - 8.333) < 1e-9);
});

test("cientifica se puede deshacer", () => {
  for (const v of [0.0000123, 0.5, 7, 520, 26000, 1e9]) {
    const c = U.cientifica(v);
    assert.ok(Math.abs(c.mantisa * Math.pow(10, c.exponente) - v) < 1e-9 * v, `${v} no se reconstruye`);
    assert.ok(Math.abs(c.mantisa) >= 1 && Math.abs(c.mantisa) < 10, `mantisa fuera de rango: ${c.mantisa}`);
  }
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

```bash
node --test simulador_stop_and_wait_v2/tests/unidades.test.js
```

Esperado: FALLA con `Cannot find module '../js/unidades.js'`.

- [ ] **Step 3: Implementar**

Crear `simulador_stop_and_wait_v2/js/unidades.js`:

```js
// unidades.js
// La escalera de magnitudes del simulador. No sabe nada del protocolo ni del
// DOM: solo convierte y, sobre todo, DEJA VER la conversión. `escalarTiempo`
// devuelve el factor además del resultado, porque el desarrollo tiene que poder
// escribir "0,02 s × 1000 ms/s = 20 ms" en vez de sacar el 20 de la manga.
//
// Decimal, no binario: 1 Kb son 1000 bits, igual que en el resto del proyecto.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Unidades = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // De mayor a menor. `desde` es el valor en ms a partir del cual manda.
  const TIEMPO = [
    { unidad: "s", desde: 1000, factorDesdeMs: 0.001 },
    { unidad: "ms", desde: 1, factorDesdeMs: 1 },
    { unidad: "µs", desde: 0.001, factorDesdeMs: 1000 },
    { unidad: "ns", desde: 0, factorDesdeMs: 1000000 },
  ];

  const BITS = [
    { unidad: "Gb", desde: 1e9, factorDesdeBits: 1e-9 },
    { unidad: "Mb", desde: 1e6, factorDesdeBits: 1e-6 },
    { unidad: "Kb", desde: 1e3, factorDesdeBits: 1e-3 },
    { unidad: "bits", desde: 0, factorDesdeBits: 1 },
  ];

  function escalarTiempo(ms) {
    const abs = Math.abs(ms);
    const escalon = TIEMPO.find((e) => abs >= e.desde) || TIEMPO[TIEMPO.length - 1];
    return {
      valor: ms * escalon.factorDesdeMs,
      unidad: escalon.unidad,
      factorDesdeMs: escalon.factorDesdeMs,
      simboloBase: "ms",
    };
  }

  function escalarBits(bits) {
    const abs = Math.abs(bits);
    const escalon = BITS.find((e) => abs >= e.desde) || BITS[BITS.length - 1];
    return {
      valor: bits * escalon.factorDesdeBits,
      unidad: escalon.unidad,
      factorDesdeBits: escalon.factorDesdeBits,
    };
  }

  function cientifica(v) {
    if (v === 0 || !Number.isFinite(v)) return { mantisa: 0, exponente: 0 };
    const exponente = Math.floor(Math.log10(Math.abs(v)));
    return { mantisa: v / Math.pow(10, exponente), exponente };
  }

  return { escalarTiempo, escalarBits, cientifica };
});
```

- [ ] **Step 4: Correr y ver que pasan**

```bash
node --test simulador_stop_and_wait_v2/tests/unidades.test.js
```

Esperado: PASA, 5 pruebas.

Si `escalarBits(1024).valor` sale `1.0240000000000002`, la prueba con `assert.equal` fallará por coma flotante: cambiarla por `assert.ok(Math.abs(U.escalarBits(1024).valor - 1.024) < 1e-12)`.

- [ ] **Step 5: Commitear**

```bash
node --check simulador_stop_and_wait_v2/js/unidades.js
git add simulador_stop_and_wait_v2/js/unidades.js simulador_stop_and_wait_v2/tests/unidades.test.js
git commit -m "feat(v2): unidades.js, la escalera de magnitudes con el factor a la vista

<ATRIBUCIÓN>"
```

---

### Task 7: `mathml.js` — fórmulas apiladas como en el libro, sin librería

MathML es nativo: verificado en el Chromium del proyecto que dibuja la fracción de verdad (numerador apilado, raya, anchos igualados) sin cargar un solo fichero. Una librería violaría la regla de cero dependencias.

**Files:**
- Create: `simulador_stop_and_wait_v2/js/mathml.js`
- Test: `simulador_stop_and_wait_v2/tests/mathml.test.js`

**Interfaces:**
- Consumes: nada. Módulo hoja.
- Produces:
  - `describir(expr)` → árbol de objetos planos `{ tag, texto?, hijos? }`. **Función pura, sin DOM: es la que se prueba con `node --test`.**
  - `render(expr, documento)` → nodo `<math>`. Solo en navegador.
  - Formas que entiende `expr`: `{t:"sim", v}` símbolo · `{t:"num", v, u?}` número con unidad opcional · `{t:"op", v}` operador · `{t:"frac", num, den}` fracción · `{t:"pot10", mantisa, exponente, u?}` potencia de diez · `{t:"fila", partes:[]}` secuencia.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `simulador_stop_and_wait_v2/tests/mathml.test.js`:

```js
// mathml.test.js — la traducción de fórmula a MathML.
// `node --test tests/mathml.test.js`
//
// Se prueba `describir`, que es pura y devuelve objetos planos. `render` usa
// createElementNS y solo corre en navegador: sus comprobaciones viven en
// banco-interfaz.html, porque meter jsdom sería una dependencia.

const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/mathml.js");

test("una fraccion produce un mfrac con dos hijos", () => {
  const d = M.describir({ t: "frac", num: { t: "sim", v: "L" }, den: { t: "sim", v: "R" } });
  assert.equal(d.tag, "mfrac");
  assert.equal(d.hijos.length, 2);
  assert.equal(d.hijos[0].tag, "mi");
  assert.equal(d.hijos[0].texto, "L");
  assert.equal(d.hijos[1].texto, "R");
});

test("un numero con unidad lleva la unidad como texto, no como variable", () => {
  const d = M.describir({ t: "num", v: "1000", u: "bits" });
  assert.equal(d.tag, "mrow");
  assert.equal(d.hijos[0].tag, "mn");
  assert.equal(d.hijos[0].texto, "1000");
  assert.equal(d.hijos[1].tag, "mtext");
  assert.match(d.hijos[1].texto, /bits/);
});

test("una potencia de diez se apila como exponente", () => {
  const d = M.describir({ t: "pot10", mantisa: "2", exponente: "-2", u: "s" });
  const sup = JSON.stringify(d).includes('"msup"');
  assert.ok(sup, "falta el msup del exponente");
  assert.match(JSON.stringify(d), /"-2"/);
});

test("una fila encadena sus partes en orden", () => {
  const d = M.describir({
    t: "fila",
    partes: [{ t: "sim", v: "Tt" }, { t: "op", v: "=" }, { t: "num", v: "20", u: "ms" }],
  });
  assert.equal(d.tag, "mrow");
  assert.equal(d.hijos[0].texto, "Tt");
  assert.equal(d.hijos[1].tag, "mo");
  assert.equal(d.hijos[1].texto, "=");
});

test("un valor con caracteres raros viaja como texto, no como estructura", () => {
  const d = M.describir({ t: "sim", v: "<script>x</script>" });
  assert.equal(d.tag, "mi");
  assert.equal(d.texto, "<script>x</script>");
  assert.equal(d.hijos, undefined);
});

test("una forma desconocida no revienta: cae a texto", () => {
  const d = M.describir({ t: "inventada", v: "?" });
  assert.equal(d.tag, "mtext");
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

```bash
node --test simulador_stop_and_wait_v2/tests/mathml.test.js
```

Esperado: FALLA con `Cannot find module '../js/mathml.js'`.

- [ ] **Step 3: Implementar**

Crear `simulador_stop_and_wait_v2/js/mathml.js`:

```js
// mathml.js
// Traduce una estructura de fórmula a MathML nativo. Sin librería: se comprobó
// en el Chromium del proyecto que el navegador dibuja la fracción de verdad
// —numerador apilado, raya, anchos igualados— sin cargar ni un fichero. KaTeX o
// MathJax violarían la regla de cero dependencias.
//
// Va en dos capas a propósito:
//   describir(expr) -> objetos planos. PURA, y es lo que prueban los tests.
//   render(expr, doc) -> nodos MathML. Necesita navegador; se comprueba en
//                        banco-interfaz.html.
// Sin esa partición habría que meter jsdom, que es una dependencia.
//
// `render` construye con createElementNS y asigna texto con textContent: un
// valor de entrada nunca se interpreta como markup.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MathMLModel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NS = "http://www.w3.org/1998/Math/MathML";

  const hoja = (tag, texto) => ({ tag, texto: String(texto) });
  const rama = (tag, hijos) => ({ tag, hijos });

  // Espacio fino delante de la unidad, como se escribe en física: "20 ms".
  const conUnidad = (nodo, u) => (u ? rama("mrow", [nodo, hoja("mtext", `\u2009${u}`)]) : nodo);

  function describir(expr) {
    if (!expr || typeof expr !== "object") return hoja("mtext", String(expr));

    switch (expr.t) {
      case "sim":
        return hoja("mi", expr.v);
      case "num":
        return conUnidad(hoja("mn", expr.v), expr.u);
      case "op":
        return hoja("mo", expr.v);
      case "frac":
        return rama("mfrac", [describir(expr.num), describir(expr.den)]);
      case "pot10":
        return conUnidad(
          rama("mrow", [
            hoja("mn", expr.mantisa),
            hoja("mo", "\u00d7"),
            rama("msup", [hoja("mn", "10"), hoja("mn", expr.exponente)]),
          ]),
          expr.u
        );
      case "fila":
        return rama("mrow", (expr.partes || []).map(describir));
      default:
        // Una forma que no se entiende se enseña como texto en vez de
        // desaparecer: un hueco en blanco en la pizarra es peor que un feo.
        return hoja("mtext", expr.v === undefined ? "?" : String(expr.v));
    }
  }

  function construir(desc, doc) {
    const el = doc.createElementNS(NS, desc.tag);
    if (desc.hijos) desc.hijos.forEach((h) => el.appendChild(construir(h, doc)));
    else el.textContent = desc.texto;
    return el;
  }

  function render(expr, doc) {
    const math = doc.createElementNS(NS, "math");
    math.setAttribute("display", "inline");
    math.appendChild(construir(describir(expr), doc));
    return math;
  }

  return { describir, render, NS };
});
```

- [ ] **Step 4: Correr y ver que pasan**

```bash
node --test simulador_stop_and_wait_v2/tests/mathml.test.js
```

Esperado: PASA, 6 pruebas.

- [ ] **Step 5: Commitear**

```bash
node --check simulador_stop_and_wait_v2/js/mathml.js
git add simulador_stop_and_wait_v2/js/mathml.js simulador_stop_and_wait_v2/tests/mathml.test.js
git commit -m "feat(v2): mathml.js, formulas apiladas con MathML nativo y cero dependencias

<ATRIBUCIÓN>"
```

---

### Task 8: La derivación granular — que se vea el 1000

El paso deja de ser *fórmula → sustitución → resultado* y pasa a ser una cadena de renglones con su motivo. Es el corazón de lo que pidió el usuario.

**Files:**
- Modify: `simulador_stop_and_wait_v2/js/steps.js` (helper `derivarTiempo`, pasos `tt` y `tp`)
- Modify: `simulador_stop_and_wait_v2/js/calc.js` (`bloquePaso`)
- Modify: `simulador_stop_and_wait_v2/calculadora.html` (cargar los dos módulos nuevos)
- Modify: `simulador_stop_and_wait_v2/css/style.css`
- Test: `simulador_stop_and_wait_v2/tests/steps.test.js`

**Interfaces:**
- Consumes: `Unidades.escalarTiempo`, `Unidades.cientifica` (tarea 6); las formas de `MathMLModel.describir` (tarea 7)
- Produces: cada paso gana `derivacion` — array de `{ expr, motivo }`, donde `expr` es una estructura de `mathml.js` y `motivo` es una cadena. Los campos `formula`, `sustitucion` y `resultado` **se conservan**: son la red de seguridad si MathML no pintara, y lo que comprueban las pruebas de las tareas 1–5.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `simulador_stop_and_wait_v2/tests/steps.test.js`:

```js
// Lo que pidió el usuario: que se vea de dónde sale el 1000 que convierte
// 0,02 s en 20 ms. Antes la pantalla saltaba de "1000 / 50000" a "20 ms".
test("el paso Tt ensena la cancelacion de unidades y el factor 1000", () => {
  const s = Steps.build(satelite());
  const d = porId(s, "tt").derivacion;
  assert.ok(Array.isArray(d) && d.length >= 4, `derivacion corta: ${d && d.length}`);

  const motivos = d.map((r) => r.motivo).join(" | ");
  assert.match(motivos, /cancel/i, "no dice que las unidades se cancelan");
  assert.match(motivos, /1000|mil/i, "no dice de donde sale el factor 1000");

  const texto = JSON.stringify(d);
  assert.match(texto, /"1000"/, "falta L sustituida");
  assert.match(texto, /"50000"/, "falta R sustituida");
  assert.match(texto, /"frac"/, "la formula no se emite como fraccion");
});

test("la derivacion termina en el mismo numero que el resultado plano", () => {
  const s = Steps.build(satelite());
  const tt = porId(s, "tt");
  assert.equal(tt.resultado, "20 ms");
  assert.match(JSON.stringify(tt.derivacion.at(-1)), /"20"/);
});

test("el paso Tp tambien trae derivacion", () => {
  const d = porId(Steps.build(satelite()), "tp").derivacion;
  assert.ok(d.length >= 4, `derivacion corta: ${d.length}`);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js
```

Esperado: FALLA. `derivacion` es `undefined`.

- [ ] **Step 3: Cargar `unidades.js` en `steps.js`**

En `js/steps.js`, sustituir la cabecera UMD por:

```js
(function (root, factory) {
  const enNode = typeof module === "object" && module.exports;
  const api = factory(
    enNode ? require("./network.js") : root.NetworkModel,
    enNode ? require("./unidades.js") : root.Unidades
  );
  if (enNode) module.exports = api;
  else root.StepsModel = api;
})(typeof self !== "undefined" ? self : this, function (N, U) {
  "use strict";
```

- [ ] **Step 4: Añadir el helper de derivación**

En `js/steps.js`, justo debajo de la función `paso(spec)`, añadir:

```js
  // Convierte una división "algo / algo" en la cadena completa de renglones,
  // con la cancelación de unidades y el factor de escala dichos en voz alta.
  // Es lo que faltaba: la pantalla saltaba de "1000 / 50000" a "20 ms" sin
  // explicar el mil.
  function derivarTiempo(spec) {
    const { simbolo, numSim, denSim, numV, numU, denV, denU, segundos, cancelacion } = spec;
    const esc = U.escalarTiempo(segundos * 1000);
    const cien = U.cientifica(segundos);

    const izq = (der) => ({ t: "fila", partes: [{ t: "sim", v: simbolo }, { t: "op", v: "=" }, der] });

    const renglones = [
      {
        expr: izq({ t: "frac", num: { t: "sim", v: numSim }, den: { t: "sim", v: denSim } }),
        motivo: "La fórmula.",
      },
      {
        expr: izq({
          t: "frac",
          num: { t: "num", v: crudo(numV), u: numU },
          den: { t: "num", v: crudo(denV), u: denU },
        }),
        motivo: "Sustituidos los datos, con sus unidades.",
      },
      {
        expr: izq({ t: "num", v: redondear(segundos), u: "s" }),
        motivo: cancelacion,
      },
    ];

    // Si la unidad natural ya es el segundo, no hay factor que explicar.
    if (esc.factorDesdeMs !== 0.001) {
      renglones.push({
        expr: izq({
          t: "fila",
          partes: [
            { t: "num", v: redondear(segundos), u: "s" },
            { t: "op", v: "\u00d7" },
            { t: "num", v: crudo(1000 * esc.factorDesdeMs), u: `${esc.unidad}/s` },
          ],
        }),
        motivo: `De segundos a ${esc.unidad}: por eso aparece el ${crudo(1000 * esc.factorDesdeMs)}.`,
      });
    }

    renglones.push({
      expr: izq({
        t: "fila",
        partes: [
          { t: "num", v: redondear(esc.valor), u: esc.unidad },
          { t: "op", v: "=" },
          { t: "pot10", mantisa: redondear(cien.mantisa), exponente: String(cien.exponente), u: "s" },
        ],
      }),
      motivo: "El resultado, en su unidad natural y en notación científica.",
    });

    return renglones;
  }
```

- [ ] **Step 5: Colgar la derivación de los pasos `tt` y `tp`**

En `js/steps.js`, en el `paso({ id: "tt", ... })`, añadir antes de `nota:`:

```js
        derivacion: derivarTiempo({
          simbolo: "Tt",
          numSim: "L", denSim: "R",
          numV: r.frameBits, numU: "bits",
          denV: r.perLink[0].rateBps, denU: "bit/s",
          segundos: r.frameBits / r.perLink[0].rateBps,
          cancelacion: "Los bits se cancelan: bits ÷ (bit/s) deja segundos.",
        }),
```

En el `paso({ id: "tp", ... })`, igual:

```js
        derivacion: derivarTiempo({
          simbolo: "Tp",
          numSim: "d", denSim: "V",
          numV: r.perLink[0].distanceKm, numU: "km",
          denV: r.perLink[0].velocityKmS, denU: "km/s",
          segundos: r.perLink[0].distanceKm / r.perLink[0].velocityKmS,
          cancelacion: "Los kilómetros se cancelan: km ÷ (km/s) deja segundos.",
        }),
```

Y en `paso(spec)`, añadir el campo para que exista siempre:

```js
      derivacion: spec.derivacion || [],
```

- [ ] **Step 6: Correr y ver que pasa**

```bash
node --test simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/unidades.test.js
```

Esperado: PASA.

- [ ] **Step 7: Pintarla en `calc.js`**

En `js/calc.js`, tras `const Steps = window.StepsModel;`, añadir:

```js
  const MM = window.MathMLModel;
```

En `bloquePaso`, sustituir el bloque que va desde `const cuenta = document.createElement("div");` hasta `li.appendChild(cuenta);` por:

```js
    const cuenta = document.createElement("div");
    cuenta.className = "step-math";

    if (paso.derivacion && paso.derivacion.length > 0) {
      // Derivación completa: un renglón por paso del razonamiento, cada uno
      // con su motivo al lado. Es lo que pidió el usuario el 2026-09-08.
      for (const renglon of paso.derivacion) {
        const fila = document.createElement("div");
        fila.className = "math-row";
        fila.appendChild(MM.render(renglon.expr, document));

        const motivo = document.createElement("span");
        motivo.className = "math-why";
        motivo.textContent = renglon.motivo;
        fila.appendChild(motivo);

        cuenta.appendChild(fila);
      }
    } else {
      cuenta.appendChild(lineaMath("formula", paso.formula));
      if (paso.sustitucion) cuenta.appendChild(lineaMath("sub", `= ${paso.sustitucion}`));
      cuenta.appendChild(lineaMath("res", `= ${paso.resultado}`));
    }
    li.appendChild(cuenta);
```

- [ ] **Step 8: Cargar los módulos nuevos en la página**

En `calculadora.html`, entre `<script src="js/network.js"></script>` y `<script src="js/steps.js"></script>`, insertar:

```html
<script src="js/unidades.js"></script>
<script src="js/mathml.js"></script>
```

El orden importa: `steps.js` lee `root.Unidades` al cargarse.

- [ ] **Step 9: Estilo de la derivación**

Añadir al final de `css/style.css`:

```css
/* Derivación paso a paso. Un renglón por línea de razonamiento, con el motivo
   al lado en tono apagado: se lee la cuenta de un vistazo y el porqué solo si
   hace falta. */
.math-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
  padding: 3px 0;
}
.math-row math {
  font-size: 1.15em;
}
.math-why {
  color: var(--muted);
  font-size: 0.85em;
  flex: 1 1 240px;
}
/* Si el navegador no soportara MathML, el <math> se vería como texto seguido.
   No se pierde información, solo la forma apilada. */
```

Comprobar que `--muted` existe:

```bash
grep -n "\-\-muted" simulador_stop_and_wait_v2/css/style.css | head -3
```

Si no existe, usar la variable de texto apagado que sí esté definida en `:root`.

- [ ] **Step 10: Verlo de verdad en el navegador**

```bash
cd C:/Users/gogam/Desktop/Universidad/simulador_stop_and_wait
CH="C:/Users/gogam/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"
python -m http.server 8123 --directory simulador_stop_and_wait_v2 &
sleep 2
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --window-size=1280,2400 --screenshot=calc.png http://localhost:8123/calculadora.html
```

Mirar `calc.png`: el paso «Tiempo de transmisión» tiene que enseñar la fracción con la raya, y el renglón del `× 1000 ms/s`. Borrar `calc.png` al terminar.

- [ ] **Step 11: Verificar y commitear**

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js simulador_stop_and_wait_v2/tests/unidades.test.js simulador_stop_and_wait_v2/tests/mathml.test.js
node --check simulador_stop_and_wait_v2/js/steps.js
node --check simulador_stop_and_wait_v2/js/calc.js
git add simulador_stop_and_wait_v2/
git commit -m "feat(v2): el desarrollo ensena la cancelacion de unidades y el factor 1000

La pantalla saltaba de '1000 / 50000' a '20 ms' sin explicar el mil. Ahora
cada paso es una cadena de renglones con su motivo, en MathML apilado.

<ATRIBUCIÓN>"
```

---

### Task 9: Entradas de primera clase, banco de interfaz y cierre documental

El fichero estaba escondido tras escribir un valor mayor que cero, y por eso el usuario no lo encontró. Sube al bloque **Datos**, con la trama y la cabecera.

**Files:**
- Modify: `simulador_stop_and_wait_v2/calculadora.html`
- Modify: `simulador_stop_and_wait_v2/js/calc.js`
- Modify: `simulador_stop_and_wait_v2/banco-interfaz.html`
- Modify: `docs/01-arquitectura.md`, `docs/05-runbook.md`, `docs/07-historial.md`

**Interfaces:**
- Consumes: `N.bitsFromSize`, `path.headerBits` (tarea 3)
- Produces: nada que consuma otra tarea. Es la última.

- [ ] **Step 1: Subir los campos al bloque Datos**

En `calculadora.html`, dentro de `<div class="field-grid">` de la sección **Datos**, justo después del par de `ack-bits`, insertar:

```html
      <label for="header-bits">Cabecera por trama (bits)</label>
      <input type="number" id="header-bits" class="num" min="0" step="1" value="0">

      <label for="transfer-size">Tamaño del fichero a enviar</label>
      <input type="number" id="transfer-size" class="num" min="0" step="1" value="0">

      <label for="transfer-unit">Unidad del fichero</label>
      <select id="transfer-unit">
        <option value="bits">bits</option>
        <option value="kb" selected>KB (1000 bytes)</option>
        <option value="mb">MB (1000 KB)</option>
      </select>
```

Y borrar el `<div class="field-grid">` entero que había dentro de `<section class="pod" id="transfer-pod">`: esos dos controles ya viven arriba. El `<ol id="transfer-steps-list">` se queda.

- [ ] **Step 2: Leer la cabecera en `calc.js`**

En `cacheDom()`, añadir a `Object.assign(dom, {...})`:

```js
      headerBits: id("header-bits"),
```

En `bindEvents()`, añadir `dom.headerBits` a la lista de campos que recalculan:

```js
    [dom.frameBits, dom.ackBits, dom.processingMs, dom.headerBits].forEach((el) => el.addEventListener("input", recalcular));
```

En `recalcular()`, donde se construye el `N.createPath({...})`, añadir:

```js
        headerBits: Number(dom.headerBits.value) || 0,
```

- [ ] **Step 3: Enseñar el bloque de transferencia siempre que haya fichero**

En `pintarTransferencia()`, sustituir el comentario y el guardián por:

```js
    // Los controles viven ahora arriba, en Datos: aquí solo se decide si hay
    // algo que enseñar. Sin fichero, el bloque estorba.
    if (!ultimoPath || !(tamano > 0)) {
      dom.transferPod.hidden = true;
      return;
    }
```

Y en el paso de tramas, aprovechar el dato nuevo. En `js/steps.js`, dentro de `buildTransfer`, sustituir el `detalle` del paso `transfer-frames` por:

```js
        detalle: [
          "Se redondea hacia arriba: la última trama cuenta entera aunque el fichero no la llene del todo.",
          r.payloadBitsPerFrame === spec.path.frameBits
            ? "Sin cabecera, los L bits de la trama son todos datos del fichero."
            : `De los ${crudo(spec.path.frameBits)} bits de cada trama, ${crudo(spec.path.headerBits)} son cabecera: solo ${crudo(r.payloadBitsPerFrame)} llevan fichero.`,
        ],
```

- [ ] **Step 4: Comprobar en el navegador**

```bash
cd C:/Users/gogam/Desktop/Universidad/simulador_stop_and_wait
CH="C:/Users/gogam/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"
python -m http.server 8123 --directory simulador_stop_and_wait_v2 &
sleep 2
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom http://localhost:8123/calculadora.html > /tmp/dom.html
grep -c "header-bits\|transfer-size" /tmp/dom.html
```

Esperado: los dos identificadores aparecen, y **una sola vez cada uno** (si salen dos, quedó el `field-grid` viejo sin borrar).

- [ ] **Step 5: Añadir comprobaciones al banco de interfaz**

En `banco-interfaz.html`, en la sección de la calculadora, añadir siguiendo el patrón de `comprobar(nombre, condicion, detalle)`:

```js
  comprobar("calc · el fichero se pide en Datos, no escondido",
    c.getElementById("transfer-size") !== null && c.getElementById("transfer-size").closest(".field-grid") !== null,
    "no está en la rejilla de datos");
  comprobar("calc · ya no se piden probabilidades de error",
    !/P error/i.test(c.body.textContent),
    "sigue apareciendo 'P error'");
  comprobar("calc · el desarrollo se dibuja con MathML",
    c.querySelector(".step-math math mfrac") !== null,
    "no hay ningún mfrac");
  comprobar("calc · el renglón del factor 1000 está",
    /1000 ms\/s|× 1000/.test(c.querySelector(".step-math").textContent),
    c.querySelector(".step-math").textContent.slice(0, 80));
```

`c` es el `contentDocument` del iframe `calc`; usar el nombre de variable que ya use ese fichero para el documento de la calculadora.

Correr el banco y anotar el número de comprobaciones que salen.

- [ ] **Step 6: Actualizar la documentación**

- `docs/05-runbook.md`: añadir `tests/unidades.test.js` y `tests/mathml.test.js` al comando de pruebas (las dos apariciones, líneas ~17 y ~49) y **actualizar ahí el conteo de pruebas, que es su fuente única**. Actualizar también el conteo del banco de interfaz.
- `docs/01-arquitectura.md`: documentar `unidades.js` y `mathml.js` en el mapa de módulos, la decisión de MathML nativo frente a librería, la partición `describir`/`render` y por qué; y corregir lo que atribuye a Tanenbaum el ejemplo LAN, la letra `a` y la forma `1/(1+2a)` (líneas ~202 y ~209).
- `docs/07-historial.md`: **entrada nueva arriba**, con fecha 2026-09-08, con qué · por qué · cómo revertir. No reescribir entradas viejas.

- [ ] **Step 7: Verificación completa**

```bash
cd C:/Users/gogam/Desktop/Universidad/simulador_stop_and_wait
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js simulador_stop_and_wait_v2/tests/unidades.test.js simulador_stop_and_wait_v2/tests/mathml.test.js
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/steps.js
node --check simulador_stop_and_wait_v2/js/calc.js
node --check simulador_stop_and_wait_v2/js/unidades.js
node --check simulador_stop_and_wait_v2/js/mathml.js
node tools/lint-docs.js
```

Todo verde, con la salida vista. **No dar por bueno nada sin haber leído la salida real.**

- [ ] **Step 8: Commitear**

```bash
git add .
git commit -m "feat(v2): fichero, trama y cabecera como entradas de primera clase

El tamano del fichero estaba escondido tras escribir un valor mayor que
cero, y el usuario no lo encontraba. Sube al bloque Datos con la cabecera.

<ATRIBUCIÓN>"
```

---

## Cierre obligatorio del plan

Al terminar la tarea 9, y solo entonces:

1. `docs/06-pendientes.md` — **no se abre ninguna ficha nueva**. Si algo quedó a medias, va como *desvío* al [spec del cierre](../specs/2026-09-07-cierre-pendientes-design.md), decidido en el momento.
2. Marcar el spec del 2026-09-08 como **implementado** en su línea de estado.
3. Confirmar con el usuario, porque el paso 3 del cierre (`V2-01`) sigue abierto y es suyo: hay que mirar la calculadora en su pantalla, no en una captura headless.
