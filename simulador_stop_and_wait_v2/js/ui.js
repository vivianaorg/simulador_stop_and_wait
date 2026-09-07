// ui.js
// Interfaz del simulador: dibuja el diagrama tiempo-espacio y la cadena de
// puntos, y traduce los controles en llamadas al motor. Ninguna regla del
// protocolo vive aquí: de eso se encargan sim.js, frame.js y network.js.

(function () {
  "use strict";

  const F = window.FrameModel;
  const N = window.NetworkModel;
  const S = window.SimModel;

  // Un ciclo completo del protocolo dura esto en pantalla a velocidad 1×.
  const SEGUNDOS_POR_CICLO = 6;

  const dom = {};
  let sim = null;
  let hops = [];
  let selectedIndex = 0;
  let ultimoInstante = 0;
  // Mientras el usuario no escriba un timeout a mano, se ajusta solo al camino:
  // un timeout por debajo del RTT provoca retransmisiones inútiles, y con varios
  // saltos el RTT cambia cada vez que se añade un punto.
  let timeoutManual = false;
  // Byte del CRC cuyo detalle está desplegado, o null.
  let byteAbierto = null;
  // Cuánto tiempo simulado hacia atrás está mirando el diagrama. 0 = sigue al
  // presente; > 0 = el usuario se ha ido a mirar historia.
  let retrocesoMs = 0;

  // ---------- Arranque ----------

  function init() {
    cacheDom();
    initTheme();
    hops = [
      { name: "Casa A → Nodo", rateBps: 100000, distanceKm: 2000, velocityKmS: 200000, errorProbData: 0, errorProbAck: 0, turnaroundMs: 5 },
    ];
    renderHops();
    bindEvents();
    rebuild();
    window.requestAnimationFrame(tick);
  }

  function cacheDom() {
    const id = (x) => document.getElementById(x);
    Object.assign(dom, {
      diagram: id("diagram"),
      chain: id("chain"),
      themeSwitch: id("theme-switch"),

      stateName: id("state-name"),
      clock: id("clock"),
      timerFill: id("timer-fill"),
      btnRun: id("btn-run"),
      btnStep: id("btn-step"),
      btnReset: id("btn-reset"),
      speed: id("speed"),
      speedLabel: id("speed-label"),

      targets: id("targets"),
      inspectorEmpty: id("inspector-empty"),
      inspectorBody: id("inspector-body"),
      inspKind: id("insp-kind"),
      inspSeq: id("insp-seq"),
      inspHop: id("insp-hop"),
      inspCrc: id("insp-crc"),
      bits: id("bits"),
      btnDestroy: id("btn-destroy"),
      btnDelay: id("btn-delay"),
      btnSeq0: id("btn-seq0"),
      btnSeq1: id("btn-seq1"),

      totalFrames: id("total-frames"),
      frameBits: id("frame-bits"),
      ackBits: id("ack-bits"),
      timeoutMs: id("timeout-ms"),
      seed: id("seed"),
      nakToggle: id("nak-toggle"),
      noiseToggle: id("noise-toggle"),
      duplexMode: id("duplex-mode"),
      btnNoiseBit: id("btn-noise-bit"),
      btnCrcSteps: id("btn-crc-steps"),
      crcSteps: id("crc-steps"),
      timeoutHint: id("timeout-hint"),

      hopsBox: id("hops"),
      btnAddHop: id("btn-add-hop"),

      log: id("log"),
      tel: {
        delivered: id("tel-delivered"),
        sent: id("tel-sent"),
        retrans: id("tel-retrans"),
        acks: id("tel-acks"),
        naks: id("tel-naks"),
        crc: id("tel-crc"),
        dups: id("tel-dups"),
        late: id("tel-late"),
        destroyed: id("tel-destroyed"),
        u: id("tel-u"),
        rtt: id("tel-rtt"),
      },
    });

    dom.dctx = dom.diagram.getContext("2d");
    dom.cctx = dom.chain.getContext("2d");
  }

  function bindEvents() {
    dom.btnRun.addEventListener("click", toggleRun);
    dom.btnStep.addEventListener("click", stepOnce);
    dom.btnReset.addEventListener("click", rebuild);
    dom.speed.addEventListener("input", () => {
      dom.speedLabel.textContent = `${Number(dom.speed.value).toFixed(1).replace(".", ",")}×`;
    });

    [dom.totalFrames, dom.frameBits, dom.ackBits, dom.seed].forEach((el) =>
      el.addEventListener("change", rebuild)
    );
    dom.timeoutMs.addEventListener("change", () => {
      timeoutManual = true;
      rebuild();
    });
    dom.nakToggle.addEventListener("change", rebuild);
    dom.noiseToggle.addEventListener("change", () => {
      renderHops();
      rebuild();
    });
    dom.duplexMode.addEventListener("change", rebuild);

    dom.btnNoiseBit.addEventListener("click", () =>
      actOnSelected((p) => {
        // Con la misma semilla, el mismo bit: el escenario se repite.
        F.flipRandomBit(p.frame, sim.random);
      })
    );

    dom.btnCrcSteps.addEventListener("click", () => {
      const abierto = dom.crcSteps.hidden;
      dom.crcSteps.hidden = !abierto;
      dom.btnCrcSteps.setAttribute("aria-expanded", String(abierto));
      dom.btnCrcSteps.textContent = abierto ? "Ocultar el CRC" : "Ver el CRC paso a paso";
      if (abierto) renderCrcSteps();
    });

    // Rueda: mirar hacia atrás. Doble clic: volver al presente.
    // Solo secuestramos la rueda si de verdad hay historia que mirar. Sin
    // simulacion, o con el diagrama al principio y la rueda subiendo, el gesto
    // se deja pasar para que la pagina o el panel derecho scrollen normal.
    dom.diagram.addEventListener("wheel", (e) => {
      if (!sim || sim.clockMs <= 0) return;
      const paso = Math.sign(e.deltaY);
      const destino = Math.max(0, Math.min(sim.clockMs, retrocesoMs - paso * ventanaVisibleMs() * 0.15));
      if (destino === retrocesoMs) return;
      e.preventDefault();
      retrocesoMs = destino;
      drawDiagram();
    }, { passive: false });

    dom.diagram.addEventListener("dblclick", () => {
      retrocesoMs = 0;
      drawDiagram();
    });
    dom.btnAddHop.addEventListener("click", addHop);

    dom.btnDestroy.addEventListener("click", () => actOnSelected((p) => S.destroy(sim, p)));
    dom.btnDelay.addEventListener("click", () =>
      actOnSelected((p) => S.freeze(sim, p, sim.timeoutMs * 1.6))
    );
    dom.btnSeq0.addEventListener("click", () => actOnSelected((p) => S.setSeqOf(sim, p, 0)));
    dom.btnSeq1.addEventListener("click", () => actOnSelected((p) => S.setSeqOf(sim, p, 1)));

    dom.themeSwitch.addEventListener("change", () =>
      setTheme(dom.themeSwitch.checked ? "dark" : "light", true)
    );

    window.addEventListener("resize", resizeCanvases);
  }

  // ---------- Camino editable ----------

  function addHop() {
    const ultimo = hops[hops.length - 1];
    hops.push({
      name: `Tramo ${hops.length + 1}`,
      rateBps: ultimo.rateBps,
      distanceKm: ultimo.distanceKm,
      velocityKmS: ultimo.velocityKmS,
      errorProbData: 0,
      errorProbAck: 0,
      turnaroundMs: ultimo.turnaroundMs,
    });
    renderHops();
    rebuild();
  }

  function removeHop(index) {
    if (hops.length <= 1) return;
    hops.splice(index, 1);
    renderHops();
    rebuild();
  }

  const CAMPOS_TRAMO = [
    { key: "distanceKm", label: "Distancia (km)", step: "1", min: "0" },
    { key: "rateBps", label: "Tasa (bits/s)", step: "1000", min: "1" },
    { key: "velocityKmS", label: "Velocidad (km/s)", step: "1000", min: "1" },
    { key: "errorProbData", label: "P error trama", step: "0.05", min: "0", max: "1" },
    { key: "turnaroundMs", label: "Vuelta del medio (ms)", step: "1", min: "0" },
  ];

  function renderHops() {
    dom.hopsBox.innerHTML = "";

    hops.forEach((hop, i) => {
      const box = document.createElement("div");
      box.className = "hop";

      const head = document.createElement("div");
      head.className = "hop-head";
      head.innerHTML = `<span>${nombreNodo(i)} → ${nombreNodo(i + 1)}</span>`;

      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.textContent = "Quitar";
      quitar.disabled = hops.length <= 1;
      quitar.addEventListener("click", () => removeHop(i));
      head.appendChild(quitar);
      box.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "hop-fields";

      for (const campo of CAMPOS_TRAMO) {
        const label = document.createElement("label");
        label.textContent = campo.label;

        const input = document.createElement("input");
        input.type = "number";
        input.className = "num";
        input.value = String(hop[campo.key]);
        input.step = campo.step;
        if (campo.min !== undefined) input.min = campo.min;
        if (campo.max !== undefined) input.max = campo.max;
        input.addEventListener("change", () => {
          hop[campo.key] = Number(input.value);
          rebuild();
        });

        if (campo.key === "errorProbData" && !dom.noiseToggle.checked) {
          input.disabled = true;
          label.title = "Enciende el ruido del canal para usar esta probabilidad";
        }

        label.appendChild(input);
        grid.appendChild(label);
      }

      box.appendChild(grid);
      dom.hopsBox.appendChild(box);
    });
  }

  function nombreNodo(i) {
    if (i === 0) return "A";
    if (i === hops.length) return "B";
    return `R${i}`;
  }

  // ---------- Construcción de la simulación ----------

  function rebuild() {
    let path;
    try {
      // Los valores del formulario se validan siempre, aunque el ruido esté
      // apagado: si no, una probabilidad imposible se aceptaba en silencio y
      // solo reventaba al encender el ruido.
      hops.forEach((h, i) =>
        N.createLink({
          name: `${nombreNodo(i)} → ${nombreNodo(i + 1)}`,
          rateBps: h.rateBps,
          distanceKm: h.distanceKm,
          velocityKmS: h.velocityKmS,
          errorProbData: h.errorProbData,
          errorProbAck: h.errorProbAck,
          turnaroundMs: h.turnaroundMs,
        })
      );

      path = N.createPath({
        frameBits: Number(dom.frameBits.value),
        ackBits: Number(dom.ackBits.value),
        duplexMode: dom.duplexMode.value,
        links: hops.map((h, i) =>
          N.createLink({
            name: `${nombreNodo(i)} → ${nombreNodo(i + 1)}`,
            rateBps: h.rateBps,
            distanceKm: h.distanceKm,
            velocityKmS: h.velocityKmS,
            errorProbData: dom.noiseToggle.checked ? h.errorProbData : 0,
            errorProbAck: dom.noiseToggle.checked ? h.errorProbAck : 0,
            turnaroundMs: h.turnaroundMs,
          })
        ),
      });
    } catch (err) {
      dom.timeoutHint.textContent = err.message;
      return;
    }

    // Timeout automático: RTT del camino con un 50 % de margen.
    if (!timeoutManual) {
      const sugerido = Math.max(1, Math.ceil(N.analyze(path).rttMs * 1.5));
      dom.timeoutMs.value = String(sugerido);
    }

    sim = S.createSimulation({
      path,
      totalFrames: Number(dom.totalFrames.value),
      timeoutMs: Number(dom.timeoutMs.value),
      nakOnError: dom.nakToggle.checked,
      seed: Number(dom.seed.value),
      payloadBytes: 8,
    });

    selectedIndex = 0;
    ultimoInstante = 0;
    retrocesoMs = 0;
    dom.btnRun.textContent = "Iniciar";
    resizeCanvases();
    avisoDeTimeout();
    renderAll();
  }

  function avisoDeTimeout() {
    const rtt = sim.analysis.rttMs;
    if (sim.timeoutMs <= rtt) {
      dom.timeoutHint.textContent = `El timeout (${fmt(sim.timeoutMs)} ms) no supera el RTT del camino (${fmt(rtt)} ms): el emisor retransmitirá tramas cuyo ACK todavía viene en camino, y el receptor las verá como duplicadas.`;
    } else if (timeoutManual) {
      dom.timeoutHint.textContent = `RTT del camino: ${fmt(rtt)} ms. Tu timeout le deja ${fmt(sim.timeoutMs - rtt)} ms de margen.`;
    } else {
      dom.timeoutHint.textContent = `Timeout ajustado al camino: RTT ${fmt(rtt)} ms más un 50 % de margen. Escribe otro valor para fijarlo tú.`;
    }
  }

  // ---------- Bucle ----------

  function toggleRun() {
    if (!sim) return;
    if (sim.running) {
      S.pause(sim);
      dom.btnRun.textContent = "Continuar";
    } else {
      S.start(sim);
      dom.btnRun.textContent = "Pausar";
    }
    renderAll();
  }

  function stepOnce() {
    if (!sim || sim.state === S.STATE.FINISHED) return;

    // Desde parado, el primer paso arranca la simulación: así se puede seguir
    // el protocolo desde el principio sin verlo correr.
    if (sim.state === S.STATE.IDLE) {
      S.start(sim);
      S.pause(sim);
      dom.btnRun.textContent = "Continuar";
    }

    // Un paso corto de tiempo simulado, con la simulación en pausa.
    const estaba = sim.running;
    sim.running = true;
    S.advance(sim, Math.max(0.1, sim.analysis.cycleMs / 60));
    sim.running = estaba;
    renderAll();
  }

  function tick(ahora) {
    const deltaReal = ultimoInstante ? Math.min(80, ahora - ultimoInstante) : 0;
    ultimoInstante = ahora;

    if (sim && (sim.running || sim.wire.length > 0)) {
      const escala = (sim.analysis.cycleMs / (SEGUNDOS_POR_CICLO * 1000)) * Number(dom.speed.value);
      S.advance(sim, deltaReal * escala);
      renderAll();
    }

    window.requestAnimationFrame(tick);
  }

  // ---------- Pintado ----------

  function renderAll() {
    if (!sim) return;
    drawDiagram();
    drawChain();
    renderState();
    renderTargets();
    renderInspector();
    renderTelemetry();
    renderLog();
  }

  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  function resizeCanvases() {
    for (const canvas of [dom.diagram, dom.chain]) {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (sim) {
      drawDiagram();
      drawChain();
    }
  }

  function colorPorEvento(e) {
    if (e.kind === "TIMEOUT" || e.kind === "TURN") return css("--wait");
    if (e.status === S.STATUS.DESTROYED || e.status === S.STATUS.CRC_FAIL || e.status === S.STATUS.DUPLICATE) {
      return css("--fault");
    }
    return e.kind === F.KIND.FRAME ? css("--data") : css("--ack");
  }

  function drawDiagram() {
    const ctx = dom.dctx;
    const w = dom.diagram.clientWidth;
    const h = dom.diagram.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--paper");
    ctx.fillRect(0, 0, w, h);

    const nodos = sim.nodeCount;
    const margenX = 58;
    const cabecera = 34;
    const anchoUtil = w - margenX * 2;
    const xDe = (i) => (nodos === 1 ? w / 2 : margenX + (anchoUtil * i) / (nodos - 1));

    // Ventana de tiempo visible, desplazada hacia atrás si el usuario ha
    // rodado el ratón sobre el diagrama.
    const ventanaMs = ventanaVisibleMs();
    const finVisible = Math.max(ventanaMs, sim.clockMs - retrocesoMs);
    const t0 = Math.max(0, finVisible - ventanaMs);
    const yDe = (t) => cabecera + ((t - t0) / ventanaMs) * (h - cabecera - 10);
    const tFin = t0 + ventanaMs;

    // Rejilla de tiempo, cada décima parte de la ventana.
    ctx.strokeStyle = css("--grid");
    ctx.lineWidth = 1;
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.fillStyle = css("--ink-soft");
    const paso = ventanaMs / 10;
    for (let k = 0; k <= 10; k++) {
      const t = t0 + paso * k;
      const y = Math.round(yDe(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(margenX - 40, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
      ctx.fillText(`${fmt(t)}`, 6, y - 3);
    }

    // Líneas verticales de cada punto del camino.
    ctx.strokeStyle = css("--rule");
    ctx.fillStyle = css("--ink");
    ctx.font = "12px ui-sans-serif, 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < nodos; i++) {
      const x = Math.round(xDe(i)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, cabecera - 12);
      ctx.lineTo(x, h - 6);
      ctx.stroke();
      ctx.fillText(nombreNodo(i), x, cabecera - 18);
    }
    ctx.textAlign = "left";

    // Flechas de los eventos.
    for (const e of sim.events) {
      if (e.tEnd < t0 || e.tStart > tFin) continue;
      const color = colorPorEvento(e);

      if (e.kind === "TURN") {
        // La inversión del medio ocupa tiempo pero no recorre distancia: se
        // dibuja como un tramo vertical grueso sobre la línea del punto.
        const x = Math.round(xDe(e.fromIdx)) + 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, yDe(e.tStart));
        ctx.lineTo(x, yDe(e.tEnd));
        ctx.stroke();
        ctx.lineWidth = 1;
        continue;
      }

      if (e.kind === "TIMEOUT") {
        const y = Math.round(yDe(e.tEnd)) + 0.5;
        ctx.strokeStyle = color;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(xDe(0) - 26, y);
        ctx.lineTo(xDe(0) + 26, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = "10px ui-monospace, Consolas, monospace";
        ctx.fillText("timeout", xDe(0) + 30, y + 3);
        continue;
      }

      const x1 = xDe(e.fromIdx);
      const y1 = yDe(e.tStart);
      const x2 = xDe(e.toIdx);
      const y2 = yDe(e.tEnd);
      const fx = x1 + (x2 - x1) * e.fraction;
      const fy = y1 + (y2 - y1) * e.fraction;

      ctx.strokeStyle = color;
      ctx.lineWidth = e.kind === F.KIND.FRAME ? 1.6 : 1.2;
      ctx.setLineDash(e.status === S.STATUS.OK ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.setLineDash([]);

      if (e.status === S.STATUS.OK) puntaDeFlecha(ctx, x1, y1, fx, fy, color);
      else aspa(ctx, fx, fy, color);

      // Etiqueta junto al comienzo del tramo, del lado en que viaja.
      ctx.fillStyle = color;
      ctx.font = "10px ui-monospace, Consolas, monospace";
      const dir = x2 >= x1 ? 1 : -1;
      ctx.textAlign = dir > 0 ? "left" : "right";
      ctx.fillText(e.label, x1 + dir * 6, y1 + 12);
      ctx.textAlign = "left";
    }

    if (retrocesoMs > 0) {
      const aviso = `histórico · ${fmt(sim.clockMs - retrocesoMs)} ms — doble clic para volver`;
      ctx.font = "11px ui-monospace, Consolas, monospace";
      const ancho = ctx.measureText(aviso).width + 14;
      ctx.fillStyle = css("--wait");
      ctx.fillRect(w - ancho - 10, 6, ancho, 20);
      ctx.fillStyle = css("--paper");
      ctx.textAlign = "center";
      ctx.fillText(aviso, w - ancho / 2 - 10, 20);
      ctx.textAlign = "left";
    }

    ctx.lineWidth = 1;
  }

  // Tres ciclos, o lo que haga falta para que quepa un timeout entero.
  function ventanaVisibleMs() {
    if (!sim) return 1;
    return Math.max(sim.analysis.cycleMs * 3, sim.timeoutMs * 2.4, 1);
  }

  function puntaDeFlecha(ctx, x1, y1, x2, y2, color) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const largo = 7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - largo * Math.cos(ang - 0.4), y2 - largo * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - largo * Math.cos(ang + 0.4), y2 - largo * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function aspa(ctx, x, y, color) {
    const r = 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawChain() {
    const ctx = dom.cctx;
    const w = dom.chain.clientWidth;
    const h = dom.chain.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--paper-sunk");
    ctx.fillRect(0, 0, w, h);

    const nodos = sim.nodeCount;
    const margen = 56;
    const y = Math.round(h / 2) + 0.5;
    const xDe = (i) => (nodos === 1 ? w / 2 : margen + ((w - margen * 2) * i) / (nodos - 1));

    // Tramos con sus datos.
    ctx.strokeStyle = css("--rule");
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < nodos - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(xDe(i), y);
      ctx.lineTo(xDe(i + 1), y);
      ctx.stroke();

      const link = sim.path.links[i];
      const medio = (xDe(i) + xDe(i + 1)) / 2;
      ctx.fillStyle = css("--ink-soft");
      ctx.fillText(`${fmt(link.distanceKm)} km`, medio, y - 12);
      ctx.fillText(`${fmtBps(link.rateBps)}`, medio, y + 20);
    }

    // Puntos del camino.
    for (let i = 0; i < nodos; i++) {
      const x = xDe(i);
      const lado = i === 0 || i === nodos - 1 ? 22 : 16;
      ctx.fillStyle = css("--paper");
      ctx.strokeStyle = css("--ink");
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.rect(x - lado / 2, y - lado / 2, lado, lado);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = css("--ink");
      ctx.font = "12px ui-sans-serif, 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(nombreNodo(i), x, y + lado / 2 + 16);
    }
    ctx.lineWidth = 1;

    // Paquetes en vuelo.
    for (const p of sim.wire) {
      const pos = S.positionOf(p);
      const x = xDe(Math.max(0, Math.min(nodos - 1, pos)));
      const esDatos = p.frame.kind === F.KIND.FRAME;
      const sano = F.isIntact(p.frame);
      const color = !sano ? css("--fault") : esDatos ? css("--data") : css("--ack");

      const ancho = 34;
      const alto = 16;
      ctx.fillStyle = color;
      ctx.fillRect(x - ancho / 2, y - alto / 2 - 26, ancho, alto);

      ctx.fillStyle = css("--paper");
      ctx.font = "10px ui-monospace, Consolas, monospace";
      ctx.fillText(F.label(p.frame), x, y - 26 + 3);

      // Guion hasta la línea del camino, para no perder de vista dónde va.
      ctx.strokeStyle = color;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.textAlign = "left";
  }

  // ---------- Paneles ----------

  const NOMBRE_ESTADO = {
    IDLE: ["Inactivo", ""],
    TRANSMITTING: ["Transmitiendo", "data"],
    WAITING_ACK: ["Esperando ACK", "wait"],
    TIMEOUT: ["Timeout", "fault"],
    FINISHED: ["Completado", "data"],
  };

  function renderState() {
    const [texto, tono] = NOMBRE_ESTADO[sim.state] || ["—", ""];
    dom.stateName.textContent = texto;
    dom.stateName.dataset.tone = tono;
    dom.clock.textContent = `${fmt(sim.clockMs)} ms`;

    const restante = sim.timerActive ? sim.timerRemainingMs / sim.timeoutMs : 0;
    dom.timerFill.style.width = `${Math.max(0, Math.min(1, restante)) * 100}%`;

    // Solo estorba cuando la simulación va sola o ya terminó.
    dom.btnStep.disabled = sim.running || sim.state === S.STATE.FINISHED;
    dom.btnRun.disabled = sim.state === S.STATE.FINISHED;
  }

  function renderTargets() {
    dom.targets.innerHTML = "";
    sim.wire.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "target";
      b.textContent = F.label(p.frame);
      b.setAttribute("aria-pressed", String(i === selectedIndex));
      b.addEventListener("click", () => {
        selectedIndex = i;
        renderInspector();
        renderTargets();
      });
      dom.targets.appendChild(b);
    });
  }

  function paqueteSeleccionado() {
    return sim.wire[selectedIndex] || sim.wire[0] || null;
  }

  function renderInspector() {
    const p = paqueteSeleccionado();
    const hay = Boolean(p);
    dom.inspectorEmpty.hidden = hay;
    dom.inspectorBody.hidden = !hay;
    if (!hay) {
      // Sin esto, los datos de la última trama se quedaban en pantalla y
      // parecían los de una trama que ya no existe.
      dom.inspKind.textContent = "—";
      dom.inspSeq.textContent = "—";
      dom.inspHop.textContent = "—";
      dom.inspCrc.textContent = "—";
      delete dom.inspCrc.dataset.ok;
      dom.bits.innerHTML = "";
      dom.crcSteps.innerHTML = "";
      return;
    }

    const sano = F.isIntact(p.frame);
    dom.inspKind.textContent = p.frame.kind;
    dom.inspSeq.textContent = String(p.frame.seq);
    dom.inspHop.textContent = `${nombreNodo(p.fromIdx)} → ${nombreNodo(p.toIdx)}`;
    dom.inspCrc.textContent = sano ? "cuadra" : "no cuadra";
    dom.inspCrc.dataset.ok = String(sano);

    const bits = F.toBitString(p.frame);
    const inicioCrc = bits.length - F.CRC_BITS;
    dom.bits.innerHTML = "";

    for (let i = 0; i < bits.length; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bit";
      b.textContent = bits[i];
      b.dataset.part = i >= inicioCrc ? "crc" : "payload";
      b.dataset.flipped = String(p.frame.flippedBits.includes(i));
      b.title = `Bit ${i}${i >= inicioCrc ? " (CRC)" : ""}`;
      b.addEventListener("click", () => {
        S.flipBitOf(sim, p, i);
        renderAll();
      });
      dom.bits.appendChild(b);
    }

    if (!dom.crcSteps.hidden) renderCrcSteps();
  }

  const SALTO = String.fromCharCode(10); // salto de línea, para el detalle del CRC

  // Enseña cómo se llega al CRC: registro inicial, un paso por byte, y el
  // detalle de los ocho desplazamientos del byte que se despliegue.
  function renderCrcSteps() {
    const p = paqueteSeleccionado();
    dom.crcSteps.innerHTML = "";
    if (!p || dom.crcSteps.hidden) return;

    const traza = F.crc16Trace(p.frame.payload);
    const hex = (v) => v.toString(16).toUpperCase().padStart(4, "0");
    const bin = (v, n) => v.toString(2).padStart(n, "0");

    const cabecera = document.createElement("p");
    cabecera.className = "hint";
    cabecera.innerHTML =
      `Polinomio <strong>${traza.polinomio}</strong>. El registro empieza en ` +
      `<code>0x${hex(traza.inicial)}</code> y se procesa un byte de la carga cada vez: ` +
      `se hace XOR del byte contra la parte alta y se desplaza ocho veces, aplicando el ` +
      `polinomio cada vez que sale un uno por la izquierda.`;
    dom.crcSteps.appendChild(cabecera);

    const tabla = document.createElement("table");
    tabla.className = "crc-table";
    tabla.innerHTML =
      "<thead><tr><th scope=\"col\">Byte</th><th scope=\"col\">Valor</th>" +
      "<th scope=\"col\">Registro antes</th><th scope=\"col\">Después</th></tr></thead>";

    const cuerpo = document.createElement("tbody");
    traza.pasos.forEach((paso) => {
      const fila = document.createElement("tr");
      fila.className = "crc-row";
      fila.tabIndex = 0;
      fila.innerHTML =
        `<td class="num">${paso.indice}</td>` +
        `<td class="num">0x${paso.byte.toString(16).toUpperCase().padStart(2, "0")}</td>` +
        `<td class="num">0x${hex(paso.antes)}</td>` +
        `<td class="num">0x${hex(paso.despues)}</td>`;

      const abrir = () => {
        byteAbierto = byteAbierto === paso.indice ? null : paso.indice;
        renderCrcSteps();
      };
      fila.addEventListener("click", abrir);
      fila.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      });
      cuerpo.appendChild(fila);

      if (byteAbierto === paso.indice) {
        const detalle = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 4;
        celda.className = "crc-detail";

        const lineas = [
          `XOR del byte contra la parte alta → 0x${hex(paso.trasXor)}`,
          ...paso.bits.map(
            (b) =>
              `desplazamiento ${b.bit + 1}: ${bin(b.antes, 16)} · ${b.msb ? "sale un 1 → XOR con el polinomio" : "sale un 0 → solo desplaza"} → ${bin(b.despues, 16)}`
          ),
        ];
        celda.textContent = lineas.join(SALTO);
        detalle.appendChild(celda);
        cuerpo.appendChild(detalle);
      }
    });

    tabla.appendChild(cuerpo);
    dom.crcSteps.appendChild(tabla);

    const sano = F.isIntact(p.frame);
    const veredicto = document.createElement("p");
    veredicto.className = "crc-verdict";
    veredicto.dataset.ok = String(sano);
    veredicto.textContent = sano
      ? `El receptor calcula 0x${hex(traza.final)} y la trama trae 0x${hex(p.frame.crc)}: coinciden, la acepta.`
      : `El receptor calcula 0x${hex(traza.final)} pero la trama trae 0x${hex(p.frame.crc)}: no coinciden, la descarta.`;
    dom.crcSteps.appendChild(veredicto);
  }

  function actOnSelected(accion) {
    const p = paqueteSeleccionado();
    if (!p) return;
    accion(p);
    selectedIndex = 0;
    renderAll();
  }

  function renderTelemetry() {
    const s = sim.stats;
    dom.tel.delivered.textContent = `${sim.rxDelivered} / ${sim.totalFrames}`;
    dom.tel.sent.textContent = String(s.framesSent);
    dom.tel.retrans.textContent = String(s.retransmissions);
    dom.tel.acks.textContent = String(s.acksReceived);
    dom.tel.naks.textContent = String(s.naksReceived);
    dom.tel.crc.textContent = String(s.crcFailures);
    dom.tel.dups.textContent = String(s.duplicatesDiscarded);
    dom.tel.late.textContent = String(s.lateAcks);
    dom.tel.destroyed.textContent = String(s.framesDestroyed + s.acksDestroyed);
    dom.tel.u.textContent = `${(sim.analysis.utilization * 100).toFixed(2)} %`;
    dom.tel.rtt.textContent = `${fmt(sim.analysis.rttMs)} ms`;
  }

  function renderLog() {
    dom.log.innerHTML = "";
    for (const entrada of sim.log.slice(-40).reverse()) {
      const li = document.createElement("li");
      li.dataset.kind = entrada.kind;
      const t = document.createElement("time");
      t.textContent = `${fmt(entrada.tMs)} ms`;
      const s = document.createElement("span");
      s.textContent = entrada.message;
      li.appendChild(t);
      li.appendChild(s);
      dom.log.appendChild(li);
    }
  }

  // ---------- Utilidades ----------

  function fmt(n) {
    if (!Number.isFinite(n)) return "—";
    if (n >= 1000) return n.toFixed(0);
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
  }

  function fmtBps(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} kbps`;
    return `${bps} bps`;
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
    if (sim) renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
