/**
 * FoZ SoundPro — Constantes Globales de Fabricación (v1.1)
 * ========================================================
 * Único punto de verdad para parámetros musicales, límites y rutas del estudio.
 * Garantiza coherencia entre síntesis en vivo, export WAV offline, export MIDI
 * y el secuenciador (por ejemplo: misma constante de SWING en los tres motores).
 */

const FoZConstants = {
  // Identidad
  APP_VERSION: "1.1.0",
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

  // Almacenamiento
  STORAGE_KEY_REC_SETTINGS: "foz_soundpro_rec_settings",
  STORAGE_KEY_CURRENT: "foz_soundpro_current_project",
  STORAGE_KEY_LIST: "foz_soundpro_saved_projects",
};

window.FoZConstants = FoZConstants;
