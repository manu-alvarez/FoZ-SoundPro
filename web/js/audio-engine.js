/**
 * FoZ SoundPro — Web Audio Synthesis, Recording & Export Engine
 * ============================================================
 * Motor de síntesis 100% nativo mediante Web Audio API (sin muestras externas obligatorias).
 * Genera sonidos de batería analógicos/digitales (Kick, Snare, Hi-Hats, 808, Clap, Rimshot),
 * gestiona la grabación de voz por micrófono y exporta audio WAV PCM estándar sin servidor.
 */

class FoZAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.analyser = null;
    this.isInitialized = false;

    // Grabación de voz
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedAudioBlob = null;
    this.micStream = null;
    this.micAnalyser = null;
    this.isRecording = false;

    // Generador de ruido compartido
    this.noiseBuffer = null;
  }

  /**
   * Inicializa el contexto de audio tras un gesto del usuario (clic/touch).
   */
  async init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
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

    // Analizador visual para espectro/osciloscopio
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Cadena: Instrumentos -> Compressor -> Gain -> Analyser -> Speakers
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Crear búfer de ruido blanco estéreo de 1 segundo
    this._createNoiseBuffer(this.ctx);

    this.isInitialized = true;
  }

  _createNoiseBuffer(context) {
    const bufferSize = context.sampleRate * 1.5;
    this.noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  setMasterVolume(val) {
    if (this.masterGain && this.ctx) {
      const v = Math.max(0, Math.min(1.2, val));
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }

  // ===========================================================================
  // SÍNTESIS DE INSTRUMENTOS DE BATERÍA
  // ===========================================================================

  /**
   * Bombo (Kick) analógico/trap: caída exponencial de frecuencia con pegada (click)
   */
  triggerKick(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    // Capa 1: Cuerpo sub-grave (barrido de 150 Hz a 38 Hz)
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

    // Capa 2: Click transitorio de ataque (pegada en frecuencias medias)
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
   * Caja (Snare): cuerpo tonal + ruido filtrado de bordones
   */
  triggerSnare(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    // 1. Cuerpo tonal
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

    // 2. Ruido de los bordones
    if (!this.noiseBuffer) this._createNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

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
   * Hi-Hat Cerrado: ruido metálico con filtro pasa-altos y caída rápida
   */
  triggerClosedHiHat(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    if (!this.noiseBuffer) this._createNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

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
   * Hi-Hat Abierto: textura metálica con cola más larga
   */
  triggerOpenHiHat(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    if (!this.noiseBuffer) this._createNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

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
   * Clap: ráfagas triples de ruido micro-espaciadas (10 ms) con decaimiento natural
   */
  triggerClap(time = 0, velocity = 1.0, destination = null) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    if (!this.noiseBuffer) this._createNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = ctx.createGain();
    // 3 micro impulsos: 0 ms, 11 ms, 22 ms
    gain.gain.setValueAtTime(0, t);
    gain.gain.setValueAtTime(0.6 * vel, t);
    gain.gain.setValueAtTime(0.1, t + 0.009);
    gain.gain.setValueAtTime(0.7 * vel, t + 0.011);
    gain.gain.setValueAtTime(0.15, t + 0.020);
    gain.gain.setValueAtTime(0.8 * vel, t + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.25);
  }

  /**
   * Bajo 808: subgrave profundo con distorsión armónica suave y sustain
   */
  trigger808(time = 0, velocity = 1.0, destination = null, noteFreq = 41.2) {
    const ctx = destination ? destination.context : this.ctx;
    const dest = destination || this.masterCompressor;
    const t = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Ligero pitch drop al inicio del 808 para ataque
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
   * Rimshot / Perc: golpe agudo seco y metálico
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

  /**
   * Despachador de instrumento según ID
   */
  triggerInstrument(instId, time = 0, velocity = 1.0, destination = null) {
    switch (instId) {
      case "kick":
        this.triggerKick(time, velocity, destination);
        break;
      case "snare":
        this.triggerSnare(time, velocity, destination);
        break;
      case "hihat_closed":
        this.triggerClosedHiHat(time, velocity, destination);
        break;
      case "hihat_open":
        this.triggerOpenHiHat(time, velocity, destination);
        break;
      case "clap":
        this.triggerClap(time, velocity, destination);
        break;
      case "bass808":
        this.trigger808(time, velocity, destination);
        break;
      case "rimshot":
        this.triggerRimshot(time, velocity, destination);
        break;
      default:
        console.warn(`Instrumento desconocido: ${instId}`);
    }
  }

  /**
   * Genera el clic del metrónomo en el pulso correspondiente
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
  // GRABACIÓN DE VOZ (MICROPHONE)
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

      // Crear visualizador para el micrófono
      const micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      micSource.connect(this.micAnalyser);

      this.recordedChunks = [];

      // Seleccionar códec soportado
      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        options = { mimeType: "audio/ogg;codecs=opus" };
      }

      this.mediaRecorder = new MediaRecorder(this.micStream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
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

        // Detener pistas del micro para liberar hardware
        if (this.micStream) {
          this.micStream.getTracks().forEach((track) => track.stop());
          this.micStream = null;
        }

        resolve(this.recordedAudioBlob);
      };

      this.mediaRecorder.onerror = (e) => {
        reject(e.error);
      };

      this.mediaRecorder.stop();
    });
  }

  // ===========================================================================
  // RENDERIZADO Y EXPORTACIÓN DE AUDIO WAV (OFFLINE CONTEXT)
  // ===========================================================================

  /**
   * Renderiza un patrón completo del secuenciador a WAV PCM 16-bit estéreo 44.1kHz.
   * Sin backend, completamente en el navegador mediante OfflineAudioContext.
   */
  async exportPatternToWavBlob(projectData, repeatBars = 2) {
    const sampleRate = 44100;
    const bpm = projectData.bpm || 90;
    const stepsCount = projectData.stepsCount || 16;
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / 4; // Asumiendo compás 4/4 y 16 pasos por compás
    const barDuration = secondsPerStep * stepsCount;
    const totalDuration = barDuration * repeatBars + 1.0; // +1.0s de margen para colas de reverb/release

    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtxClass) {
      throw new Error("OfflineAudioContext no disponible en este navegador.");
    }

    const offlineCtx = new OfflineCtxClass(2, Math.ceil(sampleRate * totalDuration), sampleRate);

    // Crear compresor master offline
    const offlineComp = offlineCtx.createDynamicsCompressor();
    offlineComp.threshold.setValueAtTime(-3, 0);
    offlineComp.ratio.setValueAtTime(8, 0);
    offlineComp.connect(offlineCtx.destination);

    // Instanciar ruido offline
    this._createNoiseBuffer(offlineCtx);

    // Programar notas para cada repetición de compás
    for (let r = 0; r < repeatBars; r++) {
      const barOffset = r * barDuration;

      projectData.tracks.forEach((track) => {
        if (track.muted) return;

        // Ganancia individual de pista offline
        const trackGain = offlineCtx.createGain();
        trackGain.gain.setValueAtTime(track.volume !== undefined ? track.volume : 0.8, 0);
        trackGain.connect(offlineComp);

        track.steps.forEach((active, stepIdx) => {
          if (active && stepIdx < stepsCount) {
            // Aplicar swing si está configurado
            let stepTime = barOffset + stepIdx * secondsPerStep;
            if (projectData.swing && stepIdx % 2 === 1) {
              stepTime += secondsPerStep * (projectData.swing * 0.33);
            }

            const vel = track.velocities ? track.velocities[stepIdx] || 0.9 : 0.9;
            this.triggerInstrument(track.id, stepTime, vel, trackGain);
          }
        });
      });
    }

    // Renderizar audio offline
    const renderedBuffer = await offlineCtx.startRendering();

    // Codificar a formato WAV estándar
    return this._audioBufferToWavBlob(renderedBuffer);
  }

  /**
   * Convierte un AudioBuffer en un Blob RIFF/WAVE PCM 16 bits firmado estéreo.
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
    const totalByteCount = 44 + dataByteCount; // 44 bytes de cabecera estándar RIFF

    const buffer = new ArrayBuffer(totalByteCount);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // 1. Chunk RIFF
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataByteCount, true); // tamaño de archivo - 8
    writeString(8, "WAVE");

    // 2. Chunk fmt
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);             // Subchunk1Size (16 para PCM)
    view.setUint16(20, format, true);         // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);    // NumChannels
    view.setUint32(24, sampleRate, true);     // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);     // BlockAlign
    view.setUint16(34, bitDepth, true);       // BitsPerSample

    // 3. Chunk data
    writeString(36, "data");
    view.setUint32(40, dataByteCount, true);  // Subchunk2Size

    // Escribir muestras intercaladas (L, R, L, R...)
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        // Clamping a [-1.0, 1.0]
        sample = Math.max(-1, Math.min(1, sample));
        // Escalar a entero de 16 bits con signo
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }
}

// Exportar como singleton en contexto global
window.fozAudioEngine = new FoZAudioEngine();
