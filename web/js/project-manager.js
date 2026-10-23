/**
 * FoZ SoundPro — Project Manager & Preset Library
 * ===============================================
 * Gestiona el formato de proyecto nativo versionado (.foz),
 * la persistencia en LocalStorage/IndexedDB, la validación estricta de esquemas
 * y una biblioteca de presets de batería (Boom Bap, Trap, Drill, Lo-Fi, Electro).
 */

class FoZProjectManager {
  constructor() {
    this.STORAGE_KEY_CURRENT = "foz_soundpro_current_project";
    this.STORAGE_KEY_LIST = "foz_soundpro_saved_projects";
  }

  /**
   * Genera la lista base de pistas estándar de percusión.
   */
  getDefaultTracks(stepsCount = 16) {
    const trackDefs = [
      { id: "kick", name: "Bombo (Kick 808)", defaultVol: 0.95 },
      { id: "snare", name: "Caja (Snare)", defaultVol: 0.90 },
      { id: "clap", name: "Palmas (Clap)", defaultVol: 0.85 },
      { id: "hihat_closed", name: "Hi-Hat Cerrado", defaultVol: 0.80 },
      { id: "hihat_open", name: "Hi-Hat Abierto", defaultVol: 0.75 },
      { id: "bass808", name: "Sub-Bajo 808", defaultVol: 0.90 },
      { id: "rimshot", name: "Aro (Rimshot)", defaultVol: 0.75 },
    ];

    return trackDefs.map((def) => ({
      id: def.id,
      name: def.name,
      muted: false,
      solo: false,
      volume: def.defaultVol,
      steps: new Array(stepsCount).fill(false),
      velocities: new Array(stepsCount).fill(0.85),
    }));
  }

  /**
   * Proyecto en blanco por defecto.
   */
  createNewProject(name = "Nuevo Beat", bpm = 90) {
    return {
      format: "foz-soundpro-project",
      version: "1.0.0",
      id: "foz_" + Date.now(),
      name: name,
      bpm: bpm,
      swing: 0.1,
      stepsCount: 16,
      masterVolume: 0.85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: this.getDefaultTracks(16),
    };
  }

