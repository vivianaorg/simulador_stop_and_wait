// sim.test.js — protocolo y detección de errores.
// `node --test tests/sim.test.js`

const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/frame.js");
const N = require("../js/network.js");
const S = require("../js/sim.js");

// Camino de prueba corto para que los tiempos sean fáciles de seguir.
function caminoSimple(extra) {
  return N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({
        name: "Enlace",
        rateBps: 100000, // Tt = 10 ms
        distanceKm: 2000,
        velocityKmS: 200000, // Tp = 10 ms
        ...(extra || {}),
      }),
    ],
  });
}

function caminoDosSaltos() {
  return N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({ name: "A → R", rateBps: 100000, distanceKm: 2000, velocityKmS: 200000 }),
      N.createLink({ name: "R → B", rateBps: 100000, distanceKm: 2000, velocityKmS: 200000 }),
    ],
  });
}

// Avanza la simulación en pasos pequeños, como hace la animación.
function correr(sim, msTotales, pasoMs) {
  const paso = pasoMs || 1;
  for (let t = 0; t < msTotales; t += paso) S.advance(sim, paso);
  return sim;
}

// ---------- CRC ----------

test("El CRC-16/CCITT detecta el volteo de cualquier bit", () => {
  const frame = F.createFrame({ kind: F.KIND.FRAME, seq: 0, frameIdx: 0, payloadBytes: 8 });
  assert.equal(F.isIntact(frame), true, "recién creada debe cuadrar");

  for (let bit = 0; bit < F.totalBits(frame); bit++) {
    const copia = F.cloneFrame(frame);
    F.flipBit(copia, bit);
    assert.equal(F.isIntact(copia), false, `el bit ${bit} debería detectarse`);
  }
});

test("Volteando dos veces el mismo bit, la trama vuelve a estar sana", () => {
  const frame = F.createFrame({ kind: F.KIND.FRAME, seq: 1, frameIdx: 3 });
  F.flipBit(frame, 12);
  assert.equal(F.isIntact(frame), false);
  F.flipBit(frame, 12);
  assert.equal(F.isIntact(frame), true);
});

test("Un índice de bit fuera de rango se rechaza", () => {
  const frame = F.createFrame({ kind: F.KIND.ACK, seq: 0 });
  assert.throws(() => F.flipBit(frame, -1), RangeError);
  assert.throws(() => F.flipBit(frame, F.totalBits(frame)), RangeError);
});

// ---------- Camino feliz ----------

test("Sin errores, las 3 tramas se entregan y la secuencia alterna 0,1,0", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  const secuencias = [];
  S.start(sim);

  for (let t = 0; t < 500 && sim.state !== S.STATE.FINISHED; t++) {
    const enVuelo = sim.wire.find((p) => p.frame.kind === F.KIND.FRAME);
    if (enVuelo && secuencias[secuencias.length - 1] !== enVuelo.frame.seq) {
      secuencias.push(enVuelo.frame.seq);
    }
    S.advance(sim, 1);
  }

  assert.equal(sim.state, S.STATE.FINISHED);
  assert.equal(sim.rxDelivered, 3, "el receptor entregó las 3 tramas");
  assert.equal(sim.stats.framesSent, 3, "sin retransmisiones");
  assert.equal(sim.stats.acksReceived, 3);
  assert.deepEqual(secuencias, [0, 1, 0], "la secuencia alterna");
});

test("El ciclo de una trama dura Tt + 2·Tp cuando no hay errores", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 1 });
  S.start(sim);
  correr(sim, 100, 0.5);

  assert.equal(sim.state, S.STATE.FINISHED);
  // Tt = 10 ms, Tp = 10 ms de ida y 10 de vuelta (el ACK no ocupa tiempo).
  assert.ok(Math.abs(sim.clockMs - 30) <= 1, `ciclo ≈ 30 ms, obtenido ${sim.clockMs}`);
});

// ---------- Detección de errores ----------

