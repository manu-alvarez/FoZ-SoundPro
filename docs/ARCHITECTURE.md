# Arquitectura del Sistema — FoZ SoundPro

FoZ SoundPro está diseñado bajo una **arquitectura híbrida, modular, portable y desacoplada**, con coste objetivo de **0 €**, sin dependencias obligatorias de servicios de pago y preparado para funcionar tanto en el ordenador principal como en un equipo Windows (Intel i5, 8 GB RAM, gráfica Intel integrada).

---

## 1. Diagrama de Capas del Sistema

```
+-------------------------------------------------------------------------+
|                  CAPA 1: FoZ SoundPro Web Studio (PWA)                  |
|  - Interfaz de Estudio (Secuenciador, Trackpad FX, Pads (Caja de       |
|    Ritmos 4x4), Record Studio, Base Library, Asistente IA, Proyectos   |
|    y Diagnóstico)                                                       |
|  - Síntesis Web Audio API (16 voces: kick, snare, hats, clap, 808,      |
|    rim, crash, ride, toms, cowbell, snap, shaker, stab, horn)           |
|  - Trackpad FX XY (LP/HP + tape drive + eco sincronizado al BPM)        |
|  - Pads 4x4: golpes en vivo por triggerInstrument (respetan muestras    |
|    locales) y grabación en vivo cuantizada de paso + velocity           |
|  - Record Studio: cadena de voz pro y captura PCM -> WAV 16b            |
|  - Base Library y Sample Studio (audio local solo en memoria)           |
|  - Renderizador y Exportador de WAV PCM 16b (OfflineAudioContext)       |
|  - Generador Binario Standard MIDI File SMF1 (Canal 10 General MIDI)   |
|  - Gestor de Proyectos (.foz JSON esquema 1.1 con migrador) y Presets   |
|  - IA Multi-Proveedor: puente local / Ollama directo (Tailscale) /      |
|    API del usuario (OpenAI-compatible) / Motor Heurístico offline       |
+-------------------------------------------------------------------------+
                                    |
                  [Peticiones REST HTTP / JSON con CORS]
                                    v
+-------------------------------------------------------------------------+
|                CAPA 2: FoZ Local Bridge (Python stdlib)                 |
|  - Servidor ligero (scripts/automation/local_bridge.py)                |
|  - Endpoints: /api/status, /api/generate-pattern, /api/pull (POST)     |
|  - Conector seguro con Ollama (OLLAMA_BASE_URL; hosts alternativos     |
|    validados, p. ej. Tailscale http://100.100.x.x:11434)                |
|  - CORS: Allow-Origin * + Access-Control-Allow-Private-Network (PNA)   |
|  - Esquema JSON de 16 voces normalizado antes de responder a la Web     |
+-------------------------------------------------------------------------+
                  |                                     |
                  v                                     v
+------------------------------------+   +--------------------------------+
|       PROVEEDORES LOCALES IA       |   |       DAW COMPLEMENTARIO       |
|  - Ollama (Modelos locales GGUF)   |   |  - LMMS 1.2.2 (macOS / Windows)|
|  - Inferencia texto / estructurado |   |  - Render CLI Headless         |
|  - Coste 0 €, sin servicios cloud  |   |  - Arreglos multipista y VST   |
+------------------------------------+   +--------------------------------+
```

---

## 2. Componentes Clave

### 2.1 FoZ SoundPro Web (Cliente Autónomo)
- **Tecnología:** HTML5, Vanilla CSS (diseño responsivo dark mode glassmorphism) y JavaScript ES6+.
- **Independencia:** Funciona directamente desde la carpeta `web/` servida localmente o desplegada en **GitHub Pages**.
- **Audio Nativo:** Síntesis sonora determinista mediante Web Audio API; no depende de paquetes npm, CDNs externos ni descargas de gigabytes de librerías.
- **Módulos v1.2 (`web/js/`):** `constants.js` (punto único de verdad musical), `audio-engine.js` (16 voces + bus FX del trackpad + export offline), `midi-engine.js` (SMF1 canal 10), `project-manager.js` (esquema 1.1 + migrador + presets), `sequencer.js` (lookahead scheduling), `sampler.js` (muestras locales por pista), `trackpad.js` (pad XY FX), `pads.js` (caja de ritmos 4×4: dispara por `audio.triggerInstrument` — respeta las muestras locales — y graba pasos cuantizados con velocity en el secuenciador), `base-library.js` (bases importadas + manifiestos M3U), `rec-studio.js` (cadena de voz y captura PCM), `ai-assistant.js` (dual-mode IA) y `app.js` (orquestación de UI).
- **Audio local sin persistencia:** las muestras (Sample Studio) y las bases importadas se decodifican a `AudioBuffer` en memoria de sesión; nunca se escriben en LocalStorage, `.foz` ni Git (buffers excluidos en `_stripForSerialization`).
- **Exportación en el Cliente:**
  - WAV: Generación de bloques binarios RIFF/WAVE PCM 16-bit estéreo a 44.1 kHz, con horneado opcional de base importada y FX del trackpad.
  - MIDI: Generación de bloques binarios SMF1 multipista con resolución de 480 PPQ.

### 2.2 FoZ Local Bridge (Puente de Sistema)
- **Implementación:** Biblioteca estándar de Python (`http.server`, `urllib.request`, `socket`).
- **Seguridad:**
  - Sin ejecución de comandos arbitrarios desde la web.
  - Entrada sanitizada con límites de longitud.
  - Control de orígenes CORS explícito.
  - Excluye modelos que dependan de APIs cloud (`:cloud`).

### 2.3 Paquete Portátil y Distribución
- **Empaquetado:** `scripts/automation/build_portable_zip.py` genera `dist/FoZ_SoundPro_Portable_v1.2.zip` acompañado de su suma criptográfica SHA-256.
- **Lanzadores sin colisión:**
  - `start_mac.sh` (macOS).
  - `start_windows.bat` (Windows).
  - `start_linux.sh` (Linux).
  - Los tres invocan `scripts/automation/serve_studio.py`, el cual escanea y reserva dinámicamente puertos libres a partir del 9200, evitando interferir con cualquier proceso previo del usuario.
