/**
 * FoZ SoundPro — Sample Studio (muestras locales por pista) (v1.1)
 * ================================================================
 * Permite cargar una muestra de audio local (WAV/MP3/M4A/OGG/FLAC) en
 * cualquier pista del secuenciador y dispararla como las voces sintéticas.
 *
 * Notas de diseño:
 *  - Decodificación con decodeAudioData del contexto ONLINE (soporte universal;
 *    el OfflineAudioContext no se usa para decodificar por compatibilidad).
 *  - El resampleo entre buffer y contexto lo resuelve la propia spec de
 *    AudioBufferSourceNode (playbackRate 1), sin conversión manual.
 *  - Las muestras viven SOLO en memoria de la sesión (regla 11: nada de audio
 *    pesado en Git ni persistido en LocalStorage/.foz).
 */

class FoZSampler {
  constructor() {
    // trackId -> { buffer: AudioBuffer, name: string, duration: number, sampleRate }
    this.samples = new Map();
  }

  isSupportedAudioFile(file) {
    const ext = (file.name || "").toLowerCase().split(".").pop();
    return ["wav", "mp3", "m4a", "aac", "ogg", "oga", "flac", "webm", "mp4"].includes(ext);
  }

  async loadSample(trackId, file) {
    const engine = window.fozAudioEngine;
    if (!engine) throw new Error("Motor de audio no disponible.");
    if (!this.isSupportedAudioFile(file)) {
      throw new Error("Formato no admitido. Usa WAV, MP3, M4A, AAC, OGG o FLAC.");
    }

    await engine.init();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = await new Promise((resolve, reject) => {
      engine.ctx.decodeAudioData(arrayBuffer, resolve, (err) => {
        reject(new Error("No se pudo decodificar el audio: " + (err && err.message ? err.message : "formato no soportado")));
      });
    });

    this.samples.set(trackId, {
      buffer: buffer,
      name: file.name,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
    });

    return this.samples.get(trackId);
  }

  hasSample(trackId) {
    return this.samples.has(trackId) && Boolean(this.samples.get(trackId).buffer);
  }

  getSample(trackId) {
    return this.samples.get(trackId) || null;
  }

  getSampleName(trackId) {
    const s = this.samples.get(trackId);
    return s ? s.name : null;
  }

  async importKit(files) {
    const voiceIds = ["kick","snare","clap","hihat_closed","hihat_open","rimshot","crash","tom_low","tom_mid","cowbell","shaker"];
    const alias = {kick:"kick",bombo:"kick",snare:"snare",clap:"clap",hihat_closed:"hihat_closed",hihat_open:"hihat_open",hat:"hihat_closed",rim:"rimshot",crash:"crash",tom_low:"tom_low",tom_mid:"tom_mid",cow:"cowbell",cowbell:"cowbell",maracas:"shaker",shaker:"shaker"};
    let imported = 0, skipped = 0, synthesis = 0;
    for (const file of (files || [])) {
      const stem = (file.name || "").toLowerCase().replace(/\.wav$/, "");
      let vid = null;
      // 1) carpeta = voiceId (webkitdirectory) — prioridad absoluta
      const folder = (file.webkitRelativePath || "").split("/")[0].toLowerCase();
      if (voiceIds.includes(folder)) vid = folder;
      // 2) nombre de archivo exacto = voiceId
      else if (voiceIds.includes(stem)) vid = stem;
      // 3) substring sobre voiceIds (más larga primero, evita que "tom" coma "tom_low")
      if (!vid) {
        const ordered = [...voiceIds].sort((a, b) => b.length - a.length);
        for (const v of ordered) {
          if (stem.includes(v) || (file.webkitRelativePath || "").includes(v)) { vid = v; break; }
        }
      }
      // 4) alias por stem (entradas de usuario tipo "bombo", "cow", "maracas")
      if (!vid) {
        for (const [k, val] of Object.entries(alias)) {
          if (stem.includes(k)) { vid = val; break; }
        }
      }
      if (vid) {
        try { await this.loadSample(vid, file); imported++; }
        catch (e) { skipped++; }
      }
    }
    synthesis = 5;
    return {imported, skipped, synthesis, total: imported + synthesis};
  }

  clearSample(trackId) {
    this.samples.delete(trackId);
  }

  /**
   * Dispara la muestra con la misma interfaz que las voces del motor:
   * triggerSample(trackId, time, velocity, destination).
   * Compatiple con el contexto online (preview/secuenciador) y con el
   * OfflineAudioContext del export (destination = compresor offline).
   */
  triggerSample(trackId, time = 0, velocity = 1.0, destination = null) {
    const engine = window.fozAudioEngine;
    if (!engine || !engine.ctx) return;

    const sample = this.samples.get(trackId);
    if (!sample || !sample.buffer) return;

    const baseCtx = destination ? destination.context : engine.ctx;
    const dest = destination || engine.masterCompressor;

    const src = baseCtx.createBufferSource();
    src.buffer = sample.buffer;

    const t = time > 0 ? time : baseCtx.currentTime;
    const gain = baseCtx.createGain();
    gain.gain.setValueAtTime(Math.max(0.05, Math.min(1.0, velocity)), t);
    src.connect(gain);
    gain.connect(dest);

    src.start(t);
    src.stop(t + sample.buffer.duration + 0.05);
  }
}

window.fozSampler = new FoZSampler();
