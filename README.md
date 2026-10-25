# FoZ SoundPro — Beatmaker AI Studio

**Estación modular de producción musical digital asistida por IA para Rap, Hip Hop, Trap y música electrónica.**
Diseñada con coste 0 €, funciona en **Windows, macOS y Linux** (optimizada para hardware estándar: Intel Core i5, 8 GB de RAM, gráfica integrada), con **uso responsive en móvil y tablet** (Android e iPhone/iPad) desde el navegador.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Studio-00f2fe?logo=github)](https://manu-alvarez.github.io/FoZ-SoundPro/)
[![Repository](https://img.shields.io/badge/GitHub-manu--alvarez%2FFoZ--SoundPro-blue?logo=github)](https://github.com/manu-alvarez/FoZ-SoundPro)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Status: Production](https://img.shields.io/badge/Status-Production%20Ready-success.svg)]()

🌐 **Acceso Web en Vivo (GitHub Pages):** [https://manu-alvarez.github.io/FoZ-SoundPro/](https://manu-alvarez.github.io/FoZ-SoundPro/)

---

## 1. Inicio Rápido (En 1 Clic y Sin Colisiones de Puerto)

El sistema incluye detección automática de puertos libres (a partir del 9200) para no interferir con ningún servicio existente:

### En la Web (Sin instalación):
Abre directamente [https://manu-alvarez.github.io/FoZ-SoundPro/](https://manu-alvarez.github.io/FoZ-SoundPro/) en cualquier navegador moderno (Chrome, Edge, Firefox, Safari).

### En macOS:
```bash
./start_mac.sh
```

### En Windows:
Haz doble clic sobre `start_windows.bat` (o ejecútalo desde cmd):
```cmd
start_windows.bat
```

### En Linux:
```bash
sh start_linux.sh
```

---

## 2. Módulos y Capacidades Implementadas (v1.2 Pads)

- **🥁 Secuenciador por Pasos (16 voces · 16/32/64 pasos):**
  - Síntesis Web Audio API nativa para **16 voces** (sin licencias ni assets externos): Bombo (Kick 808), Caja (Snare), Palmas (Clap), Hi-Hat Cerrado, Hi-Hat Abierto, Sub-Bajo 808, Aro (Rimshot), **Crash, Ride, Tom Grave, Tom Medio, Cowbell, Snap Trap, Shaker, Stab Dark y Horn Slap**.
  - Velocity por paso (Shift+Clic cicla suave/medio/forte), color por instrumento en pantalla, Mute/Solo y volumen por pista.
  - **Sample Studio:** carga una muestra local (WAV/MP3/M4A/OGG/FLAC) en cualquier pista y dispara la voz personalizada como el resto (solo vive en memoria de sesión).
  - Longitud de patrón 16/32/64 pasos, BPM 30–300 y Swing 0–75 % con lookahead scheduling (sin drift).
  - Presets listos para usar: *Boom Bap 90*, *Trap Banger 140*, *Drill 142*, *Lo-Fi 85* + 4 kits nuevos v1.1: *Trap Dark Snap 140*, *Drill Kheap Dark 142*, *Lo-Fi Dusty Stabs 78* y *Cowbell Bounce 96*.
- **🕹️ Trackpad FX (pad XY en tiempo real):**
  - Eje X = filtro Lowpass/Highpass (120 Hz → 18 kHz) y Eje Y = saturación *Tape Drive* o *Eco de corchea* sincronizado al BPM.
  - Multitáctil (Pointer Events), modo momentáneo estilo pedal CC, doble toque en el centro para reset y presets por estilo (Clean / Trap Lush / Boom Bap Dusty / Drill Dark).
  - El estado del pad se guarda en el proyecto y puede hornearse en el export WAV.
- **🎛️ Pads — Caja de Ritmos 4×4 (jugable en vivo, *nueva en v1.2*):**
  - Grid 4×4 de pads con las 16 voces de la sesión (mismos colores que el secuenciador; dispara tus muestras locales vía Sample Studio).
  - **Multitáctil** (Pointer Events) y teclado **QWERTY** (1234 · QWER · ASDF · ZXCV) con slider de velocity global.
  - **Grabación en vivo cuantizada:** con PLAY en marcha y REC armado, cada golpe escribe su paso + velocity en el secuenciador (repetir sobre un paso encendido no lo borra) y persiste con el proyecto.
  - Los golpes pasan por el bus del Trackpad FX (filtro/Tape/Eco en vivo; queda aplicado al soltar salvo modo MOMENTÁNEO).
- **💾 Exportación de Audio WAV Real:**
  - Renderizado directo en navegador mediante `OfflineAudioContext`.
  - Generación de archivos PCM estéreo de 16 bits a 44.1 kHz conforme al estándar RIFF/WAVE (con base importada y FX del trackpad horneados).
- **🎵 Generación y Exportación MIDI Real:**
  - Codificador binario puro de Standard MIDI File (SMF Formato 1) para las 16 voces.
  - Eventos de nota asignados al canal 10 de General MIDI (Percusión) con división de 480 PPQ.
- **🎙️ Record Studio (grabación vocal con beat y cadena pro):**
  - Cadena de voz profesional: filtro pasa-altos, EQ de 3 bandas, compresor (presets *Rap/Suave/Agresivo*), reverb sintética y eco por sends, monitor con anti-acople y VU + osciloscopio.
  - Captura PCM determinista → **WAV 16-bit idéntico en macOS y Windows** (MediaRecorder queda como respaldo del sistema).
  - Pre-roll metronómico de 0/1/2 compases sincronizado por reloj de audio, ajuste fino voz/beat (±150 ms) y noise gate offline.
  - Tomas persistentes en IndexedDB con reproductor, descarga y borrado integrado.
- **💿 Base Library (bases / instrumentales importadas):**
  - Importa MP3/M4A/WAV/Ogg/FLAC **locales** como instrumental sobre el beat: bucle, ganancia y fades configurables.
  - Arranque sincronizado con el transporte del secuenciador y horneado determinista en el export WAV.
  - Manifiestos `.m3u/.m3u8` como catálogo local (empareja por nombre de archivo; sin streaming remoto, modo offline).
- **🤖 Asistente Musical con IA (Multi-Proveedor):**
  - *FoZ Local Bridge:* conexión segura con Ollama local mediante `scripts/automation/local_bridge.py` (ruta recomendada desde HTTPS).
  - *Ollama directo:* endpoints propios o en red Tailscale (p. ej. `http://100.100.2.10:11434`) con diagnóstico honesto por sondeo: online / alcanzable sin CORS / no accesible.
  - *API propia del usuario:* cualquier endpoint compatible con OpenAI (baseUrl + clave; la clave se guarda SOLO en el navegador).
  - *Descarga de modelos (pull):* si falta un modelo, se descarga en Ollama desde la propia interfaz (puente u Ollama directo).
  - *Modo Heurístico Autónomo:* generador rítmico por teoría musical que funciona al 100% sin conexión si ningún proveedor responde.
  - Diagnóstico y gestión de proveedores en la pestaña **Diagnóstico**; esquema JSON de 16 voces con normalización compartida.
  - Previsualización gráfica en mini-grid y botón para aplicar directamente al secuenciador.
- **📁 Gestión de Proyectos (.foz esquema 1.1):**
  - Persistencia automática en `LocalStorage`.
  - Exportación e importación de proyectos JSON versionados (`.foz`) con **migrador automático v1.0 → 1.1** (los archivos antiguos cargan sin perder pasos; las voces nuevas aparecen vacías).
  - Estado del Trackpad FX persistido por proyecto; los buffers de muestras nunca se serializan.
  - Proyecto de demostración incluido (`workspace/projects/demo_trap_beat.foz`).
- **📱 Uso responsive en móvil/tablet y PWA:**
  - Diseño adaptado a pantallas táctiles: seguridad lateral en fila, secuenciador con scroll horizontal, barra de transporte deslizable y targets táctiles amplios (funciona en Android, iPhone y iPad).
  - Logo premium con iconos SVG/PNG (192·512·apple-touch 180), manifest PWA y metadatos Open Graph/Twitter para que al compartir el enlace aparezca la imagen del estudio.

---

## 3. Paquete Portátil para Windows

Para trasladar la estación a otro equipo Windows sin instalar herramientas de compilación ni entornos pesados:

1. El archivo empaquetado y verificado se encuentra en:
   [`dist/FoZ_SoundPro_Portable_v1.2.zip`](dist/FoZ_SoundPro_Portable_v1.2.zip).
2. Suma criptográfica de integridad:
   [`dist/FoZ_SoundPro_Portable_v1.2.zip.sha256`](dist/FoZ_SoundPro_Portable_v1.2.zip.sha256).
3. Guía completa de uso en Windows: ver [docs/PAQUETE_WINDOWS.md](docs/PAQUETE_WINDOWS.md).

---

## 4. Despliegue en GitHub Pages

La carpeta [`web/`](web/) es completamente autónoma (HTML, CSS, JS, manifest y service worker PWA):
- Publicable directamente desde GitHub: *Settings $\rightarrow$ Pages $\rightarrow$ Branch: main /web*.
- Guía detallada de publicación y consideraciones de seguridad: ver [docs/DESPLIEGUE_GITHUB_PAGES.md](docs/DESPLIEGUE_GITHUB_PAGES.md).

---

## 5. Ejecución de la Suite Completa de Pruebas

Para ejecutar las 6 fases de validación técnica automatizada:

```bash
./scripts/diagnostics/run-checks.sh
```

**Fases verificadas:**
1. Auditoría del entorno y dependencias (`scripts/diagnostics/doctor.sh`).
2. Generación y comprobación binaria de audio WAV PCM (`scripts/audio/generate_test_wav.py`).
3. Generación y parsing binario de MIDI SMF1 en canal GM 10 (`scripts/midi/generate_demo_midi.py`).
4. Validación de esquemas de proyecto .foz (`tests/test_project_schema.py`).
5. Integridad de la distribución web estática y PWA (`tests/test_web_integrity.py`).
6. Empaquetado y verificación estructural de ZIP portátil (`scripts/automation/build_portable_zip.py`).

---

## 6. Documentación del Proyecto

- [Manual de Usuario](docs/MANUAL_USUARIO.md) — Guía completa de uso de la estación musical.
- [Guía para PC Windows de Destino](docs/PAQUETE_WINDOWS.md) — Configuración para Intel i5 / 8GB RAM.
- [Despliegue en GitHub Pages](docs/DESPLIEGUE_GITHUB_PAGES.md) — Alojamiento estático a coste 0 €.
- [Soporte CLI de LMMS](docs/LMMS_CLI.md) — Capacidades headless y renderizado del DAW.
- [Arquitectura del Sistema](docs/ARCHITECTURE.md) — Capas, flujo de datos y modelo de seguridad.
- [Hoja de Ruta](docs/ROADMAP.md) — Fases completadas.
