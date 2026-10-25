/**
 * FoZ SoundPro — Record Studio v2 (grabación con música + cadena pro) (v1.1)
 * ==========================================================================
 * Grabación determinista vía PCM (captura ScriptProcessor del bus) → WAV 16-bit,
 * siguiendo el estándar profesional de los DAW web (salida idéntica en
 * macOS/Windows; MediaRecorder queda como respaldo opcional con códec del SO).
 *
 * Arquitectura:
 *   mic → micGain → HPF → EQ 3 bandas → Compresor → [FX: Reverb/Echo] → micOut
 *   monitor: micOut → monitorGain(0 por defecto, anti-acople) → altavoces
 *   recBus: micOut (según modo) + padPostGain del motor (beat con FX)
 *   recBus → ScriptProcessor(4096) → PCM L/R → AudioBuffer → (nudge, gate) → WAV
 *
 * Pre-roll: cuenta metronómica de 0/1/2 compases; la captura y el arranque del
 * beat se sincronizan por tiempo del contexto (goTime).
 * Tomas: persistidas en IndexedDB con nombre automático, descarga y borrado.
 */

class FoZRecStudio {
  constructor(engine) {
    this.engine = engine;
    this.settings = this._defaultSettings();
    this.loadSettings();

    // Cadena de micrófono
    this.micStream = null;
    this.micSource = null;
    this.micGain = null;
    this.micHPF = null;
    this.micEQ = {}; // low, mid, high
    this.micComp = null;
    this.micReverbSend = null;
    this.micEchoSend = null;
    this.micEchoDelay = null;
    this.micEchoFb = null;
    this.reverbConvolver = null;
    this.reverbWet = null;
    this.echoWet = null;
    this.micOut = null;
    this.monitorGain = null;
    this.micAnalyser = null;

    // Estado de grabación
    this.recBus = null;
    this.captureNode = null;
    this.fallbackRecorder = null; // MediaRecorder de respaldo (webm/mp4 del SO)
    this.rec = null;              // { armed, goTime, ch0:[], ch1:[], mode, startedAt }

    this.takesDb = null; // IndexedDB
    this.onCountdown = null;   // (barIdx, beatIdx)
    this.onStopRequestedByUser = null;
  }