test("Una trama con un bit volteado se descarta por CRC y no se entrega", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 1, timeoutMs: 200 });
  S.start(sim);
  correr(sim, 12); // la trama ya salió al medio

  const paquete = S.selected(sim);
  assert.ok(paquete, "hay una trama en vuelo");
  S.flipBitOf(sim, paquete, 5);

  correr(sim, 20);
  assert.equal(sim.stats.crcFailures, 1, "el receptor detectó el error");
  assert.equal(sim.rxDelivered, 0, "no se entregó nada a la capa de red");
  assert.equal(sim.stats.acksReceived, 0, "no hubo ACK");
});

test("Sin NAK, el emisor solo se entera por el temporizador (Protocolo 3)", () => {
  const sim = S.createSimulation({
    path: caminoSimple(),
    totalFrames: 1,
    timeoutMs: 100,
    nakOnError: false,
  });
  S.start(sim);
  correr(sim, 12);
  S.flipBitOf(sim, S.selected(sim), 5);
  correr(sim, 30);

  assert.equal(sim.stats.retransmissions, 0, "todavía no ha reintentado");
  assert.equal(sim.stats.naksReceived, 0, "el receptor no manda NAK");

  correr(sim, 100); // se cumple el timeout
  assert.equal(sim.stats.retransmissions, 1, "reintenta al expirar el temporizador");
});

test("Con NAK activado, la retransmisión llega antes del temporizador", () => {
  const sim = S.createSimulation({
    path: caminoSimple(),
    totalFrames: 1,
    timeoutMs: 1000, // deliberadamente enorme
    nakOnError: true,
  });
  S.start(sim);
  correr(sim, 12);
  S.flipBitOf(sim, S.selected(sim), 5);
  correr(sim, 40);

  assert.equal(sim.stats.naksReceived, 1, "llegó el NAK");
  assert.equal(sim.stats.retransmissions, 1, "retransmitió sin esperar 1000 ms");
  assert.ok(sim.clockMs < 100, "muy por debajo del timeout");
});

test("Un ACK dañado deja al emisor esperando el temporizador", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 1, timeoutMs: 100 });
  S.start(sim);
  correr(sim, 25); // la trama llegó y el ACK ya viaja de vuelta

  const ack = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  assert.ok(ack, "hay un ACK en vuelo");
  S.flipBitOf(sim, ack, 3);

  correr(sim, 15);
  assert.equal(sim.stats.acksReceived, 0, "el ACK dañado no confirma nada");
  assert.equal(sim.rxDelivered, 1, "pero el receptor sí había entregado la trama");

  correr(sim, 120);
  assert.equal(sim.stats.retransmissions, 1, "el emisor reintenta");
  assert.equal(sim.stats.duplicatesDiscarded, 1, "y el receptor descarta la copia");
  assert.equal(sim.rxDelivered, 1, "sin entregarla dos veces");
});

// ---------- Acciones del inspector ----------

test("Destruir la trama en vuelo obliga a esperar el temporizador", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 1, timeoutMs: 80 });
  S.start(sim);
  correr(sim, 12);

  S.destroy(sim, S.selected(sim));
  assert.equal(sim.wire.length, 0, "ya no hay nada en el canal");
  assert.equal(sim.stats.framesDestroyed, 1);

  correr(sim, 100);
  assert.equal(sim.stats.retransmissions, 1);
});

test("Forzar el número de secuencia hace que el receptor la vea como duplicada", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 2, timeoutMs: 200 });
  S.start(sim);
  correr(sim, 12);

  // El receptor espera seq=0; le mandamos seq=1.
  S.setSeqOf(sim, S.selected(sim), 1);
  correr(sim, 20);

  assert.equal(sim.stats.duplicatesDiscarded, 1);
  assert.equal(sim.rxDelivered, 0, "no la entrega a la capa de red");
});

test("Retrasar el ACK produce un ACK tardío que el emisor descarta", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 2, timeoutMs: 60 });
  S.start(sim);
  correr(sim, 25);

  const ack = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  assert.ok(ack, "hay un ACK en vuelo");
  S.freeze(sim, ack, 150); // más que el timeout

  correr(sim, 400);
  assert.equal(sim.stats.retransmissions >= 1, true, "el emisor reintentó por timeout");
  assert.equal(sim.stats.lateAcks >= 1, true, "y el ACK viejo llegó fuera de tiempo");
});

