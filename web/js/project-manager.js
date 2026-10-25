/**
 * FoZ SoundPro — Project Manager & Preset Library (v1.1)
 * ======================================================
 * Gestiona el formato de proyecto nativo versionado (.foz), la persistencia en
 * LocalStorage, la migración automática de esquemas (1.0.0 -> 1.1.0) y una
 * biblioteca de 8 presets (4 clásicos + 4 kits nuevos con las voces v1.1).
 *
 * Novedades v1.1:
 *  - Kit de 16 instrumentos canónicos (con orden estable).
 *  - Estado del Trackpad FX persistido por proyecto (project.padFx).
 *  - Migrador automático para proyectos .foz v1.0 (añade pistas nuevas vacías).
 *  - Las muestras del Sample Studio se archivan al exportar (buffers nunca
 *    se serializan) para proteger LocalStorage y los .foz.
 */

class FoZProjectManager {
  constructor() {
    this.STORAGE_KEY_CURRENT = FoZConstants.STORAGE_KEY_CURRENT;
    this.STORAGE_KEY_LIST = FoZConstants.STORAGE_KEY_LIST;
  }

  // ===========================================================================
  // DEFINICIÓN CANÓNICA DE PISTAS (16 VOCES v1.1)
  // ===========================================================================

  getTrackDefs() {
    return [
      { id: "kick",         name: "Bombo (Kick 808)", defaultVol: 0.95 },
      { id: "snare",        name: "Caja (Snare)",     defaultVol: 0.90 },
      { id: "clap",         name: "Palmas (Clap)",    defaultVol: 0.85 },
      { id: "hihat_closed", name: "Hi-Hat Cerrado",   defaultVol: 0.80 },
      { id: "hihat_open",   name: "Hi-Hat Abierto",   defaultVol: 0.75 },
      { id: "bass808",      name: "Sub-Bajo 808",     defaultVol: 0.90 },
      { id: "rimshot",      name: "Aro (Rimshot)",    defaultVol: 0.75 },
      { id: "crash",        name: "Crash Cymbal",     defaultVol: 0.70 },
      { id: "ride",         name: "Ride Cymbal",      defaultVol: 0.70 },
      { id: "tom_low",      name: "Tom Grave",        defaultVol: 0.80 },
      { id: "tom_mid",      name: "Tom Medio",        defaultVol: 0.80 },
      { id: "cowbell",      name: "Cowbell",          defaultVol: 0.75 },
      { id: "snap_trap",    name: "Snap Trap",        defaultVol: 0.80 },
      { id: "shaker",       name: "Shaker",           defaultVol: 0.70 },
      { id: "stab_dark",    name: "Stab Dark",        defaultVol: 0.75 },
      { id: "horn_slap",    name: "Horn Slap",        defaultVol: 0.75 },
    ];
  }

  getDefaultTracks(stepsCount = FoZConstants.DEFAULT_STEPS_COUNT) {
    return this.getTrackDefs().map((def) => ({
      id: def.id,
      name: def.name,
      muted: false,
      solo: false,
      volume: def.defaultVol,
      steps: new Array(stepsCount).fill(false),
      velocities: new Array(stepsCount).fill(FoZConstants.DEFAULT_VELOCITY),
    }));
  }

  padFxDefaults() {
    return {
      active: false,      // El FX está neutro hasta que el trackpad se toca
      mapX: "lowpass",    // lowpass | highpass
      mapY: "tape",       // tape (saturación) | echo (eco de corchea)
      x: 1.0,             // normalizado 0..1 (1.0 = filtro totalmente abierto)
      y: 0.0,             // normalizado 0..1 (0 = sin drive / sin eco)
      latch: false,       // mantener el último valor al soltar (estilo CC pedal)
      inExport: true,     // hornear FX en el export WAV
    };
  }

