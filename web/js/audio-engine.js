/**
 * FoZ SoundPro — Web Audio Synthesis, FX Bus, Recording & Export Engine (v1.1)
 * ==========================================================================
 * Motor de síntesis 100% nativo mediante Web Audio API (sin muestras externas obligatorias).
 *
 * Novedades v1.1:
 *  - Kit de 16 instrumentos sintetizados con diseño profesional por voz.
 *  - Bus de FX del Trackpad (filtro biquad → saturación tape → eco) en la cadena master.
 *  - Cadena de nodos por sampleRate (corregido bug del buffer de ruido compartido
 *    que corrompía los hi-hats tras exportar en equipos con sampleRate 48 kHz).
 *  - Constantes de swing/velocity unificadas con el secuenciador y el export MIDI
 *    (FoZConstants.SWING_FACTOR / DEFAULT_VELOCITY).
 *  - Export WAV offline extendido: hornea los FX del trackpad, aplica eco como taps
 *    deterministas y puede mezclar una base instrumental importada.
 *
 * La gestión del micrófono/PCM de la grabación vive en rec-studio.js;
 * la reproducción de bases importadas vive en base-library.js.
 */

class FoZAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.analyser = null;
    this.isInitialized = false;

    // Bus de FX del Trackpad (siempre presente en la cadena con valores neutros)
    this.padFilter = null;    // BiquadFilterNode (lowpass / highpass)
    this.padShaper = null;    // WaveShaperNode (saturación tape)
    this.padPostGain = null;  // punto de "tap" post-FX (aquí enganchan bases y rec-bus de beat)
    this.padSendGain = null;  // send hacia el eco
    this.padDelay = null;     // DelayNode
    this.padFeedback = null;
    this.padEchoWet = null;

    // Estado de FX del trackpad (los valores los empuja trackpad.js)
    this.padState = {
      filterMode: "lowpass",  // lowpass | highpass
      filterHz: 18000,        // neutro (120 .. 18000)
      drive: 0,               // 0 .. FoZConstants.PAD_DRIVE_MAX
      echoMix: 0,             // 0 .. FoZConstants.PAD_ECHO_WET_MAX
      echoTime: 0.25,         // s (corchea a BPM actual)
    };

    // Referencia vocal legacy (compatibilidad con la toma única antigua)
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedAudioBlob = null;
    this.micStream = null;
    this.micAnalyser = null;
    this.isRecording = false;

    // Cache de buffers de ruido por sampleRate (fix v1.1)
    this.noiseBuffers = new Map();
  }

  // ===========================================================================
  // INICIALIZACIÓN DEL CONTEXTO Y CADENA MASTER
  // ===========================================================================

  async init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API no soportada en este navegador.");
    }

    this.ctx = new AudioContextClass();

    // Compresor/limitador master para evitar saturación y clics
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(6, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    // Ganancia Master
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // --------------------------------------------------------------------
    // Cadena con Bus de FX (Trackpad):
    // Instrumentos/Bases -> Compressor -> Gain -> LP/HP Filter -> Tape Shaper
    //                     -> PostGain -> Analyser -> Speakers
    // PostGain -> SendGain -> Delay(+Feedback) -> EchoWet -> Analyser
    // --------------------------------------------------------------------
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.setValueAtTime(this.padState.filterHz, this.ctx.currentTime);
    this.padFilter.Q.value = 1.0;

    this.padShaper = this.ctx.createWaveShaper();
    this.padShaper.curve = this._driveCurve(this.padState.drive);
    this.padShaper.oversample = "2x";

    this.padPostGain = this.ctx.createGain();
    this.padPostGain.gain.value = 1.0;

    this.padSendGain = this.ctx.createGain();
    this.padSendGain.gain.value = this.padState.echoMix;

    this.padDelay = this.ctx.createDelay(2.0);
    this.padDelay.delayTime.value = this.padState.echoTime;

    this.padFeedback = this.ctx.createGain();
    this.padFeedback.gain.value = Math.min(
      FoZConstants.PAD_ECHO_FEEDBACK_MAX,
      this.padState.echoMix * 0.7
    );

    this.padEchoWet = this.ctx.createGain();
    this.padEchoWet.gain.value = 0.9;

    // Analizador visual para espectro/osciloscopio
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Cableado
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.padFilter);
    this.padFilter.connect(this.padShaper);
    this.padShaper.connect(this.padPostGain);
    this.padPostGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.padPostGain.connect(this.padSendGain);
    this.padSendGain.connect(this.padDelay);
    this.padDelay.connect(this.padFeedback);
    this.padFeedback.connect(this.padDelay); // loop retroalimentado legal en Web Audio
    this.padDelay.connect(this.padEchoWet);
    this.padEchoWet.connect(this.analyser);

    this.isInitialized = true;
  }

  /**
   * Buffer de ruido blanco mono cacheado por sampleRate del contexto.
   * FIX v1.1: antes se compartía un único buffer entre el contexto online y el
   * OfflineAudioContext, corrompiendo el almacenamiento temporal tras exportar
   * en equipos con sampleRate !== 44100.
   */
  _noiseBufferFor(context) {
    const key = context.sampleRate;
    if (!this.noiseBuffers.has(key)) {
      const bufferSize = Math.floor(context.sampleRate * 1.5);
      const buffer = context.createBuffer(1, bufferSize, key);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffers.set(key, buffer);
    }
    return this.noiseBuffers.get(key);
  }

  /** Compatibilidad con llamadas antiguas (usa el contexto online). */
  _createNoiseBuffer(context) {
    return this._noiseBufferFor(context || this.ctx);
  }

  setMasterVolume(val) {
    if (this.masterGain && this.ctx) {
      const v = Math.max(0, Math.min(1.2, val));
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }

  // ===========================================================================
  // BUS DE FX DEL TRACKPAD (API PÚBLICA)
  // ===========================================================================

  setPadFilterMode(mode) {
    if (!this.padFilter) return;
    this.padState.filterMode = mode === "highpass" ? "highpass" : "lowpass";
    this.padFilter.type = this.padState.filterMode;
  }

  setPadFilterHz(hz) {
    if (!this.padFilter || !this.ctx) return;
    this.padState.filterHz = Math.max(
      FoZConstants.PAD_FILTER_MIN_HZ,
      Math.min(FoZConstants.PAD_FILTER_MAX_HZ, hz)
    );
    this.padFilter.frequency.setTargetAtTime(
      this.padState.filterHz, this.ctx.currentTime, 0.012
    );
  }

  setPadDrive(amount) {
    if (!this.padShaper || !this.ctx) return;
    this.padState.drive = Math.max(0, Math.min(FoZConstants.PAD_DRIVE_MAX, amount));
    this.padShaper.curve = this._driveCurve(this.padState.drive);
  }

  setPadEchoMix(mix) {
    if (!this.ctx) return;
    this.padState.echoMix = Math.max(0, Math.min(FoZConstants.PAD_ECHO_WET_MAX, mix));
    this.padSendGain.gain.setTargetAtTime(this.padState.echoMix, this.ctx.currentTime, 0.02);
    this.padFeedback.gain.setTargetAtTime(
      Math.min(FoZConstants.PAD_ECHO_FEEDBACK_MAX, this.padState.echoMix * 0.7),
      this.ctx.currentTime, 0.02
    );
  }

  setPadEchoTime(seconds) {
    if (!this.ctx) return;
    this.padState.echoTime = Math.max(0.02, Math.min(2.0, seconds));
    this.padDelay.delayTime.setTargetAtTime(this.padState.echoTime, this.ctx.currentTime, 0.05);
  }

  /** Restablece la cadena FX a valores neutros (sin coloración). */
  resetPadFx() {
    this.setPadFilterMode("lowpass");
    this.setPadFilterHz(FoZConstants.PAD_FILTER_MAX_HZ);
    this.setPadDrive(0);
    this.setPadEchoMix(0);
  }

  /** Curva de saturación tanh (drive 0 = lineal/perfecto passthrough). */
  _driveCurve(amount) {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = amount * 30;
    if (k <= 0.0001) {
      for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1;
      return curve;
    }
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Impulso sintético de reverb (determinista, sin fichero): ruido estéreo con
   * caída exponencial. Para ConvolverNode en la cadena de voz / buses offline.
   */
  createSyntheticImpulse(context, durationSec = 1.2, decay = 3.2) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = context.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // ===========================================================================
  // SÍNTESIS DE INSTRUMENTOS DE BATERÍA (16 VOCES)
  // ===========================================================================

  /**
   * Bombo (Kick) trap: caída exponencial 155→38 Hz con click de ataque.
   */
  triggerKick(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.08);
    oscGain.gain.setValueAtTime(1.0 * vel, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(320, t);
    clickOsc.frequency.exponentialRampToValueAtTime(60, t + 0.02);
    clickGain.gain.setValueAtTime(0.4 * vel, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    clickOsc.connect(clickGain);
    clickGain.connect(dest);
    clickOsc.start(t);
    clickOsc.stop(t + 0.03);
  }

  /**
   * Caja (Snare): cuerpo tonal + ruido filtrado de bordones.
   */
  triggerSnare(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(190, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    bodyGain.gain.setValueAtTime(0.7 * vel, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(dest);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.13);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(1000, t);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6 * vel, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.23);
  }

  /**
   * Hi-Hat Cerrado: ruido metálico bandpass 8.5 kHz, caída 55 ms.
   */
  triggerClosedHiHat(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(8500, t);
    bandpass.Q.setValueAtTime(3.0, t);
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(6500, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.06);
  }

  /**
   * Hi-Hat Abierto: cola metálica de ~320 ms.
   */
  triggerOpenHiHat(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(7500, t);
    bandpass.Q.setValueAtTime(2.0, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.35);
  }

  /**
   * Clap: ráfagas triples de ruido micro-espaciadas (0/11/22 ms).
   */
  triggerClap(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.setValueAtTime(0.6 * vel, t);
    gain.gain.setValueAtTime(0.1, t + 0.009);
    gain.gain.setValueAtTime(0.7 * vel, t + 0.011);
    gain.gain.setValueAtTime(0.15, t + 0.020);
    gain.gain.setValueAtTime(0.8 * vel, t + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.25);
  }

  /**
   * Bajo 808: subgrave con pitch drop y sustain largo.
   */
  trigger808(time = 0, velocity = 1.0, destination = null, noteFreq = 41.2) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(noteFreq * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(noteFreq, t + 0.04);
    gain.gain.setValueAtTime(0.9 * vel, t);
    gain.gain.setValueAtTime(0.85 * vel, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.70);
  }

  /**
   * Rimshot: golpe agudo seco y metálico.
   */
  triggerRimshot(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.02);
    gain.gain.setValueAtTime(0.8 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  // ---------------------------------------------------------------------------
  // VOCES NUEVAS v1.1 (diseño profesional sintetizado, 0 KB de assets)
  // ---------------------------------------------------------------------------

  /**
   * Crash: ruido metálico ancho de 1.4 s con ping de baqueta y empuje grave.
   */
  triggerCrash(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    // Ping de baqueta
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = "sine";
    ping.frequency.setValueAtTime(4200, t);
    pingGain.gain.setValueAtTime(0.22 * vel, t);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    ping.connect(pingGain);
    pingGain.connect(dest);
    ping.start(t);
    ping.stop(t + 0.06);

    // Empuje grave complejidad body
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(150, t);
    bodyGain.gain.setValueAtTime(0.4 * vel, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(dest);
    body.start(t);
    body.stop(t + 0.09);

    // Cola metálica amplia
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(6200, t);
    band.Q.setValueAtTime(0.6, t);
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.setValueAtTime(8000, t);
    shelf.gain.setValueAtTime(4, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    noise.connect(band);
    band.connect(shelf);
    shelf.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 1.45);
  }

  /**
   * Ride: ping brillante con campana (2800 Hz) y cama metálica sostenida.
   */
  triggerRide(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = "sine";
    bell.frequency.setValueAtTime(2800, t);
    bellGain.gain.setValueAtTime(0.30 * vel, t);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    bell.connect(bellGain);
    bellGain.connect(dest);
    bell.start(t);
    bell.stop(t + 0.32);

    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = "triangle";
    ping.frequency.setValueAtTime(1800, t);
    pingGain.gain.setValueAtTime(0.14 * vel, t);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    ping.connect(pingGain);
    pingGain.connect(dest);
    ping.start(t);
    ping.stop(t + 0.13);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(5000, t);
    band.Q.setValueAtTime(0.8, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.30 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    noise.connect(band);
    band.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.95);
  }

  /**
   * Tom Grave: batería del tambor (110→60 Hz) con piel corta.
   */
  triggerTomLow(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(110, t);
    body.frequency.exponentialRampToValueAtTime(58, t + 0.25);
    bodyGain.gain.setValueAtTime(0.9 * vel, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    body.connect(bodyGain);
    bodyGain.connect(dest);
    body.start(t);
    body.stop(t + 0.40);

    const skin = ctx.createBufferSource();
    skin.buffer = this._noiseBufferFor(ctx);
    const skinBand = ctx.createBiquadFilter();
    skinBand.type = "bandpass";
    skinBand.frequency.setValueAtTime(500, t);
    skinBand.Q.setValueAtTime(1.0, t);
    const skinGain = ctx.createGain();
    skinGain.gain.setValueAtTime(0.20 * vel, t);
    skinGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    skin.connect(skinBand);
    skinBand.connect(skinGain);
    skinGain.connect(dest);
    skin.start(t);
    skin.stop(t + 0.10);
  }

  /**
   * Tom Medio: cuerpo 180→100 Hz más agudo y ágil.
   */
  triggerTomMid(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(180, t);
    body.frequency.exponentialRampToValueAtTime(100, t + 0.18);
    bodyGain.gain.setValueAtTime(0.85 * vel, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    body.connect(bodyGain);
    bodyGain.connect(dest);
    body.start(t);
    body.stop(t + 0.30);

    const skin = ctx.createBufferSource();
    skin.buffer = this._noiseBufferFor(ctx);
    const skinBand = ctx.createBiquadFilter();
    skinBand.type = "bandpass";
    skinBand.frequency.setValueAtTime(900, t);
    skinBand.Q.setValueAtTime(1.0, t);
    const skinGain = ctx.createGain();
    skinGain.gain.setValueAtTime(0.18 * vel, t);
    skinGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    skin.connect(skinBand);
    skinBand.connect(skinGain);
    skinGain.connect(dest);
    skin.start(t);
    skin.stop(t + 0.08);
  }

  /**
   * Cowbell: doble cuadrada 540/800 Hz con bandpass metálico (estilo TR-808).
   */
  triggerCowbell(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(850, t);
    band.Q.setValueAtTime(2.2, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    band.connect(gain);
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    o1.type = "square";
    o1.frequency.setValueAtTime(540, t);
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(800, t);
    o1.connect(band);
    o2.connect(band);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.27);
    o2.stop(t + 0.27);
  }

  /**
   * Snap Trap: transitorio ultra-corto de percusión tipo "gunshot/punch".
   */
  triggerSnapTrap(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(3500, t);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(6000, t);
    band.Q.setValueAtTime(1.4, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.75 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    noise.connect(hp);
    hp.connect(band);
    band.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.05);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(1200, t);
    click.frequency.exponentialRampToValueAtTime(400, t + 0.02);
    clickGain.gain.setValueAtTime(0.30 * vel, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    click.connect(clickGain);
    clickGain.connect(dest);
    click.start(t);
    click.stop(t + 0.025);
  }

  /**
   * Shaker: ambiente suave tipo maracas para Lo-Fi / Grooves.
   */
  triggerShaker(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBufferFor(ctx);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(3200, t);
    band.Q.setValueAtTime(1.8, t);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2000, t);
    const gain = ctx.createGain();
    // Ataque suave + caída: envolvente de shaker "ondeado"
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35 * vel, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    noise.connect(band);
    band.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.11);
  }

  /**
   * Stab Dark: golpe de sintetizador oscuro (saw + sub) con barrido de filtro.
   */
  triggerStabDark(time = 0, velocity = 1.0, destination = null, noteFreq = 220) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.28);
    lp.Q.setValueAtTime(2.5, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
    lp.connect(gain);
    gain.connect(dest);

    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(noteFreq, t);
    saw.connect(lp);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(noteFreq / 2, t);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;
    sub.connect(subGain);
    subGain.connect(lp);

    saw.start(t);
    sub.start(t);
    saw.stop(t + 0.42);
    sub.stop(t + 0.42);
  }

  /**
   * Horn Slap: golpe de metales agudo (brass stab) con caída de tono).
   */
  triggerHornSlap(time = 0, velocity = 1.0, destination = null, noteFreq = 240) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const bpLow = ctx.createBiquadFilter();
    bpLow.type = "lowpass";
    bpLow.frequency.setValueAtTime(4000, t);
    bpLow.Q.setValueAtTime(0.8, t);
    const bpMid = ctx.createBiquadFilter();
    bpMid.type = "bandpass";
    bpMid.frequency.setValueAtTime(1400, t);
    bpMid.Q.setValueAtTime(1.2, t);
    const gain = ctx.createGain();
    // Ataque percusivo de metales
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.55 * vel, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    bpMid.connect(bpLow);
    bpLow.connect(gain);
    gain.connect(dest);

    const saw1 = ctx.createOscillator();
    saw1.type = "sawtooth";
    saw1.frequency.setValueAtTime(noteFreq * 1.02, t);
    saw1.frequency.exponentialRampToValueAtTime(noteFreq * 0.85, t + 0.3);
    const saw2 = ctx.createOscillator();
    saw2.type = "sawtooth";
    saw2.frequency.setValueAtTime(noteFreq, t);
    saw2.frequency.exponentialRampToValueAtTime(noteFreq * 0.84, t + 0.3);
    saw1.connect(bpMid);
    saw2.connect(bpMid);
    saw1.start(t);
    saw2.start(t);
    saw1.stop(t + 0.45);
    saw2.stop(t + 0.45);
  }

  /**
   * Despachador de instrumento según ID. Prioriza muestras cargadas del
   * Sample Studio (sampler.js) para la pista correspondiente.
   */
  triggerInstrument(instId, time = 0, velocity = 1.0, destination = null) {
    // Capa de muestras locales (Sample Studio) si la pista tiene muestra cargada
    if (window.fozSampler && window.fozSampler.hasSample(instId)) {
      window.fozSampler.triggerSample(instId, time, velocity, destination);
      return;
    }

    switch (instId) {
      case "kick":        return this.triggerKick(time, velocity, destination);
      case "snare":       return this.triggerSnare(time, velocity, destination);
      case "hihat_closed": return this.triggerClosedHiHat(time, velocity, destination);
      case "hihat_open":  return this.triggerOpenHiHat(time, velocity, destination);
      case "clap":        return this.triggerClap(time, velocity, destination);
      case "bass808":     return this.trigger808(time, velocity, destination);
      case "rimshot":     return this.triggerRimshot(time, velocity, destination);
      case "crash":       return this.triggerCrash(time, velocity, destination);
      case "ride":        return this.triggerRide(time, velocity, destination);
      case "tom_low":     return this.triggerTomLow(time, velocity, destination);
      case "tom_mid":     return this.triggerTomMid(time, velocity, destination);
      case "cowbell":     return this.triggerCowbell(time, velocity, destination);
      case "snap_trap":   return this.triggerSnapTrap(time, velocity, destination);
      case "shaker":      return this.triggerShaker(time, velocity, destination);
      case "stab_dark":   return this.triggerStabDark(time, velocity, destination);
      case "horn_slap":   return this.triggerHornSlap(time, velocity, destination);
      default:
        console.warn(`Instrumento desconocido: ${instId}`);
    }
  }

  /**
   * Clic del metrónomo (se usa en playback y cuenta atrás de pre-roll).
   */
  triggerMetronome(time = 0, isFirstBeat = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = time || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isFirstBeat ? 1400 : 900, t);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // ===========================================================================
  // CAMBIOS v1.1 — GRABACIÓN LEGACY
  // ---------------------------------------------------------------------------
  // El Record Studio completo (micrófono con cadena pro, buses, pre-roll, tomas
  // en IndexedDB) vive en rec-studio.js. Aquí se conserva la ruta original de
  // toma única para compatibilidad y como fallback del navegador.
  // ===========================================================================

  async startVoiceRecording() {
    await this.init();
    if (this.isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("La API getUserMedia no está disponible en este navegador/contexto.");
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      micSource.connect(this.micAnalyser);

      this.recordedChunks = [];

      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        options = { mimeType: "audio/ogg;codecs=opus" };
      }

      this.mediaRecorder = new MediaRecorder(this.micStream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start(100);
      this.isRecording = true;
    } catch (err) {
      this.isRecording = false;
      throw new Error(`Error al acceder al micrófono: ${err.message}`);
    }
  }

  stopVoiceRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || "audio/webm";
        this.recordedAudioBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.isRecording = false;

        if (this.micStream) {
          this.micStream.getTracks().forEach((track) => track.stop());
          this.micStream = null;
        }
        resolve(this.recordedAudioBlob);
      };

      this.mediaRecorder.onerror = (e) => reject(e.error);
      this.mediaRecorder.stop();
    });
  }

  // ===========================================================================
  // RENDERIZADO Y EXPORTACIÓN DE AUDIO WAV (OFFLINE CONTEXT)
  // ===========================================================================

  /**
   * Convierte un AudioBuffer en un Blob RIFF/WAVE PCM 16 bits firmado estéreo.
   * (También lo consume rec-studio.js para la tomas WAV del Record Studio.)
   */
  _audioBufferToWavBlob(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM sin comprimir
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const numSamples = audioBuffer.length;
    const dataByteCount = numSamples * blockAlign;
    const totalByteCount = 44 + dataByteCount;

    const buffer = new ArrayBuffer(totalByteCount);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataByteCount, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataByteCount, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  /**
   * Aplica eco determinista post-render (conjunto de taps idéntico en cualquier
   * dispositivo): suma el propio buffer desplazado con ganancia wet^n.
   */
  _applyEchoTaps(audioBuffer, delaySec, wet, taps = FoZConstants.PAD_ECHO_TAPS) {
    if (wet <= 0.0001 || delaySec <= 0) return audioBuffer;
    const rate = audioBuffer.sampleRate;
    const dSamples = Math.floor(delaySec * rate);
    if (dSamples <= 0 || dSamples >= audioBuffer.length) return audioBuffer;

    const numCh = audioBuffer.numberOfChannels;
    const out = audioBuffer.context.createBuffer(numCh, audioBuffer.length, rate);
    for (let ch = 0; ch < numCh; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src);
      let tapGain = wet;
      for (let tap = 1; tap <= taps; tap++) {
        const off = tap * dSamples;
        if (off >= dst.length) break;
        for (let i = 0; i + off < dst.length; i++) {
          dst[i + off] += src[i] * tapGain;
        }
        tapGain *= wet;
      }
    }
    return out;
  }

  /**
   * Renderiza un patrón completo del secuenciador a WAV PCM 16-bit estéreo
   * 44.1 kHz, horneando (opcionalmente) los FX del Trackpad y una base
   * instrumental importada.
   *
   * @param {Object} projectData  Datos del proyecto (.foz)
   * @param {number} repeatBars   Compases del patrón a repetir
   * @param {Object} opts         { backingBuffer, backingGain, padFx:{filterMode, filterHz, drive, echoMix, echoTime} }
   */
  async exportPatternToWavBlob(projectData, repeatBars = 2, opts = {}) {
    const sampleRate = 44100;
    const bpm = projectData.bpm || 90;
    const stepsCount = projectData.stepsCount || 16;
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / 4;
    const barDuration = secondsPerStep * stepsCount;
    const patternDuration = barDuration * repeatBars;

    const backing = opts.backing || null;
    const backingDuration = backing ? backing.buffer.duration : 0;
    const totalDuration = Math.max(patternDuration, backingDuration) + 1.0;

    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtxClass) {
      throw new Error("OfflineAudioContext no disponible en este navegador.");
    }

    const offlineCtx = new OfflineCtxClass(2, Math.ceil(sampleRate * totalDuration), sampleRate);

    // ------------------------------------------------------------------
    // Cadena master offline (con FX horneados si procede)
    // ------------------------------------------------------------------
    const offlineComp = offlineCtx.createDynamicsCompressor();
    offlineComp.threshold.setValueAtTime(-3, 0);
    offlineComp.ratio.setValueAtTime(8, 0);

    const padFx = opts.padFx || null;
    let chainTail = offlineComp;
    let offlineFilter = null;
    let offlineShaper = null;

    if (padFx) {
      offlineFilter = offlineCtx.createBiquadFilter();
      offlineFilter.type = padFx.filterMode || "lowpass";
      offlineFilter.frequency.setValueAtTime(
        Math.max(FoZConstants.PAD_FILTER_MIN_HZ, Math.min(FoZConstants.PAD_FILTER_MAX_HZ, padFx.filterHz || FoZConstants.PAD_FILTER_MAX_HZ)),
        0
      );
      offlineFilter.Q.value = 1.0;

      offlineShaper = offlineCtx.createWaveShaper();
      offlineShaper.curve = this._driveCurve(padFx.drive || 0);
      offlineShaper.oversample = "2x";

      offlineComp.connect(offlineFilter);
      offlineFilter.connect(offlineShaper);
      offlineShaper.connect(offlineCtx.destination);
      chainTail = offlineFilter;
    } else {
      offlineComp.connect(offlineCtx.destination);
    }

    // ------------------------------------------------------------------
    // Base instrumental importada (se hornea al principio del render)
    // ------------------------------------------------------------------
    if (backing && backing.buffer) {
      const backingOffline = offlineCtx.createBuffer(
        backing.buffer.numberOfChannels,
        backing.buffer.length,
        backing.buffer.sampleRate
      );
      // Resample: si el sampleRate de la base difiere, OfflineAudioContext lo
      // reinterpreta al reproducirse vía AudioBufferSourceNode.
      for (let ch = 0; ch < backing.buffer.numberOfChannels; ch++) {
        backingOffline.getChannelData(ch).set(backing.buffer.getChannelData(ch));
      }
      const backingSource = offlineCtx.createBufferSource();
      backingSource.buffer = backingOffline;
      const backingGainNode = offlineCtx.createGain();
      backingGainNode.gain.setValueAtTime(backing.gain != null ? backing.gain : 0.85, 0);
      // Fade in/out determinista
      const fadeIn = Math.max(0, backing.fadeInSec || 0);
      const fadeOut = Math.max(0, backing.fadeOutSec || 0);
      if (fadeIn > 0) {
        backingGainNode.gain.setValueAtTime(0, 0);
        backingGainNode.gain.linearRampToValueAtTime(backing.gain != null ? backing.gain : 0.85, fadeIn);
      }
      if (fadeOut > 0 && backingDuration > fadeOut) {
        const tOut = Math.max(backingDuration - fadeOut, fadeIn + 0.01);
        backingGainNode.gain.setValueAtTime(backing.gain != null ? backing.gain : 0.85, tOut);
        backingGainNode.gain.linearRampToValueAtTime(0.0001, backingDuration);
      }
      backingSource.connect(backingGainNode);
      backingGainNode.connect(offlineComp);
      backingSource.start(0);
    }

    // ------------------------------------------------------------------
    // Programar notas del patrón (síntesis idéntica al modo en vivo)
    // ------------------------------------------------------------------
    for (let r = 0; r < repeatBars; r++) {
      const barOffset = r * barDuration;

      projectData.tracks.forEach((track) => {
        if (track.muted) return;

        const hasSolo = projectData.tracks.some((t) => t.solo);
        if (hasSolo && !track.solo) return;

        const trackGain = offlineCtx.createGain();
        trackGain.gain.setValueAtTime(
          track.volume !== undefined ? track.volume : FoZConstants.DEFAULT_VOLUME, 0
        );
        trackGain.connect(offlineComp);

        track.steps.forEach((active, stepIdx) => {
          if (active && stepIdx < stepsCount) {
            const stepTime = barOffset + stepIdx * secondsPerStep;
            const swingOffset =
              projectData.swing && stepIdx % 2 === 1
                ? secondsPerStep * (projectData.swing * FoZConstants.SWING_FACTOR)
                : 0;
            const vel = track.velocities
              ? track.velocities[stepIdx] || FoZConstants.DEFAULT_VELOCITY
              : FoZConstants.DEFAULT_VELOCITY;
            this.triggerInstrument(track.id, stepTime + swingOffset, vel, trackGain);
          }
        });
      });
    }

    // ------------------------------------------------------------------
    // Render final + eco determinista + codificación WAV
    // ------------------------------------------------------------------
    const renderedBuffer = await offlineCtx.startRendering();
    let finalBuffer = renderedBuffer;

    if (padFx && (padFx.echoMix || 0) > 0.0001) {
      finalBuffer = this._applyEchoTaps(
        renderedBuffer,
        padFx.echoTime || 0.25,
        padFx.echoMix,
        FoZConstants.PAD_ECHO_TAPS
      );
    }

    return this._audioBufferToWavBlob(finalBuffer);
  }
}

// Exportar como singleton en contexto global
window.fozAudioEngine = new FoZAudioEngine();
