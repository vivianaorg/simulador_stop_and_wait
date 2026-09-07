// protocol.js
// Modelo del protocolo Stop & Wait (puerto de protocol.py)

class StopAndWaitProtocol {
  constructor(totalFrames = 5, timeoutDuration = 5) {
    this.totalFrames = totalFrames;
    this.timeoutDuration = timeoutDuration; // segundos
    this.currentFrameIdx = 0;
    this.seqNum = 0;
    this.rxExpectedSeq = 0;
    this.rxReceivedCount = 0;
    this.isRunning = false;
    // El temporizador de retransmisión: corre SIEMPRE desde que se envía una trama
    // hasta que llega su ACK o expira (igual que en el protocolo real), no solo
    // cuando se simula una pérdida.
    this.timerActive = false;
    // true solo cuando se marcó una pérdida explícita (destruir/retrasar) y el
    // emisor "no sabe" que el paquete ya no llegará; controla el aviso de
    // "tiempo infinito" y la etiqueta de estado, no el conteo del timer.
    this.isWaitingTimeout = false;
    this.activePacket = null; // { type: "FRAME"|"ACK", seq, x, y, targetX, frameIdx }
    this.timerCounter = 0;
    this.state = "IDLE"; // IDLE, TRANSMITTING, WAITING_ACK, TIMEOUT, FINISHED
    this.speedMultiplier = 1.0;

    // Causa de la espera actual (para la advertencia de "tiempo infinito"): "FRAME" | "ACK" | null
    this.lossReason = null;
    // Paquete de ACK deliberadamente retrasado, viaja de forma independiente al activePacket
    this.delayedPacket = null;

    // Telemetría
    this.framesSent = 0;
    this.acksReceived = 0;
    this.framesLost = 0;
    this.acksLost = 0;
    this.retransmissions = 0;
    this.lateAcks = 0;
    this.startTime = null;
    this.endTime = null;

    // Parámetros físicos del enlace (editables), para la fórmula de eficiencia
    // U = Tt / (Tt + 2·Tp) = 1 / (1 + 2a), con a = Tp / Tt.
    // No se reinician con resetStats(): son configuración del enlace, no del run.
    this.linkFrameBits = 8000;      // L: longitud de la trama, en bits
    this.linkRateBps = 1000000;     // R: tasa de transmisión, en bits/segundo
    this.linkDistanceKm = 1000;     // D: distancia del enlace, en km
    this.linkVelocityKmS = 200000;  // V: velocidad de propagación, en km/s
  }

  nextSeq() {
    return (this.seqNum + 1) % 2;
  }

  // Tt: tiempo de transmisión (ms) — cuánto tarda en "empujarse" la trama al enlace.
  get transmissionTimeMs() {
    if (this.linkRateBps <= 0) return 0;
    return (this.linkFrameBits / this.linkRateBps) * 1000;
  }

  // Tp: tiempo de propagación (ms) — cuánto tarda la señal en recorrer el enlace.
  get propagationTimeMs() {
    if (this.linkVelocityKmS <= 0) return 0;
    return (this.linkDistanceKm / this.linkVelocityKmS) * 1000;
  }

  // a = Tp / Tt
  get aRatio() {
    const tt = this.transmissionTimeMs;
    if (tt <= 0) return Infinity;
    return this.propagationTimeMs / tt;
  }

  // U = Tt / (Tt + 2·Tp) = 1 / (1 + 2a): fracción de tiempo que el canal
  // transmite datos útiles en un ciclo Stop & Wait sin pérdidas.
  get utilization() {
    const a = this.aRatio;
    if (!Number.isFinite(a)) return 0;
    return 1 / (1 + 2 * a);
  }

  // Porcentaje de ocio del canal (tiempo esperando la propagación de ida y vuelta).
  get idlePercent() {
    return (1 - this.utilization) * 100;
  }

  resetStats() {
    this.currentFrameIdx = 0;
    this.seqNum = 0;
    this.rxExpectedSeq = 0;
    this.rxReceivedCount = 0;
    this.isRunning = false;
    this.timerActive = false;
    this.isWaitingTimeout = false;
    this.activePacket = null;
    this.timerCounter = 0;
    this.state = "IDLE";
    this.lossReason = null;
    this.delayedPacket = null;
    this.framesSent = 0;
    this.acksReceived = 0;
    this.framesLost = 0;
    this.acksLost = 0;
    this.retransmissions = 0;
    this.lateAcks = 0;
    this.startTime = null;
    this.endTime = null;
  }

  get totalLost() {
    return this.framesLost + this.acksLost;
  }

  get efficiency() {
    if (this.framesSent === 0) return 100.0;
    return Math.round((this.currentFrameIdx / this.framesSent) * 1000) / 10;
  }

  get elapsedTime() {
    if (this.startTime === null) return 0.0;
    const end = this.endTime !== null ? this.endTime : Date.now();
    return Math.round((end - this.startTime) / 100) / 10;
  }
}
