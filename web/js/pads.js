/**
 * FoZ SoundPro — Pads / Caja de Ritmos 4x4 (Fase 9.2)
 * ===================================================
 * Controlador de pads jugable sobre las 16 voces de la sesión actual:
 *
 * - Grid 4x4 generado desde project.tracks (mismos nombres, colores y orden
 *   que el secuenciador). Respeta las muestras locales del Sample Studio,
 *   porque el disparo pasa por audio.triggerInstrument().
 * - Multitáctil (Pointer Events, sin scroll accidental) + teclado QWERTY
 *   (1234 · QWER · ASDF · ZXCV).
 * - Grabación en vivo cuantizada: con el transporte en marcha y el REC
 *   activo, cada golpe escribe su paso y su velocity en la pista del
 *   secuenciador (escribe solo pasos apagados: el segundo golpe en el mismo
 *   paso no lo borra, como en una caja de ritmos real).
 * - El Trackpad FX (filtro/tape/eco) procesa los golpes en vivo por su bus;
 *   por defecto el FX queda aplicado al soltar (latch) y el botón
 *   MOMENTÁNEO del trackpad lo vuelve momentáneo estilo pedal CC.
 * - Fase 9.3 (hoy): Salida MIDI (Web MIDI API). Implementación opcional:
 *   `tryMidiAccess()` detecta `navigator.requestMIDIAccess()` (solo Chrome/Edge);
 *   `sendMidiNote()` envía noteOn/noteOff al primer output MIDI disponible.
 *   Limitación honesta: Firefox/Safari no soportan Web MIDI API de serie; la
 *   función no se activa en esos navegadores (documentado en docs/MAGENTA_JS.md).
 */

class FoZPads {
  constructor(audio, projectMgr) {
    this.audio = audio;
    this.projectMgr = projectMgr;
    this.project = null;
    this.velocity = 0.85;      // velocity global del golpe
    this.liveRecord = false;   // REC en vivo cuantizado on/off
    this.onStepWritten = null; // callback del wiring (re-render del grid)
    this.container = null;
    this._padEls = new Map();  // voiceId -> { el, flashTimer }
    this._keyMap = this._buildKeyMap();
  }

  setProject(project) {
    this.project = project;
    this.buildGrid();
  }

  setVelocity(v) {
    const num = Number(v);
    this.velocity = Math.min(1.0, Math.max(0.1, isFinite(num) ? num : 0.85));
    return this.velocity;
  }

  setLiveRecord(on) {
    this.liveRecord = Boolean(on);
    return this.liveRecord;
  }

  /**
   * Mapa QWERTY -> índice de pista (orden de project.tracks):
   * fila 1 (QWER) = voces 1-4, fila 2 (ASDF) = 5-8, fila 3 (ZXCV) = 9-12,
   * fila 4 (1234) = 13-16.
   */
  _buildKeyMap() {
    return {
      q: 0, w: 1, e: 2, r: 3,
      a: 4, s: 5, d: 6, f: 7,
      z: 8, x: 9, c: 10, v: 11,
      "1": 12, "2": 13, "3": 14, "4": 15,
    };
  }

