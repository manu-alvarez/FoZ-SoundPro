/**
 * FoZ SoundPro — FX Trackpad (XY pad completo y funcional) (v1.1)
 * ==============================================================
 * Pad 2D multitáctil (Pointer Events, touch-action none) que controla el bus
 * de FX del motor en tiempo real:
 *
 *   Eje X -> Filtro Lowpass / Highpass (mapeo exponencial 120 Hz .. 18 kHz)
 *   Eje Y -> Saturación tape (WaveShaper tanh)  /  Echo de corchea (wet+fb)
 *
 * Extras profesionales:
 *  - Presets por estilo (Clean / Trap Lush / Boom Bap Dusty / Drill Dark).
 *  - Modo "Momentáneo (CC pedal)": al soltar vuelve a neutro.
 *  - Doble tap en el centro o botón Reset: estado neutro.
 *  - Estado persistido por proyecto (project.padFx) y opción de horneado en WAV.
 *  - El eco se ajusta al tempo del proyecto (corchea = 60/BPM * 0.5).
 */

class FoZTrackpad {
  constructor(engine) {
    this.engine = engine;
    this.project = null;
    this.projectMgr = null;

    this.canvas = null;
    this.drawCtx = null;
    this.activePointerId = null;
    this.lastTapTime = 0;

    this.onStateChange = null; // callback UI
  }

  init(canvasEl, projectMgr, onStateChange) {
    this.canvas = canvasEl;
    this.drawCtx = canvasEl.getContext("2d");
    this.projectMgr = projectMgr || window.fozProjectManager;
    this.onStateChange = onStateChange || null;

    // Prepara la cadena de audio con gesto del usuario (el primer toque)
    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

    this._draw();
    requestAnimationFrame(() => this._draw());
  }

  setProject(project) {
    this.project = project;
    this._applyToEngine();
  }

  // ===========================================================================
  // APLICACIÓN DE ESTADO AL MOTOR
  // ===========================================================================

  _applyToEngine() {
    if (!this.engine || !this.project || !this.project.padFx) return;
    const fx = this.project.padFx;

    this.engine.setPadFilterMode(fx.mapX);
    const hz = this._xToHz(fx.x);
    this.engine.setPadFilterHz(hz);

    this._applyY(fx);
    if (this.onStateChange) this.onStateChange(this._describeState());
  }

  _applyY(fx) {
    if (fx.mapY === "echo") {
      this.engine.setPadDrive(0);
      this.engine.setPadEchoMix(fx.y * FoZConstants.PAD_ECHO_WET_MAX);
    } else {
      this.engine.setPadEchoMix(0);
      this.engine.setPadDrive(fx.y * FoZConstants.PAD_DRIVE_MAX);
    }
  }

  _xToHz(x) {
    const minX = FoZConstants.PAD_FILTER_MIN_HZ;
    const maxX = FoZConstants.PAD_FILTER_MAX_HZ;
    const t = Math.max(0, Math.min(1, x));
    // Mapeo exponencial musical (más resolución en graves)
    return minX * Math.pow(maxX / minX, t);
  }

  _describeState() {
    const fx = this.project.padFx;
    const hz = Math.round(this._xToHz(fx.x));
    const filterLabel = fx.mapX === "lowpass" ? "LP" : "HP";
    const yLabel = fx.mapY === "echo"
      ? `Eco ${Math.round(fx.y * 100)}%`
      : `Tape ${Math.round(fx.y * 100)}%`;
    return { filter: `${filterLabel} ${hz} Hz`, y: yLabel };
  }

  // ===========================================================================
  // INTERACCIÓN CON EL PAD
  // ===========================================================================

  _padCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  async _onPointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.activePointerId = e.pointerId;

    // Inicia el audio con el gesto del usuario
    try { await this.engine.init(); } catch (err) { console.warn(err); }

    const coords = this._padCoords(e);
    const now = Date.now();
    const isCenterTap = Math.abs(coords.x - 0.5) < 0.12 && Math.abs((1 - coords.y) - 0.5) < 0.12;

    if (isCenterTap && (now - this.lastTapTime) < 350) {
      this.resetPad();
      this.lastTapTime = 0;
      return;
    }
    this.lastTapTime = now;

