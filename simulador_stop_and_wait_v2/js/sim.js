// sim.js
// Máquina de estados de Stop & Wait sobre un camino de N saltos.
// Sin DOM y con tiempo simulado explícito: se avanza con `advance(dtMs)`, así
// que la misma secuencia de llamadas produce siempre el mismo resultado y se
// puede probar con `node --test`.
//
// Reglas del protocolo (Tanenbaum, cap. 3, Protocolo 3 · PAR):
//  - Ventana 1: como mucho una trama de datos en vuelo.
//  - Número de secuencia de 1 bit que alterna 0/1.
//  - El receptor descarta la trama si el CRC falla o si el número de secuencia
//    no es el esperado, y en el segundo caso repite el ACK.
//  - El emisor arma el temporizador en CADA envío, no solo ante una pérdida.

(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./frame.js") : root.FrameModel,
    typeof module === "object" && module.exports ? require("./network.js") : root.NetworkModel
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SimModel = api;
})(typeof self !== "undefined" ? self : this, function (F, N) {
  "use strict";

  const STATE = {
    IDLE: "IDLE",
    TRANSMITTING: "TRANSMITTING",
    WAITING_ACK: "WAITING_ACK",
    TIMEOUT: "TIMEOUT",
    FINISHED: "FINISHED",
  };

  const PHASE = { TX: "tx", PROP: "prop", FROZEN: "frozen" };

  // Motivos por los que una trama deja de avanzar, para el diagrama.
  const STATUS = {
    OK: "ok",
    DESTROYED: "destroyed",
    CRC_FAIL: "crc",
    DUPLICATE: "duplicate",
  };

  function createSimulation(spec) {
    const path = spec.path; // objeto de network.js
    const analysis = N.analyze(path);

    const sim = {
      path,
      analysis,
      nodeCount: path.links.length + 1,
      totalFrames: spec.totalFrames === undefined ? 5 : spec.totalFrames,
      // Timeout en milisegundos de tiempo simulado. Por defecto, el mínimo
      // razonable (el RTT) más un 50 % de margen.
      timeoutMs: spec.timeoutMs === undefined ? analysis.rttMs * 1.5 : spec.timeoutMs,
      nakOnError: spec.nakOnError === true,
      payloadBytes: spec.payloadBytes === undefined ? 8 : spec.payloadBytes,
      random: F.seededRandom(spec.seed === undefined ? 1 : spec.seed),

      clockMs: 0,
      state: STATE.IDLE,
      running: false,

      // Emisor
      seqNum: 0,
      frameIdx: 0,
      timerActive: false,
      timerRemainingMs: 0,

      // Receptor
      rxExpectedSeq: 0,
      rxDelivered: 0,

      wire: [], // paquetes en vuelo
      events: [], // trazas para el diagrama tiempo-espacio
      log: [],

      stats: {
        framesSent: 0,
        acksReceived: 0,
        naksReceived: 0,
        framesDestroyed: 0,
        acksDestroyed: 0,
        crcFailures: 0,
        duplicatesDiscarded: 0,
        retransmissions: 0,
        lateAcks: 0,
      },
    };

    return sim;
  }

  function nextSeq(seq) {
    return (seq + 1) % 2;
  }

  function note(sim, kind, message) {
    sim.log.push({ tMs: sim.clockMs, kind, message });
    if (sim.log.length > 400) sim.log.shift();
  }

  // ---------- Paquetes en vuelo ----------

  function linkFor(sim, packet) {
    return sim.path.links[packet.hop];
  }

  function beginHop(sim, packet) {
    const link = linkFor(sim, packet);
    const bits = packet.frame.kind === F.KIND.FRAME ? sim.path.frameBits : sim.path.ackBits;
    packet.phase = PHASE.TX;
    packet.txMs = N.transmissionMs(link, bits);
    packet.propMs = N.propagationMs(link);
    packet.elapsedMs = 0;
    packet.hopStartMs = sim.clockMs;
    packet.fromIdx = packet.dir > 0 ? packet.hop : packet.hop + 1;
    packet.toIdx = packet.dir > 0 ? packet.hop + 1 : packet.hop;
  }

  function launch(sim, frame, dir) {
    const packet = {
      frame,
      dir, // +1 emisor → receptor, −1 de vuelta
      hop: dir > 0 ? 0 : sim.path.links.length - 1,
      phase: PHASE.TX,
      elapsedMs: 0,
      txMs: 0,
      propMs: 0,
      hopStartMs: sim.clockMs,
      frozenRemainingMs: 0,
      fromIdx: 0,
      toIdx: 0,
    };
    beginHop(sim, packet);
    sim.wire.push(packet);
    return packet;
  }

  function emitEvent(sim, packet, status, fraction) {
    sim.events.push({
      tStart: packet.hopStartMs,
      tEnd: sim.clockMs,
      fromIdx: packet.fromIdx,
      toIdx: packet.toIdx,
      kind: packet.frame.kind,
      label: F.label(packet.frame),
      status,
      fraction: fraction === undefined ? 1 : fraction,
      corrupted: packet.frame.corrupted,
    });
    if (sim.events.length > 600) sim.events.shift();
  }

  function removePacket(sim, packet) {
    sim.wire = sim.wire.filter((p) => p !== packet);
  }

  // ---------- Emisor ----------

  function armTimer(sim) {
    sim.timerActive = true;
    sim.timerRemainingMs = sim.timeoutMs;
  }

  function stopTimer(sim) {
    sim.timerActive = false;
    sim.timerRemainingMs = 0;
  }

  function sendFrame(sim, isRetransmission) {
    if (sim.frameIdx >= sim.totalFrames) {
      sim.state = STATE.FINISHED;
      sim.running = false;
      stopTimer(sim);
      note(sim, "SUCCESS", "Todas las tramas fueron confirmadas");
      return null;
    }

    const frame = F.createFrame({
      kind: F.KIND.FRAME,
      seq: sim.seqNum,
      frameIdx: sim.frameIdx,
      payloadBytes: sim.payloadBytes,
    });

    sim.stats.framesSent += 1;
    if (isRetransmission) sim.stats.retransmissions += 1;
    sim.state = STATE.TRANSMITTING;
    note(
      sim,
      isRetransmission ? "WARNING" : "INFO",
      `${isRetransmission ? "Retransmite" : "Envía"} trama #${sim.frameIdx + 1} (seq=${sim.seqNum})`
    );

    const packet = launch(sim, frame, +1);
    armTimer(sim);
    return packet;
  }

  function onTimeout(sim) {
    stopTimer(sim);
    sim.state = STATE.TIMEOUT;
    sim.events.push({
      tStart: sim.clockMs,
      tEnd: sim.clockMs,
      fromIdx: 0,
      toIdx: 0,
      kind: "TIMEOUT",
      label: "timeout",
      status: STATUS.OK,
      fraction: 1,
    });
    note(sim, "ERROR", `Expiró el temporizador esperando ACK${nextSeq(sim.seqNum)}`);
    // La trama que siguiera en vuelo ya no sirve: el emisor la da por perdida.
    sim.wire = sim.wire.filter((p) => p.frame.kind !== F.KIND.FRAME);
    sendFrame(sim, true);
  }

  // ---------- Receptor ----------

  function onFrameArrivedAtReceiver(sim, packet) {
    const frame = packet.frame;

    if (!F.isIntact(frame)) {
      sim.stats.crcFailures += 1;
      emitEvent(sim, packet, STATUS.CRC_FAIL);
      removePacket(sim, packet);
      note(sim, "ERROR", `CRC incorrecto en ${F.label(frame)}: el receptor la descarta`);

      if (sim.nakOnError) {
        const nak = F.createFrame({
          kind: F.KIND.NAK,
          seq: frame.seq,
          frameIdx: frame.frameIdx,
          payloadBytes: sim.payloadBytes,
        });
        note(sim, "WARNING", `El receptor envía NAK${frame.seq}`);
        launch(sim, nak, -1);
      }
      return;
    }

    if (frame.seq === sim.rxExpectedSeq) {
      sim.rxDelivered += 1;
      sim.rxExpectedSeq = nextSeq(sim.rxExpectedSeq);
      emitEvent(sim, packet, STATUS.OK);
      note(sim, "SUCCESS", `Receptor acepta ${F.label(frame)} y la entrega a la capa de red`);
    } else {
      sim.stats.duplicatesDiscarded += 1;
      emitEvent(sim, packet, STATUS.DUPLICATE);
      note(sim, "WARNING", `${F.label(frame)} duplicada: se descarta y se repite el ACK`);
    }

    removePacket(sim, packet);

    // En ambos casos el receptor confirma: el ACK lleva el número de la
    // siguiente trama que espera (ACK0 confirma la trama 1, y viceversa).
    const ack = F.createFrame({
      kind: F.KIND.ACK,
      seq: sim.rxExpectedSeq,
      frameIdx: frame.frameIdx,
      payloadBytes: sim.payloadBytes,
    });
    launch(sim, ack, -1);
  }

  function onAckArrivedAtSender(sim, packet) {
    const frame = packet.frame;

    if (!F.isIntact(frame)) {
      sim.stats.crcFailures += 1;
      emitEvent(sim, packet, STATUS.CRC_FAIL);
      removePacket(sim, packet);
      note(sim, "ERROR", `El ACK llegó dañado: el emisor lo ignora y espera el temporizador`);
      return;
    }

    if (frame.kind === F.KIND.NAK) {
      sim.stats.naksReceived += 1;
      emitEvent(sim, packet, STATUS.OK);
      removePacket(sim, packet);
      note(sim, "WARNING", "NAK recibido: retransmite sin esperar el temporizador");
      stopTimer(sim);
      sim.wire = sim.wire.filter((p) => p.frame.kind !== F.KIND.FRAME);
      sendFrame(sim, true);
      return;
    }

    const esperado = nextSeq(sim.seqNum);
    emitEvent(sim, packet, STATUS.OK);
    removePacket(sim, packet);

    // El emisor solo tiene en cuenta un ACK mientras hay una trama pendiente de
    // confirmar: el temporizador armado es justo esa condición. Si ya no espera
    // nada, lo que llega es una copia vieja.
    if (!sim.timerActive || frame.seq !== esperado) {
      // Un ACK viejo que llegó tarde: ya no confirma nada.
      sim.stats.lateAcks += 1;
      note(sim, "WARNING", `${F.label(frame)} llegó fuera de tiempo: el emisor lo descarta`);
      return;
    }

    sim.stats.acksReceived += 1;
    stopTimer(sim);
    note(sim, "SUCCESS", `${F.label(frame)} confirma la trama #${sim.frameIdx + 1}`);

    sim.seqNum = nextSeq(sim.seqNum);
    sim.frameIdx += 1;
    sendFrame(sim, false);
  }

  // ---------- Avance del tiempo ----------

  function arrive(sim, packet) {
    const esNodoFinal =
      (packet.dir > 0 && packet.hop === sim.path.links.length - 1) ||
      (packet.dir < 0 && packet.hop === 0);

    emitEventIfIntermediate(sim, packet, esNodoFinal);

    if (!esNodoFinal) {
      packet.hop += packet.dir;
      beginHop(sim, packet);
      return;
    }

    if (packet.dir > 0) onFrameArrivedAtReceiver(sim, packet);
    else onAckArrivedAtSender(sim, packet);
  }

  function emitEventIfIntermediate(sim, packet, esNodoFinal) {
    // El tramo final lo registra quien procesa la llegada, porque necesita
    // saber si el CRC cuadró o si era duplicada.
    if (!esNodoFinal) emitEvent(sim, packet, STATUS.OK);
  }

  // Al entrar en un tramo, el ruido del canal puede dañar la trama.
  function applyChannelNoise(sim, packet) {
    const link = linkFor(sim, packet);
    const prob = packet.frame.kind === F.KIND.FRAME ? link.errorProbData : link.errorProbAck;
    if (prob > 0 && sim.random() < prob) {
      F.flipRandomBit(packet.frame, sim.random);
      note(sim, "ERROR", `El ruido del canal dañó ${F.label(packet.frame)} en "${link.name}"`);
    }
  }

  function advance(sim, dtMs) {
    if (dtMs <= 0) return sim;
    // En pausa no se mueve nada. Pero si el emisor ya terminó y todavía queda
    // algo en el canal (un ACK retrasado, por ejemplo), ese paquete tiene que
    // llegar: el canal no se detiene porque el emisor haya acabado.
    const terminandoEnVuelo = sim.state === STATE.FINISHED && sim.wire.length > 0;
    if (!sim.running && !terminandoEnVuelo) return sim;

    sim.clockMs += dtMs;

    // Temporizador de retransmisión.
    if (sim.timerActive) {
      sim.timerRemainingMs -= dtMs;
      if (sim.timerRemainingMs <= 0) {
        onTimeout(sim);
      } else if (sim.wire.every((p) => p.frame.kind !== F.KIND.FRAME)) {
        sim.state = STATE.WAITING_ACK;
      }
    }

    // Copia: la lista cambia mientras se procesan las llegadas.
    for (const packet of sim.wire.slice()) {
      if (!sim.wire.includes(packet)) continue;
      stepPacket(sim, packet, dtMs);
    }

    return sim;
  }

  function stepPacket(sim, packet, dtMs) {
    let restante = dtMs;
    let vueltas = 0;

    while (restante > 0 && sim.wire.includes(packet) && vueltas < 64) {
      vueltas += 1;

      if (packet.phase === PHASE.FROZEN) {
        packet.frozenRemainingMs -= restante;
        if (packet.frozenRemainingMs > 0) return;
        restante = -packet.frozenRemainingMs;
        packet.phase = PHASE.PROP;
        packet.elapsedMs = 0;
        continue;
      }

      const duracion = packet.phase === PHASE.TX ? packet.txMs : packet.propMs;
      const falta = duracion - packet.elapsedMs;

      if (restante < falta) {
        packet.elapsedMs += restante;
        return;
      }

      restante -= falta;
      packet.elapsedMs = 0;

      if (packet.phase === PHASE.TX) {
        // Terminó de salir al medio: aquí es donde el ruido puede alcanzarla.
        applyChannelNoise(sim, packet);
        packet.phase = PHASE.PROP;
      } else {
        arrive(sim, packet);
        return; // tras llegar, el paquete o se consumió o empezó otro tramo
      }
    }
  }

  // ---------- Control ----------

  function start(sim) {
    if (sim.state === STATE.FINISHED) return sim;
    if (sim.state === STATE.IDLE) {
      sim.running = true;
      sendFrame(sim, false);
    } else {
      sim.running = true;
    }
    return sim;
  }

  function pause(sim) {
    sim.running = false;
    return sim;
  }

  function reset(sim) {
    sim.clockMs = 0;
    sim.state = STATE.IDLE;
    sim.running = false;
    sim.seqNum = 0;
    sim.frameIdx = 0;
    sim.rxExpectedSeq = 0;
    sim.rxDelivered = 0;
    stopTimer(sim);
    sim.wire = [];
    sim.events = [];
    sim.log = [];
    for (const key of Object.keys(sim.stats)) sim.stats[key] = 0;
    return sim;
  }

  // ---------- Acciones sobre la trama en vuelo (con la simulación en pausa) ----------

  function selected(sim, index) {
    return sim.wire[index === undefined ? 0 : index] || null;
  }

  function flipBitOf(sim, packet, bitIndex) {
    if (!packet) throw new Error("No hay ninguna trama en vuelo");
    F.flipBit(packet.frame, bitIndex);
    note(sim, "WARNING", `Bit ${bitIndex} volteado en ${F.label(packet.frame)}`);
    return packet;
  }

  function setSeqOf(sim, packet, seq) {
    if (!packet) throw new Error("No hay ninguna trama en vuelo");
    // Cambiar el número de secuencia rehace la trama: el CRC se recalcula,
    // porque esto simula un emisor que se equivoca, no un canal que daña bits.
    const nueva = F.createFrame({
      kind: packet.frame.kind,
      seq,
      frameIdx: packet.frame.frameIdx,
      payloadBytes: sim.payloadBytes,
    });
    packet.frame = nueva;
    note(sim, "WARNING", `Número de secuencia forzado a ${seq}`);
    return packet;
  }

  function destroy(sim, packet) {
    if (!packet) throw new Error("No hay ninguna trama en vuelo");
    const fraccion =
      packet.phase === PHASE.PROP && packet.propMs > 0 ? packet.elapsedMs / packet.propMs : 0.5;
    emitEvent(sim, packet, STATUS.DESTROYED, fraccion);
    if (packet.frame.kind === F.KIND.FRAME) sim.stats.framesDestroyed += 1;
    else sim.stats.acksDestroyed += 1;
    removePacket(sim, packet);
    note(sim, "ERROR", `${F.label(packet.frame)} destruida en el canal`);
    return sim;
  }

  function freeze(sim, packet, ms) {
    if (!packet) throw new Error("No hay ninguna trama en vuelo");
    packet.phase = PHASE.FROZEN;
    packet.frozenRemainingMs = ms;
    note(sim, "WARNING", `${F.label(packet.frame)} retrasada ${Math.round(ms)} ms`);
    return sim;
  }

  // Posición del paquete en el camino, en [0, nodeCount−1], para dibujarlo.
  function positionOf(packet) {
    const avance =
      packet.phase === PHASE.PROP && packet.propMs > 0 ? packet.elapsedMs / packet.propMs : 0;
    return packet.fromIdx + (packet.toIdx - packet.fromIdx) * avance;
  }

  return {
    STATE,
    PHASE,
    STATUS,
    createSimulation,
    advance,
    start,
    pause,
    reset,
    sendFrame,
    selected,
    flipBitOf,
    setSeqOf,
    destroy,
    freeze,
    positionOf,
    nextSeq,
  };
});
