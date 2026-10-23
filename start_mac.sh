#!/usr/bin/env bash
# ==============================================================================
# FoZ SoundPro — Lanzador Local para macOS (con detección de puertos libres)
# ==============================================================================

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ejecutar el lanzador Python que detecta automáticamente puertos libres sin colisión
if command -v python3 >/dev/null 2>&1; then
  python3 "${SCRIPT_DIR}/scripts/automation/serve_studio.py" "$@"
elif command -v python >/dev/null 2>&1; then
  python "${SCRIPT_DIR}/scripts/automation/serve_studio.py" "$@"
else
  # Fallback abriendo el archivo local si no hay intérprete de Python
  printf "\033[33m[AVISO] Python no detectado. Abriendo index.html en navegador por defecto...\033[0m\n"
  open "${SCRIPT_DIR}/web/index.html"
fi
