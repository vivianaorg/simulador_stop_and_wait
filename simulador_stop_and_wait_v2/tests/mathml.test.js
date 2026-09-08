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
