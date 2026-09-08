// steps.js
// Convierte el resultado de network.js en un desarrollo estructurado: bloques
// con fórmula, sustitución y resultado, más un detalle que se puede desplegar.
//
// La clave es que NO devuelve texto pegado: devuelve datos. La interfaz decide
// cómo enseñarlos (de uno en uno, todos, con el detalle abierto o cerrado) y
// las pruebas pueden comprobar cada número por separado.

(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./network.js") : root.NetworkModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StepsModel = api;
})(typeof self !== "undefined" ? self : this, function (N) {
  "use strict";

  // ---------- Formato ----------

  function ms(v) {
    if (!Number.isFinite(v)) return "—";
    if (v === 0) return "0 ms";
    if (v < 0.001) return `${(v * 1e6).toFixed(2)} ns`;
    if (v < 1) return `${(v * 1000).toFixed(2)} µs`;
    if (v < 1000) return `${redondear(v)} ms`;
    return `${redondear(v / 1000)} s`;
  }

  function redondear(v) {
    const abs = Math.abs(v);
    const dec = abs >= 100 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
    return Number(v.toFixed(dec)).toString().replace(".", ",");
  }

  function bps(v) {
    if (!Number.isFinite(v)) return "—";
    if (v >= 1e9) return `${redondear(v / 1e9)} Gbit/s`;
    if (v >= 1e6) return `${redondear(v / 1e6)} Mbit/s`;
    if (v >= 1e3) return `${redondear(v / 1e3)} kbit/s`;
    return `${redondear(v)} bit/s`;
  }

  function pct(fraccion) {
    if (!Number.isFinite(fraccion)) return "—";
    return `${redondear(fraccion * 100)} %`;
  }

  function entero(v) {
    return Math.round(v).toLocaleString("es-ES");
  }

  // Dentro de una fórmula los miles NO se separan: "1000 / 50.000" se lee mal.
  function crudo(v) {
    return String(Math.round(v));
  }

  // ---------- Construcción del desarrollo ----------

  function paso(spec) {
    return {
      id: spec.id,
      titulo: spec.titulo,
      formula: spec.formula,
      sustitucion: spec.sustitucion || "",
      resultado: spec.resultado,
      detalle: spec.detalle || [],
      nota: spec.nota || "",
    };
  }

  /**
   * @param {object} r resultado de NetworkModel.analyze()
   * @returns {{entrada: Array, titular: Array, pasos: Array, graficas: object}}
   */
  function build(r) {
    const unSalto = r.hops === 1;
    const conErrores = r.cycleErrorProb > 0;
    const conVuelta = r.turnaroundTotalMs > 0;

    // ---- Lo que se ha entendido de los datos ----
    const entrada = [
      { etiqueta: "Tamaño de la trama · L", valor: `${entero(r.frameBits)} bits` },
      { etiqueta: "Tamaño del ACK", valor: r.ackBits === 0 ? "despreciable (0 bits)" : `${entero(r.ackBits)} bits` },
      { etiqueta: "Saltos del camino", valor: r.hops === 1 ? "1 enlace directo" : `${r.hops} tramos en serie` },
      { etiqueta: "Canal", valor: r.duplexMode === "half" ? "half duplex" : "full duplex" },
    ];
    r.perLink.forEach((l, i) => {
      entrada.push({
        etiqueta: `Tramo ${i + 1} · ${l.name}`,
        valor: `${entero(l.distanceKm)} km a ${bps(l.rateBps)}, propagando a ${entero(l.velocityKmS)} km/s`,
      });
    });

    // ---- Titular ----
    const titular = [
      { etiqueta: "Utilización del canal", valor: pct(r.utilization), enfasis: true },
      { etiqueta: "Tiempo de ciclo", valor: ms(r.cycleMs) },
      { etiqueta: "Caudal útil", valor: bps(r.throughputBps) },
    ];
    if (conErrores) {
      titular.splice(1, 0, { etiqueta: "Utilización efectiva", valor: pct(r.effectiveUtilization) });
    }

    // ---- Pasos ----
    const pasos = [];

    pasos.push(
      paso({
        id: "tt",
        titulo: "Tiempo de transmisión de cada tramo",
        formula: "Tt = L / R",
        sustitucion: r.perLink
          .map((l) => `${crudo(r.frameBits)} / ${crudo(l.rateBps)}`)
          .join("   ·   "),
        resultado: unSalto ? ms(r.perLink[0].ttDataMs) : `${r.perLink.map((l) => ms(l.ttDataMs)).join(" + ")} = ${ms(r.ttDataTotalMs)}`,
        detalle: r.perLink.map(
          (l) =>
            `${l.name}: ${crudo(r.frameBits)} bits ÷ ${crudo(l.rateBps)} bit/s = ${redondear(r.frameBits / l.rateBps)} s = ${ms(l.ttDataMs)}`
        ),
        nota: "Es lo que tarda el emisor en empujar la trama entera al medio. No depende de la distancia.",
      })
    );

    pasos.push(
      paso({
        id: "tp",
        titulo: "Tiempo de propagación de cada tramo",
        formula: "Tp = d / V",
        sustitucion: r.perLink
          .map((l) => `${redondear(l.distanceKm)} / ${crudo(l.velocityKmS)}`)
          .join("   ·   "),
        resultado: unSalto ? ms(r.perLink[0].tpMs) : `${r.perLink.map((l) => ms(l.tpMs)).join(" + ")} = ${ms(r.tpTotalMs)}`,
        detalle: r.perLink.map(
          (l) =>
            `${l.name}: ${redondear(l.distanceKm)} km ÷ ${crudo(l.velocityKmS)} km/s = ${redondear(l.distanceKm / l.velocityKmS)} s = ${ms(l.tpMs)}`
        ),
        nota: "Es lo que tarda la señal en recorrer el enlace. No depende del tamaño de la trama.",
      })
    );

    pasos.push(
      paso({
        id: "a",
        titulo: "Parámetro del enlace",
        formula: "a = Tp / Tt",
        sustitucion: `${ms(r.tpTotalMs)} / ${ms(r.ttDataTotalMs)}`,
        resultado: Number.isFinite(r.aRatio) ? redondear(r.aRatio) : "∞",
        detalle: unSalto
          ? [
              `Forma cerrada equivalente: a = (R · d) / (V · L)`,
              `a = (${crudo(r.perLink[0].rateBps)} · ${redondear(r.perLink[0].distanceKm)}) / (${crudo(r.perLink[0].velocityKmS)} · ${crudo(r.frameBits)}) = ${redondear(r.aRatio)}`,
            ]
          : [
              "Con varios tramos se usan los totales del camino: a = ΣTp / ΣTt.",
              `a = ${ms(r.tpTotalMs)} / ${ms(r.ttDataTotalMs)} = ${redondear(r.aRatio)}`,
            ],
        nota: "a mide cuántas veces cabe el tiempo de transmisión dentro del de propagación. Cuanto mayor es a, peor le sienta Stop & Wait.",
      })
    );

    const detalleIda = [
      `Transmisión en los ${r.hops} tramo(s): ${ms(r.ttDataTotalMs)}`,
      `Propagación en los ${r.hops} tramo(s): ${ms(r.tpTotalMs)}`,
    ];
    if (r.processingMs > 0) detalleIda.push(`Procesamiento en nodos intermedios: ${ms(r.processingMs)}`);
    if (r.hops > 1) {
      detalleIda.push(
        "Cada nodo intermedio recibe la trama completa antes de reenviarla (store-and-forward): por eso Tt se paga una vez por tramo."
      );
    }

    pasos.push(
      paso({
        id: "ida",
        titulo: "Viaje de ida de la trama",
        formula: r.processingMs > 0 ? "ida = ΣTt + ΣTp + procesamiento" : "ida = ΣTt + ΣTp",
        sustitucion:
          r.processingMs > 0
            ? `${ms(r.ttDataTotalMs)} + ${ms(r.tpTotalMs)} + ${ms(r.processingMs)}`
            : `${ms(r.ttDataTotalMs)} + ${ms(r.tpTotalMs)}`,
        resultado: ms(r.forwardMs),
        detalle: detalleIda,
      })
    );

    pasos.push(
      paso({
        id: "vuelta",
        titulo: "Viaje de vuelta del ACK",
        formula: "vuelta = ΣTt(ACK) + ΣTp",
        sustitucion: `${ms(r.ttAckTotalMs)} + ${ms(r.tpTotalMs)}`,
        resultado: ms(r.ackReturnMs),
        detalle:
          r.ackBits === 0
            ? ["El ACK se toma como despreciable en tiempo de transmisión, así que solo cuenta la propagación."]
            : [`El ACK ocupa el medio ${ms(r.ttAckTotalMs)} en total, sumando todos los tramos.`],
      })
    );

    const detalleCiclo = [`RTT = ida + vuelta = ${ms(r.forwardMs)} + ${ms(r.ackReturnMs)} = ${ms(r.rttMs)}`];
    if (conVuelta) {
      detalleCiclo.push(
        `Half duplex: hay que invertir el sentido del medio dos veces por ciclo, ${ms(r.turnaroundTotalMs)} en total.`
      );
      detalleCiclo.push("El RTT no cambia por ser half duplex; lo que crece es el ciclo.");
    }

    pasos.push(
      paso({
        id: "ciclo",
        titulo: "Ciclo completo del protocolo",
        formula: conVuelta ? "ciclo = RTT + 2 · tiempo de vuelta" : "ciclo = RTT = ida + vuelta",
        sustitucion: conVuelta
          ? `${ms(r.rttMs)} + ${ms(r.turnaroundTotalMs)}`
          : `${ms(r.forwardMs)} + ${ms(r.ackReturnMs)}`,
        resultado: ms(r.cycleMs),
        detalle: detalleCiclo,
        nota: "Durante todo el ciclo el emisor no puede mandar nada más: esa es la penalización de Stop & Wait.",
      })
    );

    const detalleU = [
      `El emisor solo transmite datos ${ms(r.senderTtMs)} de cada ${ms(r.cycleMs)}.`,
    ];
    if (unSalto && r.ackBits === 0 && !conVuelta) {
      detalleU.push(
        `Comprobación con la forma del libro: U = 1 / (1 + 2a) = 1 / (1 + 2 · ${redondear(r.aRatio)}) = ${pct(1 / (1 + 2 * r.aRatio))}`
      );
    } else {
      detalleU.push(
        "Con varios tramos, ACK con tamaño o canal half duplex, la forma 1/(1+2a) ya no basta: hay que dividir por el ciclo real."
      );
    }

    pasos.push(
      paso({
        id: "u",
        titulo: "Utilización del canal",
        formula: "U = Tt(emisor) / ciclo",
        sustitucion: `${ms(r.senderTtMs)} / ${ms(r.cycleMs)}`,
        resultado: pct(r.utilization),
        detalle: detalleU,
        nota: `El canal queda ocioso el ${pct(r.idleFraction)} del tiempo.`,
      })
    );

    if (conErrores) {
      pasos.push(
        paso({
          id: "perror",
          titulo: "Probabilidad de que el ciclo falle",
          formula: "P = 1 − Π(1 − Pi)",
          sustitucion: r.perLink
            .map((l) => `(1 − ${redondear(l.errorProbData)})`)
            .join(" · "),
          resultado: pct(r.cycleErrorProb),
          detalle: [
            "El ciclo falla si se daña la trama en cualquier tramo, o el ACK en cualquier tramo.",
            `Probabilidad de que todo salga bien: ${pct(r.cycleSuccessProb)}`,
            "El emisor no distingue si se perdió la trama o el ACK: en ambos casos espera el temporizador.",
          ],
        })
      );

      pasos.push(
        paso({
          id: "uefectiva",
          titulo: "Utilización efectiva con errores",
          formula: "U_efectiva = U · (1 − P)",
          sustitucion: `${pct(r.utilization)} · ${redondear(r.cycleSuccessProb)}`,
          resultado: pct(r.effectiveUtilization),
          detalle: [
            `Transmisiones esperadas por trama entregada: 1 / (1 − P) = ${redondear(r.expectedTransmissions)}`,
            unSalto && r.ackBits === 0 && !conVuelta
              ? `Con un enlace directo esto es la forma clásica (1 − P) / (1 + 2a).`
              : "Cada retransmisión vuelve a pagar el ciclo entero.",
          ],
        })
      );
    }

    pasos.push(
      paso({
        id: "caudal",
        titulo: "Caudal útil",
        formula: "caudal = L · (1 − P) / ciclo",
        sustitucion: `${crudo(r.frameBits)} · ${redondear(r.cycleSuccessProb)} / ${ms(r.cycleMs)}`,
        resultado: bps(r.throughputBps),
        detalle: [
          `De los ${bps(r.perLink[0].rateBps)} que da el primer tramo, en la práctica se aprovechan ${bps(r.throughputBps)}.`,
        ],
      })
    );

    pasos.push(
      paso({
        id: "bdp",
        titulo: "Producto ancho de banda por retardo",
        formula: "BDP = R · RTT",
        sustitucion: `${crudo(r.perLink[0].rateBps)} · ${redondear(r.rttMs / 1000)} s`,
        resultado: `${entero(r.bandwidthDelayProductBits)} bits`,
        detalle: [
          `Son ${redondear(r.bandwidthDelayProductBits / r.frameBits)} tramas de ${crudo(r.frameBits)} bits.`,
          "Es lo que cabría en el canal si el emisor pudiera transmitir sin parar. Stop & Wait deja ese hueco vacío.",
        ],
      })
    );

    pasos.push(
      paso({
        id: "timeout",
        titulo: "Temporizador mínimo razonable",
        formula: "timeout ≥ RTT",
        sustitucion: `≥ ${ms(r.rttMs)}`,
        resultado: ms(r.minimumTimeoutMs),
        detalle: [
          "Por debajo del RTT el emisor retransmite tramas cuyo ACK todavía viene en camino.",
          "El receptor las verá como duplicadas y las descartará, así que el trabajo se pierde entero.",
        ],
      })
    );

    return { entrada, titular, pasos, graficas: graficas(r) };
  }

  /**
   * Desarrollo de la ráfaga de ruido: cuántos bits arruina y sobre cuántas
   * tramas se reparten. No calcula nada aquí: llama a network.js.
   * @param {{rateBps: number, burstMs: number, frameBits: number}} spec
   * @returns {Array} pasos, con el mismo `paso(spec)` que usa `build`
   */
  function buildBurst(spec) {
    const bits = N.burstBitsFromMs({ rateBps: spec.rateBps, burstMs: spec.burstMs });
    const dano = N.burstDamage({ bits, frameBits: spec.frameBits });

    return [
      paso({
        id: "burst-bits",
        titulo: "Bits que arruina la ráfaga",
        formula: "bits = R · t",
        sustitucion: `${crudo(spec.rateBps)} · ${redondear(spec.burstMs / 1000)} s`,
        resultado: `${entero(bits)} bits`,
        detalle: [
          `${bps(spec.rateBps)} sostenidos durante ${ms(spec.burstMs)} arruinan ${entero(bits)} bits seguidos.`,
          "Esta conversión de milisegundos a bits es análisis dimensional (bit/s por s da bits), no una fórmula del libro: Tanenbaum mide las ráfagas directamente en bits.",
        ],
      }),
      paso({
        id: "burst-frames",
        titulo: "Tramas que abarca la ráfaga",
        formula: "tramas = ⌈bits / L⌉",
        sustitucion: `${crudo(bits)} / ${crudo(spec.frameBits)}`,
        resultado: `${entero(dano.frames)} ${dano.frames === 1 ? "trama" : "tramas"}`,
        detalle: [
          "Se redondea hacia arriba: aunque la ráfaga no llene entera la última trama que toca, esa trama queda arruinada igual.",
          "El libro sí trae este otro resultado: un CRC con r bits de verificación detecta cualquier ráfaga de longitud ≤ r.",
        ],
      }),
    ];
  }

  /**
   * Desarrollo de la transferencia de un fichero completo: cuántas tramas
   * hacen falta y cuánto tarda. No calcula nada aquí: llama a network.js.
   * @param {{path: object, totalBits: number}} spec
   * @returns {Array} pasos, con el mismo `paso(spec)` que usa `build`
   */
  function buildTransfer(spec) {
    const r = N.transferAnalysis(spec.path, spec.totalBits);
    const cycleMs = r.totalMs / r.frames;

    return [
      paso({
        id: "transfer-frames",
        titulo: "Tramas que hacen falta",
        formula: "tramas = ⌈bits / L⌉",
        sustitucion: `${crudo(spec.totalBits)} / ${crudo(spec.path.frameBits)}`,
        resultado: `${entero(r.frames)} ${r.frames === 1 ? "trama" : "tramas"}`,
        detalle: [
          "Se redondea hacia arriba: la última trama cuenta entera aunque el fichero no la llene del todo.",
        ],
      }),
      paso({
        id: "transfer-time",
        titulo: "Tiempo total de la transferencia",
        formula: "tiempo = tramas · ciclo",
        sustitucion: `${entero(r.frames)} · ${ms(cycleMs)}`,
        resultado: ms(r.totalMs),
        detalle: [
          "Con Stop & Wait el emisor no puede adelantar trabajo: cada trama paga el ciclo completo, una detrás de otra.",
          "Esto supone canal limpio: no cuenta reenvíos. Con ruido el tiempo real es mayor, porque cada retransmisión repite el ciclo entero.",
        ],
      }),
      paso({
        id: "transfer-goodput",
        titulo: "Caudal conseguido en la transferencia",
        formula: "goodput = bits / tiempo",
        sustitucion: `${crudo(spec.totalBits)} / ${redondear(r.totalMs / 1000)} s`,
        resultado: bps(r.goodputBps),
        detalle: [
          "Es el fichero completo entre el tiempo total: al no haber reenvíos, coincide con el caudal útil de un solo ciclo.",
        ],
      }),
    ];
  }

  // ---------- Datos para las gráficas ----------

  function graficas(r) {
    // Curva U = 1/(1+2a) en escala logarítmica de a, con el punto actual.
    const puntos = [];
    for (let i = 0; i <= 120; i++) {
      const exponente = -2 + (i / 120) * 5; // a de 0,01 a 1000
      const a = Math.pow(10, exponente);
      puntos.push({ a, u: 1 / (1 + 2 * a) });
    }

    return {
      curva: {
        puntos,
        actual: Number.isFinite(r.aRatio) ? { a: r.aRatio, u: r.utilization } : null,
      },
      ciclo: {
        totalMs: r.cycleMs,
        segmentos: [
          { etiqueta: "Transmitiendo", ms: r.senderTtMs, tipo: "activo" },
          { etiqueta: "Esperando", ms: Math.max(0, r.cycleMs - r.senderTtMs), tipo: "ocioso" },
        ],
      },
    };
  }

  return { build, buildBurst, buildTransfer, formato: { ms, bps, pct, entero, crudo, redondear } };
});
