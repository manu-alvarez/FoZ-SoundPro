/**
 * FoZ SoundPro — Constantes Globales de Fabricación (v1.2)
 * ========================================================
 * Único punto de verdad para parámetros musicales, límites y rutas del estudio.
 * Garantiza coherencia entre síntesis en vivo, export WAV offline, export MIDI
 * y el secuenciador (por ejemplo: misma constante de SWING en los tres motores).
 */

const FoZConstants = {
  // Identidad
  APP_VERSION: "1.2.1",
  SCHEMA_VERSION: "1.1.0",
  FORMAT_ID: "foz-soundpro-project",

  // Secuencia / Tempo (valores unificados realtime == offline == MIDI)
  DEFAULT_STEPS_COUNT: 16,
  MIN_STEPS_COUNT: 4,
  MAX_STEPS_COUNT: 64,
  DEFAULT_VELOCITY: 0.85,
  DEFAULT_VOLUME: 0.85,
  SWING_FACTOR: 0.33,      // desplazamiento proporcional aplicado SOLO a pasos impares
  MIN_BPM: 30,
  MAX_BPM: 300,

  // Buses y FX del Trackpad
  PAD_FILTER_MIN_HZ: 120,
  PAD_FILTER_MAX_HZ: 18000,
  PAD_DRIVE_MAX: 0.9,
  PAD_ECHO_WET_MAX: 0.65,
  PAD_ECHO_FEEDBACK_MAX: 0.45,
  PAD_ECHO_TAPS: 4,
  PAD_DELAY_DIVISION: 0.5, // corchea: (60/BPM) * 0.5

  // Grabación (Record Studio)
  REC_CAPTURE_BUFFER_SIZE: 4096, // ScriptProcessor determinista; AudioWorklet pendiente (P5)
  REC_PREROLL_MAX_BARS: 2,
  REC_OFFSET_MAX_MS: 300,        // Ajuste manual de alineación voz/beat
  REC_TAKE_MAX_SECONDS: 600,
  REC_CLIP_DB: -0.5,

  // Bases / instrumentales importadas
  BASE_GAIN_MAX: 1.5,
  BASE_FADE_MAX_SEC: 4,

  // Local Bridge (fijo; los puertos dinámicos ≥9200 solo aplican al servidor web estático)
  BRIDGE_PORT: 8765,
  OLLAMA_PORT: 11434,

  // Voces canónicas del secuenciador (deben coincidir con ProjectManager.getTrackDefs).
  // Punto único de verdad para la normalización de patrones generados por IA.
  AI_VOICE_IDS: [
    "kick", "snare", "clap", "hihat_closed", "hihat_open", "bass808", "rimshot",
    "crash", "ride", "tom_low", "tom_mid", "cowbell", "snap_trap", "shaker",
    "stab_dark", "horn_slap",
  ],

  // Proveedores de IA por defecto (editables por el usuario en Diagnóstico).
  // - bridge: FoZ Local Bridge en la propia máquina (proxy hacia Ollama)
  // - ollama: servidor Ollama directo vía Tailscale (requiere OLLAMA_ORIGINS para CORS)
  AI_PROVIDER_DEFAULTS: [
    { id: "bridge-local", kind: "bridge", name: "FoZ Local Bridge", baseUrl: "http://127.0.0.1:8765", apiKey: "", model: "", enabled: true },
    { id: "ollama-ts-2", kind: "ollama", name: "Ollama Tailscale .2.10", baseUrl: "http://100.100.2.10:11434", apiKey: "", model: "", enabled: true },
    { id: "ollama-ts-1", kind: "ollama", name: "Ollama Tailscale .1.10", baseUrl: "http://100.100.1.10:11434", apiKey: "", model: "", enabled: true },
  ],

  // Almacenamiento
  STORAGE_KEY_REC_SETTINGS: "foz_soundpro_rec_settings",
  STORAGE_KEY_CURRENT: "foz_soundpro_current_project",
  STORAGE_KEY_LIST: "foz_soundpro_saved_projects",
  STORAGE_KEY_AI_SETTINGS: "foz_soundpro_ai_settings",
};

window.FoZConstants = FoZConstants;
