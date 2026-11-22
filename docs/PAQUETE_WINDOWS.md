# Llevar FoZ SoundPro a un equipo Windows

## Preparar el paquete

Desde la raíz del repositorio, ejecuta el [empaquetador](../scripts/automation/build_portable_zip.py) con Python 3.

```sh
python3 scripts/automation/build_portable_zip.py
```

Copia `dist/FoZ_SoundPro_Portable_v1.2.zip` y su archivo `.sha256` al equipo de destino. En PowerShell, `Get-FileHash .\FoZ_SoundPro_Portable_v1.2.zip -Algorithm SHA256` permite comparar la huella con la que generó el empaquetador.

## Abrir el estudio

1. Extrae todo el ZIP en una carpeta.
2. Abre la carpeta extraída y ejecuta `start_windows.bat`.
3. Si el lanzador encuentra `python` en el PATH, inicia el servidor local. En caso contrario abre `web/index.html` directamente. Para funciones que dependen del origen web, utiliza el servidor local.
4. Carga un patrón y expórtalo como WAV o MIDI. Puedes importar el MIDI en un secuenciador como LMMS.

La generación rítmica heurística está integrada en el estudio. Para trabajar con Ollama, consulta las opciones del [manual de usuario](MANUAL_USUARIO.md). El rendimiento de audio depende del navegador, el equipo y las pistas activas.
