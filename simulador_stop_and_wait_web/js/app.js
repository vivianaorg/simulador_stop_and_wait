// app.js
// Interfaz gráfica y animación del simulador (puerto de gui.py) usando Canvas 2D.

(() => {
  "use strict";

  const COLORS = {
    framePkt: "#f59e0b",
    ackPkt: "#10b981",
  };

  // Paletas del canvas por tema (deben reflejar las variables CSS de style.css)
  const PALETTES = {
    dark: {
      channelBorder: "#1b2740",
      channelLine: "rgba(148, 163, 184, 0.55)",
      nodeFillTop: "#1c2740",
      nodeFillBottom: "#111a2c",
      textMain: "#e8ecf3",
      textMuted: "#8993a8",
      accentTx: "#5b8def",
      accentRx: "#2dd4a7",
      tubeStart: "rgba(91, 141, 239, 0.22)",
      tubeEnd: "rgba(45, 212, 167, 0.22)",
      tubeBorder: "rgba(148, 163, 184, 0.18)",
      glowCenter: "rgba(91, 141, 239, 0.10)",
      shadowColor: "rgba(0, 0, 0, 0.45)",
    },
    light: {
      channelBorder: "#dde3ee",
      channelLine: "rgba(91, 101, 118, 0.45)",
      nodeFillTop: "#ffffff",
      nodeFillBottom: "#f2f5fa",
      textMain: "#16202f",
      textMuted: "#5b6576",
      accentTx: "#3760c9",
      accentRx: "#0d8f63",
      tubeStart: "rgba(55, 96, 201, 0.10)",
      tubeEnd: "rgba(13, 143, 99, 0.10)",
      tubeBorder: "rgba(91, 101, 118, 0.14)",
      glowCenter: "rgba(55, 96, 201, 0.06)",
      shadowColor: "rgba(30, 41, 59, 0.16)",
    },
  };

  // Icono por tipo de toast/alerta
  const KIND_ICON = {
    INFO: "icon-info",
    SUCCESS: "icon-check-circle",
    WARNING: "icon-alert-triangle",
    DANGER: "icon-alert-octagon",
  };

  // ---------- Sistema de partículas (chispas al destruir tramas/ACKs) ----------
  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    explode(x, y, color = "#ef4444") {
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 5.5;
        this.particles.push({
          x, y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.04 + Math.random() * 0.04,
          radius: 2 + Math.random() * 3,
          color,
        });
      }
    }

    update() {
      this.particles = this.particles.filter((p) => {
        p.x += p.dx;
        p.y += p.dy;
        p.life -= p.decay;
        return p.life > 0;
      });
    }

    draw(ctx) {
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }
  }

  // ---------- Aplicación principal ----------
  class SimulatorApp {
    constructor() {
      this.protocol = new StopAndWaitProtocol();
      this.particles = new ParticleSystem();
      this.timerId = null;
      // Muestra brevemente "Timer Reiniciado" en el intervalo entre el ACK
      // recibido con éxito y el envío de la siguiente trama.
      this.timerJustReset = false;
      // Fase del "flujo" animado que recorre el tubo del canal (puramente
      // decorativo, para que el canal se sienta vivo incluso en reposo).
      this.flowPhase = 0;

      // Cola de alertas modales pendientes de confirmación explícita del usuario.
      this.alertQueue = [];
      this.alertShowing = false;

      // Layout del canal (coordenadas en píxeles CSS)
      this.txX1 = 40;
      this.txX2 = 180;
      this.txY1 = 35;
      this.txY2 = 185;
      this.rxX1 = 540;
      this.rxX2 = 680;
      this.rxY1 = 35;
      this.rxY2 = 185;
      this.lineY = 110;
      this.canvasWidth = 720;
      this.canvasHeight = 240;

      this._cacheDom();
      this._bindEvents();
      this._setupCanvasResize();
      this._initTheme();
      this._updateLinkDisplay();

      this.updateTelemetry();
      this._updateActionButtons();
      this._updateWarningBanner();

      // Bucle de animación continuo (equivalente a root.after(30, animate))
      setInterval(() => this._animate(), 30);
    }

    _cacheDom() {
      this.canvas = document.getElementById("sim-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.canvasWrap = document.getElementById("canvas-wrap");
      this.toastContainer = document.getElementById("toast-container");

      this.statusBadge = document.getElementById("status-badge");
      this.statusBadgeText = document.getElementById("status-badge-text");
      this.statusDot = this.statusBadge.querySelector(".status-dot");
      this.framesInput = document.getElementById("frames-input");
      this.timeoutInput = document.getElementById("timeout-input");
      this.speedRange = document.getElementById("speed-range");
      this.speedLabel = document.getElementById("speed-label");

      this.btnStart = document.getElementById("btn-start");
      this.btnPause = document.getElementById("btn-pause");
      this.btnReset = document.getElementById("btn-reset");
      this.btnKillFrame = document.getElementById("btn-kill-frame");
      this.btnKillAck = document.getElementById("btn-kill-ack");
      this.btnDelayAck = document.getElementById("btn-delay-ack");

      this.themeSwitch = document.getElementById("theme-switch");
      this.warningBanner = document.getElementById("warning-banner");
      this.warningBannerText = document.getElementById("warning-banner-text");

      this.alertOverlay = document.getElementById("alert-overlay");
      this.alertIconWrap = document.getElementById("alert-icon-wrap");
      this.alertIconUse = document.getElementById("alert-icon-use");
      this.alertTitle = document.getElementById("alert-title");
      this.alertMessage = document.getElementById("alert-message");
      this.alertDismissBtn = document.getElementById("alert-dismiss");
      this.alertQueueBadge = document.getElementById("alert-queue-badge");

      this.linkLengthInput = document.getElementById("link-length");
      this.linkRateInput = document.getElementById("link-rate");
      this.linkDistanceInput = document.getElementById("link-distance");
      this.linkVelocityInput = document.getElementById("link-velocity");
      this.linkEls = {
        tt: document.getElementById("link-tt"),
        tp: document.getElementById("link-tp"),
        a: document.getElementById("link-a"),
        u: document.getElementById("link-u"),
        idle: document.getElementById("link-idle"),
      };
      this.utilBarBusy = document.getElementById("util-bar-busy");
      this.utilBarIdle = document.getElementById("util-bar-idle");
      this.utilValueBusy = document.getElementById("util-value-busy");
      this.utilValueIdle = document.getElementById("util-value-idle");

      this.pipeContainer = document.getElementById("pipe-container");

      this.statEls = {
        sent: document.getElementById("stat-sent"),
        acks: document.getElementById("stat-acks"),
        lost: document.getElementById("stat-lost"),
        retrans: document.getElementById("stat-retrans"),
        lateAcks: document.getElementById("stat-late-acks"),
        eff: document.getElementById("stat-eff"),
        time: document.getElementById("stat-time"),
      };
    }

    _bindEvents() {
      this.btnStart.addEventListener("click", () => this.startSimulation());
      this.btnPause.addEventListener("click", () => this.pauseSimulation());
      this.btnReset.addEventListener("click", () => this.resetSimulation());
      this.btnKillFrame.addEventListener("click", () => this.killFrame());
      this.btnKillAck.addEventListener("click", () => this.killAck());
      this.btnDelayAck.addEventListener("click", () => this.delayAck());
      this.speedRange.addEventListener("input", () => this._onSpeedChange());
      this.themeSwitch.addEventListener("change", () => this._toggleTheme());
      this.alertDismissBtn.addEventListener("click", () => this._dismissAlert());

      this.linkLengthInput.addEventListener("input", () => this._onLinkParamsChange());
      this.linkRateInput.addEventListener("input", () => this._onLinkParamsChange());
      this.linkDistanceInput.addEventListener("input", () => this._onLinkParamsChange());
      this.linkVelocityInput.addEventListener("input", () => this._onLinkParamsChange());
    }

    // ---------- Parámetros del enlace y fórmula de eficiencia ----------
    _onLinkParamsChange() {
      const p = this.protocol;
      const length = this.linkLengthInput.valueAsNumber;
      const rate = this.linkRateInput.valueAsNumber;
      const distance = this.linkDistanceInput.valueAsNumber;
      const velocity = this.linkVelocityInput.valueAsNumber;

      if (Number.isFinite(length) && length > 0) p.linkFrameBits = length;
      if (Number.isFinite(rate) && rate > 0) p.linkRateBps = rate;
      if (Number.isFinite(distance) && distance >= 0) p.linkDistanceKm = distance;
      if (Number.isFinite(velocity) && velocity > 0) p.linkVelocityKmS = velocity;

      this._updateLinkDisplay();
    }

    _formatMs(ms) {
      if (!Number.isFinite(ms)) return "—";
      if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
      if (ms < 1000) return `${ms.toFixed(3)} ms`;
      return `${(ms / 1000).toFixed(3)} s`;
    }

    _updateLinkDisplay() {
      const p = this.protocol;
      const tt = p.transmissionTimeMs;
      const tp = p.propagationTimeMs;
      const a = p.aRatio;
      const u = p.utilization;
      const idle = p.idlePercent;

      this.linkEls.tt.textContent = this._formatMs(tt);
      this.linkEls.tp.textContent = this._formatMs(tp);
      this.linkEls.a.textContent = Number.isFinite(a) ? a.toFixed(3) : "∞";
      this.linkEls.u.textContent = `${(u * 100).toFixed(1)}%`;
      this.linkEls.idle.textContent = `${idle.toFixed(1)}%`;

      const busyPct = Math.max(0, Math.min(100, u * 100));
      const idlePct = 100 - busyPct;
      this.utilBarBusy.style.height = `${busyPct}%`;
      this.utilBarIdle.style.height = `${idlePct}%`;
      this.utilValueBusy.textContent = `${busyPct.toFixed(1)}%`;
      this.utilValueIdle.textContent = `${idlePct.toFixed(1)}%`;
    }

    // Reparte un presupuesto visual fijo (independiente de la magnitud real de
    // Tt/Tp, que puede ir de microsegundos a segundos) en la MISMA proporción
    // que la utilización teórica: así la animación siempre es observable, pero
    // el reparto "ocupado vs. ocioso" en pantalla refleja el valor real de U.
    _visualDurations() {
      const TOTAL_MS = 3900;
      const MIN_FORM_MS = 120;
      const MIN_FLIGHT_MS = 500;

      const u = this.protocol.utilization;
      const formMs = Math.max(MIN_FORM_MS, Math.round(TOTAL_MS * u));
      const flightMsOneWay = Math.max(MIN_FLIGHT_MS, Math.round((TOTAL_MS * (1 - u)) / 2));
      return { formMs, flightMsOneWay };
    }

    // ---------- Tema claro/oscuro ----------
    _initTheme() {
      let saved = null;
      try { saved = localStorage.getItem("saw-theme"); } catch (e) { /* almacenamiento no disponible */ }
      this._setTheme(saved === "light" ? "light" : "dark", false);
    }

    _currentTheme() {
      return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    }

    _setTheme(theme, persist = true) {
      document.documentElement.setAttribute("data-theme", theme);
      this.themeSwitch.checked = theme === "dark";
      if (persist) {
        try { localStorage.setItem("saw-theme", theme); } catch (e) { /* almacenamiento no disponible */ }
      }
      this._draw();
    }

    _toggleTheme() {
      this._setTheme(this.themeSwitch.checked ? "dark" : "light");
    }

    _setupCanvasResize() {
      const resize = () => {
        const rect = this.canvasWrap.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvasWidth = Math.max(320, Math.round(rect.width));
        this.canvasHeight = Math.max(160, Math.round(rect.height));

        this.canvas.width = this.canvasWidth * dpr;
        this.canvas.height = this.canvasHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Recalcular posiciones responsivas de Emisor, Receptor y Canal
        this.txX1 = 40;
        this.txX2 = 180;
        this.rxX2 = Math.max(360, this.canvasWidth - 40);
        this.rxX1 = this.rxX2 - 140;
        this.lineY = Math.round(this.canvasHeight / 2);
        this.txY1 = Math.max(10, this.lineY - 75);
        this.txY2 = this.lineY + 75;
        this.rxY1 = this.txY1;
        this.rxY2 = this.txY2;

        // Si hay un paquete activo, actualizar su destino y limitar posición
        const pkt = this.protocol.activePacket;
        if (pkt) {
          if (pkt.type === "FRAME") {
            pkt.targetX = this.rxX1;
            if (pkt.x > this.rxX1) pkt.x = this.rxX1;
          } else if (pkt.type === "ACK") {
            pkt.targetX = this.txX2;
            if (pkt.x < this.txX2) pkt.x = this.txX2;
          }
          pkt.y = this.lineY;
        }

        const dp = this.protocol.delayedPacket;
        if (dp) {
          if (dp.x < this.txX2) dp.x = this.txX2;
          dp.y = this.lineY + 34;
        }
      };

      new ResizeObserver(resize).observe(this.canvasWrap);
      resize();
    }

    // ---------- Notificaciones ----------
    // Toast: aviso liviano y no bloqueante para eventos de flujo normal (info/éxito).
    _toast(message, type = "INFO") {
      const el = document.createElement("div");
      el.className = `toast toast-${type}`;
      const iconId = KIND_ICON[type] || KIND_ICON.INFO;
      el.innerHTML = `<svg class="icon"><use href="#${iconId}"></use></svg><span></span>`;
      el.querySelector("span").textContent = message;
      this.toastContainer.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 250);
      }, 3200);
    }

    // Alerta modal: para eventos de red relevantes (pérdidas, timeouts,
    // duplicados, desincronización) que el usuario debe leer y confirmar
    // explícitamente en lugar de que desaparezcan solos.
    _alert(title, message, kind = "warning") {
      this.alertQueue.push({ title, message, kind });
      if (!this.alertShowing) this._showNextAlert();
      else this._updateAlertQueueBadge();
    }

    _showNextAlert() {
      const next = this.alertQueue.shift();
      if (!next) {
        this.alertShowing = false;
        return;
      }
      this.alertShowing = true;
      // Congela la simulación mientras la alerta está en pantalla: así los
      // eventos no se te acumulan detrás del modal mientras la lees.
      this._freezeForAlert();
      this.alertTitle.textContent = next.title;
      this.alertMessage.textContent = next.message;
      this.alertIconWrap.className = `alert-icon-wrap kind-${next.kind}`;
      this.alertIconUse.setAttribute("href", `#${next.kind === "danger" ? "icon-alert-octagon" : "icon-alert-triangle"}`);
      this._updateAlertQueueBadge();
      this.alertOverlay.hidden = false;
    }

    _updateAlertQueueBadge() {
      const pending = this.alertQueue.length;
      if (pending > 0) {
        this.alertQueueBadge.hidden = false;
        this.alertQueueBadge.textContent = `+${pending} más en espera`;
      } else {
        this.alertQueueBadge.hidden = true;
      }
    }

    _dismissAlert() {
      this.alertOverlay.hidden = true;
      if (this.alertQueue.length > 0) {
        this._showNextAlert();
      } else {
        this.alertShowing = false;
        this._unfreezeAfterAlerts();
      }
    }

    // Detiene el reloj de la simulación (movimiento de paquetes y temporizador
    // de retransmisión) sin tocar botones ni badge: es un pausado transitorio,
    // no el "Pausar" manual del usuario.
    _freezeForAlert() {
      const p = this.protocol;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      p.isRunning = false;
    }

    // Reanuda tras cerrar la última alerta de la cola, salvo que la
    // simulación ya haya terminado mientras tanto.
    _unfreezeAfterAlerts() {
      const p = this.protocol;
      if (p.state === "FINISHED") return;
      p.isRunning = true;
      if (p.timerActive) this._timeoutTick();
    }

    updateBadge(text, bg) {
      this.statusBadgeText.textContent = text;
      this.statusDot.style.background = bg;
    }

    _onSpeedChange() {
      const speed = parseFloat(this.speedRange.value);
      this.speedLabel.textContent = `${speed.toFixed(1)}x`;
      this.protocol.speedMultiplier = speed;
    }

    updateTelemetry() {
      const p = this.protocol;
      this.statEls.sent.textContent = String(p.framesSent);
      this.statEls.acks.textContent = String(p.acksReceived);
      this.statEls.lost.textContent = String(p.totalLost);
      this.statEls.retrans.textContent = String(p.retransmissions);
      this.statEls.lateAcks.textContent = String(p.lateAcks);
      this.statEls.eff.textContent = `${p.efficiency}%`;
      this.statEls.time.textContent = `${p.elapsedTime}s`;
      this._updatePipelineUI();
    }

    _updatePipelineUI() {
      const p = this.protocol;
      this.pipeContainer.innerHTML = "";
      for (let i = 0; i < p.totalFrames; i++) {
        let statusClass = "stat-muted";
        let statusLabel = "Pendiente";

        if (i < p.currentFrameIdx) {
          statusClass = "stat-green";
          statusLabel = "Confirmada";
        } else if (i === p.currentFrameIdx && p.isRunning) {
          if (p.isWaitingTimeout) {
            statusClass = "stat-orange";
            statusLabel = "Esperando ACK";
          } else if (p.state === "TIMEOUT") {
            statusClass = "stat-red";
            statusLabel = "Reintentando";
          } else {
            statusClass = "stat-blue";
            statusLabel = "En curso";
          }
        }

        const card = document.createElement("div");
        card.className = "pipe-card";
        card.innerHTML = `<span class="pipe-card-label">Trama #${i + 1}</span><span class="pipe-card-status ${statusClass}">${statusLabel}</span>`;
        this.pipeContainer.appendChild(card);
      }
    }

    _updateActionButtons() {
      const p = this.protocol;
      const pkt = p.activePacket;
      // Mientras la trama todavía se está "transmitiendo" (Tt) no ha salido al
      // canal, así que no tiene sentido ofrecer "destruir en tránsito" todavía.
      const isFlyingFrame = pkt && pkt.type === "FRAME" && !(pkt.formMsRemaining > 0);
      const hasFrame = p.isRunning && isFlyingFrame;
      const hasAck = p.isRunning && pkt && pkt.type === "ACK";
      this.btnKillFrame.disabled = !hasFrame;
      this.btnKillAck.disabled = !hasAck;
      this.btnDelayAck.disabled = !hasAck;
    }

    // Muestra/oculta el banner que explica el problema del "tiempo infinito"
    // cuando el emisor queda esperando un ACK que (por ahora) no llegará.
    _updateWarningBanner() {
      const p = this.protocol;
      if (p.isWaitingTimeout && p.lossReason) {
        this.warningBanner.hidden = false;
        if (p.lossReason === "FRAME") {
          this.warningBannerText.textContent =
            "La trama de datos se perdió: el receptor nunca la recibirá y jamás generará un ACK. " +
            "Sin un temporizador de retransmisión, el emisor esperaría ese ACK para siempre (tiempo infinito).";
        } else {
          this.warningBannerText.textContent =
            "El emisor no recibirá el ACK correspondiente. " +
            "Sin un temporizador, el emisor se quedaría esperando indefinidamente (tiempo infinito de espera).";
        }
      } else {
        this.warningBanner.hidden = true;
      }
    }

    // ---------- Control de simulación ----------
    startSimulation() {
      const p = this.protocol;
      if (p.isRunning) return;

      let freshStart = false;
      if (p.activePacket === null && p.currentFrameIdx === 0 && !p.isWaitingTimeout && !p.timerActive) {
        const totalFrames = parseInt(this.framesInput.value, 10);
        const timeoutDuration = parseInt(this.timeoutInput.value, 10);
        if (!Number.isFinite(totalFrames) || !Number.isFinite(timeoutDuration) ||
            totalFrames < 1 || timeoutDuration < 1) {
          this._toast("Ingresa números válidos para tramas y timeout.", "WARNING");
          return;
        }

        p.resetStats();
        p.totalFrames = totalFrames;
        p.timeoutDuration = timeoutDuration;
        p.startTime = Date.now();

        this._toast(`Simulación iniciada: ${p.totalFrames} tramas`, "INFO");
        freshStart = true;
      }

      p.isRunning = true;

      if (freshStart) {
        // sendFrame() arma el temporizador de retransmisión y lo empieza a contar.
        this.sendFrame();
      } else if (p.timerActive) {
        // Reanudar el conteo del temporizador que quedó congelado al pausar.
        this._timeoutTick();
      }

      if (p.isWaitingTimeout) {
        this.updateBadge("Esperando ACK", "#f59e0b");
      } else {
        p.state = "TRANSMITTING";
        this.updateBadge("Transmitiendo", "#16a34a");
      }

      this.btnStart.disabled = true;
      this.framesInput.disabled = true;
      this.timeoutInput.disabled = true;
      this.btnPause.disabled = false;
      this._updateActionButtons();
    }

    pauseSimulation() {
      this.protocol.isRunning = false;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }

      this.updateBadge("Pausado", "#d97706");
      this.btnStart.disabled = false;
      this.btnPause.disabled = true;
      this._updateActionButtons();
      this._toast("Simulación pausada", "INFO");
    }

    resetSimulation() {
      this.pauseSimulation();
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }

      const p = this.protocol;
      p.activePacket = null;
      p.resetStats();
      this.timerJustReset = false;

      this.updateBadge("Inactivo", "#263045");
      this.framesInput.disabled = false;
      this.timeoutInput.disabled = false;
      this.btnStart.disabled = false;
      this._updateActionButtons();
      this._updateWarningBanner();
      this.updateTelemetry();
      this._toast("Simulación reiniciada", "INFO");
    }

    sendFrame() {
      const p = this.protocol;
      if (p.currentFrameIdx >= p.totalFrames) {
        p.endTime = Date.now();
        p.state = "FINISHED";
        p.timerActive = false;
        p.isWaitingTimeout = false;
        this._updateWarningBanner();
        this.updateBadge("Completado", "#2563eb");
        this._toast("Simulación completada con éxito", "SUCCESS");
        this.pauseSimulation();
        this.btnStart.disabled = true;
        return;
      }

      // Si llegamos aquí porque expiró el timeout, es un reenvío de la MISMA
      // trama (mismo bit de secuencia): eso es justo lo que hace que el
      // receptor la reconozca como duplicada.
      const isRetransmission = p.state === "TIMEOUT";

      p.framesSent += 1;
      p.state = "TRANSMITTING";
      p.isWaitingTimeout = false;

      const { formMs, flightMsOneWay } = this._visualDurations();

      p.activePacket = {
        type: "FRAME",
        seq: p.seqNum,
        // Un poco fuera de la caja del emisor: así no tapa el texto de
        // "Estado" mientras se queda quieto durante toda la fase de formación.
        x: this.txX2 + 14,
        y: this.lineY,
        targetX: this.rxX1,
        frameIdx: p.currentFrameIdx,
        isRetransmission,
        // Fase de "transmisión" (Tt): el paquete se queda formándose en el
        // emisor antes de empezar a volar por el canal (Tp).
        formMsRemaining: formMs,
        formMsTotal: formMs,
        flightMsOneWay,
      };

      this.updateBadge("Transmitiendo", "#16a34a");
      this._toast(`Trama #${p.currentFrameIdx + 1} enviada (seq=${p.seqNum})${isRetransmission ? " · retransmisión" : ""}`, "INFO");
      this._updateActionButtons();
      this.updateTelemetry();

      // El temporizador de retransmisión se arma en cada envío, se reciba o
      // no ACK a tiempo — igual que en el protocolo real.
      this._armTimer();
    }

    sendAck() {
      const p = this.protocol;
      const nextSeq = p.nextSeq();
      const { flightMsOneWay } = this._visualDurations();

      p.activePacket = {
        type: "ACK",
        seq: nextSeq,
        x: this.rxX1,
        y: this.lineY,
        targetX: this.txX2,
        frameIdx: 0,
        // El ACK no tiene fase de "transmisión" propia: la fórmula asume que
        // su tamaño/tiempo de transmisión es despreciable frente al de datos.
        formMsRemaining: 0,
        formMsTotal: 0,
        flightMsOneWay,
      };

      this._updateActionButtons();
      this.updateTelemetry();
    }

    killFrame() {
      const p = this.protocol;
      if (p.activePacket && p.activePacket.type === "FRAME") {
        p.framesLost += 1;
        const pkt = p.activePacket;
        this.particles.explode(pkt.x, pkt.y, "#ef4444");
        p.activePacket = null;

        this._alert(
          "Trama perdida en el canal",
          `La trama #${pkt.frameIdx + 1} se destruyó en tránsito y nunca llegará al receptor. El emisor queda a la espera de un ACK que no llegará hasta que expire el temporizador de retransmisión.`,
          "danger"
        );
        this._updateActionButtons();
        this.updateTelemetry();

        // El temporizador YA está corriendo desde que se envió esta trama;
        // solo marcamos que el emisor "no sabe" que se perdió, para el aviso.
        this._markLoss("FRAME");
      }
    }

    killAck() {
      const p = this.protocol;
      if (p.activePacket && p.activePacket.type === "ACK") {
        p.acksLost += 1;
        const pkt = p.activePacket;
        this.particles.explode(pkt.x, pkt.y, "#f97316");
        p.activePacket = null;

        this._alert(
          "ACK perdido en el canal",
          "La trama sí llegó al receptor, pero el ACK de confirmación se destruyó de vuelta. El emisor no se enterará de la entrega hasta que expire el temporizador y reintente el envío.",
          "danger"
        );
        this._updateActionButtons();
        this.updateTelemetry();

        this._markLoss("ACK");
      }
    }

    delayAck() {
      const p = this.protocol;
      if (p.activePacket && p.activePacket.type === "ACK") {
        const pkt = p.activePacket;
        p.delayedPacket = {
          x: pkt.x,
          y: this.lineY + 34,
          seq: pkt.seq,
          frameIdxAtDelay: p.currentFrameIdx,
          // Se congela más allá de lo que dura el timeout + reenvío, para que
          // llegue deliberadamente tarde y se note la desincronización.
          freezeRemainingMs: (p.timeoutDuration + 3) * 1000,
        };
        p.activePacket = null;

        this._alert(
          "ACK retrasado en el canal",
          "El ACK no fue destruido, pero tardará más de lo normal en llegar. El emisor, al no recibirlo a tiempo, iniciará el timeout como si se hubiera perdido — y el ACK original terminará llegando tarde, después de la retransmisión.",
          "warning"
        );
        this._updateActionButtons();
        this.updateTelemetry();

        this._markLoss("ACK");
      }
    }

    // Marca que el ACK/trama en curso ya no llegará (para el aviso de "tiempo
    // infinito" y la etiqueta de estado). El temporizador de retransmisión no
    // se reinicia aquí: ya viene corriendo desde el momento del envío.
    _markLoss(reason) {
      const p = this.protocol;
      p.isWaitingTimeout = true;
      p.state = "WAITING_ACK";
      p.lossReason = reason;

      this.updateBadge("Esperando ACK", "#f59e0b");
      this._updateWarningBanner();
    }

    // Arma el temporizador de retransmisión al máximo y empieza a contar.
    // Se llama en CADA envío (inicial o reenvío), igual que en el protocolo real.
    _armTimer() {
      const p = this.protocol;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      p.timerActive = true;
      p.timerCounter = p.timeoutDuration;
      this.timerJustReset = false;
      this._timeoutTick();
    }

    _timeoutTick() {
      const p = this.protocol;
      if (!p.isRunning || !p.timerActive) return;

      if (p.timerCounter > 0) {
        p.timerCounter -= 1;
        const delay = 1000 / p.speedMultiplier;
        this.timerId = setTimeout(() => this._timeoutTick(), delay);
      } else {
        p.state = "TIMEOUT";
        p.retransmissions += 1;
        p.timerActive = false;
        p.isWaitingTimeout = false;
        p.lossReason = null;

        this.updateBadge("Timeout", "#ef4444");
        this._updateWarningBanner();
        this._alert(
          "Se agotó el tiempo de espera",
          `El emisor no recibió el ACK antes de que expirara el temporizador. Va a reintentar el envío de la trama #${p.currentFrameIdx + 1} con el mismo bit de secuencia (seq=${p.seqNum}).`,
          "warning"
        );

        this.updateTelemetry();
        this.sendFrame();
      }
    }

    // ---------- Animación y dibujo ----------
    _animate() {
      const p = this.protocol;
      this.particles.update();
      this.flowPhase = (this.flowPhase + 0.5) % 18;

      if (p.isRunning) {
        const pkt = p.activePacket;
        if (pkt && pkt.formMsRemaining > 0) {
          // Fase de "transmisión" (Tt): el paquete aún se está formando en el
          // emisor, todavía no viaja por el canal.
          pkt.formMsRemaining -= 30 * p.speedMultiplier;
          if (pkt.formMsRemaining <= 0) {
            pkt.formMsRemaining = 0;
            this._updateActionButtons(); // ahora sí queda "en tránsito"
          }
        } else if (pkt) {
          // Fase de "propagación" (Tp): la velocidad se deriva del reparto
          // visual Tt/Tp calculado a partir de los parámetros del enlace.
          const channelDist = Math.max(40, this.rxX1 - this.txX2);
          const oneWayMs = Math.max(30, pkt.flightMsOneWay || 2000);
          const baseSpeed = (channelDist / oneWayMs) * 30 * p.speedMultiplier;
          const speed = pkt.type === "FRAME" ? baseSpeed : -baseSpeed;
          pkt.x += speed;

          if (pkt.type === "FRAME" && pkt.x >= this.rxX1) {
            p.activePacket = null;

            if (pkt.seq === p.rxExpectedSeq) {
              p.rxReceivedCount += 1;
              p.rxExpectedSeq = p.nextSeq();
            } else {
              this._alert(
                "Trama duplicada detectada",
                `El receptor recibió de nuevo la trama con seq=${pkt.seq}, que ya había confirmado antes. La descarta y reenvía el ACK correspondiente, tal como exige el protocolo Stop & Wait.`,
                "warning"
              );
            }
            this.sendAck();
          } else if (pkt.type === "ACK" && pkt.x <= this.txX2) {
            p.activePacket = null;

            if (this.timerId) {
              clearTimeout(this.timerId);
              this.timerId = null;
            }
            p.timerActive = false;
            p.isWaitingTimeout = false;
            p.lossReason = null;
            this._updateWarningBanner();
            // Muestra "Timer Reiniciado" durante el hueco antes del próximo envío.
            this.timerJustReset = true;

            p.acksReceived += 1;
            this._toast(`ACK recibido. Trama #${p.currentFrameIdx + 1} confirmada`, "SUCCESS");

            p.seqNum = p.nextSeq();
            p.currentFrameIdx += 1;
            this.updateTelemetry();

            const delay = 600 / p.speedMultiplier;
            setTimeout(() => this.sendFrame(), delay);
          }
        }
      }

      // El ACK deliberadamente retrasado avanza de forma independiente al resto
      // de la simulación (incluso si está pausada o ya terminó), para que
      // siempre acabe llegando y se pueda observar la desincronización.
      const dp = this.protocol.delayedPacket;
      if (dp) {
        if (dp.freezeRemainingMs > 0) {
          dp.freezeRemainingMs -= 30 * this.protocol.speedMultiplier;
        } else {
          const speed = 5.5 * this.protocol.speedMultiplier;
          dp.x -= speed;
          if (dp.x <= this.txX2) {
            this.protocol.lateAcks += 1;
            this._alert(
              "Desincronización de tiempos",
              `El ACK que se había retrasado acaba de llegar, pero ya se retransmitió la trama #${dp.frameIdxAtDelay + 1} por timeout. El emisor debe descartarlo por duplicado u obsoleto: así se manifiesta la desincronización de tiempos (RTT variable) en Stop & Wait.`,
              "warning"
            );
            this.protocol.delayedPacket = null;
            this.updateTelemetry();
          }
        }
      }

      this._draw();
    }

    // Dibuja un rectángulo con esquinas redondeadas (compatible sin depender
    // de ctx.roundRect nativo) — la base de todas las formas "menos cuadradas".
    _roundRectPath(ctx, x, y, w, h, r) {
      const radius = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.canvasWidth, h = this.canvasHeight;
      const palette = PALETTES[this._currentTheme()];
      ctx.clearRect(0, 0, w, h);

      // Resplandor de fondo suave centrado en el canal, para dar profundidad
      // en vez del plano liso "cuadriculado" de antes.
      const glowCx = (this.txX2 + this.rxX1) / 2;
      const glow = ctx.createRadialGradient(glowCx, this.lineY, 10, glowCx, this.lineY, Math.max(w, h) * 0.65);
      glow.addColorStop(0, palette.glowCenter);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      this._drawStatic(ctx, palette);
      this.particles.draw(ctx);

      const dp = this.protocol.delayedPacket;
      if (dp) this._drawDelayedPacket(ctx, dp);

      const pkt = this.protocol.activePacket;
      if (pkt) this._drawPacket(ctx, pkt);
    }

    _drawStatic(ctx, palette) {
      const p = this.protocol;
      const txMidX = (this.txX1 + this.txX2) / 2;
      const rxMidX = (this.rxX1 + this.rxX2) / 2;

      // Tubo del canal: una cápsula redondeada con un degradado sutil del
      // color del emisor al del receptor, en vez de una caja + línea punteada.
      const tubeX1 = this.txX2 + 6;
      const tubeX2 = this.rxX1 - 6;
      const tubeY1 = this.lineY - 20;
      const tubeH = 40;
      if (tubeX2 > tubeX1) {
        const tubeGrad = ctx.createLinearGradient(tubeX1, 0, tubeX2, 0);
        tubeGrad.addColorStop(0, palette.tubeStart);
        tubeGrad.addColorStop(1, palette.tubeEnd);
        this._roundRectPath(ctx, tubeX1, tubeY1, tubeX2 - tubeX1, tubeH, tubeH / 2);
        ctx.fillStyle = tubeGrad;
        ctx.fill();
        ctx.strokeStyle = palette.tubeBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Flujo animado ("marching ants") a lo largo del eje del tubo: sugiere
        // un canal vivo incluso cuando no hay ningún paquete en tránsito.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tubeX1 + 16, this.lineY);
        ctx.lineTo(tubeX2 - 16, this.lineY);
        ctx.strokeStyle = palette.channelLine;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.setLineDash([2, 10]);
        ctx.lineDashOffset = -this.flowPhase;
        ctx.stroke();
        ctx.restore();
      }

      // Nodo EMISOR (Tx)
      this._drawNodeBox(ctx, this.txX1, this.txY1, this.txX2, this.txY2, palette.accentTx, palette);
      this._drawNodeBadge(ctx, txMidX, this.txY1 + 20, palette.accentTx, "TX");
      ctx.fillStyle = palette.textMain;
      ctx.font = "600 12px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText("Emisor", txMidX, this.txY1 + 46);

      const pkt = p.activePacket;
      const isForming = pkt && pkt.type === "FRAME" && pkt.formMsRemaining > 0;
      let txStateStr = "Inactivo";
      if (p.isRunning) {
        if (p.isWaitingTimeout) txStateStr = "Esperando ACK";
        else if (p.state === "TIMEOUT") txStateStr = "Reintentando";
        else if (isForming) txStateStr = "Enviando (Tt)";
        else if (p.state === "TRANSMITTING") txStateStr = "En tránsito (Tp)";
      }

      ctx.fillStyle = palette.textMuted;
      ctx.font = "11px 'Segoe UI'";
      ctx.fillText(`Seq: ${p.seqNum}`, txMidX, this.txY1 + 68);
      ctx.font = "10px 'Segoe UI'";
      ctx.fillText(txStateStr, txMidX, this.txY1 + 88);

      // El temporizador se muestra corriendo durante TODA transmisión (haya o
      // no una pérdida simulada), y su reinicio al llegar el ACK con éxito.
      let timerText = "Timer inactivo";
      let timerColor = palette.textMuted;
      if (p.timerActive) {
        timerText = `Timeout en ${p.timerCounter}s`;
        timerColor = p.timerCounter > 2 ? "#f59e0b" : "#ef4444";
      } else if (this.timerJustReset) {
        timerText = "Timer reiniciado";
        timerColor = palette.accentRx;
      } else if (p.isRunning) {
        timerText = "Timer en espera";
        timerColor = palette.accentTx;
      }
      ctx.fillStyle = timerColor;
      ctx.font = "600 12px Consolas, monospace";
      ctx.fillText(timerText, txMidX, Math.min(this.txY2 - 16, this.txY1 + 128));

      // Nodo RECEPTOR (Rx)
      this._drawNodeBox(ctx, this.rxX1, this.rxY1, this.rxX2, this.rxY2, palette.accentRx, palette);
      this._drawNodeBadge(ctx, rxMidX, this.rxY1 + 20, palette.accentRx, "RX");
      ctx.fillStyle = palette.textMain;
      ctx.font = "600 12px 'Segoe UI'";
      ctx.fillText("Receptor", rxMidX, this.rxY1 + 46);

      ctx.fillStyle = palette.textMuted;
      ctx.font = "11px 'Segoe UI'";
      ctx.fillText(`Espera seq: ${p.rxExpectedSeq}`, rxMidX, this.rxY1 + 68);
      ctx.fillText(`Recibidas: ${p.rxReceivedCount}`, rxMidX, this.rxY1 + 90);

      ctx.textAlign = "left";
    }

    // Tarjeta del nodo: esquinas redondeadas, degradado vertical suave y una
    // sombra difusa real (en vez del rectángulo duplicado y desplazado de antes).
    _drawNodeBox(ctx, x1, y1, x2, y2, borderColor, palette) {
      const w = x2 - x1, h = y2 - y1;
      const radius = 16;

      ctx.save();
      ctx.shadowColor = palette.shadowColor;
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      const grad = ctx.createLinearGradient(0, y1, 0, y2);
      grad.addColorStop(0, palette.nodeFillTop);
      grad.addColorStop(1, palette.nodeFillBottom);
      this._roundRectPath(ctx, x1, y1, w, h, radius);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      this._roundRectPath(ctx, x1, y1, w, h, radius);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Pequeña insignia circular con degradado ("TX"/"RX") en la cabecera de
    // cada nodo — un toque de identidad más allá del texto plano.
    _drawNodeBadge(ctx, cx, cy, accent, label) {
      const r = 14;
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, this._shade(accent, -18));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 9px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy + 1);
      ctx.textBaseline = "alphabetic";
    }

    // Oscurece (percent negativo) o aclara (positivo) un color hex plano —
    // usado para dar a insignias y paquetes un ligero degradado sin tener que
    // mantener un segundo tono a mano por cada color.
    _shade(hex, percent) {
      const num = parseInt(hex.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const r = Math.max(0, Math.min(255, (num >> 16) + amt));
      const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
      const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Paquete "fantasma": una cápsula translúcida con borde punteado, sin
    // relleno duro, para que se lea como algo que ya no debería estar ahí.
    _drawDelayedPacket(ctx, pkt) {
      const w = 100, h = 30, r = 15;
      ctx.save();
      ctx.globalAlpha = 0.75;
      this._roundRectPath(ctx, pkt.x - w / 2, pkt.y - h / 2, w, h, r);
      ctx.fillStyle = "rgba(76, 29, 149, 0.35)";
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ede9fe";
      ctx.font = "600 10px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`ACK seq=${pkt.seq} (tardío)`, pkt.x, pkt.y);
      ctx.restore();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Dibuja el paquete como una pequeña "píldora" redondeada con resplandor
    // (en vez de dos rectángulos anidados): una etiqueta de tipo arriba y el
    // bit de secuencia (SEQ=0/1) bien visible abajo. Las retransmisiones
    // (mismo bit, trama duplicada) llevan un borde punteado y una marca roja.
    _drawPacket(ctx, pkt) {
      const isFrame = pkt.type === "FRAME";
      const isDup = !!pkt.isRetransmission;
      const isForming = isFrame && pkt.formMsRemaining > 0;
      const accent = isFrame ? COLORS.framePkt : COLORS.ackPkt;
      const w = 46, h = 34, r = 14;

      ctx.save();
      ctx.shadowColor = isDup ? "rgba(239, 68, 68, 0.75)" : accent;
      ctx.shadowBlur = 16;
      const grad = ctx.createLinearGradient(0, pkt.y - h / 2, 0, pkt.y + h / 2);
      grad.addColorStop(0, this._shade(accent, 16));
      grad.addColorStop(1, accent);
      this._roundRectPath(ctx, pkt.x - w / 2, pkt.y - h / 2, w, h, r);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      this._roundRectPath(ctx, pkt.x - w / 2, pkt.y - h / 2, w, h, r);
      if (isDup) {
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta de tipo (fila superior de la cabecera)
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 7px 'Segoe UI'";
      ctx.fillText(isFrame ? "TRAMA" : "ACK", pkt.x, pkt.y - 8);

      if (isForming) {
        // Fase de transmisión (Tt): barra de progreso "llenándose" en vez del
        // campo de secuencia, para mostrar que el bit aún se está empujando al enlace.
        const total = pkt.formMsTotal || 1;
        const progress = Math.min(1, Math.max(0, 1 - pkt.formMsRemaining / total));
        const barW = 30, barH = 6;
        this._roundRectPath(ctx, pkt.x - barW / 2, pkt.y + 2, barW, barH, 3);
        ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
        ctx.fill();
        if (progress > 0) {
          this._roundRectPath(ctx, pkt.x - barW / 2, pkt.y + 2, barW * progress, barH, 3);
          ctx.fillStyle = "#0f172a";
          ctx.fill();
        }
      } else {
        // Campo de bit de secuencia (fila inferior de la cabecera)
        ctx.font = "700 11px Consolas, monospace";
        ctx.fillText(`SEQ=${pkt.seq}`, pkt.x, pkt.y + 7);
      }

      // Marca de retransmisión/duplicado
      if (isDup) {
        const bx = pkt.x + w / 2 - 2;
        const by = pkt.y - h / 2 - 2;
        ctx.save();
        ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 7px 'Segoe UI'";
        ctx.fillText("DUP", bx, by + 1);
      }

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    new SimulatorApp();
  });
})();
