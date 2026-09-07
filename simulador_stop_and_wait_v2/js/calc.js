// calc.js
// Interfaz de la calculadora. Lee los controles, pide el cálculo a
// NetworkModel y pinta el resultado. Aquí no se calcula ninguna fórmula:
// el dueño de las fórmulas es js/network.js.

(function () {
  "use strict";

  const N = window.NetworkModel;

  // Presets: casos con número publicado, los mismos que cubren las pruebas.
  const PRESETS = {
    satelite: {
      frameBits: 1000,
      ackBits: 0,
      duplexMode: "full",
      processingMs: 0,
      links: [
        { name: "Enlace satelital", rateBps: 50000, distanceKm: 50000, velocityKmS: 200000, errorProbData: 0, errorProbAck: 0, turnaroundMs: 0 },
      ],
    },
    lan: {
      frameBits: 500,
      ackBits: 0,
      duplexMode: "full",
      processingMs: 0,
      links: [
        { name: "LAN", rateBps: 10000000, distanceKm: 1, velocityKmS: 200000, errorProbData: 0, errorProbAck: 0, turnaroundMs: 0 },
      ],
    },
    "casa-satelite-casa": {
      frameBits: 1000,
      ackBits: 0,
      duplexMode: "full",
      processingMs: 1,
      links: [
        { name: "Casa A → Satélite", rateBps: 1000000, distanceKm: 35786, velocityKmS: 300000, errorProbData: 0, errorProbAck: 0, turnaroundMs: 0 },
        { name: "Satélite → Casa B", rateBps: 500000, distanceKm: 35786, velocityKmS: 300000, errorProbData: 0, errorProbAck: 0, turnaroundMs: 0 },
      ],
    },
  };

  const LINK_FIELDS = [
    { key: "name", label: "Nombre", type: "text" },
    { key: "rateBps", label: "Tasa R (bits/s)", type: "number", min: 1, step: 1 },
    { key: "distanceKm", label: "Distancia d (km)", type: "number", min: 0, step: 0.001 },
    { key: "velocityKmS", label: "Velocidad V (km/s)", type: "number", min: 1, step: 1 },
    { key: "errorProbData", label: "P error trama (0–1)", type: "number", min: 0, max: 1, step: 0.01 },
    { key: "errorProbAck", label: "P error ACK (0–1)", type: "number", min: 0, max: 1, step: 0.01 },
    { key: "turnaroundMs", label: "Tiempo de vuelta (ms)", type: "number", min: 0, step: 1 },
  ];

  const dom = {};
  let linkRows = [];

  function cacheDom() {
    dom.frameBits = document.getElementById("frame-bits");
    dom.ackBits = document.getElementById("ack-bits");
    dom.duplexMode = document.getElementById("duplex-mode");
    dom.processingMs = document.getElementById("processing-ms");
    dom.linksContainer = document.getElementById("links-container");
    dom.btnAddLink = document.getElementById("btn-add-link");
    dom.errorBox = document.getElementById("error-box");
    dom.themeSwitch = document.getElementById("theme-switch");
    dom.utilBarBusy = document.getElementById("util-bar-busy");
    dom.steps = document.getElementById("steps");

    dom.out = {
      u: document.getElementById("out-u"),
      uEff: document.getElementById("out-u-eff"),
      idle: document.getElementById("out-idle"),
      throughput: document.getElementById("out-throughput"),
      ttSender: document.getElementById("out-tt-sender"),
      ttTotal: document.getElementById("out-tt-total"),
      tpTotal: document.getElementById("out-tp-total"),
      a: document.getElementById("out-a"),
      rtt: document.getElementById("out-rtt"),
      turnaround: document.getElementById("out-turnaround"),
      cycle: document.getElementById("out-cycle"),
      timeout: document.getElementById("out-timeout"),
      perr: document.getElementById("out-perr"),
      attempts: document.getElementById("out-attempts"),
      bdp: document.getElementById("out-bdp"),
    };
  }

  // ---------- Formato ----------

  function formatMs(ms) {
    if (!Number.isFinite(ms)) return "—";
    if (ms === 0) return "0 ms";
    if (ms < 1) return `${(ms * 1000).toFixed(3)} µs`;
    if (ms < 1000) return `${ms.toFixed(3)} ms`;
    return `${(ms / 1000).toFixed(4)} s`;
  }

  function formatBps(bps) {
    if (!Number.isFinite(bps)) return "—";
    if (bps >= 1e9) return `${(bps / 1e9).toFixed(3)} Gbps`;
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(3)} Mbps`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(3)} kbps`;
    return `${bps.toFixed(1)} bps`;
  }

  function formatPercent(fraction) {
    if (!Number.isFinite(fraction)) return "—";
    const pct = fraction * 100;
    return pct < 0.01 && pct > 0 ? `${pct.toExponential(2)} %` : `${pct.toFixed(2)} %`;
  }

  // ---------- Filas de enlace ----------

  function linkRowTemplate(values, index) {
    const row = document.createElement("div");
    row.className = "link-row";

    const head = document.createElement("div");
    head.className = "link-row-head";
    head.innerHTML = `<span class="link-index">Salto ${index + 1}</span>`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-ghost btn-small";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => {
      if (linkRows.length <= 1) {
        showError("Hace falta al menos un enlace.");
        return;
      }
      linkRows = linkRows.filter((r) => r.element !== row);
      renderLinks(collectLinkValues());
      recalculate();
    });
    head.appendChild(remove);
    row.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "link-fields";

    const inputs = {};
    for (const field of LINK_FIELDS) {
      const label = document.createElement("label");
      label.textContent = field.label;

      const input = document.createElement("input");
      input.type = field.type;
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      input.value = values[field.key] === undefined ? "" : String(values[field.key]);
      input.addEventListener("input", recalculate);

      const wrap = document.createElement("div");
      wrap.className = "link-field";
      wrap.appendChild(label);
      wrap.appendChild(input);
      grid.appendChild(wrap);

      inputs[field.key] = input;
    }

    row.appendChild(grid);
    return { element: row, inputs };
  }

  function renderLinks(values) {
    dom.linksContainer.innerHTML = "";
    linkRows = values.map((v, i) => {
      const row = linkRowTemplate(v, i);
      dom.linksContainer.appendChild(row.element);
      return row;
    });
  }

  function collectLinkValues() {
    return linkRows.map((row) => {
      const out = {};
      for (const field of LINK_FIELDS) {
        const raw = row.inputs[field.key].value;
        out[field.key] = field.type === "number" ? Number(raw) : raw;
      }
      return out;
    });
  }

  // ---------- Cálculo ----------

  function showError(message) {
    dom.errorBox.hidden = false;
    dom.errorBox.textContent = message;
  }

  function clearError() {
    dom.errorBox.hidden = true;
    dom.errorBox.textContent = "";
  }

  function buildPath() {
    const links = collectLinkValues().map((v, i) =>
      N.createLink({
        name: v.name || `Salto ${i + 1}`,
        rateBps: v.rateBps,
        distanceKm: v.distanceKm,
        velocityKmS: v.velocityKmS,
        errorProbData: v.errorProbData,
        errorProbAck: v.errorProbAck,
        turnaroundMs: v.turnaroundMs,
      })
    );

    return N.createPath({
      frameBits: Number(dom.frameBits.value),
      ackBits: Number(dom.ackBits.value),
      duplexMode: dom.duplexMode.value,
      processingMsPerHop: Number(dom.processingMs.value),
      links,
    });
  }

  function recalculate() {
    let result;
    try {
      result = N.analyze(buildPath());
    } catch (err) {
      showError(err.message);
      return;
    }
    clearError();
    render(result);
  }

  function render(r) {
    dom.out.u.textContent = formatPercent(r.utilization);
    dom.out.uEff.textContent = formatPercent(r.effectiveUtilization);
    dom.out.idle.textContent = formatPercent(r.idleFraction);
    dom.out.throughput.textContent = formatBps(r.throughputBps);

    dom.out.ttSender.textContent = formatMs(r.senderTtMs);
    dom.out.ttTotal.textContent = formatMs(r.ttDataTotalMs);
    dom.out.tpTotal.textContent = formatMs(r.tpTotalMs);
    dom.out.a.textContent = Number.isFinite(r.aRatio) ? r.aRatio.toFixed(4) : "∞";
    dom.out.rtt.textContent = formatMs(r.rttMs);
    dom.out.turnaround.textContent = formatMs(r.turnaroundTotalMs);
    dom.out.cycle.textContent = formatMs(r.cycleMs);
    dom.out.timeout.textContent = formatMs(r.minimumTimeoutMs);
    dom.out.perr.textContent = formatPercent(r.cycleErrorProb);
    dom.out.attempts.textContent = Number.isFinite(r.expectedTransmissions)
      ? r.expectedTransmissions.toFixed(3)
      : "∞";
    dom.out.bdp.textContent = `${Math.round(r.bandwidthDelayProductBits)} bits · ${(r.bandwidthDelayProductBits / r.frameBits).toFixed(2)} tramas`;

    const busy = Math.max(0, Math.min(100, r.utilization * 100));
    dom.utilBarBusy.style.width = `${busy}%`;

    dom.steps.textContent = buildSteps(r);
  }

  // Escribe el desarrollo con los mismos números que muestran las casillas.
  function buildSteps(r) {
    const lines = [];
    lines.push(`Datos: L = ${r.frameBits} bits · ACK = ${r.ackBits} bits · ${r.hops} salto(s) · canal ${r.duplexMode === "half" ? "half duplex" : "full duplex"}`);
    lines.push("");

    r.perLink.forEach((l, i) => {
      lines.push(`Salto ${i + 1} — ${l.name}`);
      lines.push(`  Tt = L / R = ${r.frameBits} / ${l.rateBps} = ${formatMs(l.ttDataMs)}`);
      lines.push(`  Tp = d / V = ${l.distanceKm} / ${l.velocityKmS} = ${formatMs(l.tpMs)}`);
      if (l.ttAckMs > 0) lines.push(`  Tt(ACK) = ${r.ackBits} / ${l.rateBps} = ${formatMs(l.ttAckMs)}`);
      if (l.errorProbData > 0 || l.errorProbAck > 0) {
        lines.push(`  P(trama) = ${l.errorProbData} · P(ACK) = ${l.errorProbAck}`);
      }
      lines.push("");
    });

    lines.push(`Tt total = ${formatMs(r.ttDataTotalMs)}   (store-and-forward: cada nodo retransmite la trama entera)`);
    lines.push(`Tp total = ${formatMs(r.tpTotalMs)}`);
    if (r.processingMs > 0) lines.push(`Procesamiento en nodos intermedios = ${formatMs(r.processingMs)} por sentido`);
    lines.push(`a = Tp / Tt = ${formatMs(r.tpTotalMs)} / ${formatMs(r.ttDataTotalMs)} = ${Number.isFinite(r.aRatio) ? r.aRatio.toFixed(4) : "∞"}`);
    lines.push("");

    lines.push(`Ida    = Tt total + Tp total${r.processingMs > 0 ? " + procesamiento" : ""} = ${formatMs(r.forwardMs)}`);
    lines.push(`Vuelta = ${formatMs(r.ackReturnMs)}`);
    lines.push(`RTT    = ida + vuelta = ${formatMs(r.rttMs)}`);
    if (r.turnaroundTotalMs > 0) {
      lines.push(`Half duplex: + ${formatMs(r.turnaroundTotalMs)} de vuelta del medio (2 inversiones por ciclo)`);
    }
    lines.push(`Ciclo  = ${formatMs(r.cycleMs)}`);
    lines.push("");

    lines.push(`U = Tt(emisor) / ciclo = ${formatMs(r.senderTtMs)} / ${formatMs(r.cycleMs)} = ${formatPercent(r.utilization)}`);
    if (r.hops === 1 && r.ackBits === 0 && r.turnaroundTotalMs === 0) {
      lines.push(`  comprobación: 1 / (1 + 2a) = ${formatPercent(1 / (1 + 2 * r.aRatio))}`);
    }
    lines.push(`Canal ocioso = ${formatPercent(r.idleFraction)}`);
    lines.push("");

    if (r.cycleErrorProb > 0) {
      lines.push(`P(fallo del ciclo) = 1 − Π(1−Pi) = ${formatPercent(r.cycleErrorProb)}`);
      lines.push(`U efectiva = U · (1 − P) = ${formatPercent(r.effectiveUtilization)}`);
      lines.push(`Transmisiones esperadas por trama = 1 / (1 − P) = ${r.expectedTransmissions.toFixed(3)}`);
    } else {
      lines.push("Sin errores declarados: U efectiva = U.");
    }
    lines.push(`Caudal útil = ${formatBps(r.throughputBps)}`);
    lines.push(`BDP = R(emisor) × RTT = ${Math.round(r.bandwidthDelayProductBits)} bits = ${(r.bandwidthDelayProductBits / r.frameBits).toFixed(2)} tramas en el canal`);
    lines.push("");
    lines.push(`Timeout mínimo razonable = RTT = ${formatMs(r.minimumTimeoutMs)}. Por debajo, el emisor retransmite tramas cuyo ACK todavía viene en camino.`);

    return lines.join("\n");
  }

  // ---------- Presets y tema ----------

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    dom.frameBits.value = String(preset.frameBits);
    dom.ackBits.value = String(preset.ackBits);
    dom.duplexMode.value = preset.duplexMode;
    dom.processingMs.value = String(preset.processingMs);
    renderLinks(preset.links.map((l) => ({ ...l })));
    recalculate();
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("saw2-theme"); } catch (e) { /* almacenamiento no disponible */ }
    setTheme(saved === "light" ? "light" : "dark", false);
  }

  function setTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    dom.themeSwitch.checked = theme === "dark";
    if (persist) {
      try { localStorage.setItem("saw2-theme", theme); } catch (e) { /* almacenamiento no disponible */ }
    }
  }

  function bindEvents() {
    [dom.frameBits, dom.ackBits, dom.processingMs].forEach((el) =>
      el.addEventListener("input", recalculate)
    );
    dom.duplexMode.addEventListener("change", recalculate);

    dom.btnAddLink.addEventListener("click", () => {
      const values = collectLinkValues();
      const last = values[values.length - 1];
      values.push({
        name: `Salto ${values.length + 1}`,
        rateBps: last ? last.rateBps : 1000000,
        distanceKm: last ? last.distanceKm : 100,
        velocityKmS: last ? last.velocityKmS : 200000,
        errorProbData: 0,
        errorProbAck: 0,
        turnaroundMs: 0,
      });
      renderLinks(values);
      recalculate();
    });

    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
    });

    dom.themeSwitch.addEventListener("change", () => {
      setTheme(dom.themeSwitch.checked ? "dark" : "light", true);
    });
  }

  function init() {
    cacheDom();
    initTheme();
    bindEvents();
    applyPreset("satelite");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
