# Soporte de Línea de Comandos (CLI) de LMMS 1.2.2

Este documento recopila las capacidades reales, verificadas empíricamente, del soporte de línea de comandos de la versión de LMMS instalada en el sistema.

---

## 1. Localización del Ejecutable

- **macOS:** `/Applications/LMMS.app/Contents/MacOS/lmms`
- **Windows:** `%PROGRAMFILES%\LMMS\lmms.exe` (por defecto `C:\Program Files\LMMS\lmms.exe`)
- **Linux:** `lmms` (mediante PATH)

---

## 2. Acciones y Sintaxis Verificada

LMMS 1.2.2 soporta acciones estructuradas de línea de comandos bajo la sintaxis:
```bash
lmms [opciones globales] [<acción> [parámetros de acción...]]
```

### 2.1 Renderizado de proyectos (`render`) — Modo Headless (100% verificado)

Renderiza un archivo de proyecto (`.mmp` o `.mmpz`) a un archivo de audio final sin necesidad de abrir la interfaz gráfica.

```bash
lmms render <proyecto.mmp|proyecto.mmpz> -o <archivo_salida> [opciones]
```

**Opciones admitidas para `render`:**
- `-o, --output <path>`: Ruta obligatoria del archivo destino (ej. `salida.wav`). Si se omite, sobreescribe el archivo de entrada.
- `-f, --format <format>`: Formato del render (`wav`, `flac`, `ogg`, `mp3`).
- `-s, --samplerate <samplerate>`: Frecuencia de muestreo en Hz (por defecto `44100`, hasta `192000`).
- `-b, --bitrate <bitrate>`: Bitrate en kbps para compresión (por defecto `160`).
- `-x, --oversampling <value>`: Factor de sobremuestreo (`1`, `2`, `4`, `8`, por defecto `2`).
- `-i, --interpolation <method>`: Método de interpolación (`linear`, `sincfastest`, `sincmedium`, `sincbest`).
- `-a, --float`: Utilizar profundidad de bits de 32 bits en coma flotante.
- `-l, --loop`: Renderizar en modo bucle.
- `-m, --mode <s|j|m>`: Modo estéreo para MP3 (`s`: Stereo, `j`: Joint Stereo, `m`: Mono).

**Ejemplo de comando real probado con éxito:**
```bash
/Applications/LMMS.app/Contents/MacOS/lmms render \
  /Applications/LMMS.app/Contents/share/lmms/projects/shorties/Skiessi-222.mmpz \
  -o workspace/exports/salida_lmms.wav \
  -f wav -s 44100
```

### 2.2 Renderizado por pistas separadas / Stems (`rendertracks`)

Renderiza cada pista del proyecto a un archivo independiente dentro de un directorio:
```bash
lmms rendertracks <proyecto.mmp|proyecto.mmpz> -o <directorio_destino> [opciones]
```

### 2.3 Descompresión e inspección de proyectos (`dump`)

Vuelca el XML de un archivo `.mmpz` comprimido a la salida estándar:
```bash
lmms dump <proyecto.mmpz>
```
Permite auditar pistas, canales, efectos y configuración sin descomprimir manualmente.

### 2.4 Actualización de versiones de proyecto (`upgrade`)

Actualiza un proyecto antiguo al esquema actual:
```bash
lmms upgrade <archivo_origen> [archivo_destino]
```

---

## 3. Limitaciones Críticas Comprobadas

1. **Diferencia entre MIDI y Proyectos LMMS:**
   - LMMS **no** convierte directamente un archivo `.mid` a audio por CLI sin un proyecto configurado.
   - Un archivo MIDI estándar solo contiene disparadores de notas (eventos de encendido/apagado, delta-times, velocidad y tempo), pero **no contiene síntesis de sonido ni muestras de instrumentos**.
   - Para que un MIDI genere audio, debe asociarse dentro de un proyecto LMMS (`.mmp` o `.mmpz`) a generadores de sonido (como TripleOscillator, AudioFileProcessor con muestras o SoundFonts SF2).

2. **Comportamiento del argumento `--import`:**
   - La opción `--import <archivo> [-e]` pertenece al bloque `"Options if no action is given"`.
   - Inicia el bucle de eventos de la interfaz gráfica Qt. Por tanto, no es una utilidad de conversión por lotes ni headless por consola.

3. **Dependencias de plugins externos:**
   - Al ejecutar en consola en macOS, LMMS emite advertencias sobre Carla (`libcarlapatchbay.so`, `libcarlarack.so`) si Carla no está instalado. Estas advertencias son no fatales si el proyecto utiliza los motores de síntesis nativos de LMMS.

---

## 4. Separación de Pruebas: Sintéticas vs. DAW vs. Reproducción Física

Para garantizar rigor técnico, FoZ SoundPro clasifica las comprobaciones en tres niveles bien delimitados:

| Nivel | Componente | Qué demuestra | Qué NO demuestra |
|---|---|---|---|
| **1. Sintético** | `scripts/audio/generate_test_wav.py` | Que el entorno genera WAVs conformes al estándar RIFF PCM, con amplitud, tamaño y duración exactas. | No demuestra que el DAW funcione ni que el hardware de sonido reproduzca audio sin distorsión. |
| **2. DAW** | `lmms render` (CLI headless) | Que el motor de audio y síntesis de LMMS funciona en el sistema operativo y puede compilar proyectos a WAV/FLAC. | No demuestra que el usuario escuche el sonido en sus auriculares o monitores. |
| **3. Perceptivo / Físico** | Reproducción en sistema de audio | Que los altavoces, interfaz de audio (CoreAudio en macOS, WASAPI/DirectSound en Windows) y volumen son correctos. | Requiere comprobación auditiva del operador humano. |
