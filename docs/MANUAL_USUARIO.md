# FoZ SoundPro — Manual de Usuario (v1.1 The Expansion)

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

### En Linux:
```bash
sh start_linux.sh
```
*Nota:* igual que en macOS, inicia un servidor local en un puerto libre ≥9200 y abre el estudio en tu navegador. Sin Python, abre `web/index.html` con el navegador por defecto (requiere `xdg-open`).

### En la Web (sin instalación):
Abre directamente [https://manu-alvarez.github.io/FoZ-SoundPro/](https://manu-alvarez.github.io/FoZ-SoundPro/).

---

## 2. Módulos del Estudio (7 pestañas)

### 2.1 Secuenciador por Pasos (Beatmaker)
- **16 voces sintéticas** (todas generadas por Web Audio API, sin licencias ni archivos externos):
  1. *Bombo (Kick 808):* barrido sub-grave con transitorio de ataque.
  2. *Caja (Snare):* doble capa (cuerpo tonal en 190 Hz + ruido de bordones).
  3. *Palmas (Clap):* micro-ráfagas triples espaciadas por 11 ms.
  4. *Hi-Hat Cerrado:* textura metálica con caída ultra rápida (55 ms).
  5. *Hi-Hat Abierto:* cola de resonancia abierta (350 ms).
  6. *Sub-Bajo 808:* subgrave sostenido con caída afinada.
  7. *Aro (Rimshot):* golpe seco para síncopas.
  8. *Crash Cymbal:* impacto de plato con barrido de ruido y deferescencia larga.
  9. *Ride Cymbal:* ping metálico con cola larga y ligera afinación en movimiento.
  10. *Tom Grave / Tom Medio:* toms con barrido descendente de tono.
  11. *Cowbell:* par de osciladores cuadrados desafinados (estilo 808).
  12. *Snap Trap:* dedo chasqueado ultra-corto con ruido soplado para traps modernos.
  13. *Shaker:* agitación granular de 16 micro-ráfagas.
  14. *Stab Dark:* acorde tipo teclado (síncopa oscura sobre la clave).
  15. *Horn Slap:* slap de metales sintético para grooves funk.
- **Longitud del patrón:** 16, 32 o 64 pasos (selector `PASOS` de la barra superior).
- **Velocity por paso:** mantén `Shift` y haz clic sobre un paso activo para ciclar *suave (0.5) → medio (0.85) → forte (1.0)*; los pasos suaves se pintan más apagados y los fuertes brillan más.
- **Color por instrumento:** cada fila y sus pasos iluminados usan su color propio para leer el patrón de un vistazo.
- **Sample Studio (📂):** pulsa el botón de carpeta de cualquier fila para cargar una **muestra local** (WAV/MP3/M4A/OGG/FLAC) y dispararla como una voz más, respetando velocity y volumen. La muestra vive solo en la memoria de esta sesión (no queda dentro del `.foz`).
- **Kit CC0 (v1.2.1):** botón **📂 Kit (carpeta)** importa una carpeta completa; cada archivo se asigna a la voz por nombre de archivo o subcarpeta (`kick`/`bombo` → kick; `hihat_closed` → hi-hat cerrado; `cow`/`cowbell` → cowbell; `maracas` → shaker). 11 voces con muestra (`workspace/samples-cc0/`, licencia CC0, fuente `stargate-sample-pack @ dbfd6ec`) + 5 voces mantienen síntesis (`bass808`, `snap_trap`, `stab_dark`, `horn_slap`, `ride`). El kit no entra en Git (`.gitignore *.wav`).
- **Controles por fila:**
  - Clic en el *nombre* para escuchar la voz en preview.
  - `📂`: cargar muestra local · `✕`: quitar muestra y volver a la voz sintética.
  - `M`: Silenciar pista (Mute) · `S`: Pista en solo (Solo).
  - Slider de volumen individual (0 – 1.2).
- **Controles globales de transporte:**
  - `PLAY / PAUSE`: reproducción cíclica continua (Atajo: tecla **Espacio**).
  - `STOP`: detener y reiniciar el cursor al paso 1.
  - `BPM`: ajuste de tempo (30 a 300 BPM).
  - `SWING`: factor de arrastre rítmico (0% a 75%) en semicorcheas impares.
  - `PASOS`: 16 / 32 / 64.
  - `MASTER`: volumen de salida master con compresor anti-saturación.

---

### 2.2 Trackpad FX (Pad XY de efectos)
El pad multidimensional aplica FX al bus master del beat **en tiempo real**:

- **Eje X (horizontal):** filtro `Lowpass` (apaga los agudos, efecto "bajo el agua") o `Highpass` (apaga los graves, efecto "walkie-talkie"), mapeo exponencial 120 Hz → 18 kHz para máxima resolución en graves.
- **Eje Y (vertical):** elige el efecto en el desplegable `-MUX Y`:
  - *Tape Drive:* saturación analógica progresiva (calidez y grueso).
  - *Eco:* eco corto (segundo) sincronizado automáticamente al BPM del proyecto (corchea).
- **Interacción:**
  - Funciona con ratón (arrastrar) y con **multitáctil** en pantallas táctiles (Pointer Events, sin scroll accidental).
  - **Doble toque en el centro** del pad (o botón `RESET`): vuelve al estado neutro (filtro abierto, sin FX).
  - `MOMENTÁNEO:` al soltar el pad, el efecto vuelve a neutro (estilo pedal CC de MIDI). Con el botón apagado, el pad se queda en el último valor al soltar.
  - `HORNEAR EN WAV:` si está activo, el estado del pad se graba "dentro" del archivo WAV exportado.
- **Presets de estilo:** `Clean`, `Trap Lush` (lowpass ~2.9 kHz + eco), `Boom Bap Dusty` (lowpass ~1 kHz + tape) y `Drill Dark` (lowpass ~0.6 kHz + tape fuerte).
- El estado del pad se guarda con el proyecto y el eco se re-sincroniza al cambiar el BPM.

---

### 2.3 Pads — Caja de Ritmos 4×4 (*nueva en v1.2*)
La pestaña **Pads** convierte el estudio en un controlador jugable tipo MPC sobre las mismas 16 voces del secuenciador (mismos colores; si cargaste muestras locales por pista, los pads las disparan vía Sample Studio):

- **Grid 4×4 jugable:** golpea cualquier voz con ratón o dedo; es **multitáctil** (varias voces a la vez, Pointer Events sin scroll accidental) y el pad destella al golpear.
- **Teclado QWERTY:** en ordenador tocas sin ratón — `1 2 3 4` (voces 13-16), `Q W E R` (1-4), `A S D F` (5-8) y `Z X C V` (9-12). Cada pad muestra su tecla en la esquina. La barra espaciadora sigue siendo Play/Stop y las teclas de pads no secuestran campos de texto ni prompts.
- **Velocity:** slider global (10%-100%) que aplica a todos los golpes.
- **Grabación en vivo cuantizada (el núcleo de la pestaña):** con `▶ PLAY` en marcha, pulsa `● REC EN VIVO` (se pone rojo): cada golpe **se escribe en el paso del secuenciador que esté sonando en ese instante**, con la velocity del golpe. Golpear y componer funciona igual en móvil, tablet y PC — no depende de la pantalla en la que estés.
  - Un golpe sobre un paso **ya encendido** no lo apaga (comportamiento real de caja de ritmos; para borrar usas el grid del secuenciador).
  - Todo lo grabado se persiste con el proyecto: aparece en el grid y sale en el export de WAV y MIDI.
- **FX en vivo por el Trackpad:** los golpes pasan por el filtro/Tape/Eco del Trackpad FX; por defecto el efecto **queda fijado en el último valor al soltar** (estilo latch) y el botón `MOMENTÁNEO` del Trackpad lo vuelve momentáneo estilo pedal CC — maniobra para tocar pads con una mano y sostener el efecto con otra.

---

### 2.4 Presets de Estilo Integrados (8 kits)
Carga instantánea con un clic (barra superior o catálogo de Proyectos):
- **Boom Bap Clásico (90 BPM):** bombo espaciado, caja clásica y hi-hats al 22% de swing.
- **Trap Banger (140 BPM):** palmas en tiempo 3, semicorcheas continuas de hi-hats y 808 pesado.
- **Drill Pattern (142 BPM):** hi-hats sincopados UK/NY y caja retardada.
- **Lo-Fi Chill Hop (85 BPM):** swing acentuado al 35%, bombo sutil y aro.
- **Trap Dark Snap (140 BPM):** *nuevo v1.1* — snap ultra-corto, crash de ataque, shaker envolvente y 808.
- **Drill Kheap Dark (142 BPM):** *nuevo v1.1* — toms graves sincopados, ride fantasma y 808 pesado.
- **Lo-Fi Dusty Stabs (78 BPM):** *nuevo v1.1* — stabs de teclado oscuros con swing arrastrado.
- **Cowbell Bounce (96 BPM):** *nuevo v1.1* — cowbell sincopado, slap de metales y groove funk.

---

### 2.5 Record Studio (Grabación con cadena pro)
Graba tu voz (o cualquier fuente de micro) **sobre el beat**, con salida WAV PCM 16-bit determinista:

1. **Activa el micro:** pulsa `🔓 Activar Micrófono` (el navegador pedirá permiso la primera vez). Elige el dispositivo en el desplegable si tienes varios.
2. **Ajusta la cadena de voz:**
   - *HPF:* filtro pasa-altos para limpiar rumble (80 Hz recomendado para voz).
   - *EQ de 3 bandas* (gravos 180 Hz, medios 1.2 kHz, agudos 3.6 kHz, ±12 dB).
   - *Compresor:* `Off / Suave (3:1) / Rap (6:1) / Agresivo (8:1)`.
   - *Reverb* (sala sintética) y *Eco* (240 ms) por sends.
   - *VU + osciloscopio:* vigila el nivel; el meter se vuelve rojo si saturas.
3. **Monitor:** botón `MONITOR` para oír tu voz por los altavoces. **Usa auriculares** siempre que el micro esté activo para evitar el acople (la voz del altavoz volviendo a entrar al micro).
4. **Qué grabar:** `Voz + Beat` (busca la mezcla de micro y beat), `Solo voz` (micro limpio) o `Solo beat` (sin micro).
5. **Pre-roll:** elige cuenta de 0, 1 o 2 compases antes de que arranque la grabación (metrónomo audible en la cuenta).
6. **Pulsa `GRABAR`:** la cuenta aparece en pantalla, el beat arranca solo en el pulso exacto y se captura audio PCM por bloques.
7. **Pulsa `DETENER`:** obtienes la toma como WAV con:
   - **Ajuste fino voz/beat (±150 ms):** deslizador para nudge si tu entrada tiene latencia; se aplica sobre la toma guardada.
   - **Gate de toma (`GATE TOMA`):** noise gate aplicado offline: silencia el fondo entre frases de forma reversible y determinista.
8. **Tomas:** se guardan en IndexedDB del navegador (lista con reproductor, tamaño, duración, aviso de clipping y descarga `⬇ WAV`). Puedes borrarlas individualmente.

*Detalles técnicos honestos:* la captura es por PCM (ScriptProcessorNode) para que el archivo sea **exactamente igual en macOS y Windows** (el MediaRecorder del sistema se guarda como respaldo cuando la captura PCM no está disponible). El pre-roll se sincroniza con el reloj de audio, no con el de sistema, para evitar deriva.

---

### 2.6 Base Library (Bases / Instrumentales)
Toca tu beat por encima de una instrumental o audio importado:

1. **Importa audio:** `⬇ Importar Bases` acepta MP3, M4A, WAV, Ogg y FLAC **locales** (múltiples archivos a la vez). Se decodifican en el navegador → nada se sube ni se guarda en Git.
2. **Catálogo M3U:** `📃 Importar Manifiesto .m3u/.m3u8` crea un catálogo con títulos y orden, y enlaza las pistas cuyo nombre coincide con las bases importadas. Los streaming remotos (listas HLS) no son compatibles: la app es 100% offline.
3. **Base activa:** marca la base con el selector circular de la lista. La base activa arranca junto al transporte (`PLAY`) y se detiene con él.
4. **Mezcla:** volumen (0 – 1.5), fade-in de arranque, fade-out en export y `Buclar la base` al terminar.
5. **Preview:** botón `▶ Escuchar` para escuchar la base sin el secuenciador.
6. **Horneado en export:** al exportar el WAV del patrón, la base activa se mezcla en la renderización offline (con su ganancia y fades).

---

### 2.7 Asistente Musical con IA (Multi-Proveedor)
El asistente elige proveedor por prioridad: **proveedor activo con estado online** → **primer proveedor disponible** → **motor heurístico offline**. Gestiónalo todo en la pestaña **Diagnóstico ▸ Proveedores de IA**:

1. **FoZ Local Bridge (recomendado):** el puente local (`python3 scripts/automation/local_bridge.py`) consulta Ollama y devuelve el patrón con CORS configurado. Es la ruta fiable desde la página HTTPS de GitHub Pages.
2. **Ollama directo:** servidores Ollama accesibles por red, incluidos los tuyos vía **Tailscale** (p. ej. `http://100.100.2.10:11434`). El diagnóstico es honesto por sondeo:
   - 🟢 *online:* accesible con CORS y lista de modelos leída.
   - 🟡 *alcanzable (sin CORS):* la red responde pero el navegador no puede leerla — define `OLLAMA_ORIGINS` en ese Ollama y reinícialo, o usa el puente.
   - 🔴 *no accesible:* red/Tailscale caída, o bloqueo de contenido mixto (HTTPS→HTTP) típico de Pages: usa el puente.
3. **API propia del usuario:** cualquier endpoint compatible con OpenAI (`baseUrl` + API key + modelo). La clave se guarda **solo en el almacenamiento local de tu navegador**; nunca viaja por el puente ni se guarda en el proyecto.
4. **Descarga de modelos (pull):** si el modelo que necesitas no está instalado, escribe su nombre (`qwen3.5:4b`, `llamusic/llamusic:latest`, `phi4-mini-reasoning:latest`…) y pulsa `⬇ Descargar` en la tarjeta de proveedores. La descarga puede tardar minutos según los GB del modelo.
5. **Modelo preferido:** en cada fila de proveedor puedes fijar el modelo a usar; si no existe, el asistente elige el mejor disponible (`qwen3.5:4b` → `llamusic` → el primero de la lista).
6. **Modo Heurístico Autónomo (100% offline):** si ningún proveedor responde, el generador por teoría musical sigue funcionando sin conexión.
7. **Acciones del Asistente:**
   - *Previsualización:* mini-mapa de pasos por voz y explicación musical en texto.
   - *Aplicar al Secuenciador:* transfiere el patrón generado a la sesión activa (normalizado a las **16 voces**).
   - *Descargar como MIDI:* exporta el patrón propuesto como `.mid` sin sobrescribir tu trabajo.

---

### 2.8 Exportación de Audio y MIDI
- **Exportación WAV:** renderiza el patrón en el navegador mediante `OfflineAudioContext` produciendo un archivo PCM estándar de 16 bits, 44.1 kHz. En v1.1 además hornea la **base importada** y el estado del **Trackpad FX** (si tienen el horneado activado).
- **Exportación MIDI:** genera un archivo binario Standard MIDI File Formato 1 (SMF1) con canal 10 General MIDI, velocidad dinámica y división temporal de 480 PPQ, listo para importar en LMMS, FL Studio, Ableton Live o Reaper. Incluye el mapa completo de las 16 voces.

---

### 2.9 Formato de Proyectos (.foz)
- Los proyectos se guardan automáticamente en el almacenamiento local del navegador (`LocalStorage`).
- Puedes exportar tu proyecto a un archivo `.foz` (JSON estructurado) para compartirlo o llevarlo a otro ordenador.
- El formato se **versiona** (actualmente esquema **1.1**):
  - Proyectos antiguos v1.0 se cargan con un **migrador automático no destructivo**: tus pasos se conservan tal cual y las pistas nuevas (crash, ride, toms, cowbell, snap, shaker, stab, horn) aparecen vacías.
  - El estado del Trackpad FX y la metadata de la sesión viajan dentro del proyecto.
- En la pestaña **Proyectos**, pulsa *Importar Archivo .foz* para cargar cualquier proyecto guardado previamente.

---

## 3. Consejos rápidos de producción
- **Swing + Tape:** activa el modulo Lo-Fi 85 con el trackpad en `Lowpass ~1 kHz + Tape` para un lo-fi creíble sin plugins.
- **Risers de trap:** sostén el pad en la esquina superior-izquierda con `Eco` activado mientras grabas (momentáneo como pedal).
- **Re-mezcla de tu beat importado:** carga tu base, activa `Solo beat` en Record Studio y graba 30 s del beat con los FX horneados para previsualizar cómo sonará exportado.
- **Nudge:** si tu voz suena siempre "tarde" respecto al beat, prueba -30/-50 ms en `Ajuste fino` y escucha la toma siguiente: los valores se recuerdan entre sesiones.

---

## 4. Uso en móvil y tablet (Android · iPhone · iPad)
La estación está pensada para escritorio, pero se usa perfectamente desde el navegador móvil:

- **Instalación como app (PWA):** en Chrome/Android, "Añadir a la pantalla de inicio"; en iOS Safari, `Compartir ▸ Añadir a pantalla de inicio`. El logo premium y el manifest están configurados.
- **Adaptación responsive:** en pantallas estrechas la barra de módulos pasa a fila horizontal deslizable, la barra de transporte se desplaza en horizontal y el secuenciador hace scroll lateral manteniendo la regla de compases alineada.
- **Trackpad FX y velocidades funcionan con dedos** (Pointer Events multitáctil; sin scroll accidental dentro del pad).
- **Grabación:** en móvil el navegador exige HTTPS para el micrófono (ideal: GitHub Pages). Sistema recomendado para grabar de forma determinista: escritorio.
- **Almacenamiento:** tomas, bases y proyectos viven en el almacenamiento de ese navegador; el cambio entre dispositivos se hace con `.foz` y descargas WAV/MIDI, no sincronizando en la nube.
