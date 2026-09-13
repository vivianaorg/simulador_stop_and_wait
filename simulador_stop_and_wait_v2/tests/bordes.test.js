// bordes.test.js — casos raros, valores extremos y usos hostiles.
// La suite normal comprueba que el simulador hace lo que debe; esta comprueba
// que no se rompe cuando se le pide algo absurdo.
//
// `node --test tests/bordes.test.js`

const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/frame.js");
const N = require("../js/network.js");
const S = require("../js/sim.js");
const Steps = require("../js/steps.js");

function enlace(extra) {
  return N.createLink({
    name: "Enlace",
    rateBps: 100000,
    distanceKm: 2000,
    velocityKmS: 200000,
    ...(extra || {}),
  });
}

function camino(extra, enlaces) {
  return N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: enlaces || [enlace()],
    ...(extra || {}),
  });
}

function correr(sim, msTotales, pasoMs) {
  const paso = pasoMs || 1;
  for (let t = 0; t < msTotales; t += paso) S.advance(sim, paso);
  return sim;
}

// ---------- Valores extremos del enlace ----------

test("Distancia cero: no hay propagación, y la utilización es total", () => {
  const r = N.analyze(camino({}, [enlace({ distanceKm: 0 })]));
  assert.equal(r.tpTotalMs, 0);
  assert.equal(r.aRatio, 0);
  assert.equal(r.utilization, 1, "sin propagación, el emisor no espera nada");
  assert.equal(r.idleFraction, 0);
});

test("Una trama enorme sobre un enlace lento no desborda ni pierde precisión", () => {
  const r = N.analyze(
    N.createPath({ frameBits: 1e9, ackBits: 0, links: [enlace({ rateBps: 1200 })] })
  );
  assert.ok(Number.isFinite(r.senderTtMs));
  assert.ok(r.utilization > 0.999, "con Tt gigantesco, la propagación deja de importar");
  assert.ok(r.aRatio < 1e-5);
});

test("Un enlace absurdamente rápido no produce división por cero", () => {
  const r = N.analyze(
    N.createPath({ frameBits: 1, ackBits: 0, links: [enlace({ rateBps: 1e12 })] })
  );
  assert.ok(Number.isFinite(r.aRatio), "a es enorme pero finito");
  assert.ok(r.utilization > 0 && r.utilization < 1e-6);
  assert.ok(Number.isFinite(r.throughputBps));
});

test("Diez saltos en serie: los totales son la suma y nada se desborda", () => {
  const enlaces = Array.from({ length: 10 }, (_, i) => enlace({ name: `T${i}` }));
  const r = N.analyze(camino({}, enlaces));

  assert.equal(r.hops, 10);
  assert.ok(Math.abs(r.ttDataTotalMs - 100) < 1e-9, "10 × 10 ms");
  assert.ok(Math.abs(r.tpTotalMs - 100) < 1e-9);
  assert.equal(r.senderTtMs, 10, "el emisor solo ocupa su tramo");
  assert.ok(r.utilization < 0.06);
});

test("Un ACK más grande que la trama sigue dando números coherentes", () => {
  const r = N.analyze(N.createPath({ frameBits: 100, ackBits: 5000, links: [enlace()] }));
  assert.ok(r.ackReturnMs > r.forwardMs, "la vuelta pesa más que la ida");
  assert.ok(r.utilization < 0.05);
  assert.ok(r.utilization > 0);
});

test("Probabilidad de error 1: nunca se entrega nada y las cuentas no explotan", () => {
  const r = N.analyze(camino({}, [enlace({ errorProbData: 1 })]));
  assert.equal(r.cycleSuccessProb, 0);
  assert.equal(r.cycleErrorProb, 1);
  assert.equal(r.effectiveUtilization, 0);
  assert.equal(r.expectedTransmissions, Infinity, "hacen falta infinitos intentos");
  assert.equal(r.throughputBps, 0);
});

test("Errores en la trama y en el ACK se componen en el mismo ciclo", () => {
  const r = N.analyze(camino({}, [enlace({ errorProbData: 0.5, errorProbAck: 0.5 })]));
  assert.ok(Math.abs(r.cycleSuccessProb - 0.25) < 1e-12);
});

// ---------- Entradas inválidas ----------