  /**
   * Biblioteca de Presets de Estilo Profesional
   */
  getPresets() {
    return [
      {
        id: "boom_bap_90",
        name: "Boom Bap Clásico (90 BPM)",
        genre: "Hip Hop / Rap Golden Era",
        bpm: 90,
        swing: 0.22,
        stepsCount: 16,
        description: "Ritmo contundente de bombo y caja con hi-hats en corcheas con swing.",
        tracks: [
          {
            id: "kick",
            steps: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, false, false],
            velocities: [1.0, 0, 0, 0, 0, 0, 0.85, 0, 0.95, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "snare",
            steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            velocities: [0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0],
          },
          {
            id: "clap",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            velocities: new Array(16).fill(0.8),
          },
          {
            id: "hihat_closed",
            steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            velocities: [0.9, 0, 0.7, 0, 0.85, 0, 0.7, 0, 0.9, 0, 0.7, 0, 0.85, 0, 0.7, 0],
          },
          {
            id: "hihat_open",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0],
          },
          {
            id: "bass808",
            steps: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, false, false],
            velocities: [0.9, 0, 0, 0, 0, 0, 0.8, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "rimshot",
            steps: [false, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0],
          },
        ],
      },
      {
        id: "trap_banger_140",
        name: "Trap Banger (140 BPM)",
        genre: "Trap Moderno",
        bpm: 140,
        swing: 0.05,
        stepsCount: 16,
        description: "Bajo 808 profundo, palmas en el pulso 3, hi-hats rápidos en semicorcheas.",
        tracks: [
          {
            id: "kick",
            steps: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false],
            velocities: [1.0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0, 0.9, 0],
          },
          {
            id: "snare",
            steps: [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "clap",
            steps: [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "hihat_closed",
            steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
            velocities: [0.95, 0.65, 0.85, 0.65, 0.9, 0.7, 0.85, 0.95, 0.95, 0.65, 0.85, 0.65, 0.9, 0.7, 0.85, 1.0],
          },
          {
            id: "hihat_open",
            steps: [false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "bass808",
            steps: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false],
            velocities: [1.0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0, 0.9, 0],
          },
          {
            id: "rimshot",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            velocities: new Array(16).fill(0.8),
          },
        ],
      },
      {
        id: "uk_drill_142",
        name: "Drill Pattern (142 BPM)",
        genre: "Drill / Grime",
        bpm: 142,
        swing: 0.12,
        stepsCount: 16,
        description: "Hi-hats con ritmo sincopado característico y cajas retardadas.",
        tracks: [
          {
            id: "kick",
            steps: [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
            velocities: [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0],
          },
          {
            id: "snare",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0],
          },
          {
            id: "clap",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            velocities: new Array(16).fill(0.8),
          },
          {
            id: "hihat_closed",
            steps: [true, false, true, true, false, true, true, false, true, false, true, true, false, true, true, false],
            velocities: [0.95, 0, 0.7, 0.85, 0, 0.9, 0.7, 0, 0.95, 0, 0.7, 0.85, 0, 0.9, 0.7, 0],
          },
          {
            id: "hihat_open",
            steps: [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
          },
          {
            id: "bass808",
            steps: [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
            velocities: [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0],
          },
          {
            id: "rimshot",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
          },
        ],
      },
      {
        id: "lofi_chill_85",
        name: "Lo-Fi Chill Hop (85 BPM)",
        genre: "Lo-Fi Hip Hop",
        bpm: 85,
        swing: 0.35,
        stepsCount: 16,
        description: "Ritmo relajado con swing pronunciado, bombo sutil y aro de caja.",
        tracks: [
          {
            id: "kick",
            steps: [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
            velocities: [0.85, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0],
          },
          {
            id: "snare",
            steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            velocities: [0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0],
          },
          {
            id: "clap",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            velocities: new Array(16).fill(0.8),
          },
          {
            id: "hihat_closed",
            steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            velocities: [0.75, 0, 0.6, 0, 0.7, 0, 0.6, 0, 0.75, 0, 0.6, 0, 0.7, 0, 0.6, 0],
          },
          {
            id: "hihat_open",
            steps: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false],
            velocities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0],
          },
          {
            id: "bass808",
            steps: [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
            velocities: [0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.65, 0, 0, 0, 0, 0],
          },
          {
            id: "rimshot",
            steps: [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false],
            velocities: [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        ],
      },
    ];
  }

  /**
   * Carga un preset sobre la estructura de pistas de un proyecto.
   */
  loadPresetIntoProject(presetId) {
    const preset = this.getPresets().find((p) => p.id === presetId);
    if (!preset) throw new Error(`Preset ${presetId} no encontrado.`);

    const proj = this.createNewProject(preset.name, preset.bpm);
    proj.swing = preset.swing;
    proj.stepsCount = preset.stepsCount;

    preset.tracks.forEach((pt) => {
      const target = proj.tracks.find((t) => t.id === pt.id);
      if (target) {
        target.steps = [...pt.steps];
        target.velocities = [...pt.velocities];
      }
    });

    return proj;
  }

  /**
   * Validación estricta del esquema de proyecto.
   */
  validateProject(obj) {
    if (!obj || typeof obj !== "object") {
      return { valid: false, error: "El contenido del archivo no es un objeto JSON válido." };
    }
    if (obj.format !== "foz-soundpro-project") {
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

    // Asegurar estructura de cada pista
    for (const track of obj.tracks) {
      if (!track.id || !Array.isArray(track.steps)) {
        return { valid: false, error: `Pista malformada: ${track.id || "sin id"}` };
      }
      if (!Array.isArray(track.velocities)) {
        track.velocities = track.steps.map((s) => (s ? 0.85 : 0));
      }
    }

    return { valid: true };
  }

  /**
   * Auto-guardado en LocalStorage
   */
  saveCurrentProject(project) {
    try {
      project.updatedAt = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(project));
      return true;
    } catch (e) {
      console.warn("Error guardando proyecto en LocalStorage:", e);
      return false;
    }
  }

  /**
   * Carga el proyecto actual de LocalStorage, o el preset por defecto si está vacío.
   */
  loadCurrentProject() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_CURRENT);
      if (raw) {
        const parsed = JSON.parse(raw);
        const check = this.validateProject(parsed);
        if (check.valid) return parsed;
      }
    } catch (e) {
      console.warn("Fallo al leer LocalStorage, cargando preset:", e);
    }
    // Preset por defecto Boom Bap 90 BPM
    return this.loadPresetIntoProject("boom_bap_90");
  }

  /**
   * Exporta el proyecto como un archivo descargable .foz (JSON estructurado)
   */
  exportProjectFile(project) {
    const jsonStr = JSON.stringify(project, null, 2);
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

  /**
   * Importa un archivo .foz desde un File object
   */
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
          resolve(parsed);
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
