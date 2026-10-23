# FoZ SoundPro — Beatmaker AI Studio

**Estación modular de producción musical digital asistida por IA para Rap, Hip Hop, Trap y música electrónica.**
Diseñada con coste 0 €, compatible con macOS y optimizada para equipos Windows con procesador Intel Core i5 (7.ª a 10.ª gen), 8 GB de RAM y gráfica integrada Intel.

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

---

## 2. Módulos y Capacidades Implementadas

- **🥁 Secuenciador por Pasos (16 pasos en 4/4):**
  - Síntesis Web Audio API nativa para 7 instrumentos: Bombo (Kick 808), Caja (Snare), Palmas (Clap), Hi-Hat Cerrado, Hi-Hat Abierto, Sub-Bajo 808 y Aro (Rimshot).
  - Controles de Mute (M), Solo (S) y volumen independiente por pista.
  - Planificador de audio de alta precisión con técnica lookahead (sin drift ni desincronización).
  - Control de tempo (BPM) y Swing ajustable en tiempo real.
  - Presets listos para usar: *Boom Bap 90*, *Trap 140*, *UK Drill 142* y *Lo-Fi 85*.
- **💾 Exportación de Audio WAV Real:**
  - Renderizado directo en navegador mediante `OfflineAudioContext`.
  - Generación de archivos PCM estéreo de 16 bits a 44.1 kHz conforme al estándar RIFF/WAVE.
- **🎵 Generación y Exportación MIDI Real:**
  - Codificador binario puro de Standard MIDI File (SMF Formato 1).
  - Eventos de nota asignados al canal 10 de General MIDI (Percusión) con división de 480 PPQ.
- **🎙️ Grabador Vocal (Vocal Studio):**
  - Grabación con micrófono de tomas vocales o ideas rítmicas.
  - Visualización de onda (osciloscopio) en tiempo real en canvas.
  - Reproductor integrado y descarga directa de la toma de audio.
- **🤖 Asistente Musical con IA Local (Dual-Mode):**
  - *Modo Ollama Local:* Conexión segura con modelos locales (`qwen3.5:4b` o `llamusic/llamusic:latest`) mediante `scripts/automation/local_bridge.py`.
  - *Modo Heurístico Autónomo:* Generador rítmico basado en teoría musical que funciona al 100% sin conexión si Ollama no está presente.
  - Previsualización gráfica en mini-grid y botón para aplicar directamente al secuenciador.
- **📁 Gestión de Proyectos (.foz):**
  - Persistencia automática en `LocalStorage`.
  - Exportación e importación de proyectos en formato JSON versionado (`.foz`).
  - Proyecto de demostración incluido (`workspace/projects/demo_trap_beat.foz`).

---

## 3. Paquete Portátil para Windows

Para trasladar la estación a otro equipo Windows sin instalar herramientas de compilación ni entornos pesados:

1. El archivo empaquetado y verificado se encuentra en:
   [`dist/FoZ_SoundPro_Portable_v1.0.zip`](dist/FoZ_SoundPro_Portable_v1.0.zip) (~101 KB).
2. Suma criptográfica de integridad:
   [`dist/FoZ_SoundPro_Portable_v1.0.zip.sha256`](dist/FoZ_SoundPro_Portable_v1.0.zip.sha256).
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