test("Cada parámetro inválido se rechaza con su mensaje, no en silencio", () => {
  const casos = [
    [{ rateBps: 0 }, /transmisi.n/i],
    [{ rateBps: -5 }, /transmisi.n/i],
    [{ rateBps: NaN }, /transmisi.n/i],
    [{ rateBps: Infinity }, /transmisi.n/i],
    [{ distanceKm: -1 }, /distancia/i],
    [{ distanceKm: NaN }, /distancia/i],
    [{ velocityKmS: 0 }, /velocidad/i],
    [{ velocityKmS: -3 }, /velocidad/i],
    [{ errorProbData: 1.5 }, /probabilidad/i],
    [{ errorProbData: -0.1 }, /probabilidad/i],
    [{ errorProbAck: 2 }, /probabilidad/i],
    [{ turnaroundMs: -1 }, /vuelta/i],
  ];

  for (const [malo, patron] of casos) {
    assert.throws(
      () => enlace(malo),
      (e) => e instanceof RangeError && patron.test(e.message),
      `debería rechazar ${JSON.stringify(malo)}`
    );
  }
});

test("Un camino sin enlaces, o con trama de cero bits, se rechaza", () => {
  assert.throws(() => N.createPath({ frameBits: 1000, links: [] }), RangeError);
  assert.throws(() => N.createPath({ frameBits: 0, links: [enlace()] }), RangeError);
  assert.throws(() => N.createPath({ frameBits: -8, links: [enlace()] }), RangeError);
  assert.throws(() => N.createPath({ frameBits: 1000, ackBits: -1, links: [enlace()] }), RangeError);
  assert.throws(
    () => N.createPath({ frameBits: 1000, links: [enlace()], processingMsPerHop: -2 }),
    RangeError
  );
});

test("Un texto donde va un número se rechaza igual que un número inválido", () => {
  assert.throws(() => enlace({ rateBps: "muy rápido" }), RangeError);
  assert.throws(() => enlace({ distanceKm: "lejos" }), RangeError);
});

// ---------- El paso de tiempo ----------

test("El resultado no depende del tamaño del paso de tiempo", () => {
  const tiempos = [0.1, 0.5, 1, 5].map((paso) => {
    const sim = S.createSimulation({ path: camino(), totalFrames: 3 });
    S.start(sim);
    for (let i = 0; i < 4000 && sim.state !== S.STATE.FINISHED; i++) S.advance(sim, paso);
    assert.equal(sim.state, S.STATE.FINISHED, `no terminó con paso ${paso}`);
    return sim.clockMs;
  });

  const minimo = Math.min(...tiempos);
  const maximo = Math.max(...tiempos);
  assert.ok(
    maximo - minimo <= 5,
    `el tiempo total varía demasiado con el paso: ${tiempos.map((t) => t.toFixed(2)).join(", ")}`
  );
});

test("Un paso de tiempo gigante no se traga la simulación", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 2 });
  S.start(sim);
  S.advance(sim, 10000); // mucho más que el ciclo entero

  assert.equal(sim.state, S.STATE.FINISHED, "termina igual");
  assert.equal(sim.rxDelivered, 2, "y entrega las dos tramas");
});

test("Avanzar con un delta cero o negativo no cambia nada", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1 });
  S.start(sim);
  correr(sim, 5, 1);
  const antes = { reloj: sim.clockMs, vuelo: sim.wire.length };

  S.advance(sim, 0);
  S.advance(sim, -50);

  assert.equal(sim.clockMs, antes.reloj);
  assert.equal(sim.wire.length, antes.vuelo);
});

// ---------- Configuraciones hostiles del protocolo ----------

test("Un timeout más corto que el tiempo de transmisión no entrega nunca, pero tampoco cuelga", () => {
  // Tt = 10 ms: con timeout de 1 ms el emisor se rinde antes incluso de
  // terminar de poner la trama en el medio, así que al receptor no le llega
  // nada y no hay duplicados que descartar. Es absurdo, y el simulador tiene
  // que enseñarlo sin romperse.
  const sim = S.createSimulation({ path: camino(), totalFrames: 1, timeoutMs: 1 });
  S.start(sim);
  correr(sim, 400, 0.5);

  assert.ok(sim.stats.retransmissions > 3, "reintenta una y otra vez");
  assert.equal(sim.rxDelivered, 0, "nada llega al receptor");
  assert.equal(sim.stats.duplicatesDiscarded, 0, "y por tanto no hay duplicados");
  assert.notEqual(sim.state, S.STATE.FINISHED, "no se da por terminado");
});

