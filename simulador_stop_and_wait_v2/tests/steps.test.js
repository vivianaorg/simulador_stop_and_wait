// steps.test.js — el desarrollo paso a paso.
// `node --test tests/steps.test.js`

const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../js/network.js");
const Steps = require("../js/steps.js");

function satelite(extra) {
  return N.analyze(
    N.createPath({
      frameBits: 1000,
      ackBits: 0,
      links: [
        N.createLink({
          name: "Enlace satelital",
          rateBps: 50000,
          distanceKm: 50000,
          velocityKmS: 200000,
          ...(extra || {}),
        }),
      ],
    })
  );
}

function porId(solucion, id) {
  const p = solucion.pasos.find((x) => x.id === id);
  assert.ok(p, `falta el paso "${id}"`);
  return p;
}

// El ejemplo de LAN de clase (10 Mbps, 1 km, V = 2·10^8 m/s, tramas de 500
// bits). NO es de Tanenbaum: se buscó `83,3` y `1 + 2a` en las 820 páginas de
// la 5.ª edición y no aparecen. Es formulación de Stallings. Se recorre por el
// mismo camino que la calculadora, que es donde se rompió:
//
// L = 500 NO es una trama construible —la real lleva la carga en bytes enteros
// más 16 de CRC, así que roundFrameBits(500) = 504—, y aun así el desarrollo
// tiene que dar los números del libro: la calculadora calcula tiempos, no
// construye tramas. Si alguien vuelve a aplicar roundFrameBits aquí, esto se
// pone rojo con a = 0,0992 y U = 83,44 %.
function lanDelLibro() {
  return N.analyze(
    N.createPath({
      frameBits: 500,
      ackBits: 0,
      links: [
        N.createLink({ name: "LAN", rateBps: 10e6, distanceKm: 1, velocityKmS: 200000 }),
      ],
    })
  );
}

test("El ejemplo de LAN de clase llega al desarrollo: a = 0,1 y U = 83,33 %", () => {
  const s = Steps.build(lanDelLibro());

  assert.equal(porId(s, "a").resultado, "0,1");
  assert.equal(porId(s, "u").resultado, "83,33 %");
  assert.equal(s.titular[0].valor, "83,33 %", "el titular dice lo mismo que el paso");
  assert.equal(s.entrada[0].valor, "500 bits", "y con los 500 bits que se pidieron");
});

test("El satélite del libro produce los pasos con sus números", () => {
  const s = Steps.build(satelite());

  assert.equal(porId(s, "tt").resultado, "20 ms");
  assert.equal(porId(s, "tp").resultado, "250 ms");
  assert.equal(porId(s, "a").resultado, "12,5");
  assert.equal(porId(s, "ciclo").resultado, "520 ms");
  assert.equal(porId(s, "u").resultado, "3,846 %");
  assert.equal(porId(s, "bd").resultado, "12.500 bits");
  assert.equal(porId(s, "ventana").resultado, "26 tramas");
  assert.equal(porId(s, "timeout").resultado, "520 ms");
});

test("Cada paso lleva fórmula, sustitución con los datos y resultado", () => {
  const s = Steps.build(satelite());

  for (const p of s.pasos) {
    assert.ok(p.formula.length > 0, `el paso ${p.id} no tiene fórmula`);
    assert.ok(p.resultado.length > 0, `el paso ${p.id} no tiene resultado`);
    assert.ok(p.titulo.length > 0, `el paso ${p.id} no tiene título`);
  }

  // La sustitución tiene que contener los datos de entrada, no solo el símbolo.
  assert.match(porId(s, "tt").sustitucion, /1000/);
  assert.match(porId(s, "tt").sustitucion, /50000/);
  assert.match(porId(s, "tp").sustitucion, /50000/);
  assert.match(porId(s, "tp").sustitucion, /200000/);
});

test("Con un enlace directo, el detalle comprueba U contra 1/(1+2a)", () => {
  const s = Steps.build(satelite());
  const detalle = porId(s, "u").detalle.join(" ");

  assert.match(detalle, /1 \/ \(1 \+ 2a\)/);
  assert.match(detalle, /3,846 %/);
});

test("Con varios saltos, el detalle avisa de que 1/(1+2a) ya no basta", () => {
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [
      N.createLink({ name: "A → R", rateBps: 1e6, distanceKm: 500, velocityKmS: 200000 }),
      N.createLink({ name: "R → B", rateBps: 5e5, distanceKm: 35786, velocityKmS: 300000 }),
    ],
  });
  const s = Steps.build(N.analyze(path));

  assert.match(porId(s, "u").detalle.join(" "), /ya no basta/);
  assert.match(porId(s, "ida").detalle.join(" "), /store-and-forward/);
  // Un paso por tramo dentro del detalle de Tt.
  assert.equal(porId(s, "tt").detalle.length, 2);
});

// El libro (p. 200) dice "sólo se usó 4% del ancho de banda". El 3,846 % es
// nuestro 20/520 exacto: correcto, pero no es una cita. Decir cuál es cuál.
test("el desarrollo distingue el 4 % del libro del 3,846 % exacto", () => {
  const s = Steps.build(satelite());
  const u = porId(s, "u");
  const texto = [u.resultado, ...u.detalle, u.nota].join(" ");
  assert.match(texto, /3,846/);
  assert.match(texto, /4 ?%/);
  assert.match(texto, /redondea/i);
});