  _defaultSettings() {
    return {
      deviceId: "",
      gain: 1.0,
      monitorMode: "off",        // off | on
      ec: true, ns: true, agc: true,
      hpfHz: 80,
      eqLow: 0, eqMid: 0, eqHigh: 0,
      compPreset: "rap",
      reverbSend: 0, echoSend: 0,
      gateEnabled: false, gateThresholdDb: -46,
      offsetMs: 0,
    };
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(FoZConstants.STORAGE_KEY_REC_SETTINGS);
      if (raw) {
        Object.assign(this.settings, JSON.parse(raw));
      }
    } catch (e) { /* ajustes por defecto */ }
  }

  saveSettings() {
    try {
      localStorage.setItem(FoZConstants.STORAGE_KEY_REC_SETTINGS, JSON.stringify(this.settings));
    } catch (e) { /* no crítico */ }
  }

  // ===========================================================================
  // MICRÓFONO + CADENA PRO
  // ===========================================================================

  async openMic() {
    const engine = this.engine;
    await engine.init();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia no disponible en este navegador/contexto.");
    }

    this.closeMic(false);

    const s = this.settings;
    const audioConstraints = {
      echoCancellation: !!s.ec,
      noiseSuppression: !!s.ns,
      autoGainControl: !!s.agc,
    };
    if (s.deviceId) audioConstraints.deviceId = { exact: s.deviceId };

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    const ctx = engine.ctx;

    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.micGain = ctx.createGain();
    this.micGain.gain.value = Math.max(0, Math.min(4, s.gain));

    this.micHPF = ctx.createBiquadFilter();
    this.micHPF.type = "highpass";
    this.micHPF.frequency.value = Math.max(20, Math.min(400, s.hpfHz || 20));
    this.micHPF.Q.value = 0.7;

    this.micEQ.low = ctx.createBiquadFilter();
    this.micEQ.low.type = "lowshelf";
    this.micEQ.low.frequency.value = 180;

    this.micEQ.mid = ctx.createBiquadFilter();
    this.micEQ.mid.type = "peaking";
    this.micEQ.mid.frequency.value = 1200;
    this.micEQ.mid.Q.value = 1.0;

    this.micEQ.high = ctx.createBiquadFilter();
    this.micEQ.high.type = "highshelf";
    this.micEQ.high.frequency.value = 3600;

    this.micComp = ctx.createDynamicsCompressor();
    this._applyCompPreset(s.compPreset);

    // FX: reverb sintética + echo corto en la cadena de voz
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = engine.createSyntheticImpulse(ctx, 1.2, 3.4);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0.8;

    this.micReverbSend = ctx.createGain();
    this.micReverbSend.gain.value = Math.max(0, Math.min(1, s.reverbSend));

    this.micEchoDelay = ctx.createDelay(1.0);
    this.micEchoDelay.delayTime.value = 0.24;
    this.micEchoFb = ctx.createGain();
    this.micEchoFb.gain.value = 0.3;
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0.8;
    this.micEchoSend = ctx.createGain();
    this.micEchoSend.gain.value = Math.max(0, Math.min(1, s.echoSend));

    this.micOut = ctx.createGain();

    // Cableado: mic → gain → HPF → EQ3 → Comp → [sends] → micOut
    this.micSource.connect(this.micGain);
    this.micGain.connect(this.micHPF);
    this.micHPF.connect(this.micEQ.low);
    this.micEQ.low.connect(this.micEQ.mid);
    this.micEQ.mid.connect(this.micEQ.high);
    this.micEQ.high.connect(this.micComp);
    this.micComp.connect(this.micOut);

    this.micComp.connect(this.micReverbSend);
    this.micReverbSend.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWet);
    this.reverbWet.connect(this.micOut);

    this.micComp.connect(this.micEchoSend);
    this.micEchoSend.connect(this.micEchoDelay);
    this.micEchoDelay.connect(this.micEchoFb);
    this.micEchoFb.connect(this.micEchoDelay);
    this.micEchoDelay.connect(this.echoWet);
    this.echoWet.connect(this.micOut);

    // Monitor (anti-acople: 0 por defecto, usar con auriculares)
    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = (s.monitorMode === "on") ? 1.0 : 0.0;
    this.micOut.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);

    // Analizador para osciloscopio/VU
    this.micAnalyser = ctx.createAnalyser();
    this.micAnalyser.fftSize = 256;
    this.micOut.connect(this.micAnalyser);

    return this.listDevices();
  }

  listDevices() {
    return navigator.mediaDevices.enumerateDevices().then((devices) => {
      return devices.filter((d) => d.kind === "audioinput").map((d) => ({
        deviceId: d.deviceId, label: d.label || "Entrada de audio",
      }));
    });
  }

  closeMic(clearSettings = true) {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    // Desconecta la cadena anterior si existe
    [this.micSource, this.micGain, this.micHPF, this.micEQ.low, this.micEQ.mid, this.micEQ.high,
     this.micComp, this.micReverbSend, this.reverbConvolver, this.reverbWet,
     this.micEchoSend, this.micEchoDelay, this.micEchoFb, this.echoWet,
     this.micOut, this.monitorGain, this.micAnalyser].forEach((n) => {
      if (n && n.disconnect) { try { n.disconnect(); } catch (e) { /* vacío */ } }
    });
    if (clearSettings) {
      this.micSource = null; this.micOut = null; this.micAnalyser = null; this.monitorGain = null;
    }
  }

  _applyCompPreset(preset) {
    const c = this.micComp;
    if (!c) return;
    const presets = {
      off:      { threshold: 0,   ratio: 1, attack: 0.003, release: 0.25, knee: 30 },
      suave:    { threshold: -30, ratio: 3, attack: 0.010, release: 0.20, knee: 24 },
      rap:      { threshold: -24, ratio: 6, attack: 0.005, release: 0.12, knee: 18 },
      agresivo: { threshold: -38, ratio: 8, attack: 0.003, release: 0.08, knee: 12 },
    };
    const p = presets[preset] || presets.rap;
    const t = this.engine.ctx.currentTime;
    c.threshold.setValueAtTime(p.threshold, t);
    c.ratio.setValueAtTime(p.ratio, t);
    c.attack.setValueAtTime(p.attack, t);
    c.release.setValueAtTime(p.release, t);
    c.knee.setValueAtTime(p.knee, t);
  }

  setCompPreset(preset) {
    this.settings.compPreset = preset;
    this._applyCompPreset(preset);
    this.saveSettings();
  }

  setMonitorMode(mode) {
    this.settings.monitorMode = (mode === "on") ? "on" : "off";
    if (this.monitorGain && this.engine.ctx) {
      const target = this.settings.monitorMode === "on" ? 1.0 : 0.0;
      this.monitorGain.gain.setTargetAtTime(target, this.engine.ctx.currentTime, 0.02);
    }
    this.saveSettings();
  }

  setMicGain(v) {
    this.settings.gain = Math.max(0, Math.min(4, v));
    if (this.micGain) {
      this.micGain.gain.setTargetAtTime(this.settings.gain, this.engine.ctx.currentTime, 0.01);
    }
    this.saveSettings();
  }

  setEq(low = 0, mid = 0, high = 0) {
    this.settings.eqLow = low; this.settings.eqMid = mid; this.settings.eqHigh = high;
    if (this.micEQ.low) this.micEQ.low.gain.setTargetAtTime(low, this.engine.ctx.currentTime, 0.02);
    if (this.micEQ.mid) this.micEQ.mid.gain.setTargetAtTime(mid, this.engine.ctx.currentTime, 0.02);
    if (this.micEQ.high) this.micEQ.high.gain.setTargetAtTime(high, this.engine.ctx.currentTime, 0.02);
    this.saveSettings();
  }

  setHpf(hz) {
    this.settings.hpfHz = Math.max(0, Math.min(400, hz));
    if (this.micHPF && this.engine.ctx) {
      this.micHPF.frequency.setTargetAtTime(Math.max(20, this.settings.hpfHz), this.engine.ctx.currentTime, 0.02);
    }
    this.saveSettings();
  }

  setReverbSend(v) {
    this.settings.reverbSend = Math.max(0, Math.min(1, v));
    if (this.micReverbSend) {
      this.micReverbSend.gain.setTargetAtTime(this.settings.reverbSend, this.engine.ctx.currentTime, 0.02);
    }
    this.saveSettings();
  }

  setEchoSend(v) {
    this.settings.echoSend = Math.max(0, Math.min(1, v));
    if (this.micEchoSend) {
      this.micEchoSend.gain.setTargetAtTime(this.settings.echoSend, this.engine.ctx.currentTime, 0.02);
    }
    this.saveSettings();
  }

  async updateConstraints(ec, ns, agc) {
    this.settings.ec = !!ec; this.settings.ns = !!ns; this.settings.agc = !!agc;
    this.saveSettings();
    if (this.micStream) {
      // getUserMedia exige re-solicitud para cambiar processing hints
      await this.openMic();
    }
  }

  // ===========================================================================
  // GRABACIÓN (PRE-ROLL + CAPTURA PCM DETERMINISTA)
  // ===========================================================================

  /**
   * Inicia la secuencia de grabación:
   * @param {Object} opts { includeMic, includeBeat, prerollBars, bpm, onStartBeat }
   * @returns {Promise<{goTime:number, barDur:number}>} goTime ya pasó al resolver
   */
  async start(opts = {}) {
    const engine = this.engine;
    await engine.init();

    const includeMic = opts.includeMic !== false;
    const includeBeat = opts.includeBeat !== false;
    const prerollBars = Math.max(0, Math.min(FoZConstants.REC_PREROLL_MAX_BARS, opts.prerollBars || 0));
    const bpm = Math.max(FoZConstants.MIN_BPM, Math.min(FoZConstants.MAX_BPM, opts.bpm || 90));
    const barDur = (60.0 / bpm);

    if (includeMic && !this.micStream) {
      await this.openMic();
    }

    // Bus de grabación
    const ctx = engine.ctx;
    this.recBus = ctx.createGain();
    if (includeBeat) {
      engine.padPostGain.connect(this.recBus);
    }
    if (includeMic && this.micOut) {
      this.micOut.connect(this.recBus);
    }

    // Pre-roll con metrónomo programado por adelantado
    const tStart = ctx.currentTime + 0.15;
    const goTime = tStart + prerollBars * barDur;
    for (let bar = 0; bar < prerollBars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        const tClick = tStart + bar * barDur + beat * (barDur / 4);
        engine.triggerMetronome(tClick, beat === 0);
        if (this.onCountdown) {
          const delayMs = Math.max(0, (tClick - ctx.currentTime) * 1000);
          setTimeout(() => { if (this.onCountdown) this.onCountdown(bar, beat); }, delayMs);
        }
      }
    }

    // Captura PCM determinista (ScriptProcessor). AudioWorklet queda como mejora
    // futura (P5); la captura interna del grafo no introduce deriva audible.
    this.rec = {
      armed: true,
      goTime: goTime,
      beatStarted: false,
      onStartBeat: opts.onStartBeat || null,
      chL: [],
      chR: [],
      mode: includeMic && includeBeat ? "voz+beat" : (includeMic ? "voz" : "beat"),
    };

    this.captureNode = ctx.createScriptProcessor(FoZConstants.REC_CAPTURE_BUFFER_SIZE, 2, 2);
    this.captureNode.onaudioprocess = (e) => this._onCapture(e);
    this.recBus.connect(this.captureNode);

    // El ScriptProcessor necesita estar conectado al árbol para funcionar;
    // lo silenciamos explícitamente hacia salida (no duplica el sonido).
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.captureNode.connect(sink);
    sink.connect(ctx.destination);

    // Respaldo (fallback): MediaRecorder del bus con códec del SO
    try {
      this._startFallbackRecorder();
    } catch (e) { console.warn("Fallback MediaRecorder no disponible:", e); }

    return { goTime: goTime, barDur: barDur };
  }

  _onCapture(e) {
    const r = this.rec;
    if (!r || !r.armed) return;
    const ctx = this.engine.ctx;
    if (ctx.currentTime < r.goTime - 0.002) return;

    // Arranca el beat exactamente en goTime (sincronizado con las primeras muestras)
    if (!r.beatStarted && r.onStartBeat) {
      r.beatStarted = true;
      try { r.onStartBeat(); } catch (err) { console.warn(err); }
    }

    if (!r.startedAt) r.startedAt = ctx.currentTime;
    r.chL.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    r.chR.push(new Float32Array(e.inputBuffer.getChannelData(1)));

    // Límite de seguridad de duración
    const maxSec = FoZConstants.REC_TAKE_MAX_SECONDS;
    if ((r.chL.length * FoZConstants.REC_CAPTURE_BUFFER_SIZE) / ctx.sampleRate >= maxSec) {
      if (this.onStopRequestedByUser) this.onStopRequestedByUser();
    }
  }

  _startFallbackRecorder() {
    if (!this.recBus || typeof MediaRecorder === "undefined") return;
    const destNode = this.engine.ctx.createMediaStreamDestination();
    this.recBus.connect(destNode);

    let mimeType = "";
    // webm/Opus primero: round-trip decodificable en Chromium/Firefox;
    // Safari no soporta webm y caerá a mp4/AAC del propio sistema.
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
    }
    this.fallbackRecorder = new MediaRecorder(destNode.stream, mimeType ? { mimeType } : undefined);
    const recorder = this.fallbackRecorder;
    recorder.chunks = [];
    // Captura por closure local: stop() anula this.fallbackRecorder mientras
    // los últimos chunks aún llegan (evita TypeError de this anulado).
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recorder.chunks.push(e.data);
    };
    recorder.start(250);
  }

  async stop() {
    if (!this.rec || !this.recBus) return null;

    const ctx = this.engine.ctx;
    this.rec.armed = false;

    const capture = this.captureNode;
    const recBus = this.recBus;
    if (capture) {
      capture.onaudioprocess = null;
      try { capture.disconnect(); } catch (e) { /* vacío */ }
    }
    try { recBus.disconnect(); } catch (e) { /* vacío */ }
    this.captureNode = null;

    // Cierra el respaldo y devuelve su blob (solo si la captura falló)
    let fallbackBlob = null;
    if (this.fallbackRecorder) {
      const fr = this.fallbackRecorder;
      this.fallbackRecorder = null;
      try {
        fallbackBlob = await new Promise((resolve) => {
          fr.onstop = () => resolve(new Blob(fr.chunks, { type: fr.mimeType || "audio/webm" }));
          fr.stop();
        });
      } catch (e) { fallbackBlob = null; }
    }

    // Construye AudioBuffer estéreo con los bloques capturados
    const blocks = this.rec.chL.length;
    if (!blocks) {
      this.rec = null;
      if (fallbackBlob && fallbackBlob.size > 0) {
        return this._persistTakeFromBlob(fallbackBlob, fallbackBlob.type, "fallback");
      }
      throw new Error("No se capturó audio. Si había pre-roll, detén la grabación una vez iniciada la cuenta (o revisa el modo y la ganancia).");
    }

    const sampleRate = ctx.sampleRate;
    const len = blocks * FoZConstants.REC_CAPTURE_BUFFER_SIZE;
    const assemblyCtx = ctx;

    // Aplica nudge manual (offsetMs)
    let shiftSamples = Math.round((this.settings.offsetMs || 0) * sampleRate / 1000);

    // Gate offline (determinista): enmascara sesgos de ruido entre frases
    let chL = this._mergeFloat32(this.rec.chL, len);
    let chR = this._mergeFloat32(this.rec.chR, len);
    if (this.settings.gateEnabled) {
      const gated = this._gateOffline(chL, chR, sampleRate, this.settings.gateThresholdDb);
      chL = gated[0]; chR = gated[1];
    }

    if (shiftSamples > 0) {
      // Recorta silencio el inicio (toma suena antes)
      chL = chL.slice(shiftSamples);
      chR = chR.slice(shiftSamples);
    } else if (shiftSamples < 0) {
      // Antepone silencio (toma suena más tarde)
      const pad = new Float32Array(-shiftSamples);
      chL = Float32Array.from([...pad, ...chL]);
      chR = Float32Array.from([...pad, ...chR]);
    }

    const outBuffer = assemblyCtx.createBuffer(2, chL.length, sampleRate);
    outBuffer.copyToChannel(chL, 0);
    outBuffer.copyToChannel(chR, 1);

    const wavBlob = this.engine._audioBufferToWavBlob(outBuffer);

    // Analítica de detalle profesional
    let peak = 0;
    for (let i = 0; i < chL.length; i += 8) {
      const v = Math.abs(chL[i]);
      if (v > peak) peak = v;
    }

    const durationSec = chL.length / sampleRate;
    const take = {
      id: "take_" + Date.now(),
      name: "toma_" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
      createdAt: new Date().toISOString(),
      sampleRate: sampleRate,
      channels: 2,
      length: chL.length,
      durationSec: durationSec,
      offsetMs: this.settings.offsetMs || 0,
      mode: this.rec.mode,
      size: wavBlob.size,
      peak: peak,
      clipped: peak >= 0.98,
      blob: wavBlob,
    };

    await this._persistTake(take);
    this.rec = null;
    return take;
  }

  _mergeFloat32(blocks, totalLen) {
    const out = new Float32Array(totalLen);
    let off = 0;
    for (const b of blocks) {
      if (off + b.length > totalLen) {
        out.set(b.subarray(0, totalLen - off), off);
        break;
      }
      out.set(b, off);
      off += b.length;
    }
    return out;
  }

  /**
   * Gate offline determinista: calcula envolvente RMS por bloques y desciende
   * el volumen de los silencios con ataque/release suaves (lo que queda en el
   * WAV es reproducible e idéntico en cualquier máquina).
   */
  _gateOffline(chL, chR, sampleRate, thresholdDb = -46) {
    const threshold = Math.pow(10, thresholdDb / 20);
    const blockSize = 256;
    const attackMs = 3, releaseMs = 40;
    const attackCoef = Math.exp(-1 / ((attackMs / 1000) * sampleRate));
    const releaseCoef = Math.exp(-1 / ((releaseMs / 1000) * sampleRate));

    const L = new Float32Array(chL.length);
    const R = new Float32Array(chR.length);
    let env = 0;

    for (let i = 0; i < chL.length; i += blockSize) {
      const end = Math.min(i + blockSize, chL.length);
      let sum = 0, count = 0;
      for (let j = i; j < end; j++) {
        const v = (Math.abs(chL[j]) + Math.abs(chR[j])) / 2;
        sum += v * v; count++;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      const target = rms < threshold ? 0 : 1;
      env = target === 0 ? env * releaseCoef : env * attackCoef + (1 - attackCoef);
      for (let j = i; j < end; j++) {
        L[j] = chL[j] * env;
        R[j] = chR[j] * env;
      }
    }
    return [L, R];
  }

  // ===========================================================================
  // TOMAS — IndexedDB
  // ===========================================================================

  _dbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("foz-soundpro", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("takes")) {
          db.createObjectStore("takes", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB bloqueada"));
    });
  }

  async _persistTake(take) {
    const db = await this._dbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("takes", "readwrite");
      tx.objectStore("takes").put(take);
      tx.oncomplete = () => resolve(take);
      tx.onerror = () => reject(tx.error);
    });
  }

  async listTakes() {
    const db = await this._dbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("takes", "readonly");
      const req = tx.objectStore("takes").getAll();
      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTake(id) {
    const db = await this._dbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("takes", "readwrite");
      tx.objectStore("takes").delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  downloadTake(take) {
    const mime = "audio/wav";
    const blobUrl = URL.createObjectURL(new Blob([take.blob], { type: mime }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${take.name}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  async _persistTakeFromBlob(blob, mime, mode) {
    try {
      // Decodifica el fallback para devolver take estructurado
      const ab = await blob.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => {
        this.engine.ctx.decodeAudioData(ab, resolve, reject);
      });
      const take = {
        id: "take_" + Date.now(),
        name: "toma_fallback_" + Date.now(),
        createdAt: new Date().toISOString(),
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        length: buffer.length,
        durationSec: buffer.duration,
        offsetMs: 0,
        mode: mode || "fallback",
        size: blob.size,
        peak: 0, clipped: false,
        blob: blob,
        mimeType: blob.type,
      };
      await this._persistTake(take);
      return take;
    } catch (e) {
      throw new Error("Fallback no decodificable: " + e.message);
    }
  }
}

window.fozRecStudio = new FoZRecStudio(window.fozAudioEngine);
