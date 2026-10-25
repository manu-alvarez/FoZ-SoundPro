# Hoja de ruta — FoZ SoundPro

- [x] Fase 0: auditoría del entorno de desarrollo.
- [x] Fase 1: estructura modular y control de versiones.
- [x] Fase 2: selección y validación del DAW (LMMS 1.2.2 y CLI headless documentados).
- [x] Fase 3: motores de síntesis Web Audio, secuenciador 16 pasos, grabación vocal y exportación WAV/MIDI.
- [x] Fase 4: evaluación de IA local (Ollama `qwen3.5:4b`, `llamusic` y motor heurístico offline).
- [x] Fase 5: generación estructurada de patrones rítmicos y exportación SMF1 en canal GM 10.
- [x] Fase 6: asistente musical interactivo con previsualización y aplicación a la sesión.
- [x] Fase 7: automatización, puente local (`local_bridge.py`) y suite unificada de pruebas (6/6 fases).
- [x] Fase 8: paquete portátil verificado (`FoZ_SoundPro_Portable_v1.0.zip`, renombrado a `_v1.1` en la siguiente fase), lanzadores dinámicos para Windows y macOS y guías de despliegue en GitHub Pages.
- [x] Fase 9 (v1.1 The Expansion): kit de 16 voces sintéticas premium, Trackpad FX XY con presets y horneado en WAV, Record Studio (cadena de voz pro, pre-roll metronómico, captura PCM→WAV determinista y tomas en IndexedDB), Base Library (MP3/M3U locales sincronizados al transporte), Sample Studio por pista y esquema de proyecto 1.1 con migrador no destructivo.
- [x] Fase 9.1 (v1.1.1 Housekeeping): sistema multi-proveedor de IA (puente local · Ollama directo por Tailscale con diagnóstico honesto online/alcanzable-sin-CORS/no accesible · API propia del usuario compatible OpenAI con clave solo en el navegador), descarga de modelos (pull) vía puente u Ollama, esquema JSON de 16 voces con normalización compartida, cabecera Private-Network Access en el puente, `start_linux.sh` e instrucciones multiplataforma (Windows/macOS/Linux), logo premium SVG→PNG (512/192/180) con manifest PWA y Open Graph para compartir enlaces, y uso responsive en móvil/tablet (Android/iOS).
