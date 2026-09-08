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
  // Tolerancia defensiva: en algunos entornos JavaScript puede dar 1.0240000000000002.
  // El brief lo anticipaba; usamos assert.ok en vez de assert.equal para máxima robustez.
  assert.ok(Math.abs(U.escalarBits(1024).valor - 1.024) < 1e-12);
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

test("cientifica solo devuelve cero para cero; los no finitos se preservan", () => {
  // Cero devuelve {0, 0}: es el caso especial correcto.
  assert.deepEqual(U.cientifica(0), { mantisa: 0, exponente: 0 });

  // Infinito, -Infinito y NaN preservan su valor en mantisa para que quien pinte
  // pueda detectarlos con Number.isFinite(mantisa) y dibujar "—" en vez de un cero mentiroso.
  const inf = U.cientifica(Infinity);
  assert.equal(inf.exponente, 0);
  assert.equal(inf.mantisa, Infinity);

  const ninf = U.cientifica(-Infinity);
  assert.equal(ninf.exponente, 0);
  assert.equal(ninf.mantisa, -Infinity);

  const nan = U.cientifica(NaN);
  assert.equal(nan.exponente, 0);
  assert.ok(Number.isNaN(nan.mantisa));
});