// ---------- Multi-salto ----------

test("Con dos saltos, la trama atraviesa el nodo intermedio y se registra cada tramo", () => {
  const sim = S.createSimulation({ path: caminoDosSaltos(), totalFrames: 1 });
  S.start(sim);
  correr(sim, 200, 0.5);

  assert.equal(sim.state, S.STATE.FINISHED);
  assert.equal(sim.rxDelivered, 1);

  const tramosDeDatos = sim.events.filter((e) => e.kind === F.KIND.FRAME);
  assert.equal(tramosDeDatos.length, 2, "un evento por tramo recorrido");
  assert.deepEqual(
    tramosDeDatos.map((e) => [e.fromIdx, e.toIdx]),
    [[0, 1], [1, 2]],
    "pasa por el nodo intermedio"
  );

  const tramosDeAck = sim.events.filter((e) => e.kind === F.KIND.ACK);
  assert.deepEqual(
    tramosDeAck.map((e) => [e.fromIdx, e.toIdx]),
    [[2, 1], [1, 0]],
    "y el ACK vuelve por el mismo camino"
  );
});

test("Añadir un salto alarga el ciclo medido por la simulación", () => {
  const uno = S.createSimulation({ path: caminoSimple(), totalFrames: 1 });
  const dos = S.createSimulation({ path: caminoDosSaltos(), totalFrames: 1 });
  S.start(uno);
  S.start(dos);
  correr(uno, 300, 0.5);
  correr(dos, 300, 0.5);

  assert.equal(uno.state, S.STATE.FINISHED);
  assert.equal(dos.state, S.STATE.FINISHED);
  assert.ok(dos.clockMs > uno.clockMs, "dos saltos tardan más");
});

test("El tiempo medido por la simulación coincide con el RTT que calcula el modelo", () => {
  const path = caminoDosSaltos();
  const esperado = N.analyze(path).rttMs;
  const sim = S.createSimulation({ path, totalFrames: 1 });
  S.start(sim);
  correr(sim, 400, 0.25);

  assert.ok(
    Math.abs(sim.clockMs - esperado) <= 1,
    `la simulación (${sim.clockMs} ms) debe coincidir con el RTT calculado (${esperado} ms)`
  );
});

// ---------- Ruido del canal y repetibilidad ----------

test("Con probabilidad de error 1 el canal daña siempre, y con 0 nunca", () => {
  const siempre = S.createSimulation({
    path: caminoSimple({ errorProbData: 1 }),
    totalFrames: 1,
    timeoutMs: 500,
  });
  S.start(siempre);
  correr(siempre, 40);
  assert.equal(siempre.stats.crcFailures, 1, "el receptor detecta el daño");

  const nunca = S.createSimulation({ path: caminoSimple({ errorProbData: 0 }), totalFrames: 1 });
  S.start(nunca);
  correr(nunca, 60);
  assert.equal(nunca.stats.crcFailures, 0);
  assert.equal(nunca.rxDelivered, 1);
});

test("La misma semilla produce exactamente la misma simulación", () => {
  function ejecutar(seed) {
    const sim = S.createSimulation({
      path: caminoSimple({ errorProbData: 0.5 }),
      totalFrames: 4,
      timeoutMs: 80,
      seed,
    });
    S.start(sim);
    correr(sim, 2000);
    return { crc: sim.stats.crcFailures, envios: sim.stats.framesSent, reloj: sim.clockMs };
  }

  assert.deepEqual(ejecutar(7), ejecutar(7), "misma semilla, mismo resultado");
});

test("Pausar detiene el reloj y el temporizador", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 2, timeoutMs: 50 });
  S.start(sim);
  correr(sim, 5);
  const reloj = sim.clockMs;
  const restante = sim.timerRemainingMs;

  S.pause(sim);
  correr(sim, 100);

  assert.equal(sim.clockMs, reloj, "el reloj no avanza en pausa");
  assert.equal(sim.timerRemainingMs, restante, "el temporizador tampoco");
});

// ---------- Half duplex ----------

