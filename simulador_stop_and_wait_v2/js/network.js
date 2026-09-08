// network.js
// Modelo de una ruta Stop & Wait de N saltos. Sin DOM: se puede probar con
// `node --test`. Toda la lógica de tiempos y utilización vive aquí; la UI la
// consume, nunca la recalcula.
//
// Referencias (nomenclatura del libro de Tanenbaum, cap. 3, y de la lecture
// ELEC3030 de Southampton, que da la forma cerrada de las fórmulas):
//
//   Tt = L / R            tiempo de transmisión de una trama de L bits
//   Tp = d / V            tiempo de propagación de un tramo
//   a  = Tp / Tt = (R·d) / (V·L)
//   U  = 1 / (1 + 2a)     utilización de Stop & Wait sin errores
//
// Con varios saltos se aplica store-and-forward: cada nodo intermedio recibe
// la trama completa antes de reenviarla, así que paga Tt otra vez.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetworkModel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Modos de canal. "simplex" no es un modo de canal: es el sentido del
  // tráfico de datos (así lo llama el libro). Lo que cambia el cálculo es si
  // el canal es half o full duplex.
  const DUPLEX = {
    HALF: "half", // alternancia estricta: hay que invertir el medio antes del ACK
    FULL: "full", // ambos sentidos vivos a la vez; sin tiempo de vuelta
  };

  const MS_PER_S = 1000;

  function isPositive(n) {
    return Number.isFinite(n) && n > 0;
  }

  function isProbability(n) {
    return Number.isFinite(n) && n >= 0 && n <= 1;
  }

  /**
   * Un tramo del camino. Todas las unidades son explícitas en el nombre.
   * @param {object} spec
   * @param {string} [spec.name]           etiqueta para la UI ("Casa → Satélite")
   * @param {number} spec.rateBps          R: tasa de transmisión, bits/s
   * @param {number} spec.distanceKm       d: longitud del tramo, km
   * @param {number} spec.velocityKmS      V: velocidad de propagación, km/s
   * @param {number} [spec.errorProbData]  probabilidad de que la trama de datos se dañe o pierda en este tramo
   * @param {number} [spec.errorProbAck]   ídem para el ACK
   * @param {number} [spec.turnaroundMs]   tiempo de vuelta del medio (solo half duplex)
   */
  function createLink(spec) {
    const link = {
      name: spec.name || "Enlace",
      rateBps: spec.rateBps,
      distanceKm: spec.distanceKm,
      velocityKmS: spec.velocityKmS,
      errorProbData: spec.errorProbData === undefined ? 0 : spec.errorProbData,
      errorProbAck: spec.errorProbAck === undefined ? 0 : spec.errorProbAck,
      turnaroundMs: spec.turnaroundMs === undefined ? 0 : spec.turnaroundMs,
    };
    const problems = validateLink(link);
    if (problems.length > 0) {
      throw new RangeError(`Enlace "${link.name}" inválido: ${problems.join("; ")}`);
    }
    return link;
  }

  function validateLink(link) {
    const problems = [];
    if (!isPositive(link.rateBps)) problems.push("la tasa R debe ser > 0 bits/s");
    if (!Number.isFinite(link.distanceKm) || link.distanceKm < 0) problems.push("la distancia d no puede ser negativa");
    if (!isPositive(link.velocityKmS)) problems.push("la velocidad de propagación V debe ser > 0 km/s");
    if (!isProbability(link.errorProbData)) problems.push("la probabilidad de error de datos debe estar entre 0 y 1");
    if (!isProbability(link.errorProbAck)) problems.push("la probabilidad de error del ACK debe estar entre 0 y 1");
    if (!Number.isFinite(link.turnaroundMs) || link.turnaroundMs < 0) problems.push("el tiempo de vuelta no puede ser negativo");
    return problems;
  }

  // Tt del tramo, en ms, para una trama de `bits` bits.
  function transmissionMs(link, bits) {
    if (bits <= 0) return 0;
    return (bits / link.rateBps) * MS_PER_S;
  }

  // Tp del tramo, en ms.
  function propagationMs(link) {
    return (link.distanceKm / link.velocityKmS) * MS_PER_S;
  }

  /**
   * Camino extremo a extremo. Un solo enlace es simplemente una cadena de 1,
   * así que el caso clásico del libro y el multi-salto comparten código.
   *
   * @param {object} spec
   * @param {number} spec.frameBits          L: tamaño de la trama de datos, bits
   * @param {number} [spec.ackBits]          tamaño de la trama de ACK, bits. 0 = ACK de duración despreciable (supuesto habitual del libro)
   * @param {Array}  spec.links              tramos, en orden emisor → receptor
   * @param {string} [spec.duplexMode]       DUPLEX.FULL (por defecto) o DUPLEX.HALF
   * @param {number} [spec.processingMsPerHop] retardo de procesamiento en cada nodo intermedio
   */
  function createPath(spec) {
    const path = {
      frameBits: spec.frameBits,
      ackBits: spec.ackBits === undefined ? 0 : spec.ackBits,
      links: spec.links || [],
      duplexMode: spec.duplexMode === DUPLEX.HALF ? DUPLEX.HALF : DUPLEX.FULL,
      processingMsPerHop: spec.processingMsPerHop === undefined ? 0 : spec.processingMsPerHop,
      headerBits: spec.headerBits === undefined ? 0 : spec.headerBits,
    };
    const problems = validatePath(path);
    if (problems.length > 0) {
      throw new RangeError(`Camino inválido: ${problems.join("; ")}`);
    }
    return path;
  }

  function validatePath(path) {
    const problems = [];
    if (!isPositive(path.frameBits)) problems.push("el tamaño de trama L debe ser > 0 bits");
    if (!Number.isFinite(path.ackBits) || path.ackBits < 0) problems.push("el tamaño del ACK no puede ser negativo");
    if (!Array.isArray(path.links) || path.links.length === 0) problems.push("hace falta al menos un enlace");
    if (!Number.isFinite(path.processingMsPerHop) || path.processingMsPerHop < 0) problems.push("el retardo de procesamiento no puede ser negativo");
    if (!Number.isFinite(path.headerBits) || path.headerBits < 0) {
      problems.push("la cabecera no puede ser negativa");
    }
    if (path.headerBits >= path.frameBits) {
      problems.push("la cabecera tiene que caber en la trama: no puede llegar a L");
    }
    return problems;
  }

  /**
   * Calcula todos los tiempos y métricas del camino.
   *
   * El ciclo de Stop & Wait es: transmitir la trama, propagarla hasta el
   * receptor (reenviándola en cada nodo intermedio), y esperar el ACK de vuelta
   * por el mismo camino. Mientras dura ese ciclo el emisor no puede enviar nada
   * más: eso es exactamente lo que mide U.
   */
  function analyze(path) {
    const links = path.links;
    const hops = links.length;

    const perLink = links.map((link) => ({
      name: link.name,
      ttDataMs: transmissionMs(link, path.frameBits),
      ttAckMs: transmissionMs(link, path.ackBits),
      tpMs: propagationMs(link),
      rateBps: link.rateBps,
      distanceKm: link.distanceKm,
      velocityKmS: link.velocityKmS,
      errorProbData: link.errorProbData,
      errorProbAck: link.errorProbAck,
      turnaroundMs: link.turnaroundMs,
    }));

    const sum = (fn) => perLink.reduce((acc, l) => acc + fn(l), 0);

    const ttDataTotalMs = sum((l) => l.ttDataMs);
    const ttAckTotalMs = sum((l) => l.ttAckMs);
    const tpTotalMs = sum((l) => l.tpMs);
    // Los nodos intermedios (todos menos emisor y receptor) procesan la trama.
    const processingMs = path.processingMsPerHop * Math.max(0, hops - 1);

    // Ida: la trama se transmite en cada tramo y se propaga en cada tramo.
    const forwardMs = ttDataTotalMs + tpTotalMs + processingMs;
    // Vuelta: lo mismo para el ACK. Con ackBits = 0 solo cuenta la propagación.
    const ackReturnMs = ttAckTotalMs + tpTotalMs + processingMs;

    // Half duplex: el medio se invierte dos veces por ciclo (antes del ACK y
    // antes de la siguiente trama).
    const turnaroundTotalMs =
      path.duplexMode === DUPLEX.HALF ? sum((l) => l.turnaroundMs) * 2 : 0;

    const rttMs = forwardMs + ackReturnMs;
    const cycleMs = rttMs + turnaroundTotalMs;

    // Tt del emisor: es el único tramo durante el cual el emisor está
    // realmente ocupado poniendo bits en el medio.
    const senderTtMs = perLink[0].ttDataMs;

    // a = Tp / Tt, en su forma agregada. Con un solo salto coincide con
    // a = (R·d)/(V·L). La letra a y esta fórmula son de Stallings, no del
    // libro de Tanenbaum: él razona con tiempos crudos y nunca define a.
    const aRatio = ttDataTotalMs > 0 ? tpTotalMs / ttDataTotalMs : Infinity;

    // `a` que SÍ reproduce U. Despejando de U = Tt(emisor)/ciclo:
    //   U = 1/(1+2a)  ->  a = (ciclo − Tt(emisor)) / (2 · Tt(emisor))
    // Con un solo salto y ACK despreciable coincide con aRatio, así que el caso
    // del libro no cambia. Con varios tramos es la única de las dos que puede
    // dibujarse sobre la curva sin mentir: aRatio mide ΣTp/ΣTt, y U mide otra
    // cosa. Es el defecto 1 del spec del 2026-09-08.
    const aEfectiva = senderTtMs > 0 ? (cycleMs - senderTtMs) / (2 * senderTtMs) : Infinity;

    // U = fracción del ciclo en la que el emisor transmite datos útiles.
    const utilization = cycleMs > 0 ? senderTtMs / cycleMs : 0;

    // Probabilidad de que el ciclo falle: basta con que se dañe la trama en
    // cualquier tramo, o el ACK en cualquier tramo.
    const successData = perLink.reduce((acc, l) => acc * (1 - l.errorProbData), 1);
    const successAck = perLink.reduce((acc, l) => acc * (1 - l.errorProbAck), 1);
    const cycleSuccessProb = successData * successAck;
    const cycleErrorProb = 1 - cycleSuccessProb;

    // Utilización efectiva: U·(1−P). Con un solo enlace y ACK sin errores es
    // la forma clásica (1−P)/(1+2a).
    const effectiveUtilization = utilization * cycleSuccessProb;

    // Transmisiones esperadas por trama entregada (media de una geométrica).
    const expectedTransmissions = cycleSuccessProb > 0 ? 1 / cycleSuccessProb : Infinity;

    // Caudal útil real, en bits/s.
    const throughputBps = cycleMs > 0 ? (path.frameBits * cycleSuccessProb) / (cycleMs / MS_PER_S) : 0;

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
    const bandwidthDelayFrames = bandwidthDelayBits / path.frameBits;
    const bandwidthDelayProductBits = perLink[0].rateBps * (rttMs / MS_PER_S);
    const windowFrames = 2 * bandwidthDelayFrames + 1;

    return {
      hops,
      perLink,
      frameBits: path.frameBits,
      ackBits: path.ackBits,
      duplexMode: path.duplexMode,

      senderTtMs,
      ttDataTotalMs,
      ttAckTotalMs,
      tpTotalMs,
      processingMs,
      turnaroundTotalMs,
      forwardMs,
      ackReturnMs,
      rttMs,
      cycleMs,

      aRatio,
      aEfectiva,
      utilization,
      idleFraction: 1 - utilization,
      cycleErrorProb,
      cycleSuccessProb,
      effectiveUtilization,
      expectedTransmissions,
      throughputBps,
      bandwidthDelayBits,
      bandwidthDelayFrames,
      bandwidthDelayProductBits,
      windowFrames,

      // Un timeout por debajo del RTT provoca retransmisiones inútiles: el ACK
      // todavía viene en camino. Es el error que el simulador debe poder
      // demostrar, así que el modelo lo expone en vez de esconderlo.
      minimumTimeoutMs: rttMs,
    };
  }

  /**
   * Cuántos bits arruina una ráfaga que dura `burstMs` sobre un canal de
   * `rateBps`. No es una fórmula del libro —Tanenbaum mide las ráfagas en
   * bits— sino análisis dimensional: bits/s × s = bits. Está aquí porque es
   * como se explica en clase, y declarado como conversión para que nadie la
   * confunda con una cita.
   */
  function burstBitsFromMs(spec) {
    if (!isPositive(spec.rateBps)) throw new RangeError("la tasa R debe ser > 0 bits/s");
    if (!Number.isFinite(spec.burstMs) || spec.burstMs < 0) {
      throw new RangeError("la duración de la ráfaga no puede ser negativa");
    }
    return Math.floor((spec.rateBps * spec.burstMs) / MS_PER_S);
  }

  /**
   * Reparte una ráfaga de `bits` sobre tramas de L bits. Supone que empieza
   * donde empieza una trama: una ráfaga a caballo entre dos puede tocar una
   * más.
   */
  function burstDamage(spec) {
    if (!Number.isFinite(spec.bits) || spec.bits < 0) {
      throw new RangeError("los bits de la ráfaga no pueden ser negativos");
    }
    if (!isPositive(spec.frameBits)) throw new RangeError("el tamaño de trama L debe ser > 0 bits");

    return { bits: spec.bits, frames: Math.ceil(spec.bits / spec.frameBits) };
  }

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

  const BITS_PER_BYTE = 8;
  // Decimal, no binario: igual que el resto de unidades de este simulador
  // (bps() en steps.js corta en múltiplos de 1000, no 1024). 1 KB = 1000
  // bytes, no los 1024 de un sistema de archivos.
  const BYTES_PER_KB = 1000;
  const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

  /**
   * Convierte un tamaño con unidad a bits. No es una fórmula del libro: es una
   * conversión de unidades, declarada aquí para que la UI no calcule nada.
   * @param {number} value  cantidad en la unidad dada
   * @param {"bits"|"kb"|"mb"} unit
   */
  function bitsFromSize(value, unit) {
    if (!isPositive(value)) throw new RangeError("el tamaño debe ser > 0");
    if (unit === "bits") return value;
    if (unit === "kb") return value * BYTES_PER_KB * BITS_PER_BYTE;
    if (unit === "mb") return value * BYTES_PER_MB * BITS_PER_BYTE;
    throw new RangeError(`unidad de tamaño desconocida: ${unit}`);
  }

  // Atajo para el caso de un solo enlace, que es el del libro.
  function singleLinkAnalysis(opts) {
    return analyze(
      createPath({
        frameBits: opts.frameBits,
        ackBits: opts.ackBits,
        duplexMode: opts.duplexMode,
        links: [
          createLink({
            name: opts.name,
            rateBps: opts.rateBps,
            distanceKm: opts.distanceKm,
            velocityKmS: opts.velocityKmS,
            errorProbData: opts.errorProbData,
            errorProbAck: opts.errorProbAck,
            turnaroundMs: opts.turnaroundMs,
          }),
        ],
      })
    );
  }

  return {
    DUPLEX,
    createLink,
    createPath,
    validateLink,
    validatePath,
    transmissionMs,
    propagationMs,
    analyze,
    singleLinkAnalysis,
    burstBitsFromMs,
    burstDamage,
    transferAnalysis,
    bitsFromSize,
  };
});
