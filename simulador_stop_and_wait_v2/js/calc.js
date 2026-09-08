// calc.js
// Interfaz de la calculadora. Lee los controles, pide el cálculo a
// NetworkModel, pide el desarrollo a StepsModel y lo pinta. Aquí no se calcula
// ninguna fórmula.
//
// El desarrollo se enseña por bloques y de uno en uno, con el detalle de cada
// paso plegado: es el patrón de Wolfram|Alpha, y su motivo es explícito —
// mantener el desarrollo legible sin esconder información. Igual que allí,
// solo hay un detalle abierto a la vez.

(function () {
  "use strict";

  const N = window.NetworkModel;
  const F = window.FrameModel;
  const Steps = window.StepsModel;

  const PRESETS = {
    satelite: {
      frameBits: 1000, ackBits: 0, duplexMode: "full", processingMs: 0,
      links: [{ name: "Enlace satelital", rateBps: 50000, distanceKm: 50000, velocityKmS: 200000, turnaroundMs: 0 }],
    },
    lan: {
      frameBits: 500, ackBits: 0, duplexMode: "full", processingMs: 0,
      links: [{ name: "LAN", rateBps: 10000000, distanceKm: 1, velocityKmS: 200000, turnaroundMs: 0 }],
    },
    "casa-satelite-casa": {
      frameBits: 1000, ackBits: 0, duplexMode: "full", processingMs: 1,
      links: [
        { name: "Casa A → Satélite", rateBps: 1000000, distanceKm: 35786, velocityKmS: 300000, turnaroundMs: 0 },
        { name: "Satélite → Casa B", rateBps: 500000, distanceKm: 35786, velocityKmS: 300000, turnaroundMs: 0 },
      ],
    },
  };

  // Sin probabilidades de error: la calculadora calcula tiempos de un canal
  // limpio (decisión del usuario, 2026-09-08). El ruido vive en el simulador,
  // en sim.js y ui.js, y ahí no se ha tocado nada.
  const CAMPOS = [
    { key: "name", label: "Nombre", type: "text" },
    { key: "rateBps", label: "Tasa R (bits/s)", type: "number", min: 1, step: 1 },
    { key: "distanceKm", label: "Distancia d (km)", type: "number", min: 0, step: 0.001 },
    { key: "velocityKmS", label: "Velocidad V (km/s)", type: "number", min: 1, step: 1 },
    { key: "turnaroundMs", label: "Tiempo de vuelta (ms)", type: "number", min: 0, step: 1 },
  ];

  const dom = {};
  let filas = [];
  let solucion = null;
  let ultimoAnalisis = null;
  let ultimoPath = null;
  let pasosVisibles = 0;
  let detalleAbierto = null; // solo uno a la vez, como en Wolfram|Alpha

  // ---------- Arranque ----------

  function init() {
    cacheDom();
    initTheme();
    bindEvents();
    aplicarPreset("satelite");
    window.addEventListener("resize", () => {
      if (solucion) { dibujarCiclo(); dibujarCurva(); }
    });
  }

  function cacheDom() {
    const id = (x) => document.getElementById(x);
    Object.assign(dom, {
      frameBits: id("frame-bits"),
      frameBitsHint: id("frame-bits-hint"),
      ackBits: id("ack-bits"),
      duplexMode: id("duplex-mode"),
      processingMs: id("processing-ms"),
      burstMs: id("burst-ms"),
      transferPod: id("transfer-pod"),
      transferSize: id("transfer-size"),
      transferUnit: id("transfer-unit"),
      transferStepsList: id("transfer-steps-list"),
      linksContainer: id("links-container"),
      btnAddLink: id("btn-add-link"),
      errorBox: id("error-box"),
      themeSwitch: id("theme-switch"),

      interpret: id("interpret"),
      headline: id("headline"),
      cycleChart: id("cycle-chart"),
      cycleTip: id("cycle-tip"),
      cycleCaption: id("cycle-caption"),

      stepsList: id("steps-list"),
      burstPod: id("burst-pod"),
      burstStepsList: id("burst-steps-list"),
      btnNextStep: id("btn-next-step"),
      btnAllSteps: id("btn-all-steps"),
      btnHideSteps: id("btn-hide-steps"),
      stepsProgress: id("steps-progress"),

      curveChart: id("curve-chart"),
      curveTip: id("curve-tip"),
      curveTable: id("curve-table"),
    });
  }

  function bindEvents() {
    [dom.frameBits, dom.ackBits, dom.processingMs].forEach((el) => el.addEventListener("input", recalcular));
    dom.duplexMode.addEventListener("change", recalcular);
    dom.burstMs.addEventListener("change", recalcular);
    dom.transferSize.addEventListener("input", pintarDesarrollo);
    dom.transferUnit.addEventListener("change", pintarDesarrollo);
    dom.btnAddLink.addEventListener("click", anadirTramo);

    document.querySelectorAll("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => aplicarPreset(b.dataset.preset))
    );

    dom.btnNextStep.addEventListener("click", () => {
      pasosVisibles = Math.min(solucion.pasos.length, pasosVisibles + 1);
      pintarPasos();
    });
    dom.btnAllSteps.addEventListener("click", () => {
      pasosVisibles = solucion.pasos.length;
      pintarPasos();
    });
    dom.btnHideSteps.addEventListener("click", () => {
      pasosVisibles = 0;
      detalleAbierto = null;
      pintarDesarrollo();
    });

    dom.themeSwitch.addEventListener("change", () => {
      setTheme(dom.themeSwitch.checked ? "dark" : "light", true);
    });

    dom.cycleChart.addEventListener("mousemove", cicloHover);
    dom.cycleChart.addEventListener("mouseleave", () => { dom.cycleTip.hidden = true; });
    dom.curveChart.addEventListener("mousemove", curvaHover);
    dom.curveChart.addEventListener("mouseleave", () => { dom.curveTip.hidden = true; dibujarCurva(); });
  }

  // ---------- Tramos ----------

  function filaTramo(valores, indice) {
    const fila = document.createElement("div");
    fila.className = "link-row";

    const cabecera = document.createElement("div");
    cabecera.className = "link-row-head";
    cabecera.innerHTML = `<span class="link-index">Salto ${indice + 1}</span>`;

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn-ghost btn-small";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", () => {
      if (filas.length <= 1) return mostrarError("Hace falta al menos un enlace.");
      filas = filas.filter((f) => f.elemento !== fila);
      pintarTramos(leerTramos());
      recalcular();
    });
    cabecera.appendChild(quitar);
    fila.appendChild(cabecera);

    const grid = document.createElement("div");
    grid.className = "link-fields";
    const entradas = {};

    for (const campo of CAMPOS) {
      const label = document.createElement("label");
      label.textContent = campo.label;

      const input = document.createElement("input");
      input.type = campo.type;
      if (campo.type === "number") input.className = "num";
      if (campo.min !== undefined) input.min = String(campo.min);
      if (campo.max !== undefined) input.max = String(campo.max);
      if (campo.step !== undefined) input.step = String(campo.step);
      input.value = valores[campo.key] === undefined ? "" : String(valores[campo.key]);
      input.addEventListener("input", recalcular);

      const caja = document.createElement("div");
      caja.className = "link-field";
      caja.appendChild(label);
      caja.appendChild(input);
      grid.appendChild(caja);
      entradas[campo.key] = input;
    }

    fila.appendChild(grid);
    return { elemento: fila, entradas };
  }

  function pintarTramos(valores) {
    dom.linksContainer.innerHTML = "";
    filas = valores.map((v, i) => {
      const fila = filaTramo(v, i);
      dom.linksContainer.appendChild(fila.elemento);
      return fila;
    });
  }

  function leerTramos() {
    return filas.map((fila) => {
      const salida = {};
      for (const campo of CAMPOS) {
        const bruto = fila.entradas[campo.key].value;
        salida[campo.key] = campo.type === "number" ? Number(bruto) : bruto;
      }
      return salida;
    });
  }

  function anadirTramo() {
    const valores = leerTramos();
    const ultimo = valores[valores.length - 1];
    valores.push({
      name: `Salto ${valores.length + 1}`,
      rateBps: ultimo ? ultimo.rateBps : 1000000,
      distanceKm: ultimo ? ultimo.distanceKm : 100,
      velocityKmS: ultimo ? ultimo.velocityKmS : 200000,
      turnaroundMs: 0,
    });
    pintarTramos(valores);
    recalcular();
  }

  // ---------- Cálculo ----------

  function mostrarError(mensaje) {
    dom.errorBox.hidden = false;
    dom.errorBox.textContent = mensaje;
  }

  function recalcular() {
    let analisis;
    try {
      const enlaces = leerTramos().map((v, i) =>
        N.createLink({
          name: v.name || `Salto ${i + 1}`,
          rateBps: v.rateBps,
          distanceKm: v.distanceKm,
          velocityKmS: v.velocityKmS,
          turnaroundMs: v.turnaroundMs,
        })
      );
      const camino = N.createPath({
        frameBits: Number(dom.frameBits.value),
        ackBits: Number(dom.ackBits.value),
        duplexMode: dom.duplexMode.value,
        processingMsPerHop: Number(dom.processingMs.value),
        links: enlaces,
      });
      analisis = N.analyze(camino);
      ultimoPath = camino;
    } catch (err) {
      mostrarError(err.message);
      // Sin resultado no hay nada de lo que dejar nota: una nota sobre un
      // tamaño que no se está calculando confunde más que ayuda.
      dom.frameBitsHint.hidden = true;
      return;
    }

    dom.errorBox.hidden = true;
    notaDeTramaReal(analisis.frameBits);
    solucion = Steps.build(analisis);
    ultimoAnalisis = analisis;
    pasosVisibles = Math.min(pasosVisibles, solucion.pasos.length);
    pintarInterpretacion();
    pintarTitular();
    pintarDesarrollo();
    dibujarCiclo();
    dibujarCurva();
    pintarTablaCurva();
  }

  /**
   * La calculadora **no redondea el tamaño de trama, y es a propósito.**
   *
   * El redondeo de `F.roundFrameBits` es una restricción de la trama *real*: la
   * que construye `createFrame`, con la carga en bytes enteros más los 16 bits
   * del CRC. El simulador no tiene más remedio que aplicarlo, porque construye
   * tramas. Aquí no se construye ninguna: solo se calculan tiempos, y
   * `Tt = L / R` funciona igual de bien con L = 500 que con L = 504.
   *
   * Importa porque el ejemplo de LAN de clase es exactamente ese: 10 Mbps,
   * 1 km, tramas de 500 bits, a = 0,1 y U = 83,33 %. NO es de Tanenbaum —
   * `83,3` y `1 + 2a` no aparecen en las 820 páginas de la 5.ª edición; es
   * formulación de Stallings—, pero igual es el número publicado contra el
   * que está probado el proyecto. Redondear a 504 lo convierte en a = 0,0992
   * y U = 83,44 %. La prueba «El ejemplo de LAN de clase llega al desarrollo:
   * a = 0,1 y U = 83,33 %» (`tests/steps.test.js`) se pone roja si alguien
   * vuelve a meter un redondeo por encima del modelo.
   *
   * Lo que sí se hace es **decirlo**: una nota de que el simulador usaría otro
   * tamaño. No es un error del formulario y no cambia ningún resultado de esta
   * página, así que no se pinta como los avisos de validación.
   */
  function notaDeTramaReal(frameBits) {
    const real = F.roundFrameBits(frameBits);
    if (real === frameBits) {
      dom.frameBitsHint.hidden = true;
      dom.frameBitsHint.textContent = "";
      return;
    }
    dom.frameBitsHint.hidden = false;
    dom.frameBitsHint.textContent =
      `Nota: los tiempos de aquí son los de una trama de ${frameBits} bits, exactos. ` +
      `Una trama construible lleva la carga en bytes enteros más 16 de CRC, así que el ` +
      `simulador ajustaría estos ${frameBits} bits a ${real}.`;
  }

  // ---------- Bloques ----------

  function pintarInterpretacion() {
    dom.interpret.innerHTML = "";
    for (const item of solucion.entrada) {
      const dt = document.createElement("dt");
      dt.textContent = item.etiqueta;
      const dd = document.createElement("dd");
      dd.textContent = item.valor;
      dom.interpret.appendChild(dt);
      dom.interpret.appendChild(dd);
    }
  }

  function pintarTitular() {
    dom.headline.innerHTML = "";
    solucion.titular.forEach((item) => {
      const caja = document.createElement("div");
      caja.className = item.enfasis ? "headline-item headline-main" : "headline-item";
      const etiqueta = document.createElement("span");
      etiqueta.className = "headline-label";
      etiqueta.textContent = item.etiqueta;
      const valor = document.createElement("span");
      valor.className = "headline-value num";
      valor.textContent = item.valor;
      caja.appendChild(etiqueta);
      caja.appendChild(valor);
      dom.headline.appendChild(caja);
    });
  }

  // `detalleAbierto` es global a los dos bloques (el desarrollo principal y la
  // ráfaga), así que abrir un detalle en uno tiene que poder repintar el otro.
  function pintarDesarrollo() {
    pintarPasos();
    pintarRafaga();
    pintarTransferencia();
  }

  function pintarPasos() {
    dom.stepsList.innerHTML = "";
    const total = solucion.pasos.length;

    solucion.pasos.slice(0, pasosVisibles).forEach((paso, i) => {
      dom.stepsList.appendChild(bloquePaso(paso, i, pintarDesarrollo));
    });

    dom.btnNextStep.hidden = pasosVisibles >= total;
    dom.btnNextStep.textContent = pasosVisibles === 0 ? "Mostrar el primer paso" : "Mostrar el siguiente paso";
    dom.btnAllSteps.hidden = pasosVisibles >= total;
    dom.btnHideSteps.hidden = pasosVisibles === 0;

    dom.stepsProgress.textContent =
      pasosVisibles === 0
        ? `${total} pasos hasta el resultado.`
        : `Paso ${pasosVisibles} de ${total}.`;
  }

  // La ráfaga usa la tasa del primer tramo, igual que hace el paso "caudal"
  // del desarrollo principal para hablar de "lo que da el primer tramo".
  function pintarRafaga() {
    const burstMs = Number(dom.burstMs.value);
    if (!ultimoAnalisis || !(burstMs > 0)) {
      dom.burstPod.hidden = true;
      dom.burstStepsList.innerHTML = "";
      return;
    }

    const pasos = Steps.buildBurst({
      rateBps: ultimoAnalisis.perLink[0].rateBps,
      burstMs,
      frameBits: ultimoAnalisis.frameBits,
    });

    dom.burstPod.hidden = false;
    dom.burstStepsList.innerHTML = "";
    pasos.forEach((paso, i) => dom.burstStepsList.appendChild(bloquePaso(paso, i, pintarDesarrollo)));
  }

  // Transferencia de un fichero completo: la unidad se convierte a bits en
  // network.js (bitsFromSize), nunca aquí.
  function pintarTransferencia() {
    const tamano = Number(dom.transferSize.value);
    dom.transferStepsList.innerHTML = "";
    // Mismo guardián que `pintarRafaga`: sin tamaño no hay nada que enseñar, y
    // un bloque con una sección vacía solo estorba.
    if (!ultimoPath || !(tamano > 0)) {
      dom.transferPod.hidden = true;
      return;
    }
    dom.transferPod.hidden = false;

    let totalBits;
    try {
      totalBits = N.bitsFromSize(tamano, dom.transferUnit.value);
    } catch (err) {
      dom.transferPod.hidden = true;
      return; // unidad inválida: no debería pasar con el <select>, pero no se pinta nada roto
    }

    const pasos = Steps.buildTransfer({ path: ultimoPath, totalBits });
    pasos.forEach((paso, i) => dom.transferStepsList.appendChild(bloquePaso(paso, i, pintarDesarrollo)));
  }

  function bloquePaso(paso, indice, repintar) {
    const li = document.createElement("li");
    li.className = "step";

    const titulo = document.createElement("h3");
    titulo.className = "step-title";
    titulo.textContent = paso.titulo;
    li.appendChild(titulo);

    const cuenta = document.createElement("div");
    cuenta.className = "step-math";

    cuenta.appendChild(lineaMath("formula", paso.formula));
    if (paso.sustitucion) cuenta.appendChild(lineaMath("sub", `= ${paso.sustitucion}`));
    cuenta.appendChild(lineaMath("res", `= ${paso.resultado}`));
    li.appendChild(cuenta);

    if (paso.nota) {
      const nota = document.createElement("p");
      nota.className = "step-note";
      nota.textContent = paso.nota;
      li.appendChild(nota);
    }

    if (paso.detalle.length > 0) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "step-more";
      const abierto = detalleAbierto === paso.id;
      boton.textContent = abierto ? "Ocultar el detalle" : "Ver el detalle";
      boton.setAttribute("aria-expanded", String(abierto));
      boton.addEventListener("click", () => {
        // Solo un detalle abierto a la vez: abrir otro cierra el anterior.
        detalleAbierto = detalleAbierto === paso.id ? null : paso.id;
        repintar();
      });
      li.appendChild(boton);

      if (abierto) {
        const lista = document.createElement("ul");
        lista.className = "step-detail";
        for (const linea of paso.detalle) {
          const item = document.createElement("li");
          item.textContent = linea;
          lista.appendChild(item);
        }
        li.appendChild(lista);
      }
    }

    li.dataset.index = String(indice + 1);
    return li;
  }

  function lineaMath(tipo, texto) {
    const div = document.createElement("div");
    div.className = `math math-${tipo}`;
    div.textContent = texto;
    return div;
  }

  // ---------- Gráficas ----------

  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  function prepararCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, canvas.clientHeight);
    return { ctx, w: rect.width, h: canvas.clientHeight };
  }

  // Barra de proporción: una sola magnitud (el tiempo activo) sobre una pista
  // neutra. No son dos categorías compitiendo, así que no hace falta un segundo
  // color: basta el relleno, la pista y las etiquetas directas.
  function dibujarCiclo() {
    const { ctx, w, h } = prepararCanvas(dom.cycleChart);
    const { ciclo } = solucion.graficas;

    const margen = 2;
    const alto = 26;
    const y = 34;
    const ancho = w - margen * 2;
    const activo = ciclo.totalMs > 0 ? ciclo.segmentos[0].ms / ciclo.totalMs : 0;
    const anchoActivo = Math.max(activo > 0 ? 2 : 0, ancho * activo);

    // Pista.
    ctx.fillStyle = css("--grid");
    ctx.fillRect(margen, y, ancho, alto);

    // Parte activa, con 2 px de hueco contra la pista.
    ctx.fillStyle = css("--chart-1");
    ctx.fillRect(margen, y, Math.max(0, anchoActivo - 2), alto);

    // Etiquetas directas.
    ctx.font = "12px ui-monospace, Consolas, monospace";
    ctx.fillStyle = css("--ink");
    ctx.textAlign = "left";
    ctx.fillText(`Transmitiendo ${Steps.formato.pct(activo)}`, margen, y - 8);
    ctx.textAlign = "right";
    ctx.fillStyle = css("--ink-soft");
    ctx.fillText(`Esperando ${Steps.formato.pct(1 - activo)}`, w - margen, y - 8);

    ctx.textAlign = "left";
    ctx.fillStyle = css("--ink-soft");
    ctx.fillText("0", margen, y + alto + 15);
    ctx.textAlign = "right";
    ctx.fillText(Steps.formato.ms(ciclo.totalMs), w - margen, y + alto + 15);
    ctx.textAlign = "left";

    dom.cycleChart.dataset.activo = String(activo);

    // La descripción lleva los números, no solo el título: quien no ve la
    // gráfica necesita el dato, no la etiqueta.
    dom.cycleChart.setAttribute(
      "aria-label",
      `Reparto del ciclo de ${Steps.formato.ms(ciclo.totalMs)}: transmitiendo ${Steps.formato.pct(activo)}, esperando ${Steps.formato.pct(1 - activo)}.`
    );
  }

  function cicloHover(evento) {
    const rect = dom.cycleChart.getBoundingClientRect();
    const x = evento.clientX - rect.left;
    const activo = Number(dom.cycleChart.dataset.activo || 0);
    const { ciclo } = solucion.graficas;
    const enActivo = x <= rect.width * activo;
    const seg = enActivo ? ciclo.segmentos[0] : ciclo.segmentos[1];

    mostrarTip(dom.cycleTip, evento, `${seg.etiqueta}: ${Steps.formato.ms(seg.ms)} de ${Steps.formato.ms(ciclo.totalMs)}`);
  }

  function curvaGeometria(w, h) {
    return { izq: 46, der: w - 14, arriba: 14, abajo: h - 28 };
  }

  const A_MIN = 0.01;
  const A_MAX = 1000;
  const logA = (a) => Math.log10(Math.max(A_MIN, Math.min(A_MAX, a)));

  function dibujarCurva(resaltado) {
    const { ctx, w, h } = prepararCanvas(dom.curveChart);
    const g = curvaGeometria(w, h);
    const { curva } = solucion.graficas;

    const x = (a) => g.izq + ((logA(a) - logA(A_MIN)) / (logA(A_MAX) - logA(A_MIN))) * (g.der - g.izq);
    const y = (u) => g.abajo - u * (g.abajo - g.arriba);

    // Rejilla discreta: el dato manda, la retícula acompaña.
    ctx.strokeStyle = css("--grid");
    ctx.fillStyle = css("--ink-soft");
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.lineWidth = 1;

    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const yy = Math.round(y(u)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(g.izq, yy);
      ctx.lineTo(g.der, yy);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${u * 100} %`, g.izq - 6, yy + 3);
    }

    ctx.textAlign = "center";
    for (const a of [0.01, 0.1, 1, 10, 100, 1000]) {
      const xx = Math.round(x(a)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(xx, g.arriba);
      ctx.lineTo(xx, g.abajo);
      ctx.stroke();
      ctx.fillText(a < 1 ? String(a).replace(".", ",") : String(a), xx, g.abajo + 15);
    }
    ctx.fillText("a = Tp / Tt", (g.izq + g.der) / 2, h - 2);

    // La curva.
    ctx.strokeStyle = css("--chart-2");
    ctx.lineWidth = 2;
    ctx.beginPath();
    curva.puntos.forEach((p, i) => {
      const px = x(p.a);
      const py = y(p.u);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // El punto de este enlace, con anillo del color de la superficie.
    if (curva.actual) {
      const px = x(curva.actual.a);
      const py = y(curva.actual.u);

      ctx.strokeStyle = css("--rule");
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, g.abajo);
      ctx.moveTo(px, py);
      ctx.lineTo(g.izq, py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = css("--paper");
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css("--chart-1");
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = css("--ink");
      ctx.font = "12px ui-monospace, Consolas, monospace";
      ctx.textAlign = px > (g.izq + g.der) / 2 ? "right" : "left";
      const dx = px > (g.izq + g.der) / 2 ? -12 : 12;
      ctx.fillText(`este enlace · ${Steps.formato.pct(curva.actual.u)}`, px + dx, py - 8);
    }

    // Cruz del puntero.
    if (resaltado) {
      const px = x(resaltado.a);
      const py = y(resaltado.u);
      ctx.strokeStyle = css("--ink-soft");
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(px, g.arriba);
      ctx.lineTo(px, g.abajo);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css("--chart-2");
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = "left";
    ctx.lineWidth = 1;

    dom.curveChart.setAttribute(
      "aria-label",
      curva.actual
        ? `Curva de utilización de Stop & Wait frente al parámetro a, de 0,01 a 1000. Este enlace: a igual a ${Steps.formato.redondear(curva.actual.a)}, utilización ${Steps.formato.pct(curva.actual.u)}. Los mismos valores están en la tabla siguiente.`
        : "Curva de utilización de Stop & Wait frente al parámetro a."
    );
  }

  function curvaHover(evento) {
    const rect = dom.curveChart.getBoundingClientRect();
    const g = curvaGeometria(rect.width, dom.curveChart.clientHeight);
    const x = evento.clientX - rect.left;
    if (x < g.izq || x > g.der) {
      dom.curveTip.hidden = true;
      return dibujarCurva();
    }

    const t = (x - g.izq) / (g.der - g.izq);
    const a = Math.pow(10, logA(A_MIN) + t * (logA(A_MAX) - logA(A_MIN)));
    const u = 1 / (1 + 2 * a);

    dibujarCurva({ a, u });
    mostrarTip(dom.curveTip, evento, `a = ${Steps.formato.redondear(a)} → U = ${Steps.formato.pct(u)}`);
  }

  function mostrarTip(elemento, evento, texto) {
    const contenedor = elemento.parentElement.getBoundingClientRect();
    elemento.hidden = false;
    elemento.textContent = texto;
    elemento.style.left = `${evento.clientX - contenedor.left + 12}px`;
    elemento.style.top = `${evento.clientY - contenedor.top + 12}px`;
  }

  // Misma información en tabla: la gráfica no puede ser el único camino al dato.
  function pintarTablaCurva() {
    const cuerpo = dom.curveTable.querySelector("tbody");
    cuerpo.innerHTML = "";

    const referencias = [
      { a: 0.1, lectura: "LAN corta: el canal se aprovecha casi entero" },
      { a: 1, lectura: "Propagación igual a la transmisión" },
      { a: 10, lectura: "Enlace largo o trama pequeña" },
      { a: 100, lectura: "Satélite: Stop & Wait deja el canal casi vacío" },
    ];

    const actual = solucion.graficas.curva.actual;
    const filas = referencias.slice();
    if (actual) filas.push({ a: actual.a, lectura: "Este enlace", destacado: true });
    filas.sort((x, y) => x.a - y.a);

    for (const fila of filas) {
      const tr = document.createElement("tr");
      if (fila.destacado) tr.className = "row-current";
      const u = 1 / (1 + 2 * fila.a);
      tr.innerHTML = `<td class="num">${Steps.formato.redondear(fila.a)}</td><td class="num">${Steps.formato.pct(u)}</td><td class="cell-note">${fila.lectura}</td>`;
      cuerpo.appendChild(tr);
    }
  }

  // ---------- Presets y tema ----------

  function aplicarPreset(nombre) {
    const preset = PRESETS[nombre];
    if (!preset) return;
    dom.frameBits.value = String(preset.frameBits);
    dom.ackBits.value = String(preset.ackBits);
    dom.duplexMode.value = preset.duplexMode;
    dom.processingMs.value = String(preset.processingMs);
    pintarTramos(preset.links.map((l) => ({ ...l })));
    detalleAbierto = null;
    recalcular();
  }

  function initTheme() {
    let guardado = null;
    try { guardado = localStorage.getItem("saw2-theme"); } catch (e) { /* sin almacenamiento */ }
    setTheme(guardado === "dark" ? "dark" : "light", false);
  }

  function setTheme(tema, persistir) {
    document.documentElement.setAttribute("data-theme", tema);
    dom.themeSwitch.checked = tema === "dark";
    if (persistir) {
      try { localStorage.setItem("saw2-theme", tema); } catch (e) { /* sin almacenamiento */ }
    }
    if (solucion) { dibujarCiclo(); dibujarCurva(); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