  createNewProject(name = "Nuevo Beat", bpm = 90) {
    return {
      format: FoZConstants.FORMAT_ID,
      version: FoZConstants.SCHEMA_VERSION,
      id: "foz_" + Date.now(),
      name: name,
      bpm: bpm,
      swing: 0.1,
      stepsCount: FoZConstants.DEFAULT_STEPS_COUNT,
      masterVolume: 0.85,
      padFx: this.padFxDefaults(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: this.getDefaultTracks(FoZConstants.DEFAULT_STEPS_COUNT),
    };
  }

  // ===========================================================================
  // MIGRADOR DE ESQUEMA (1.0.0 -> 1.1.0) — idempotente y no destructivo
  // ===========================================================================

  migrateProject(obj) {
    if (!obj || typeof obj !== "object") return obj;

    // 1. stepsCount numérico y acotado
    if (typeof obj.stepsCount !== "number" || obj.stepsCount < FoZConstants.MIN_STEPS_COUNT) {
      obj.stepsCount = FoZConstants.DEFAULT_STEPS_COUNT;
    }
    obj.stepsCount = Math.max(
      FoZConstants.MIN_STEPS_COUNT,
      Math.min(FoZConstants.MAX_STEPS_COUNT, Math.floor(obj.stepsCount))
    );

    // 2. Pistas: rellenar las que faltan (voces v1.1) y redimensionar arrays
    const defs = this.getTrackDefs();
    obj.tracks = obj.tracks || [];
    defs.forEach((def) => {
      let track = obj.tracks.find((t) => t.id === def.id);
      if (!track) {
        track = {
          id: def.id, name: def.name,
          muted: false, solo: false, volume: def.defaultVol,
          steps: new Array(obj.stepsCount).fill(false),
          velocities: new Array(obj.stepsCount).fill(FoZConstants.DEFAULT_VELOCITY),
        };
        obj.tracks.push(track);
      }
      if (!track.name) track.name = def.name;
      if (typeof track.volume !== "number") track.volume = def.defaultVol;
      if (typeof track.muted !== "boolean") track.muted = false;
      if (typeof track.solo !== "boolean") track.solo = false;

      // Redimensionado de arrays preservando los activos existentes
      const steps = new Array(obj.stepsCount).fill(false);
      if (Array.isArray(track.steps)) {
        for (let i = 0; i < Math.min(obj.stepsCount, track.steps.length); i++) {
          steps[i] = Boolean(track.steps[i]);
        }
      }
      track.steps = steps;

      const vels = new Array(obj.stepsCount).fill(FoZConstants.DEFAULT_VELOCITY);
      if (Array.isArray(track.velocities)) {
        for (let i = 0; i < Math.min(obj.stepsCount, track.velocities.length); i++) {
          vels[i] = Math.max(0, Math.min(1.2, Number(track.velocities[i]) || 0));
        }
      }
      track.velocities = vels;
    });

    // 3. Estado del Trackpad FX
    const fx = this.padFxDefaults();
    if (obj.padFx && typeof obj.padFx === "object") {
      Object.assign(fx, obj.padFx);
    }
    fx.mapX = (fx.mapX === "highpass") ? "highpass" : "lowpass";
    fx.mapY = (fx.mapY === "echo") ? "echo" : "tape";
    fx.x = Math.max(0, Math.min(1, Number(fx.x) || 0));
    fx.y = Math.max(0, Math.min(1, Number(fx.y) || 0));
    fx.latch = Boolean(fx.latch);
    fx.inExport = Boolean(fx.inExport);
    obj.padFx = fx;

    // 4. BPM y master seguro
    if (typeof obj.bpm !== "number" || obj.bpm < FoZConstants.MIN_BPM || obj.bpm > FoZConstants.MAX_BPM) {
      obj.bpm = 90;
    }
    if (typeof obj.masterVolume !== "number") obj.masterVolume = 0.85;

    obj.version = FoZConstants.SCHEMA_VERSION;
    return obj;
  }

  // ===========================================================================
  // PRESETS v1.1 — 4 clásicos + 4 kits con las voces nuevas
  // ===========================================================================

  _vels(len, map) {
    const arr = new Array(len).fill(0);
    for (const k of Object.keys(map)) arr[k] = map[k];
    return arr;
  }

  getPresets() {
    const V = FoZConstants.DEFAULT_STEPS_COUNT;
    return [
      {
        id: "boom_bap_90",
        name: "Boom Bap Clásico (90 BPM)",
        genre: "Hip Hop / Rap Golden Era",
        bpm: 90,
        swing: 0.22,
        description: "Ritmo contundente de bombo y caja con hi-hats en corcheas con swing.",
        tracks: [
          { id: "kick",  steps: this._steps([0, 6, 8]),  velocities: this._vels(V, {0:1.0, 6:0.85, 8:0.95}) },
          { id: "snare", steps: this._steps([4, 12]),    velocities: this._vels(V, {4:1.0, 12:1.0}) },
          { id: "hihat_closed", steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.9, 2:0.7, 4:0.85, 6:0.7, 8:0.9, 10:0.7, 12:0.85, 14:0.7}) },
          { id: "hihat_open", steps: this._steps([14]),  velocities: this._vels(V, {14:0.85}) },
          { id: "bass808", steps: this._steps([0, 6, 8]), velocities: this._vels(V, {0:0.9, 6:0.8, 8:0.85}) },
          { id: "rimshot", steps: this._steps([10]),     velocities: this._vels(V, {10:0.7}) },
        ],
      },
      {
        id: "trap_banger_140",
        name: "Trap Banger (140 BPM)",
        genre: "Trap Moderno",
        bpm: 140,
        swing: 0.05,
        description: "Bajo 808 profundo, palmas en el pulso 3, hi-hats rápidos en semicorcheas.",
        tracks: [
          { id: "kick",  steps: this._steps([0, 8, 14]), velocities: this._vels(V, {0:1.0, 8:0.95, 14:0.9}) },
          { id: "snare", steps: this._steps([8]),        velocities: this._vels(V, {8:1.0}) },
          { id: "clap",  steps: this._steps([8]),        velocities: this._vels(V, {8:1.0}) },
          { id: "hihat_closed", steps: this._steps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]), velocities: this._vels(V, {0:0.95, 1:0.65, 2:0.85, 3:0.65, 4:0.9, 5:0.7, 6:0.85, 7:0.95, 8:0.95, 9:0.65, 10:0.85, 11:0.65, 12:0.9, 13:0.7, 14:0.85, 15:1.0}) },
          { id: "hihat_open", steps: this._steps([6]),   velocities: this._vels(V, {6:0.85}) },
          { id: "bass808", steps: this._steps([0, 8, 14]), velocities: this._vels(V, {0:1.0, 8:0.95, 14:0.9}) },
        ],
      },
      {
        id: "uk_drill_142",
        name: "Drill Pattern (142 BPM)",
        genre: "Drill / Grime",
        bpm: 142,
        swing: 0.12,
        description: "Hi-hats con ritmo sincopado característico y cajas retardadas.",
        tracks: [
          { id: "kick",  steps: this._steps([0, 10]),    velocities: this._vels(V, {0:1.0, 10:0.9}) },
          { id: "snare", steps: this._steps([12]),       velocities: this._vels(V, {12:1.0}) },
          { id: "hihat_closed", steps: this._steps([0,2,3,5,6,8,10,11,13,14]), velocities: this._vels(V, {0:0.95, 2:0.7, 3:0.85, 5:0.9, 6:0.7, 8:0.95, 10:0.7, 11:0.85, 13:0.9, 14:0.7}) },
          { id: "hihat_open", steps: this._steps([8]),   velocities: this._vels(V, {8:0.85}) },
          { id: "bass808", steps: this._steps([0, 10]),  velocities: this._vels(V, {0:1.0, 10:0.9}) },
          { id: "rimshot", steps: this._steps([12]),     velocities: this._vels(V, {12:0.9}) },
        ],
      },
      {
        id: "lofi_chill_85",
        name: "Lo-Fi Chill Hop (85 BPM)",
        genre: "Lo-Fi Hip Hop",
        bpm: 85,
        swing: 0.35,
        description: "Ritmo relajado con swing pronunciado, bombo sutil y aro de caja.",
        tracks: [
          { id: "kick",  steps: this._steps([0, 10]),    velocities: this._vels(V, {0:0.85, 10:0.75}) },
          { id: "snare", steps: this._steps([4, 12]),    velocities: this._vels(V, {4:0.85, 12:0.85}) },
          { id: "hihat_closed", steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.75, 2:0.6, 4:0.7, 6:0.6, 8:0.75, 10:0.6, 12:0.7, 14:0.6}) },
          { id: "hihat_open", steps: this._steps([14]),  velocities: this._vels(V, {14:0.7}) },
          { id: "bass808", steps: this._steps([0, 10]),  velocities: this._vels(V, {0:0.7, 10:0.65}) },
          { id: "rimshot", steps: this._steps([4]),      velocities: this._vels(V, {4:0.8}) },
        ],
      },

      // ------------------------------------------------------------------
      // KITS NUEVOS v1.1 (voces premium)
      // ------------------------------------------------------------------
      {
        id: "trap_dark_snap_140",
        name: "Trap Dark Snap (140 BPM)",
        genre: "Trap Oscuro",
        bpm: 140,
        swing: 0.0,
        description: "Trap oscuro con snap ultra-corto, crash de ataque, shaker envolvente y 808 a slide.",
        tracks: [
          { id: "kick",     steps: this._steps([0, 7, 11]),    velocities: this._vels(V, {0:1.0, 7:0.9, 11:0.95}) },
          { id: "bass808",  steps: this._steps([0, 7, 11]),    velocities: this._vels(V, {0:1.0, 7:0.85, 11:0.95}) },
          { id: "snare",    steps: this._steps([8]),           velocities: this._vels(V, {8:0.95}) },
          { id: "snap_trap",steps: this._steps([8, 11, 15]),   velocities: this._vels(V, {8:0.8, 11:0.6, 15:0.9}) },
          { id: "hihat_closed", steps: this._steps([1,3,5,9,13]), velocities: this._vels(V, {1:0.65, 3:0.6, 5:0.7, 9:0.65, 13:0.7}) },
          { id: "shaker",   steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.5, 2:0.35, 4:0.55, 6:0.35, 8:0.5, 10:0.35, 12:0.55, 14:0.35}) },
          { id: "crash",    steps: this._steps([0]),           velocities: this._vels(V, {0:0.55}) },
        ],
      },
      {
        id: "drill_kheap_142",
        name: "Drill Kheap Dark (142 BPM)",
        genre: "UK Drill Oscuro",
        bpm: 142,
        swing: 0.1,
        description: "Drill desolado con toms graves sincopados, ride fantasma y 808 pesado.",
        tracks: [
          { id: "kick",    steps: this._steps([0, 7, 10]),   velocities: this._vels(V, {0:1.0, 7:0.85, 10:0.95}) },
          { id: "bass808", steps: this._steps([0, 10]),      velocities: this._vels(V, {0:1.0, 10:0.9}) },
          { id: "snare",   steps: this._steps([7, 12]),      velocities: this._vels(V, {7:0.7, 12:1.0}) },
          { id: "tom_low", steps: this._steps([3, 12]),      velocities: this._vels(V, {3:0.65, 12:0.6}) },
          { id: "tom_mid", steps: this._steps([11]),         velocities: this._vels(V, {11:0.6}) },
          { id: "hihat_closed", steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.85, 2:0.6, 4:0.75, 6:0.6, 8:0.85, 10:0.6, 12:0.75, 14:0.6}) },
          { id: "ride",    steps: this._steps([14]),         velocities: this._vels(V, {14:0.5}) },
          { id: "crash",   steps: this._steps([0]),          velocities: this._vels(V, {0:0.45}) },
        ],
      },
      {
        id: "lofi_dusty_stab_78",
        name: "Lo-Fi Dusty Stabs (78 BPM)",
        genre: "Lo-Fi Hip Hop",
        bpm: 78,
        swing: 0.32,
        description: "Lo-Fi polvoriento con stabs oscuros tipo teclado, shaker arrastrado y aro suave.",
        tracks: [
          { id: "kick",     steps: this._steps([0, 10]),        velocities: this._vels(V, {0:0.85, 10:0.7}) },
          { id: "snare",    steps: this._steps([4, 12]),        velocities: this._vels(V, {4:0.8, 12:0.8}) },
          { id: "rimshot",  steps: this._steps([4]),            velocities: this._vels(V, {4:0.6}) },
          { id: "stab_dark",steps: this._steps([0, 6, 8, 14]),  velocities: this._vels(V, {0:0.7, 6:0.5, 8:0.75, 14:0.5}) },
          { id: "bass808",  steps: this._steps([0, 10]),        velocities: this._vels(V, {0:0.8, 10:0.6}) },
          { id: "shaker",   steps: this._steps([2, 6, 10, 14]), velocities: this._vels(V, {2:0.4, 6:0.35, 10:0.4, 14:0.35}) },
          { id: "hihat_closed", steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.6, 2:0.45, 4:0.6, 6:0.45, 8:0.6, 10:0.45, 12:0.6, 14:0.45}) },
        ],
      },
      {
        id: "cowbell_bounce_96",
        name: "Cowbell Bounce (96 BPM)",
        genre: "Hip Hop / Funk",
        bpm: 96,
        swing: 0.25,
        description: "Groove con cowbell sincopado, slap de metales y caja con pegada clásica.",
        tracks: [
          { id: "kick",    steps: this._steps([0, 8, 11]),   velocities: this._vels(V, {0:1.0, 8:0.9, 11:0.85}) },
          { id: "snare",   steps: this._steps([4, 12]),      velocities: this._vels(V, {4:1.0, 12:1.0}) },
          { id: "cowbell", steps: this._steps([2, 6, 10, 14]), velocities: this._vels(V, {2:0.75, 6:0.6, 10:0.75, 14:0.6}) },
          { id: "horn_slap", steps: this._steps([12]),       velocities: this._vels(V, {12:0.65}) },
          { id: "hihat_closed", steps: this._steps([0,2,4,6,8,10,12,14]), velocities: this._vels(V, {0:0.8, 2:0.6, 4:0.8, 6:0.6, 8:0.8, 10:0.6, 12:0.8, 14:0.6}) },
          { id: "bass808", steps: this._steps([0, 8]),       velocities: this._vels(V, {0:0.9, 8:0.8}) },
        ],
      },
    ];
  }

  _steps(indices) {
    const arr = new Array(FoZConstants.DEFAULT_STEPS_COUNT).fill(false);
    (indices || []).forEach((i) => { if (i < arr.length) arr[i] = true; });
    return arr;
  }

  loadPresetIntoProject(presetId) {
    const preset = this.getPresets().find((p) => p.id === presetId);
    if (!preset) throw new Error(`Preset ${presetId} no encontrado.`);

    const proj = this.createNewProject(preset.name, preset.bpm);
    proj.swing = preset.swing;

    preset.tracks.forEach((pt) => {
      const target = proj.tracks.find((t) => t.id === pt.id);
      if (target) {
        target.steps = [...pt.steps];
        target.velocities = [...pt.velocities];
      }
    });

    return proj;
  }

  // ===========================================================================
  // VALIDACIÓN + MIGRACIÓN
  // ===========================================================================

  validateProject(obj) {
    if (!obj || typeof obj !== "object") {
      return { valid: false, error: "El contenido del archivo no es un objeto JSON válido." };
    }
    if (obj.format !== FoZConstants.FORMAT_ID) {
      return { valid: false, error: "El archivo no pertenece al formato oficial FoZ SoundPro (formato incompatible)." };
    }
    if (!obj.version) {
      return { valid: false, error: "El proyecto no especifica versión de esquema." };
    }
    if (!Array.isArray(obj.tracks) || obj.tracks.length === 0) {
      return { valid: false, error: "El proyecto no contiene pistas válidas." };
    }
    if (typeof obj.bpm !== "number" || obj.bpm < 30 || obj.bpm > 300) {
      return { valid: false, error: "Valor de BPM inválido (debe estar entre 30 y 300)." };
    }

    for (const track of obj.tracks) {
      if (!track.id || !Array.isArray(track.steps)) {
        return { valid: false, error: `Pista malformada: ${track.id || "sin id"}` };
      }
      if (!Array.isArray(track.velocities)) {
        track.velocities = track.steps.map((s) => (s ? FoZConstants.DEFAULT_VELOCITY : 0));
      }
    }

    return { valid: true };
  }

  // ===========================================================================
  // SANEADO PARA PERSISTENCIA (LocalStorage y .foz)
  // ===========================================================================

  _stripForSerialization(project) {
    const clone = JSON.parse(JSON.stringify(project, (key, value) => {
      // Descarta buffers/objetos no serializables de forma determinista
      if (key === "sample") return undefined;
      return value;
    }));
    return clone;
  }

  saveCurrentProject(project) {
    try {
      project.updatedAt = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(this._stripForSerialization(project)));
      return true;
    } catch (e) {
      console.warn("Error guardando proyecto en LocalStorage:", e);
      return false;
    }
  }

  loadCurrentProject() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_CURRENT);
      if (raw) {
        const parsed = JSON.parse(raw);
        const check = this.validateProject(parsed);
        if (check.valid) {
          return this.migrateProject(parsed);
        }
      }
    } catch (e) {
      console.warn("Fallo al leer LocalStorage, cargando preset:", e);
    }
    return this.loadPresetIntoProject("boom_bap_90");
  }

  exportProjectFile(project) {
    const jsonStr = JSON.stringify(this._stripForSerialization(project), null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const filename = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_${project.bpm}bpm.foz`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async importProjectFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const val = this.validateProject(parsed);
          if (!val.valid) {
            reject(new Error(val.error));
            return;
          }
          resolve(this.migrateProject(parsed));
        } catch (err) {
          reject(new Error("Error al analizar el archivo JSON: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo del disco."));
      reader.readAsText(file);
    });
  }
}

window.fozProjectManager = new FoZProjectManager();