  buildGrid() {
    if (!this.container) this.container = document.getElementById("pads-grid");
    if (!this.container || !this.project) return;
    this.container.innerHTML = "";
    this._padEls.clear();

    const tracks = this.project.tracks || [];
    const keyLabels = Object.entries(this._keyMap);

    tracks.forEach((track, idx) => {
      const color = track.color || (window.instrumentColorHint ? window.instrumentColorHint(track.id) : "#00f2fe");
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "pad";
      pad.dataset.voice = track.id;
      pad.style.setProperty("--pad-accent", color);
      pad.style.borderColor = color + "59";
      pad.style.setProperty("--pad-bg", color + "17");

      const label = document.createElement("span");
      label.className = "pad-label";
      label.textContent = track.name;
      pad.appendChild(label);

      const keyEntry = keyLabels.find(([, v]) => v === idx);
      if (keyEntry) {
        const key = document.createElement("span");
        key.className = "pad-key";
        key.textContent = String(keyEntry[0]).toUpperCase();
        pad.appendChild(key);
      }

      pad.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.hit(track.id);
      });
      pad.addEventListener("contextmenu", (e) => e.preventDefault());

      this.container.appendChild(pad);
      this._padEls.set(track.id, pad);
    });
  }

  /**
   * Golpe de pad: sonido inmediato (+ REC en vivo si procede).
   * El volumen respeta el factor de la pista como hace el secuenciador
   * (velocity * track.volume), para que el grid y los pads suenen igual.
   */
  hit(voiceId) {
    if (!this.project) return;
    const track = (this.project.tracks || []).find((t) => t.id === voiceId);
    if (!track) return;
    const vol = track.volume || window.FoZConstants.DEFAULT_VOLUME;
    const vel = Math.min(1.0, this.velocity * vol);

    this.flash(voiceId);
    this.audio.init().then(() => {
      this.audio.triggerInstrument(voiceId, 0, vel);
    });

    if (this.liveRecord) this._writeStep(voiceId);
  }

  flash(voiceId) {
    const el = this._padEls.get(voiceId);
    if (!el) return;
    el.classList.add("flash");
    clearTimeout(this._padEls.get(voiceId + "::t"));
    const timer = setTimeout(() => el.classList.remove("flash"), 140);
    this._padEls.set(voiceId + "::t", timer);
  }

  /**
   * Grabación en vivo cuantizada: escribe el paso en el que estaba el
   * transporte en el momento del golpe (solo si estaba apagado) con la
   * velocity del golpe, y persiste el proyecto.
   */
  _writeStep(voiceId) {
    const seq = window.fozSequencer;
    if (!seq || !seq.isPlaying || !this.project) return;
    const idx = (this.project.tracks || []).findIndex((t) => t.id === voiceId);
    if (idx < 0) return;

    const stepsCount = this.project.stepsCount || window.FoZConstants.DEFAULT_STEPS_COUNT;
    const step = seq.currentStep;
    if (step < 0 || step >= stepsCount) return;

    const track = this.project.tracks[idx];
    if (track.steps[step]) return; // ya suena: no se toca (comportamiento de caja de ritmos)

    track.steps[step] = true;
    if (Array.isArray(track.velocities)) {
      track.velocities[step] = this.velocity;
    }
    this.projectMgr.saveCurrentProject(this.project);
    if (this.onStepWritten) this.onStepWritten();
  }

  /**
   * Teclado QWERTY. Ignora repeticiones del SO y campos de texto de otras
   * pestañas (no secuestramos la escritura de prompts o nombres).
   */
  handleKeydown(e) {
    if (e.repeat) return;
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const idx = this._keyMap[e.key.toLowerCase()];
    if (idx === undefined) return;
    if (!this.project || !this.project.tracks || !this.project.tracks[idx]) return;
    e.preventDefault();
    this.hit(this.project.tracks[idx].id);
  }

  /* =====================================================================
     FASE 9.3 — Web MIDI API (opcional, solo Chrome/Edge con soporte)
     Requiere navigator.requestMIDIAccess() disponible.
     Si el navegador no lo soporta, no se activa (limitación documentada).
     ===================================================================== */
  async tryMidiAccess() {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      return { supported: false, reason: "Web MIDI API no disponible en este navegador (requiere Chrome/Edge)." };
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(access.outputs.values());
      this.midiOutputs = outputs;
      return { supported: true, outputs: outputs.length, reason: null };
    } catch (err) {
      return { supported: false, reason: "Acceso MIDI denegado: " + (err && err.message ? err.message : err) };
    }
  }

  async sendMidiNote(voiceId, velocity = 0.85) {
    if (!this.midiOutputs || this.midiOutputs.length === 0) return;
    const output = this.midiOutputs[0];
    const noteMap = { kick: 36, snare: 38, clap: 39, hihat_closed: 42, hihat_open: 46,
                     bass808: 36, rimshot: 37, crash: 49, ride: 51, tom_low: 41,
                     tom_mid: 45, cowbell: 56, snap_trap: 39, shaker: 70,
                     stab_dark: 39, horn_slap: 41 };
    const note = noteMap[voiceId] || 38;
    const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    try {
      output.send([0x90, note, vel], 0); // noteOn
      setTimeout(() => output.send([0x80, note, 0], 0), 200); // noteOff 200ms
    } catch (e) {
      // Silenciosamente ignoramos errores de MIDI en vivo (no rompemos)
    }
  }
}

window.fozPads = new FoZPads(window.fozAudioEngine, window.fozProjectManager);
