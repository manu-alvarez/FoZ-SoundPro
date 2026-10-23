# FoZ SoundPro — Manual de Usuario

Guía completa para la producción musical asistida por IA con FoZ SoundPro Beatmaker Studio.

---

## 1. Inicio Rápido

### En macOS:
Ejecuta el lanzador que detecta puertos libres automáticamente y abre tu navegador:
```bash
./start_mac.sh
```

### En Windows (PC de destino):
Haz doble clic sobre el archivo `start_windows.bat` o ejecútalo desde la consola:
```cmd
start_windows.bat
```
*Nota:* Si tienes Python instalado, iniciará el servidor en un puerto libre a partir de 9200. Si no tienes Python, abrirá `web/index.html` directamente en tu navegador por defecto.

---

## 2. Módulos del Estudio

### 2.1 Secuenciador por Pasos (Beatmaker)
- **16 Pasos por compás:** Dividido visualmente en 4 tiempos de 4 semicorcheas con sombreado alterno.
- **Instrumentos disponibles:**
  1. *Bombo (Kick 808):* Barrido sub-grave con transitorio de ataque.
  2. *Caja (Snare):* Doble capa (cuerpo tonal en 190 Hz + ruido de bordones).
  3. *Palmas (Clap):* Micro-ráfagas triples espaciadas por 11 ms.
  4. *Hi-Hat Cerrado:* Textura metálica de alta frecuencia con caída ultra rápida (55 ms).
  5. *Hi-Hat Abierto:* Cola de resonancia abierta (350 ms).
  6. *Sub-Bajo 808:* Subgrave sostenido con caída afinada.
  7. *Aro (Rimshot):* Golpe seco en madera/metal para síncopas.
- **Controles por pista:**
  - `M`: Silenciar pista (Mute).
  - `S`: Pista en solo (Solo).
  - Slider de volumen individual.
  - Clic en el nombre del instrumento para escuchar su sonido inmediatamente.
- **Controles globales de transporte:**
  - `PLAY / PAUSE`: Reproducción cíclica continua (Atajo: tecla **Espacio**).
  - `STOP`: Detener y reiniciar el cursor al paso 1.
  - `BPM`: Ajuste de tempo (40 a 240 BPM).
  - `SWING`: Factor de arrastre rítmico (0% a 75%) en semicorcheas impares.
  - `MASTER`: Volumen de salida master con compresor anti-saturación.

---

### 2.2 Presets de Estilo Integrados
Puedes cargar instantáneamente ritmos profesionales preconfigurados:
- **Boom Bap 90:** Bombo espaciado, caja clásica en tiempos 2 y 4, hi-hats con swing al 22%.
- **Trap 140:** Palmas en tiempo 3, semicorcheas continuas en hi-hats y bajo 808 pesado.
- **Drill 142:** Ritmo sincopado de hi-hats característico de UK/NY y caja retardada.
- **Lo-Fi 85:** Swing acentuado al 35%, bombo sutil y aro de caja.

---

### 2.3 Grabador de Voz (Vocal Studio)
- Permite registrar tomas vocales, coros o ideas rítmicas usando el micrófono del equipo.
- Muestra osciloscopio en tiempo real sobre el lienzo de visualización.
- Incluye temporizador de grabación.
- Al terminar, permite reproducir la toma grabada y descargarla como archivo de audio (`.webm` / `.wav`).

---

### 2.4 Asistente Musical con IA Local
El asistente opera en dos modalidades transparentes para el usuario:

1. **Modo Ollama Local (cuando el puente está activo):**
   - Se comunica con el modelo local `qwen3.5:4b` o `llamusic/llamusic:latest` a través de `http://127.0.0.1:8765`.
   - Procesa lenguaje natural y genera una estructura estricta en JSON con el ritmo solicitado.
2. **Modo Heurístico Autónomo (100% Offline):**
   - Si Ollama no está instalado o el puente está desconectado, el botón de generación sigue funcionando sin interrupciones.
   - Aplica matrices de probabilidad de teoría musical para construir ritmos coherentes del estilo elegido.
3. **Acciones del Asistente:**
   - *Previsualización:* Muestra un mini-mapa de los 16 pasos por instrumento y la explicación musical.
   - *Aplicar al Secuenciador:* Transfiere el ritmo generado directamente a la sesión activa.
   - *Descargar como MIDI:* Exporta el patrón propuesto como archivo `.mid` sin sobrescribir tu trabajo actual.

---

### 2.5 Exportación de Audio y MIDI
- **Exportación WAV:** Renderiza el patrón en el navegador mediante `OfflineAudioContext` produciendo un archivo PCM estándar de 16 bits, 44.1 kHz, reproducible en cualquier dispositivo sin necesidad de software adicional.
- **Exportación MIDI:** Genera un archivo binario Standard MIDI File Formato 1 (SMF1) con canal 10 General MIDI, velocidad dinámica y división temporal de 480 PPQ, listo para importar en LMMS, FL Studio, Ableton Live o Reaper.

---

### 2.6 Formato de Proyectos (.foz)
- Los proyectos se guardan automáticamente en el almacenamiento local del navegador (`LocalStorage`).
- Puedes exportar tu proyecto a un archivo `.foz` (JSON estructurado) para compartirlo o llevarlo a otro ordenador.
- En la pestaña **Proyectos**, pulsa *Importar Archivo .foz* para cargar cualquier proyecto guardado previamente.
