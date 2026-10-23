# Arquitectura del Sistema — FoZ SoundPro

FoZ SoundPro está diseñado bajo una **arquitectura híbrida, modular, portable y desacoplada**, con coste objetivo de **0 €**, sin dependencias obligatorias de servicios de pago y preparado para funcionar tanto en el ordenador principal como en un equipo Windows (Intel i5, 8 GB RAM, gráfica Intel integrada).

---

## 1. Diagrama de Capas del Sistema

```
+-------------------------------------------------------------------------+
|                  CAPA 1: FoZ SoundPro Web Studio (PWA)                  |
|  - Interfaz de Estudio Musical (Secuenciador 16 pasos, Grabador Vocal)  |
|  - Síntesis Web Audio API (Kick, Snare, Hi-Hats, Clap, 808, Rimshot)    |
|  - Renderizador y Exportador de WAV PCM 16b (OfflineAudioContext)       |
|  - Generador Binario Standard MIDI File SMF1 (Canal 10 General MIDI)   |
|  - Gestor de Proyectos (.foz JSON) y Presets (Boom Bap, Trap, Drill)    |
|  - Asistente Heurístico Musical (100% Offline / Reglas de Composición)  |
+-------------------------------------------------------------------------+
                                    |
                  [Peticiones REST HTTP / JSON con CORS]
                                    v
+-------------------------------------------------------------------------+
|                CAPA 2: FoZ Local Bridge (Python stdlib)                 |
|  - Servidor ligero (scripts/automation/local_bridge.py)                |
|  - Detección dinámica de puertos libres (>= 9200) sin colisiones       |
|  - Conector seguro con Ollama Local (http://127.0.0.1:11434)           |
|  - Filtro estricto: solo modelos locales (qwen3.5:4b, llamusic)         |
|  - Validación de esquemas JSON antes de responder a la Web              |
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
- **Exportación en el Cliente:**
  - WAV: Generación de bloques binarios RIFF/WAVE PCM 16-bit estéreo a 44.1 kHz.
  - MIDI: Generación de bloques binarios SMF1 multipista con resolución de 480 PPQ.

### 2.2 FoZ Local Bridge (Puente de Sistema)
- **Implementación:** Biblioteca estándar de Python (`http.server`, `urllib.request`, `socket`).
- **Seguridad:**
  - Sin ejecución de comandos arbitrarios desde la web.
  - Entrada sanitizada con límites de longitud.
  - Control de orígenes CORS explícito.
  - Excluye modelos que dependan de APIs cloud (`:cloud`).

### 2.3 Paquete Portátil y Distribución
- **Empaquetado:** `scripts/automation/build_portable_zip.py` genera `dist/FoZ_SoundPro_Portable_v1.0.zip` acompañado de su suma criptográfica SHA-256.
- **Lanzadores sin colisión:**
  - `start_mac.sh` (macOS).
  - `start_windows.bat` (Windows).
  - Ambos invocan `scripts/automation/serve_studio.py`, el cual escanea y reserva dinámicamente puertos libres a partir del 9200, evitando interferir con cualquier proceso previo del usuario.
