// network.test.js
// Se ejecuta con el runner nativo de Node: `node --test tests/`.
// No añade ninguna dependencia al proyecto.
//
// Regla del proyecto: cada fórmula que la interfaz muestra tiene aquí un caso
// con un número publicado (Tanenbaum cap. 3 y la lecture ELEC3030 de
// Southampton, que usa la misma notación).

const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../js/network.js");

// Compara con tolerancia relativa: son números en coma flotante.
function closeTo(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${message || "valor inesperado"}: esperado ${expected} ± ${tolerance}, obtenido ${actual}`
  );
}

test("Ejemplo del satélite del libro: 50 kbps, tramas de 1000 bits, 500 ms de RTT de propagación", () => {
  // Tanenbaum: canal de 50 kbps, retardo de propagación de ida y vuelta de
  // 500 ms, tramas de 1000 bits. Tt = 20 ms, el ACK vuelve en t = 520 ms y el
  // emisor estuvo ocioso 500 de esos 520 ms: ~4 % de utilización.
  const r = N.singleLinkAnalysis({
    name: "Enlace satelital",
    frameBits: 1000,
    ackBits: 0, // el libro desprecia el tiempo de transmisión del ACK
    rateBps: 50000,
    distanceKm: 50000, // 50 000 km / 200 000 km/s = 250 ms por sentido
    velocityKmS: 200000,
  });

  closeTo(r.senderTtMs, 20, 1e-9, "Tt");
  closeTo(r.tpTotalMs, 250, 1e-9, "Tp");
  closeTo(r.rttMs, 520, 1e-9, "tiempo hasta recibir el ACK");
  closeTo(r.utilization * 100, 3.846, 0.001, "utilización en %");
  closeTo(r.idleFraction * 100, 96.15, 0.01, "canal ocioso en %");
});

test("Ejemplo de LAN: 10 Mbps, 1 km, V = 2·10^8 m/s, tramas de 500 bits → a = 0,1 y U = 0,83", () => {
  const r = N.singleLinkAnalysis({
    name: "LAN",
    frameBits: 500,
    ackBits: 0,
    rateBps: 10e6,
    distanceKm: 1,
    velocityKmS: 200000, // 2·10^8 m/s
  });

  closeTo(r.aRatio, 0.1, 1e-9, "a");
  closeTo(r.utilization, 0.8333, 0.0001, "U");
});

test("a coincide con la forma cerrada a = (R·d)/(V·L)", () => {
  const cases = [
    { rateBps: 10e6, distanceKm: 1, velocityKmS: 200000, frameBits: 500 },
    { rateBps: 50000, distanceKm: 50000, velocityKmS: 200000, frameBits: 1000 },
    { rateBps: 2e6, distanceKm: 350, velocityKmS: 250000, frameBits: 4096 },
  ];

  for (const c of cases) {
    const r = N.singleLinkAnalysis({ ...c, ackBits: 0 });
    // a = (R·d)/(V·L), con d y V en las mismas unidades de longitud.
    const closedForm = (c.rateBps * c.distanceKm) / (c.velocityKmS * c.frameBits);
    closeTo(r.aRatio, closedForm, 1e-9, "a frente a (R·d)/(V·L)");
  }
});

test("Con un solo enlace y ACK despreciable, U se reduce exactamente a 1/(1+2a)", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 8000,
    ackBits: 0,
    rateBps: 1e6,
    distanceKm: 1000,
    velocityKmS: 200000,
  });

  closeTo(r.utilization, 1 / (1 + 2 * r.aRatio), 1e-12, "U frente a 1/(1+2a)");
});

test("Un ACK con tamaño propio añade su tiempo de transmisión al ciclo", () => {
  const base = { frameBits: 1000, rateBps: 50000, distanceKm: 50000, velocityKmS: 200000 };
  const sinAck = N.singleLinkAnalysis({ ...base, ackBits: 0 });
  const conAck = N.singleLinkAnalysis({ ...base, ackBits: 100 });

  // 100 bits a 50 kbps = 2 ms.
  closeTo(conAck.rttMs - sinAck.rttMs, 2, 1e-9, "coste del ACK");
  assert.ok(conAck.utilization < sinAck.utilization, "un ACK con tamaño baja la utilización");
});

test("Cadena casa → satélite → casa: los tiempos son la suma de los tramos (store-and-forward)", () => {
  const subida = N.createLink({
    name: "Casa A → Satélite",
    rateBps: 1e6,
    distanceKm: 35786, // órbita geoestacionaria
    velocityKmS: 300000,
  });
  const bajada = N.createLink({
    name: "Satélite → Casa B",
    rateBps: 500000,
    distanceKm: 35786,
    velocityKmS: 300000,
  });

  const path = N.createPath({ frameBits: 1000, ackBits: 0, links: [subida, bajada] });
  const r = N.analyze(path);

  const ttEsperado = 1000 / 1e6 * 1000 + 1000 / 500000 * 1000; // 1 ms + 2 ms
  const tpEsperado = (35786 / 300000) * 1000 * 2;

  assert.equal(r.hops, 2);
  closeTo(r.ttDataTotalMs, ttEsperado, 1e-9, "Tt total");
  closeTo(r.tpTotalMs, tpEsperado, 1e-9, "Tp total");
  closeTo(r.rttMs, ttEsperado + 2 * tpEsperado, 1e-9, "RTT de la cadena");
  // El emisor solo ocupa el primer tramo: 1 ms de los ~240 del ciclo.
  closeTo(r.senderTtMs, 1, 1e-9, "Tt del emisor");
});

test("Un salto extra siempre empeora el RTT y la utilización", () => {
  const tramo = () => N.createLink({ rateBps: 1e6, distanceKm: 500, velocityKmS: 200000 });

  const unSalto = N.analyze(N.createPath({ frameBits: 8000, links: [tramo()] }));
  const dosSaltos = N.analyze(N.createPath({ frameBits: 8000, links: [tramo(), tramo()] }));

  assert.ok(dosSaltos.rttMs > unSalto.rttMs, "el RTT crece con los saltos");
  assert.ok(dosSaltos.utilization < unSalto.utilization, "la utilización baja con los saltos");
});

test("El retardo de procesamiento solo lo pagan los nodos intermedios", () => {
  const tramo = () => N.createLink({ rateBps: 1e6, distanceKm: 500, velocityKmS: 200000 });

  const sinProceso = N.analyze(N.createPath({ frameBits: 8000, links: [tramo(), tramo()] }));
  const conProceso = N.analyze(
    N.createPath({ frameBits: 8000, links: [tramo(), tramo()], processingMsPerHop: 5 })
  );

  // Un solo nodo intermedio, y lo atraviesan la trama y el ACK: 2 × 5 ms.
  closeTo(conProceso.rttMs - sinProceso.rttMs, 10, 1e-9, "coste del procesamiento");

  const unSalto = N.analyze(N.createPath({ frameBits: 8000, links: [tramo()], processingMsPerHop: 5 }));
  closeTo(unSalto.processingMs, 0, 1e-12, "sin nodos intermedios no hay procesamiento");
});

test("Half duplex añade el tiempo de vuelta del medio dos veces por ciclo", () => {
  const spec = {
    frameBits: 1000,
    ackBits: 0,
    rateBps: 50000,
    distanceKm: 50000,
    velocityKmS: 200000,
    turnaroundMs: 30,
  };

  const full = N.singleLinkAnalysis({ ...spec, duplexMode: N.DUPLEX.FULL });
  const half = N.singleLinkAnalysis({ ...spec, duplexMode: N.DUPLEX.HALF });

  closeTo(full.turnaroundTotalMs, 0, 1e-12, "full duplex no invierte el medio");
  closeTo(half.turnaroundTotalMs, 60, 1e-9, "2 × 30 ms");
  closeTo(half.cycleMs - full.cycleMs, 60, 1e-9, "coste del half duplex");
  assert.ok(half.utilization < full.utilization, "half duplex utiliza peor el canal");
  // El RTT (tiempo de ida y vuelta de la señal) no cambia: lo que cambia es el
  // ciclo completo, porque hay que esperar a invertir el medio.
  closeTo(half.rttMs, full.rttMs, 1e-12, "el RTT no depende del modo del canal");
});

test("Con errores, la utilización efectiva es (1−P)/(1+2a)", () => {
  const P = 0.2;
  const r = N.singleLinkAnalysis({
    frameBits: 8000,
    ackBits: 0,
    rateBps: 1e6,
    distanceKm: 1000,
    velocityKmS: 200000,
    errorProbData: P,
  });

  closeTo(r.cycleErrorProb, P, 1e-12, "P del ciclo");
  closeTo(r.effectiveUtilization, (1 - P) / (1 + 2 * r.aRatio), 1e-12, "U efectiva");
  closeTo(r.expectedTransmissions, 1 / (1 - P), 1e-12, "transmisiones esperadas");
});

test("Las probabilidades de error de varios tramos se componen", () => {
  const l1 = N.createLink({ rateBps: 1e6, distanceKm: 100, velocityKmS: 200000, errorProbData: 0.1 });
  const l2 = N.createLink({ rateBps: 1e6, distanceKm: 100, velocityKmS: 200000, errorProbData: 0.2 });
  const r = N.analyze(N.createPath({ frameBits: 8000, links: [l1, l2] }));

  // La trama sobrevive solo si supera los dos tramos: 0,9 × 0,8 = 0,72.
  closeTo(r.cycleSuccessProb, 0.72, 1e-12, "probabilidad de éxito del ciclo");
  closeTo(r.cycleErrorProb, 0.28, 1e-12, "P extremo a extremo");
});

test("Un ACK que se pierde cuenta igual que una trama perdida", () => {
  const base = { frameBits: 8000, ackBits: 0, rateBps: 1e6, distanceKm: 1000, velocityKmS: 200000 };
  const porDatos = N.singleLinkAnalysis({ ...base, errorProbData: 0.3 });
  const porAck = N.singleLinkAnalysis({ ...base, errorProbAck: 0.3 });

  closeTo(porAck.cycleErrorProb, porDatos.cycleErrorProb, 1e-12, "el emisor no distingue la causa");
});

test("El timeout mínimo razonable es el RTT: por debajo hay retransmisiones inútiles", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 1000,
    ackBits: 0,
    rateBps: 50000,
    distanceKm: 50000,
    velocityKmS: 200000,
  });

  closeTo(r.minimumTimeoutMs, 520, 1e-9, "timeout mínimo");
});

test("El producto ancho de banda por retardo son los bits que caben en un RTT", () => {
  const r = N.singleLinkAnalysis({
    frameBits: 1000,
    ackBits: 0,
    rateBps: 50000,
    distanceKm: 50000,
    velocityKmS: 200000,
  });

  // 50 000 bits/s × 0,52 s = 26 000 bits = 26 tramas de 1000 bits.
  closeTo(r.bandwidthDelayProductBits, 26000, 1e-9, "BDP");
  closeTo(r.bandwidthDelayProductBits / r.frameBits, 26, 1e-9, "tramas que caben en el canal");
});

test("Los parámetros inválidos se rechazan con un mensaje, no en silencio", () => {
  assert.throws(() => N.createLink({ rateBps: 0, distanceKm: 10, velocityKmS: 200000 }), RangeError);
  assert.throws(() => N.createLink({ rateBps: 1e6, distanceKm: -1, velocityKmS: 200000 }), RangeError);
  assert.throws(() => N.createLink({ rateBps: 1e6, distanceKm: 10, velocityKmS: 0 }), RangeError);
  assert.throws(
    () => N.createLink({ rateBps: 1e6, distanceKm: 10, velocityKmS: 200000, errorProbData: 1.5 }),
    RangeError
  );
  assert.throws(() => N.createPath({ frameBits: 1000, links: [] }), RangeError);
  assert.throws(() => N.createPath({ frameBits: 0, links: [N.createLink({ rateBps: 1e6, distanceKm: 1, velocityKmS: 200000 })] }), RangeError);
});

test("Conversión de milisegundos a bits: bits/s × s = bits", () => {
  // No es una fórmula del libro, es análisis dimensional, y así está declarado
  // en el spec. 10 ms sobre un canal de 100 kbps son 1000 bits.
  assert.equal(N.burstBitsFromMs({ rateBps: 100000, burstMs: 10 }), 1000);
  assert.equal(N.burstBitsFromMs({ rateBps: 1500, burstMs: 2 }), 3);
  assert.equal(N.burstBitsFromMs({ rateBps: 100000, burstMs: 0 }), 0);
});

test("Una ráfaga se reparte sobre tramas de L bits", () => {
  assert.equal(N.burstDamage({ bits: 1000, frameBits: 500 }).frames, 2);
  assert.equal(N.burstDamage({ bits: 1000, frameBits: 1000 }).frames, 1);
  // Una ráfaga que no llena una trama sigue arruinando esa trama.
  assert.equal(N.burstDamage({ bits: 100, frameBits: 1000 }).frames, 1);
  assert.equal(N.burstDamage({ bits: 0, frameBits: 1000 }).frames, 0);
});

test("Ráfaga con parámetros imposibles se rechaza", () => {
  assert.throws(() => N.burstBitsFromMs({ rateBps: 0, burstMs: 10 }), RangeError);
  assert.throws(() => N.burstBitsFromMs({ rateBps: 1000, burstMs: -1 }), RangeError);
  assert.throws(() => N.burstDamage({ bits: 10, frameBits: 0 }), RangeError);
  assert.throws(() => N.burstDamage({ bits: -1, frameBits: 1000 }), RangeError);
});

test("Transferencia: un fichero se parte en tramas y el tiempo es N ciclos", () => {
  // Mismo enlace satelital de la primera prueba: Tt = 20 ms, ciclo = 520 ms.
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({
        name: "Enlace satelital",
        rateBps: 50000,
        distanceKm: 50000,
        velocityKmS: 200000,
      }),
    ],
  });

  const r = N.transferAnalysis(path, 10000); // 10 000 bits

  assert.equal(r.frames, 10, "10 000 / 1000");
  closeTo(r.totalMs, 5200, 1e-9, "10 ciclos de 520 ms");
  closeTo(r.goodputBps, 10000 / 5.2, 1e-6, "caudal conseguido");
});

test("Transferencia: la última trama cuenta entera aunque vaya a medias", () => {
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({ name: "Enlace", rateBps: 50000, distanceKm: 50000, velocityKmS: 200000 }),
    ],
  });

  assert.equal(N.transferAnalysis(path, 10001).frames, 11);
});

test("Conversión de tamaño con unidad a bits: KB y MB son decimales, no 1024", () => {
  assert.equal(N.bitsFromSize(1, "bits"), 1);
  assert.equal(N.bitsFromSize(1, "kb"), 8000, "1 KB = 1000 bytes = 8000 bits");
  assert.equal(N.bitsFromSize(2, "mb"), 16000000, "2 MB = 2 000 000 bytes = 16 000 000 bits");
});

test("Conversión de tamaño fraccionario: el número exacto de bits, sin aproximar", () => {
  // 1,5 MB es el caso normal en un ejercicio ("fichero de 1,5 MB"), no un
  // entero. El aserto exige el bit exacto: si algún día se cuela un
  // redondeo en bitsFromSize, esta prueba lo tiene que cazar.
  assert.equal(N.bitsFromSize(1.5, "mb"), 12000000, "1,5 MB = 1 500 000 bytes = 12 000 000 bits");
  assert.equal(N.bitsFromSize(0.5, "kb"), 4000, "0,5 KB = 500 bytes = 4000 bits");
  assert.equal(N.bitsFromSize(0.125, "bits"), 0.125, "en bits no hay conversión que redondear");
});

test("Tamaño de transferencia con parámetros imposibles se rechaza", () => {
  assert.throws(() => N.transferAnalysis(N.createPath({
    frameBits: 1000,
    links: [N.createLink({ rateBps: 1e6, distanceKm: 1, velocityKmS: 200000 })],
  }), 0), RangeError);
  assert.throws(() => N.bitsFromSize(0, "kb"), RangeError);
  assert.throws(() => N.bitsFromSize(1, "gb"), RangeError);
});