test("Un timeout entre la llegada y el ACK sí provoca duplicados", () => {
  // La trama llega a los 20 ms y el ACK volvería a los 30. Con timeout de 25 el
  // emisor retransmite algo que el receptor ya tenía.
  const sim = S.createSimulation({ path: camino(), totalFrames: 1, timeoutMs: 25 });
  S.start(sim);
  correr(sim, 300, 0.5);

  assert.ok(sim.stats.retransmissions >= 1, "retransmite por impaciencia");
  assert.ok(sim.stats.duplicatesDiscarded >= 1, "el receptor reconoce la copia");
  assert.equal(sim.rxDelivered, 1, "y la entrega a la capa de red una sola vez");
});

test("Con el canal siempre roto, el emisor no da por entregada ninguna trama", () => {
  const sim = S.createSimulation({
    path: camino({}, [enlace({ errorProbData: 1 })]),
    totalFrames: 2,
    timeoutMs: 50,
  });
  S.start(sim);
  correr(sim, 600, 0.5);

  assert.equal(sim.rxDelivered, 0);
  assert.notEqual(sim.state, S.STATE.FINISHED, "no puede darse por terminado");
  assert.ok(sim.stats.crcFailures > 3, "cada intento se detecta por CRC");
  assert.ok(sim.stats.retransmissions > 3, "y cada uno provoca su retransmisión");
});

test("Con NAK y el canal siempre roto, se reintenta sin esperar y aun así no se entrega", () => {
  const sim = S.createSimulation({
    path: camino({}, [enlace({ errorProbData: 1 })]),
    totalFrames: 1,
    timeoutMs: 10000,
    nakOnError: true,
  });
  S.start(sim);
  correr(sim, 400, 0.5);

  assert.ok(sim.stats.naksReceived > 3, "la recuperación va por NAK, no por temporizador");
  assert.equal(sim.stats.retransmissions, sim.stats.naksReceived);
  assert.equal(sim.rxDelivered, 0);
});

test("Cero tramas: la simulación termina en cuanto arranca", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 0 });
  S.start(sim);
  correr(sim, 50);

  assert.equal(sim.state, S.STATE.FINISHED);
  assert.equal(sim.stats.framesSent, 0);
  assert.equal(sim.wire.length, 0);
});

test("Muchas tramas seguidas mantienen la alternancia y no dejan basura en el canal", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 20 });
  S.start(sim);
  correr(sim, 2000, 0.5);

  assert.equal(sim.state, S.STATE.FINISHED);
  assert.equal(sim.rxDelivered, 20);
  assert.equal(sim.stats.framesSent, 20, "ninguna retransmisión sin motivo");
  assert.equal(sim.wire.length, 0, "el canal queda vacío");
  assert.equal(sim.rxExpectedSeq, sim.seqNum, "emisor y receptor terminan de acuerdo");
});

// ---------- Acciones del inspector en momentos raros ----------

test("Las acciones sobre un paquete inexistente avisan en vez de romperse", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1 });
  assert.throws(() => S.destroy(sim, null), /No hay ninguna trama/);
  assert.throws(() => S.freeze(sim, null, 10), /No hay ninguna trama/);
  assert.throws(() => S.flipBitOf(sim, null, 0), /No hay ninguna trama/);
  assert.throws(() => S.setSeqOf(sim, null, 0), /No hay ninguna trama/);
});

test("Voltear un bit fuera de rango se rechaza sin tocar la trama", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1 });
  S.start(sim);
  correr(sim, 3, 0.5);
  const paquete = S.selected(sim);

  // Fuera de rango de verdad, no un número mágico: desde la Tarea 3 el
  // tamaño de la trama real lo decide frameBits, así que "fuera de rango"
  // hay que calcularlo, no suponerlo.
  const fueraDeRango = F.totalBits(paquete.frame);
  assert.throws(() => S.flipBitOf(sim, paquete, fueraDeRango), RangeError);
  assert.equal(F.isIntact(paquete.frame), true, "la trama sigue sana");
});

test("Destruir la trama dos veces no descuenta dos veces", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1, timeoutMs: 500 });
  S.start(sim);
  correr(sim, 3, 0.5);

  const paquete = S.selected(sim);
  S.destroy(sim, paquete);
  S.destroy(sim, paquete); // el usuario insiste

  assert.equal(sim.stats.framesDestroyed, 2, "cuenta las dos pulsaciones");
  assert.equal(sim.wire.length, 0, "pero el canal sigue vacío, sin duplicados fantasma");
});

test("Retrasar la trama de datos (no el ACK) solo la hace llegar tarde", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1, timeoutMs: 500 });
  S.start(sim);
  correr(sim, 3, 0.5);

  S.freeze(sim, S.selected(sim), 100);
  correr(sim, 30, 0.5);
  assert.equal(sim.rxDelivered, 0, "todavía no ha llegado");

  correr(sim, 200, 0.5);
  assert.equal(sim.rxDelivered, 1, "acaba llegando");
});

