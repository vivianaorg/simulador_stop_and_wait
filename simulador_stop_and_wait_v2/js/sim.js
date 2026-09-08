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

  // Suma de los tiempos de vuelta del camino. En half duplex el medio va en un
  // solo sentido a la vez: antes de que salga el ACK, y antes de la siguiente
  // trama, hay que invertirlo. En full duplex no cuesta nada.
  function turnaroundMs(sim) {
    if (sim.path.duplexMode !== N.DUPLEX.HALF) return 0;
    return sim.path.links.reduce((acc, l) => acc + l.turnaroundMs, 0);
  }

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
      // Sin payloadBytes explícito, la carga sale de path.frameBits: es la
      // misma regla de la Tarea 3 (frameBits manda), aquí en sim.js para que
      // una simulación construida directamente (sin pasar por la UI) no
      // vuelva a tener un tamaño de trama de mentira desacoplado del real.
      payloadBytes: spec.payloadBytes === undefined ? F.payloadBytesFor(path.frameBits) : spec.payloadBytes,
      random: F.seededRandom(spec.seed === undefined ? 1 : spec.seed),

      clockMs: 0,
      state: STATE.IDLE,
      running: false,
      burst: null,

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
        burstBitsRuined: 0,
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

  function launch(sim, frame, dir, esperaPreviaMs) {
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
      // Tiempo de inversión del medio que hay que esperar antes de empezar a
      // transmitir. Cero en full duplex.
      turnRemainingMs: esperaPreviaMs || 0,
      fromIdx: 0,
      toIdx: 0,
    };
    beginHop(sim, packet);
    sim.wire.push(packet);

    if (packet.turnRemainingMs > 0) {
      pushEvent(sim, {
        tStart: sim.clockMs,
        tEnd: sim.clockMs + packet.turnRemainingMs,
        fromIdx: packet.fromIdx,
        toIdx: packet.fromIdx,
        kind: "TURN",
        label: "inversión del medio",
        status: STATUS.OK,
        fraction: 1,
      });
      note(sim, "INFO", `Half duplex: invirtiendo el medio (${Math.round(packet.turnRemainingMs)} ms)`);
    }
    return packet;
  }

  const MAX_EVENTOS = 600;

  // Único sitio por el que se añaden eventos: así el recorte no se puede
  // olvidar. Antes lo hacía solo emitEvent, y los timeouts y las inversiones
  // del medio se colaban sin pasar por aquí.
  function pushEvent(sim, evento) {
    sim.events.push(evento);
    if (sim.events.length > MAX_EVENTOS) sim.events.shift();
  }

  function emitEvent(sim, packet, status, fraction) {
    pushEvent(sim, {
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

    // La primera trama no espera: el medio ya está en su sentido. Las
    // siguientes llegan después de un ACK, así que hay que invertirlo otra vez.
    const espera = sim.stats.framesSent === 1 ? 0 : turnaroundMs(sim);
    const packet = launch(sim, frame, +1, espera);
    armTimer(sim);
    return packet;
  }

  function onTimeout(sim) {
    stopTimer(sim);
    sim.state = STATE.TIMEOUT;
    pushEvent(sim, {
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
        launch(sim, nak, -1, turnaroundMs(sim));
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
    launch(sim, ack, -1, turnaroundMs(sim));
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
      const bits = N.burstBitsFromMs({ rateBps: link.rateBps, burstMs: dtMs });
      if (bits <= 0) continue;

      const desde = sim.burst.cursorPorPaquete.get(packet) || 0;
      const tocados = F.flipRun(packet.frame, desde, bits);
      sim.burst.cursorPorPaquete.set(packet, desde + tocados);
      sim.stats.burstBitsRuined += tocados;
    }
  }

  // Cuánto falta para el próximo suceso: que expire el temporizador, o que un
  // paquete termine la fase en la que está.
  function proximoSucesoMs(sim) {
    let minimo = Infinity;
    if (sim.timerActive) minimo = Math.min(minimo, sim.timerRemainingMs);
    if (sim.burst) minimo = Math.min(minimo, sim.burst.endsAtMs - sim.clockMs);

    for (const p of sim.wire) {
      if (p.turnRemainingMs > 0) minimo = Math.min(minimo, p.turnRemainingMs);
      else if (p.phase === PHASE.FROZEN) minimo = Math.min(minimo, p.frozenRemainingMs);
      else {
        const duracion = p.phase === PHASE.TX ? p.txMs : p.propMs;
        minimo = Math.min(minimo, duracion - p.elapsedMs);
      }
    }
    return minimo;
  }

  /**
   * Avanza el tiempo simulado. El delta se parte en tramos que terminan justo
   * en el siguiente suceso, así que un paso grande produce exactamente el mismo
   * resultado que muchos pasos pequeños: la animación puede ir a tirones sin
   * que la simulación mienta.
   */
  function advance(sim, dtMs) {
    if (!(dtMs > 0)) return sim;

    let restante = dtMs;
    let vueltas = 0;
    while (restante > 1e-9 && vueltas < 10000) {
      vueltas += 1;
      const puedeAvanzar =
        sim.running || (sim.state === STATE.FINISHED && sim.wire.length > 0);
      if (!puedeAvanzar) break;

      const hasta = proximoSucesoMs(sim);
      const tramo = Number.isFinite(hasta) ? Math.max(1e-6, Math.min(restante, hasta)) : restante;
      avanzarTramo(sim, tramo);
      restante -= tramo;
    }
    return sim;
  }

  function avanzarTramo(sim, dtMs) {
    sim.clockMs += dtMs;

    applyBurst(sim, dtMs);
    if (sim.burst && sim.clockMs >= sim.burst.endsAtMs) {
      sim.burst = null;
      note(sim, "INFO", "La ráfaga terminó: el canal vuelve a estar limpio");
    }

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

      // La inversión del medio se paga antes de nada: el paquete existe pero
      // todavía no ocupa el canal.
      if (packet.turnRemainingMs > 0) {
        packet.turnRemainingMs -= restante;
        if (packet.turnRemainingMs > 0) return;
        restante = -packet.turnRemainingMs;
        packet.turnRemainingMs = 0;
        // El tramo empieza a contar ahora, no cuando se creó el paquete.
        packet.hopStartMs = sim.clockMs - restante;
        continue;
      }

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
    sim.burst = null;
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
    proximoSucesoMs,
    startBurst,
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