test("con varios saltos U se llama la del enlace del emisor, no la del canal", () => {
  const dos = N.analyze(
    N.createPath({
      frameBits: 1000, ackBits: 0,
      links: [
        N.createLink({ name: "A", rateBps: 1000000, distanceKm: 35786, velocityKmS: 300000 }),
        N.createLink({ name: "B", rateBps: 500000, distanceKm: 35786, velocityKmS: 300000 }),
      ],
    })
  );
  assert.match(porId(Steps.build(dos), "u").titulo, /emisor/i);
  assert.match(porId(Steps.build(satelite()), "u").titulo, /^Utilización del canal$/);
});

test("Los pasos de error solo aparecen cuando hay probabilidad de error", () => {
  const sinError = Steps.build(satelite());
  assert.equal(sinError.pasos.some((p) => p.id === "perror"), false);
  assert.equal(sinError.pasos.some((p) => p.id === "uefectiva"), false);

  const conError = Steps.build(satelite({ errorProbData: 0.2 }));
  assert.equal(porId(conError, "perror").resultado, "20 %");
  assert.match(porId(conError, "uefectiva").detalle.join(" "), /1,25/); // 1/(1−0,2)
});

test("El titular incluye la utilización efectiva solo si hay errores", () => {
  const sin = Steps.build(satelite());
  const con = Steps.build(satelite({ errorProbData: 0.1 }));

  assert.equal(sin.titular.some((t) => t.etiqueta.includes("efectiva")), false);
  assert.equal(con.titular.some((t) => t.etiqueta.includes("efectiva")), true);
});

test("La entrada interpretada describe cada tramo con sus unidades", () => {
  const s = Steps.build(satelite());
  const texto = s.entrada.map((e) => `${e.etiqueta}: ${e.valor}`).join(" | ");

  assert.match(texto, /1000 bits/);
  assert.match(texto, /despreciable/);
  assert.match(texto, /50\.000 km/);
  assert.match(texto, /200\.000 km\/s/);
});

test("Half duplex añade el tiempo de vuelta al paso del ciclo", () => {
  const r = N.analyze(
    N.createPath({
      frameBits: 1000,
      ackBits: 0,
      duplexMode: N.DUPLEX.HALF,
      links: [
        N.createLink({ rateBps: 50000, distanceKm: 50000, velocityKmS: 200000, turnaroundMs: 30 }),
      ],
    })
  );
  const s = Steps.build(r);

  assert.match(porId(s, "ciclo").formula, /tiempo de vuelta/);
  assert.equal(porId(s, "ciclo").resultado, "580 ms");
  assert.match(porId(s, "ciclo").detalle.join(" "), /El RTT no cambia/);
});

test("La curva de la gráfica pasa por el punto que se está calculando", () => {
  const s = Steps.build(satelite());
  const { curva } = s.graficas;

  assert.ok(curva.puntos.length > 50, "la curva tiene suficientes puntos");
  assert.equal(curva.actual.a.toFixed(4), "12.5000");
  assert.ok(Math.abs(curva.actual.u - 1 / (1 + 2 * 12.5)) < 1e-9);

  // La curva es la fórmula del libro en toda su extensión.
  for (const p of curva.puntos) {
    assert.ok(Math.abs(p.u - 1 / (1 + 2 * p.a)) < 1e-12);
  }
});

test("El desarrollo de la ráfaga trae sus números, no solo el rótulo", () => {
  const pasos = Steps.buildBurst({ rateBps: 100000, burstMs: 10, frameBits: 500 });

  assert.equal(porId({ pasos }, "burst-bits").resultado, "1000 bits");
  assert.equal(porId({ pasos }, "burst-frames").resultado, "2 tramas");
});

test("Una ráfaga que no llena una trama entera sigue arruinando esa trama", () => {
  const pasos = Steps.buildBurst({ rateBps: 100000, burstMs: 1, frameBits: 1000 });

  // 100 bits arruinados, muy por debajo de los 1000 de la trama: sigue siendo 1.
  assert.equal(porId({ pasos }, "burst-bits").resultado, "100 bits");
  assert.equal(porId({ pasos }, "burst-frames").resultado, "1 trama");
});

test("El desarrollo de la transferencia trae sus números, no solo el rótulo", () => {
  const path = N.createPath({
    frameBits: 1000,
    ackBits: 0,
    links: [N.createLink({ name: "Enlace satelital", rateBps: 50000, distanceKm: 50000, velocityKmS: 200000 })],
  });
  const pasos = Steps.buildTransfer({ path, totalBits: 10000 });

  assert.equal(porId({ pasos }, "transfer-frames").resultado, "10 tramas");
  assert.equal(porId({ pasos }, "transfer-time").resultado, "5,2 s");
  assert.match(porId({ pasos }, "transfer-time").detalle.join(" "), /no cuenta reenvíos/);
});

test("Los segmentos del ciclo suman el ciclo completo", () => {
  const s = Steps.build(satelite());
  const { ciclo } = s.graficas;
  const suma = ciclo.segmentos.reduce((acc, x) => acc + x.ms, 0);

  assert.ok(Math.abs(suma - ciclo.totalMs) < 1e-9);
  assert.equal(ciclo.segmentos[0].ms, 20, "la parte activa es Tt del emisor");
});