test("Forzar la secuencia del ACK hace que el emisor lo descarte por viejo", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 2, timeoutMs: 300 });
  S.start(sim);
  correr(sim, 22, 0.5);

  const ack = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  assert.ok(ack, "hay un ACK volviendo");
  S.setSeqOf(sim, ack, 0); // el receptor esperaba 1

  correr(sim, 15, 0.5);
  assert.equal(sim.stats.acksReceived, 0, "no confirma nada");
  assert.equal(sim.stats.lateAcks, 1, "queda contado como fuera de tiempo");
});

test("Reiniciar en mitad del vuelo deja todo a cero", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 3 });
  S.start(sim);
  correr(sim, 40, 0.5);
  S.reset(sim);

  assert.equal(sim.clockMs, 0);
  assert.equal(sim.wire.length, 0);
  assert.equal(sim.events.length, 0);
  assert.equal(sim.state, S.STATE.IDLE);
  assert.equal(sim.rxDelivered, 0);
  for (const [clave, valor] of Object.entries(sim.stats)) {
    assert.equal(valor, 0, `la estadística ${clave} debería estar a cero`);
  }
});

test("Reiniciar y volver a arrancar da exactamente el mismo resultado", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 3, seed: 42 });
  S.start(sim);
  correr(sim, 400, 0.5);
  const primera = { reloj: sim.clockMs, entregadas: sim.rxDelivered, envios: sim.stats.framesSent };

  S.reset(sim);
  S.start(sim);
  correr(sim, 400, 0.5);

  assert.deepEqual(
    { reloj: sim.clockMs, entregadas: sim.rxDelivered, envios: sim.stats.framesSent },
    primera
  );
});

test("Pausar y continuar muchas veces no altera el resultado", () => {
  const seguido = S.createSimulation({ path: camino(), totalFrames: 3 });
  S.start(seguido);
  correr(seguido, 400, 0.5);

  const troceado = S.createSimulation({ path: camino(), totalFrames: 3 });
  S.start(troceado);
  for (let i = 0; i < 800; i++) {
    S.advance(troceado, 0.5);
    if (i % 7 === 0) {
      S.pause(troceado);
      S.advance(troceado, 100); // en pausa no debe pasar nada
      S.start(troceado);
    }
  }

  assert.equal(troceado.clockMs, seguido.clockMs);
  assert.equal(troceado.rxDelivered, seguido.rxDelivered);
});

test("La bitácora no crece sin límite", () => {
  const sim = S.createSimulation({ path: camino(), totalFrames: 1, timeoutMs: 1 });
  S.start(sim);
  correr(sim, 3000, 0.5);

  assert.ok(sim.log.length <= 400, `la bitácora tiene ${sim.log.length} entradas`);
  assert.ok(sim.events.length <= 600, `el diagrama guarda ${sim.events.length} eventos`);
});

// ---------- Tramas ----------

test("Una carga de un solo byte sigue teniendo CRC comprobable", () => {
  const frame = F.createFrame({ kind: F.KIND.FRAME, seq: 0, frameIdx: 0, payloadBytes: 1 });
  assert.equal(F.totalBits(frame), 8 + 16);
  assert.equal(F.isIntact(frame), true);
  F.flipBit(frame, 0);
  assert.equal(F.isIntact(frame), false);
});

test("El CRC de una carga vacía o rara no rompe el cálculo", () => {
  assert.equal(F.crc16(new Uint8Array(0)), 0xffff, "valor inicial de CCITT-FALSE");
  assert.ok(Number.isInteger(F.crc16(new Uint8Array([0, 0, 0]))));
  assert.ok(F.crc16(new Uint8Array([255, 255])) <= 0xffff);
});

test("Dos tramas distintas con los mismos datos tienen el mismo CRC", () => {
  const a = F.createFrame({ kind: F.KIND.FRAME, seq: 1, frameIdx: 7 });
  const b = F.createFrame({ kind: F.KIND.FRAME, seq: 1, frameIdx: 7 });
  assert.equal(a.crc, b.crc);
  assert.deepEqual(Array.from(a.payload), Array.from(b.payload));
});

test("Copiar una trama no comparte memoria con el original", () => {
  const original = F.createFrame({ kind: F.KIND.FRAME, seq: 0, frameIdx: 0 });
  const copia = F.cloneFrame(original);
  F.flipBit(copia, 3);

  assert.equal(F.isIntact(original), true, "el original no se toca");
  assert.equal(F.isIntact(copia), false);
  assert.equal(original.flippedBits.length, 0);
});

