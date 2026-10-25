/**
 * FoZ SoundPro — Base Library (bases/instrumentales importadas) (v1.1)
 * ===================================================================
 * Importa archivos de audio locales (MP3, M4A, WAV, OGG, FLAC) para usarlos
 * como base/instrumental por encima del beat, con reproducción sincronizada
 * al transporte del secuenciador y horneado determinista en el export WAV.
 *
 * M3U/M3U8: se trata como MANIFIESTO LOCAL de catálogo (títulos/ordenes).
 * No se ejecuta streaming remoto (modo offline, coste 0 €, reglas del proyecto).
 * Los ficheros se vinculan con un selector multi-archivo; el emparejamiento es
 * por coincidencia normalizada de nombre.
 */

class FoZBaseLibrary {
  constructor() {
    this._idSeq = 0;
    this.bases = [];           // { id, name, buffer, duration }
    this.activeId = null;
    this.settings = { gain: 0.85, loop: true, fadeInSec: 0, fadeOutSec: 0 };
    this.catalog = [];         // entradas del .m3u parseadas
    this.catalogName = "";
    this.matchedCount = 0;
    this.playing = null;       // { source, gain }
    this.onCatalogChanged = null;
  }

  // ===========================================================================
  // IMPORTACIÓN DE AUDIO
  // ===========================================================================

  async importFiles(files) {
    const engine = window.fozAudioEngine;
    await engine.init();

    const results = { imported: [], failed: [] };
    for (const file of Array.from(files)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await new Promise((resolve, reject) => {
          engine.ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });

        const entry = {
          id: "base_" + (++this._idSeq),
          name: file.name,
          buffer: buffer,
          duration: buffer.duration,
        };
        this.bases.push(entry);
        results.imported.push(entry);
        if (!this.activeId) this.activeId = entry.id;
      } catch (err) {
        results.failed.push({ name: file.name, error: err && err.message });
      }
    }
    return results;
  }

  getActive() {
    return this.bases.find((b) => b.id === this.activeId) || null;
  }

  setActive(id) {
    this.activeId = id;
  }

  remove(id) {
    if (this.playing && this.playing.baseId === id) this.stopLive();
    this.bases = this.bases.filter((b) => b.id !== id);
    if (this.activeId === id) {
      this.activeId = this.bases.length ? this.bases[0].id : null;
    }
  }

  // ===========================================================================
  // MANIFIESTO M3U / M3U8 (solo lectura local de metadatos)
  // ===========================================================================

  async importM3UFile(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim());

    // Detección: m3u8 puede ser HLS de streaming (no compatible con offline)
    const isHls = lines.some((l) => l.startsWith("#EXT-X-TARGETDURATION") || l.startsWith("#EXT-X-STREAM-INF"));
    if (isHls) {
      throw new Error("El archivo parece una lista HLS de streaming (#EXT-X…); no compatible con el modo offline. Descarga los audios y crea un .m3u local.");
    }

    const entries = [];
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      entries.push({ path: line, title: "", duration: 0 });
    }

    let pendingInf = null;
    for (const line of lines) {
      if (line.startsWith("#EXTINF:")) {
        const body = line.slice(8);
        const commaIdx = body.indexOf(",");
        const dur = parseFloat(commaIdx > 0 ? body.slice(0, commaIdx) : body);
        const title = commaIdx > 0 ? body.slice(commaIdx + 1) : "";
        pendingInf = { duration: isNaN(dur) ? 0 : dur, title: title.trim() };
      } else if (line && !line.startsWith("#")) {
        const meta = pendingInf || { duration: 0, title: "" };
        entries.push({ path: line, title: meta.title || "", duration: meta.duration });
        pendingInf = null;
      }
    }
    // de-duplicar (el primer bucle pudo añadir rutas crudas)
    const seen = new Set();
    const unique = entries.filter((e) => {
      if (seen.has(e.path)) return false;
      seen.add(e.path);
      return true;
    });

    this.catalog = unique;
    this.catalogName = file.name;
    this.matchedCount = this._countMatches();
    if (this.onCatalogChanged) this.onCatalogChanged(this.catalog);
    return unique.length;
  }

  _norm(name) {
    return name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[\s_\-]+/g, " ").trim();
  }

  _countMatches() {
    if (!this.catalog.length || !this.bases.length) return 0;
    const baseNames = new Set(this.bases.map((b) => this._norm(b.name)));
    return this.catalog.filter((e) => {
      const last = e.path.split(/[\\\/]/).pop();
      return baseNames.has(this._norm(last));
    }).length;
  }

  matchCatalogFiles(files) {
    // Empareja ficheros recién importados con las entradas del manifiesto
    const catNorms = new Map();
    this.catalog.forEach((e) => catNorms.set(this._norm(e.path.split(/[\\\/]/).pop()), e));
    let matched = 0;
    Array.from(files).forEach((f) => {
      if (catNorms.has(this._norm(f.name || "ab"))) matched++;
    });
    this.matchedCount = this._countMatches();
    return matched;
  }

  // ===========================================================================
  // REPRODUCCIÓN SINCRONIZADA CON EL TRANSPORTE
  // ===========================================================================

  async startLive(offsetSec = 0) {
    const engine = window.fozAudioEngine;
    await engine.init();

    const base = this.getActive();
    if (!base) return false;

    this.stopLive();

    const src = engine.ctx.createBufferSource();
    src.buffer = base.buffer;
    src.loop = this.settings.loop;

    const gain = engine.ctx.createGain();
    const T = engine.ctx.currentTime + 0.06;
    const targetGain = Math.max(0, Math.min(FoZConstants.BASE_GAIN_MAX, this.settings.gain));

    if (this.settings.fadeInSec > 0) {
      gain.gain.setValueAtTime(0.0001, T);
      gain.gain.linearRampToValueAtTime(targetGain, T + this.settings.fadeInSec);
    } else {
      gain.gain.setValueAtTime(targetGain, T);
    }

    src.connect(gain);
    gain.connect(engine.masterCompressor);
    src.start(T + Math.max(0, offsetSec || 0));

    this.playing = { source: src, gain: gain, baseId: base.id, startedAt: T };
    return true;
  }

  stopLive() {
    if (!this.playing) return;
    try { this.playing.source.stop(0); } catch (e) { /* ya detenido */ }
    try { this.playing.gain.disconnect(); } catch (e) { /* vacío */ }
    this.playing = null;
  }

  /**
   * Parámetros para hornear la base activa en el export WAV offline.
   */
  exportParams() {
    const b = this.getActive();
    if (!b) return null;
    return {
      buffer: b.buffer,
      gain: Math.max(0, Math.min(FoZConstants.BASE_GAIN_MAX, this.settings.gain)),
      fadeInSec: Math.max(0, Math.min(FoZConstants.BASE_FADE_MAX_SEC, this.settings.fadeInSec)),
      fadeOutSec: Math.max(0, Math.min(FoZConstants.BASE_FADE_MAX_SEC, this.settings.fadeOutSec)),
    };
  }
}

window.fozBaseLibrary = new FoZBaseLibrary();
