// frame.js
// Tramas con detección de errores real: CRC-16/CCITT-FALSE, el mismo tipo de
// código de redundancia cíclica que describe Tanenbaum en el capítulo 3.
//
// La detección NO está simulada con una bandera: el receptor recalcula el CRC
// sobre los bits que le llegaron. Si el usuario voltea un bit desde la
// interfaz, el CRC deja de cuadrar por sí solo.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FrameModel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KIND = { FRAME: "FRAME", ACK: "ACK", NAK: "NAK" };

  // Polinomio x^16 + x^12 + x^5 + 1, valor inicial 0xFFFF (CCITT-FALSE).
  const POLYNOMIAL = 0x1021;
  const INITIAL = 0xffff;
  const CRC_BITS = 16;

  // Nombre legible del polinomio, para la explicación.
  const POLINOMIO_TEXTO = "x¹⁶ + x¹² + x⁵ + 1  (0x1021)";

  /**
   * El mismo cálculo que crc16, pero contando lo que hace en cada paso.
   * Sirve para enseñar el CRC, no para calcularlo: el que manda es crc16.
   *
   * Devuelve, por cada byte de la carga, el registro antes y después, y el
   * detalle de los ocho desplazamientos: si el bit más significativo estaba a
   * uno (y por tanto tocaba aplicar el polinomio) o no.
   */
  function crc16Trace(bytes) {
    let crc = INITIAL;
    const pasos = [];

    for (let i = 0; i < bytes.length; i++) {
      const antesDelByte = crc;
      crc ^= (bytes[i] & 0xff) << 8;
      const trasXor = crc & 0xffff;
      const bits = [];

      for (let bit = 0; bit < 8; bit++) {
        const antes = crc & 0xffff;
        const msb = (crc & 0x8000) !== 0;
        crc = msb ? ((crc << 1) ^ POLYNOMIAL) & 0xffff : (crc << 1) & 0xffff;
        bits.push({ bit, antes, msb, despues: crc & 0xffff });
      }

      pasos.push({
        indice: i,
        byte: bytes[i] & 0xff,
        antes: antesDelByte,
        trasXor,
        despues: crc & 0xffff,
        bits,
      });
    }

    return {
      polinomio: POLINOMIO_TEXTO,
      inicial: INITIAL,
      pasos,
      final: crc & 0xffff,
    };
  }

  function crc16(bytes) {
    let crc = INITIAL;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= (bytes[i] & 0xff) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ POLYNOMIAL) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc & 0xffff;
  }

  // Carga determinista: la misma trama siempre tiene los mismos bits, así la
  // simulación se puede repetir y comparar.
  function buildPayload(kind, seq, frameIdx, byteLength) {
    const bytes = new Uint8Array(Math.max(1, byteLength));
    bytes[0] = (kind.charCodeAt(0) + seq) & 0xff;
    for (let i = 1; i < bytes.length; i++) {
      bytes[i] = (frameIdx * 31 + i * 17 + seq * 7) & 0xff;
    }
    return bytes;
  }

  /**
   * @param {object} spec
   * @param {string} spec.kind        KIND.FRAME | KIND.ACK | KIND.NAK
   * @param {number} spec.seq         número de secuencia (0 o 1)
   * @param {number} [spec.frameIdx]  índice de la trama de datos que representa
   * @param {number} [spec.payloadBytes] tamaño de la carga, en bytes
   */
  function createFrame(spec) {
    const payload = buildPayload(
      spec.kind,
      spec.seq,
      spec.frameIdx === undefined ? 0 : spec.frameIdx,
      spec.payloadBytes === undefined ? 8 : spec.payloadBytes
    );

    return {
      kind: spec.kind,
      seq: spec.seq,
      frameIdx: spec.frameIdx === undefined ? 0 : spec.frameIdx,
      payload,
      // El emisor calcula el CRC y lo manda dentro de la trama. El receptor
      // recalculará el suyo y comparará.
      crc: crc16(payload),
      // Marcas de lo que le pasó a esta trama, para la interfaz.
      corrupted: false,
      flippedBits: [],
    };
  }

  function label(frame) {
    if (frame.kind === KIND.FRAME) return `F${frame.seq}`;
    if (frame.kind === KIND.ACK) return `ACK${frame.seq}`;
    return `NAK${frame.seq}`;
  }

  // Total de bits que se pueden voltear: los de la carga más los del CRC.
  function totalBits(frame) {
    return frame.payload.length * 8 + CRC_BITS;
  }

  /**
   * Voltea un bit de la trama, como haría el ruido del canal. Índices
   * [0, payload*8) son de la carga; los 16 siguientes, del CRC.
   * Devuelve el índice volteado.
   */
  function flipBit(frame, bitIndex) {
    const total = totalBits(frame);
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex >= total) {
      throw new RangeError(`Índice de bit fuera de rango: ${bitIndex} (0..${total - 1})`);
    }

    const payloadBits = frame.payload.length * 8;
    if (bitIndex < payloadBits) {
      const byte = Math.floor(bitIndex / 8);
      const bit = 7 - (bitIndex % 8);
      frame.payload[byte] ^= 1 << bit;
    } else {
      const bit = CRC_BITS - 1 - (bitIndex - payloadBits);
      frame.crc ^= 1 << bit;
    }

    frame.corrupted = true;
    frame.flippedBits.push(bitIndex);
    return bitIndex;
  }

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

  // Voltea un bit "al azar" con un generador propio: la simulación tiene que
  // poder repetirse, así que no se usa Math.random.
  function flipRandomBit(frame, random) {
    const total = totalBits(frame);
    const index = Math.floor(random() * total) % total;
    return flipBit(frame, index);
  }

  /**
   * Lo que hace el receptor: recalcular el CRC sobre lo recibido y comparar.
   * No mira ninguna bandera de "esta trama venía corrupta".
   */
  function isIntact(frame) {
    return crc16(frame.payload) === frame.crc;
  }

  // Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma
  // simulación. Sin esto, un escenario con errores no se puede repetir.
  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cloneFrame(frame) {
    return {
      kind: frame.kind,
      seq: frame.seq,
      frameIdx: frame.frameIdx,
      payload: frame.payload.slice(),
      crc: frame.crc,
      corrupted: frame.corrupted,
      flippedBits: frame.flippedBits.slice(),
    };
  }

  // Representación en bits, para pintar el inspector.
  function toBitString(frame) {
    let out = "";
    for (let i = 0; i < frame.payload.length; i++) {
      out += frame.payload[i].toString(2).padStart(8, "0");
    }
    return out + frame.crc.toString(2).padStart(16, "0");
  }

  return {
    KIND,
    CRC_BITS,
    POLINOMIO_TEXTO,
    crc16,
    crc16Trace,
    createFrame,
    cloneFrame,
    label,
    totalBits,
    flipBit,
    flipRun,
    flipRandomBit,
    isIntact,
    seededRandom,
    toBitString,
  };
});
