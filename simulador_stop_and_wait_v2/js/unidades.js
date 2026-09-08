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
    // Solo cero devuelve cero. Un valor no finito (Infinity, -Infinity, NaN)
    // preserva la información devolviendo { mantisa: v, exponente: 0 }, de modo que
    // Number.isFinite(mantisa) sea falso. El consumidor (p. ej., formateador de
    // pantalla) puede entonces decidir mostrar "—" en vez de dejar que Infinity se
    // dibuje como un cero falso. Ver steps.js: ms(), bps(), pct() usan este patrón.
    if (v === 0) return { mantisa: 0, exponente: 0 };
    if (!Number.isFinite(v)) return { mantisa: v, exponente: 0 };
    const exponente = Math.floor(Math.log10(Math.abs(v)));
    return { mantisa: v / Math.pow(10, exponente), exponente };
  }

  return { escalarTiempo, escalarBits, cientifica };
});