function caminoHalfDuplex(turnaroundMs) {
  return N.createPath({
    frameBits: 1000,
    ackBits: 0,
    duplexMode: N.DUPLEX.HALF,
    links: [
      N.createLink({
        name: "Enlace",
        rateBps: 100000, // Tt = 10 ms
        distanceKm: 2000,
        velocityKmS: 200000, // Tp = 10 ms
        turnaroundMs,
      }),
    ],
  });
}

test("Half duplex: el ciclo crece 2 × el tiempo de vuelta y el RTT no cambia", () => {
  const full = S.createSimulation({ path: caminoSimple(), totalFrames: 1 });
  const half = S.createSimulation({ path: caminoHalfDuplex(8), totalFrames: 1 });

  S.start(full);
  S.start(half);
  correr(full, 200, 0.25);
  correr(half, 200, 0.25);

  assert.equal(full.state, S.STATE.FINISHED);
  assert.equal(half.state, S.STATE.FINISHED);

  // Una sola trama: solo se invierte el medio una vez, antes del ACK.
  assert.ok(
    Math.abs(half.clockMs - full.clockMs - 8) <= 0.5,
    `esperado +8 ms, obtenido +${(half.clockMs - full.clockMs).toFixed(2)}`
  );

  // El RTT que calcula el modelo no depende del modo del canal.
  assert.equal(half.analysis.rttMs, full.analysis.rttMs);
  // Pero el ciclo sí: dos inversiones por ciclo completo.
  assert.equal(half.analysis.cycleMs - full.analysis.cycleMs, 16);
});

test("Half duplex: el ACK no empieza a viajar hasta que se invierte el medio", () => {
  const sim = S.createSimulation({ path: caminoHalfDuplex(12), totalFrames: 1 });
  S.start(sim);

  // Tt + Tp = 20 ms: la trama acaba de llegar al receptor.
  correr(sim, 21, 0.5);
  const ack = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  assert.ok(ack, "el ACK ya existe");
  assert.ok(ack.turnRemainingMs > 0, "pero todavía está esperando la inversión del medio");
  assert.equal(ack.elapsedMs, 0, "no ha avanzado nada por el canal");

  correr(sim, 12, 0.5);
  const sigue = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  if (sigue) assert.equal(sigue.turnRemainingMs, 0, "terminada la inversión, ya viaja");
});

test("Half duplex: la inversión queda registrada en el diagrama", () => {
  const sim = S.createSimulation({ path: caminoHalfDuplex(6), totalFrames: 2 });
  S.start(sim);
  correr(sim, 300, 0.5);

  const inversiones = sim.events.filter((e) => e.kind === "TURN");
  // Dos tramas: ACK de la primera, segunda trama, ACK de la segunda.
  assert.equal(inversiones.length, 3);
  for (const e of inversiones) {
    assert.equal(e.tEnd - e.tStart, 6, "cada inversión dura el tiempo de vuelta");
    assert.equal(e.fromIdx, e.toIdx, "ocurre en un punto, no entre dos");
  }
});

test("Full duplex no paga ninguna inversión", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 2 });
  S.start(sim);
  correr(sim, 200, 0.5);

  assert.equal(sim.events.filter((e) => e.kind === "TURN").length, 0);
});

test("La primera trama no espera inversión: el medio ya está en su sentido", () => {
  const sim = S.createSimulation({ path: caminoHalfDuplex(20), totalFrames: 1 });
  S.start(sim);
  correr(sim, 1, 0.5);

  const trama = sim.wire.find((p) => p.frame.kind === F.KIND.FRAME);
  assert.ok(trama, "la trama ya está en el canal");
  assert.equal(trama.turnRemainingMs, 0);
});

// ---------- Ráfaga de ruido ----------

test("La ráfaga arruina bits de lo que esté viajando, sin generador", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.start(sim); // que haya algo en el cable y el reloj corriendo
  S.startBurst(sim, 5);
  correr(sim, 20, 1);

  assert.ok(sim.stats.burstBitsRuined > 0, "la ráfaga tiene que haber mordido algo");
});

