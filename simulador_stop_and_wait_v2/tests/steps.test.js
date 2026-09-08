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
// tiene que dar los números publicados de este ejemplo de clase: la
// calculadora calcula tiempos, no construye tramas. Si alguien vuelve a
// aplicar roundFrameBits aquí, esto se pone rojo con a = 0,0992 y U = 83,44 %.
function lanDeClase() {
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
  const s = Steps.build(lanDeClase());

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

// Sin probabilidades de error, el caudal es L/ciclo a secas. Arrastrar un
// "· (1 − P)" con P = 0 es ruido en la pizarra.
test("sin errores el caudal no arrastra el (1 - P)", () => {
  const s = Steps.build(satelite());
  const caudal = porId(s, "caudal");
  assert.equal(caudal.formula, "caudal = L / ciclo");
  // Ojo con comprobar esto buscando un "1": la sustitucion es "1000 / 520 ms" y
  // lleva unos de sobra. Lo que no debe aparecer es el producto por (1 - P).
  assert.ok(!caudal.sustitucion.includes("·"), `sobra el factor: ${caudal.sustitucion}`);
});

test("con errores el caudal sigue mostrando el (1 - P)", () => {
  const s = Steps.build(satelite({ errorProbData: 0.1 }));
  assert.equal(porId(s, "caudal").formula, "caudal = L · (1 − P) / ciclo");
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

  // La curva es la forma cerrada 1/(1+2a) en toda su extensión (Stallings,
  // no Tanenbaum: él nunca define a).
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

// Lo que pidió el usuario: que se vea de dónde sale el 1000 que convierte
// 0,02 s en 20 ms. Antes la pantalla saltaba de "1000 / 50000" a "20 ms".
test("el paso Tt ensena la cancelacion de unidades y el factor 1000", () => {
  const s = Steps.build(satelite());
  const d = porId(s, "tt").derivacion;
  assert.ok(Array.isArray(d) && d.length >= 4, `derivacion corta: ${d && d.length}`);

  const motivos = d.map((r) => r.motivo).join(" | ");
  assert.match(motivos, /cancel/i, "no dice que las unidades se cancelan");
  assert.match(motivos, /1000|mil/i, "no dice de donde sale el factor 1000");

  const texto = JSON.stringify(d);
  assert.match(texto, /"1000"/, "falta L sustituida");
  assert.match(texto, /"50000"/, "falta R sustituida");
  assert.match(texto, /"frac"/, "la formula no se emite como fraccion");
});

test("la derivacion termina en el mismo numero que el resultado plano", () => {
  const s = Steps.build(satelite());
  const tt = porId(s, "tt");
  assert.equal(tt.resultado, "20 ms");
  assert.match(JSON.stringify(tt.derivacion.at(-1)), /"20"/);
});

test("el paso Tp tambien trae derivacion", () => {
  const d = porId(Steps.build(satelite()), "tp").derivacion;
  assert.ok(d.length >= 4, `derivacion corta: ${d.length}`);
});

// Ronda de correcciones 1/5, hallazgo Important 1: rateBps = 1e-300 es
// "positivo y finito" según isPositive() de network.js, así que pasa la
// validación. crudo() lo redondeaba a "0" en la fila de sustitución: un cero
// que no está en los datos, inventado por Math.round(). Ahora esa fila usa
// notación científica en vez de mentir.
test("la fila de sustitucion no inventa un cero cuando el dato es mas chico que el redondeo", () => {
  const d = porId(Steps.build(satelite({ rateBps: 1e-300 })), "tt").derivacion;
  const sustitucion = d[1];
  const texto = JSON.stringify(sustitucion);

  assert.doesNotMatch(texto, /"v":"0"/, `el denominador se redondeo a un 0 falso: ${texto}`);
  assert.match(texto, /"pot10"/, "un dato subunitario deberia enseñarse en notacion cientifica");
  assert.match(texto, /"-300"/, "el exponente del dato original no aparece");
});

// Ronda de correcciones 1/5, hallazgo Important 2: con rateBps tan chico que
// L/R desborda a Infinity, la derivacion decia "Tt = Infinity s" mientras
// paso.resultado (que pasa por ms(), y ya devuelve "—" para no finitos)
// decia "—". Los dos campos son la fórmula y su red de seguridad: no pueden
// contradecirse.
test("la derivacion no contradice al resultado plano cuando el valor no es finito", () => {
  const tt = porId(Steps.build(satelite({ rateBps: Number.MIN_VALUE })), "tt");
  assert.equal(tt.resultado, "—", "precondicion: el caso elegido debe desbordar a Infinity");

  const ultimo = JSON.stringify(tt.derivacion.at(-1));
  assert.match(ultimo, /"—"/, "la derivacion tiene que enseñar el mismo guion que el resultado");
  assert.doesNotMatch(ultimo, /Infinity/i, "no debe quedar un Infinity crudo en la derivacion");
});

// La ampliación pedida en la ronda 1: U y caudal escondían un factor del
// mismo tipo que el 1000 de Tt/Tp (×100 para pasar a por ciento, ×1000 para
// pasar de bit/ms a bit/s), y a no tenía derivación en absoluto.
test("el paso a trae derivacion sin factor de escala: las unidades se cancelan solas", () => {
  const d = porId(Steps.build(satelite()), "a").derivacion;
  assert.equal(d.length, 3, "a no esconde ningun factor: no debe tener renglones de mas");
  assert.match(d.map((x) => x.motivo).join(" | "), /cancel/i);
  assert.match(JSON.stringify(d.at(-1)), /"12,5"/);
});

test("el paso U ensena el factor 100 que lo pasa de fraccion a por ciento", () => {
  const d = porId(Steps.build(satelite()), "u").derivacion;
  const motivos = d.map((x) => x.motivo).join(" | ");
  assert.match(motivos, /cancel/i);
  assert.match(motivos, /100/, "no dice de donde sale el factor 100");
  assert.match(JSON.stringify(d.at(-1)), /"3,846".*"%"/);
});

test("el paso caudal ensena el factor 1000 que lo pasa de bit\\/ms a bit\\/s", () => {
  const d = porId(Steps.build(satelite()), "caudal").derivacion;
  const motivos = d.map((x) => x.motivo).join(" | ");
  assert.match(motivos, /1000/, "no dice de donde sale el factor 1000");
  assert.match(JSON.stringify(d), /"pot10"/, "el resultado deberia traer notacion cientifica");
});

// Los pasos que no esconden ningun factor (ida, vuelta, ciclo, bd, ventana,
// timeout) solo necesitan tipografiarse: formula, sustitucion y resultado,
// sin renglones inventados de mas.
test("ida, vuelta, ciclo, bd, ventana y timeout se tipografian sin renglones extra", () => {
  const s = Steps.build(satelite());
  for (const id of ["ida", "vuelta", "ciclo", "bd", "ventana", "timeout"]) {
    const d = porId(s, id).derivacion;
    assert.equal(d.length, 3, `${id}: se esperaban 3 renglones (formula/sustitucion/resultado), hay ${d.length}`);
    assert.match(JSON.stringify(d), /"frac"|"fila"|"num"|"sim"/, `${id}: no se emitio como estructura de mathml.js`);
  }
});
