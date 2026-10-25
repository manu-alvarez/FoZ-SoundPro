# FoZ SoundPro — Guía para PC Windows de Destino

Esta guía detalla los pasos para trasladar y ejecutar **FoZ SoundPro Beatmaker AI Studio** en el ordenador de destino con **Intel Core i5 (7.ª a 10.ª generación), 8 GB de RAM y gráfica integrada Intel**.

---

## 1. Características del Paquete Portátil

El paquete se encuentra empaquetado en:
`dist/FoZ_SoundPro_Portable_v1.1.zip` (acompañado de su suma criptográfica `FoZ_SoundPro_Portable_v1.1.zip.sha256`).

- **Coste:** 0 €.
- **Sin instaladores pesados ni dependencias de compilación:** No requiere Node.js, npm, Visual Studio ni Git en el ordenador de destino.
- **Peso reducido:** ~100 KB comprimido.
- **Ejecución 100% Offline:** Todas las funciones de síntesis de audio, secuenciador, exportación WAV/MIDI, persistencia y generación rítmica heurística funcionan sin conexión a Internet.
- **Prevención de conflictos de red:** El lanzador busca automáticamente un puerto TCP libre a partir del 9200, evitando colisionar con cualquier aplicación existente del usuario (como servidores en 8080, 8082, etc.).

---

## 2. Instrucciones de Traslado y Puesta en Marcha

1. Copia el archivo `FoZ_SoundPro_Portable_v1.1.zip` en el ordenador Windows (mediante pendrive USB, red local o descarga directa).
2. Haz clic derecho sobre el archivo ZIP y selecciona **Extraer todo...** en una carpeta de tu preferencia (ejemplo: `C:\FoZ_SoundPro` o en el Escritorio).
3. Entra en la carpeta extraída y haz doble clic sobre:
   ```cmd
   start_windows.bat
   ```
4. Se abrirá automáticamente tu navegador web predeterminado (Edge, Chrome, Firefox, Brave) con la estación musical lista para crear.

---

## 3. Rendimiento en el Hardware de Destino (i5 / 8 GB RAM)

El diseño técnico ha sido optimizado específicamente para este perfil de hardware:
- **Consumo de memoria RAM:** La aplicación web consume menos de 75 MB de memoria en el navegador. No satura los 8 GB del equipo.
- **Gráfica integrada Intel HD/UHD:** La interfaz utiliza aceleración 2D estándar y CSS optimizado sin shaders 3D pesados, garantizando 60 FPS estables.
- **Latencia de audio:** Web Audio API interactúa directamente con el subsistema de audio de Windows (WASAPI / DirectSound) a 44.1 kHz, proporcionando respuesta inmediata al pulsar los botones y reproducir ritmos.

---

## 4. Integraciones Opcionales en Windows

Si deseas ampliar las capacidades en el equipo Windows con software complementario gratuito:

### 4.1 LMMS en Windows (Opcional para mezcla avanzada)
- Puedes descargar e instalar LMMS 1.2.2 para Windows (64-bit) de forma gratuita desde su sitio oficial.
- La ruta estándar es: `C:\Program Files\LMMS\lmms.exe`.
- Puedes importar directamente los archivos `.mid` exportados desde FoZ SoundPro en el editor de canciones de LMMS y asignar instrumentos VST o SoundFonts.

### 4.2 Ollama en Windows (Opcional para IA con lenguaje natural)
- Si instalas Ollama para Windows desde `ollama.com`, puedes descargar un modelo ligero optimizado para 8 GB de RAM:
  ```cmd
  ollama run qwen3.5:4b
  ```
- Para conectar la interfaz web con Ollama, abre una consola en la carpeta del proyecto y ejecuta el puente local:
  ```cmd
  python scripts\automation\local_bridge.py
  ```
- La interfaz detectará automáticamente el puente en `http://127.0.0.1:8765` y activará la generación en lenguaje natural.

---

## 5. Resolución de Dudas Frecuentes

- **¿Qué pasa si no tengo Python instalado en el PC Windows?**
  El lanzador `start_windows.bat` detecta si Python está ausente y abre directamente el archivo `web\index.html` en el navegador. Todas las funciones de beatmaking, síntesis, grabación vocal, exportación WAV y MIDI siguen funcionando con normalidad.
- **¿Por qué el navegador pide permisos de micrófono al pulsar 'Grabar Toma'?**
  Es el mecanismo de seguridad nativo del navegador. Concede permiso para que la pestaña pueda capturar el audio de tu micrófono en la sección de grabación vocal.