// 9600 bps es la tasa de módem de los ejercicios del capítulo 3 y, aquí, la
// que hace visible el fallo: son 9,6 bits por milisegundo, así que la
// conversión a bits enteros no es exacta. Con tasas redondas el troceado del
// reloj no se nota.
function caminoModem() {
  return N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({ name: "Módem", rateBps: 9600, distanceKm: 2000, velocityKmS: 200000 }),
    ],
  });
}

test("El total de la ráfaga no depende del troceado del reloj y es el de la calculadora", () => {
  const esperados = N.burstBitsFromMs({ rateBps: 9600, burstMs: 5 });
  assert.equal(esperados, 48, "9600 bps · 5 ms = 48 bits");

  function corrida(pasoMs) {
    const sim = S.createSimulation({ path: caminoModem(), totalFrames: 3 });
    S.start(sim);
    S.startBurst(sim, 5);
    correr(sim, 20, pasoMs);
    return sim.stats.burstBitsRuined;
  }

  assert.equal(corrida(1), esperados, "tramos de 1 ms");
  assert.equal(corrida(0.1), esperados, "tramos de 0,1 ms");
  assert.equal(corrida(20), esperados, "una sola llamada que se traga la ventana entera");
});

test("La ventana de la ráfaga cuenta una vez, no una por paquete en vuelo", () => {
  const sim = S.createSimulation({ path: caminoModem(), totalFrames: 3 });
  S.start(sim);
  S.sendFrame(sim); // dos tramas a la vez en el mismo cable
  assert.equal(sim.wire.length, 2, "hacen falta dos paquetes en vuelo");

  S.startBurst(sim, 5);
  correr(sim, 20, 1);

  assert.equal(
    sim.stats.burstBitsRuined,
    N.burstBitsFromMs({ rateBps: 9600, burstMs: 5 }),
    "la ventana de tiempo es una, no una por paquete"
  );
});

test("Un ACK de duración despreciable no lo alcanza la ráfaga", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.start(sim);
  correr(sim, 25, 1); // Tt = 10 ms, Tp = 10 ms: a los 25 ms el ACK vuelve

  const ack = sim.wire.find((p) => p.frame.kind === F.KIND.ACK);
  assert.ok(ack, "hace falta un ACK en vuelo");
  assert.equal(ack.txMs, 0, "con ackBits = 0 el ACK no ocupa bits en el cable");

  S.startBurst(sim, 1);
  correr(sim, 2, 0.25);

  assert.equal(ack.frame.flippedBits.length, 0, "no se le puede voltear ningún bit");
  assert.equal(F.isIntact(ack.frame), true, "y por tanto su CRC sigue cuadrando");
});

test("La ráfaga es determinista: dos corridas iguales arruinan lo mismo", () => {
  function corrida() {
    const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
    S.start(sim);
    S.startBurst(sim, 5);
    correr(sim, 20, 1);
    return sim.stats.burstBitsRuined;
  }
  assert.equal(corrida(), corrida());
});

test("La ventana de la ráfaga se cierra sola y deja de morder", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.start(sim);
  S.startBurst(sim, 5);
  correr(sim, 20, 1);
  const trasCerrarse = sim.stats.burstBitsRuined;

  correr(sim, 50, 1);
  assert.equal(sim.stats.burstBitsRuined, trasCerrarse, "ya no debería morder nada");
  assert.equal(sim.burst, null, "la ventana quedó cerrada");
});

test("El cierre de la ráfaga entra en el próximo suceso", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.sendFrame(sim);
  S.startBurst(sim, 1);
  // El reloj no puede saltarse el final de la ventana.
  assert.ok(S.proximoSucesoMs(sim) <= 1);
});

test("Dos ráfagas seguidas dejan dos sucesos, cada una con su propia ventana", () => {
  const sim = S.createSimulation({ path: caminoSimple(), totalFrames: 3 });
  S.start(sim);
  S.startBurst(sim, 5);
  correr(sim, 20, 1); // deja que la primera ventana se cierre sola
  S.startBurst(sim, 5);

  const sucesos = sim.events.filter((e) => e.kind === "BURST");
  assert.equal(sucesos.length, 2, "cada startBurst tiene que dejar su propio suceso");
  assert.ok(sucesos[0].tEnd <= sucesos[1].tStart, "las dos ventanas no se pisan en el tiempo");
});