// ---------- El desarrollo paso a paso ----------

test("El desarrollo aguanta los extremos sin escribir NaN ni undefined", () => {
  const extremos = [
    N.analyze(camino({}, [enlace({ distanceKm: 0 })])),
    N.analyze(camino({}, [enlace({ errorProbData: 1 })])),
    N.analyze(N.createPath({ frameBits: 1, ackBits: 0, links: [enlace({ rateBps: 1e12 })] })),
    N.analyze(camino({}, Array.from({ length: 8 }, () => enlace()))),
  ];

  for (const r of extremos) {
    const s = Steps.build(r);
    const texto = JSON.stringify(s);
    assert.ok(!texto.includes("NaN"), "no debería aparecer NaN");
    assert.ok(!texto.includes("undefined"), "no debería aparecer undefined");
    assert.ok(s.pasos.length >= 8, "los pasos siguen estando");
    for (const paso of s.pasos) {
      assert.ok(paso.resultado.trim().length > 0, `el paso ${paso.id} se quedó sin resultado`);
    }
  }
});

test("Con probabilidad de error 1, el desarrollo dice infinito en vez de romperse", () => {
  const s = Steps.build(N.analyze(camino({}, [enlace({ errorProbData: 1 })])));
  const paso = s.pasos.find((p) => p.id === "uefectiva");

  assert.ok(paso, "el paso de utilización efectiva existe");
  assert.equal(paso.resultado, "0 %");
  assert.match(paso.detalle.join(" "), /—|∞|Infinity/, "los intentos esperados se muestran de algún modo");
});

test("La curva sigue siendo válida cuando el punto se sale del rango dibujado", () => {
  const s = Steps.build(N.analyze(N.createPath({ frameBits: 1, ackBits: 0, links: [enlace({ rateBps: 1e12 })] })));
  const { curva } = s.graficas;

  assert.ok(curva.actual.a > 1000, "el enlace queda fuera del eje");
  assert.ok(curva.actual.u > 0, "pero su utilización es un número real");
  assert.ok(curva.puntos.every((p) => p.u > 0 && p.u <= 1));
});

// ---------- El CRC contado paso a paso ----------

test("El desarrollo del CRC llega exactamente al mismo valor que el cálculo directo", () => {
  for (const bytes of [
    new Uint8Array([0]),
    new Uint8Array([255, 0, 128]),
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 37) % 256)),
  ]) {
    const traza = F.crc16Trace(bytes);
    assert.equal(traza.final, F.crc16(bytes), "el paso a paso no puede desviarse del cálculo");
    assert.equal(traza.pasos.length, bytes.length, "un paso por byte");
    assert.equal(traza.inicial, 0xffff, "valor inicial de CCITT-FALSE");
  }
});

test("Cada byte del desarrollo tiene sus ocho desplazamientos encadenados", () => {
  const traza = F.crc16Trace(new Uint8Array([0xab, 0xcd]));

  for (const paso of traza.pasos) {
    assert.equal(paso.bits.length, 8, "ocho bits por byte");
    assert.equal(paso.bits[0].antes, paso.trasXor, "el primer bit parte del registro tras el XOR");
    assert.equal(paso.bits[7].despues, paso.despues, "el último deja el registro del byte");

    for (let i = 1; i < paso.bits.length; i++) {
      assert.equal(paso.bits[i].antes, paso.bits[i - 1].despues, "cada paso arranca donde acabó el anterior");
    }
    for (const bit of paso.bits) {
      assert.equal(bit.msb, (bit.antes & 0x8000) !== 0, "el aviso del bit más significativo debe ser cierto");
      assert.ok(bit.despues <= 0xffff, "el registro nunca se sale de 16 bits");
    }
  }

  // El encadenado también vale entre bytes.
  assert.equal(traza.pasos[1].antes, traza.pasos[0].despues);
});

test("El desarrollo del CRC de una trama coincide con el que viaja dentro de ella", () => {
  const frame = F.createFrame({ kind: F.KIND.FRAME, seq: 1, frameIdx: 2, payloadBytes: 8 });
  assert.equal(F.crc16Trace(frame.payload).final, frame.crc);

  F.flipBit(frame, 9);
  assert.notEqual(F.crc16Trace(frame.payload).final, frame.crc, "tras dañar la carga ya no coincide");
  assert.equal(F.isIntact(frame), false);
});
