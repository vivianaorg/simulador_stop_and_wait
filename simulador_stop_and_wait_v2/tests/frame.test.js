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

// Tanenbaum, Redes de computadoras, 5.ª ed., cap. 3, códigos polinomiales:
// un código con r bits de verificación detecta TODAS las ráfagas de longitud
// <= r. Aquí r = 16.
//
// Esta prueba comprueba el caso que el simulador produce de verdad: el tramo
// contiguo de bits volteados que hace flipRun. El enunciado del libro es más
// amplio (cubre cualquier patrón interior), y la razón de fondo es la misma:
// un polinomio de error de grado < 16 no puede ser múltiplo de G(x).
test("Ningún tramo volteado de longitud <= 16 sobrevive al CRC (Tanenbaum, cap. 3)", () => {
  const payloadBytes = 4; // 4*8 + 16 = 48 bits: barrido exhaustivo asequible
  const total = 48;

  for (let largo = 1; largo <= 16; largo++) {
    for (let desde = 0; desde + largo <= total; desde++) {
      const f = trama(payloadBytes);
      F.flipRun(f, desde, largo);
      assert.equal(
        F.isIntact(f),
        false,
        `ráfaga de ${largo} bits en ${desde} debería detectarse`
      );
    }
  }
});

// El mismo pasaje: una ráfaga de r+1 bits pasa desapercibida si, y solo si,
// es idéntica a G(x). Con CRC-16/CCITT eso es 0x11021, o sea 17 bits:
// 1 0000 0001 0010 0001. Es el único patrón de 17 que se cuela por posición.
test("La ráfaga de 17 bits igual a G(x) sí se cuela (Tanenbaum, cap. 3)", () => {
  // 0x11021 = 1 0001 0000 0010 0001, los 17 bits de G(x) = x^16+x^12+x^5+1.
  const PATRON = [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const f = trama(4);

  PATRON.forEach((bit, i) => {
    if (bit === 1) F.flipBit(f, 8 + i);
  });

  assert.equal(F.isIntact(f), true, "el CRC no puede distinguir esta ráfaga de una trama limpia");
});