    if (this.project && this.project.padFx) {
      this.project.padFx.active = true;
      this.project.padFx.x = coords.x;
      this.project.padFx.y = 1 - coords.y; // arriba = más FX
      this._applyToEngine();
      this._persist();
    }
  }

  _onPointerMove(e) {
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) return;
    e.preventDefault();

    if (this.project && this.project.padFx) {
      const coords = this._padCoords(e);
      this.project.padFx.x = coords.x;
      this.project.padFx.y = 1 - coords.y;
      this._applyToEngine();
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.activePointerId = null;

    // Momentáneo (estilo CC pedal): vuelve al neutro al soltar
    if (this.project && this.project.padFx && this.project.padFx.latch) {
      this.project.padFx.y = 0;
      this._applyToEngine();
    }
    this._persist();
  }

  resetPad() {
    if (!this.project) return;
    this.project.padFx.active = false;
    this.project.padFx.x = 1.0;
    this.project.padFx.y = 0.0;
    this._applyToEngine();
    this._persist();
    if (this.onStateChange) this.onStateChange(this._describeState());
  }

  setMapX(mode) {
    if (!this.project) return;
    this.project.padFx.mapX = mode;
    this._applyToEngine();
    this._persist();
  }

  setMapY(mode) {
    if (!this.project) return;
    this.project.padFx.mapY = mode;
    this._applyToEngine();
    this._persist();
  }

  toggleLatch() {
    if (!this.project) return false;
    this.project.padFx.latch = !this.project.padFx.latch;
    this._persist();
    return this.project.padFx.latch;
  }

  toggleInExport() {
    if (!this.project) return false;
    this.project.padFx.inExport = !this.project.padFx.inExport;
    this._persist();
    return this.project.padFx.inExport;
  }

  applyStylePreset(preset) {
    if (!this.project) return;
    const fx = this.project.padFx;
    fx.active = preset !== "clean";

    switch (preset) {
      case "trap_lush":
        fx.mapX = "lowpass"; fx.x = 0.62;   // ~2.9 kHz
        fx.mapY = "echo";    fx.y = 0.35;
        break;
      case "boombap":
        fx.mapX = "lowpass"; fx.x = 0.45;   // ~1.0 kHz
        fx.mapY = "tape";    fx.y = 0.45;
        break;
      case "drill_dark":
        fx.mapX = "lowpass"; fx.x = 0.38;   // ~0.6 kHz
        fx.mapY = "tape";    fx.y = 0.65;
        break;
      case "clean":
      default:
        fx.x = 1.0; fx.y = 0.0;
        break;
    }

    this._applyToEngine();
    this._persist();
    if (this.onStateChange) this.onStateChange(this._describeState());
  }

  _persist() {
    if (this.projectMgr && this.project) {
      this.projectMgr.saveCurrentProject(this.project);
    }
  }

  /** Sincroniza el tiempo de eco con el BPM actual (corchea). */
  syncEchoToBpm(bpm) {
    if (!this.engine) return;
    const echoSec = (60.0 / Math.max(30, bpm)) * FoZConstants.PAD_DELAY_DIVISION;
    this.engine.setPadEchoTime(echoSec);
  }

  // ===========================================================================
  // RENDER DEL PAD (canvas)
  // ===========================================================================

  _draw() {
    requestAnimationFrame(() => this._draw());
    if (!this.drawCtx || !this.canvas) return;

    const ctx = this.drawCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fondo degradado del pad
    const grad = ctx.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, "#0b0f18");
    grad.addColorStop(0.6, "#111827");
    grad.addColorStop(1, "#17223a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cuadrícula cada 25%
    ctx.strokeStyle = "rgba(0,242,254,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gx = (i / 4) * w;
      const gy = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // crosshair central
    ctx.strokeStyle = "rgba(168,85,247,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(w / 2 - 10, h / 2); ctx.lineTo(w / 2 + 10, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 10); ctx.lineTo(w / 2, h / 2 + 10); ctx.stroke();

    // Curva de trail del cursor
    if (this.project && this.project.padFx) {
      const fx = this.project.padFx;
      const px = fx.x * w;
      const py = (1 - fx.y) * h;

      // Halo de feedback del Y activo
      const yColor = fx.mapY === "echo" ? "#a855f7" : "#ff9c00";
      const yAlpha = 0.15 + 0.5 * fx.y;
      ctx.fillStyle = `rgba(${
        fx.mapY === "echo" ? "168,85,247" : "255,156,0"
      },${yAlpha})`;
      ctx.fillRect(0, py - 3, w, 6);

      // Cursor
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#00f2fe";
      ctx.shadowColor = "#00f2fe";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Etiqueta de estado
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.85)";
      ctx.fillText(Math.round(this._xToHz(fx.x)) + " Hz", 8, h - 10);
      const yLabel = (fx.mapY === "echo" ? "ECO " : "TAPE ") + Math.round(fx.y * 100) + "%";
      ctx.fillText(yLabel, w - ctx.measureText(yLabel).width - 8, h - 10);
    }
  }
}

window.fozTrackpad = new FoZTrackpad(window.fozAudioEngine);
