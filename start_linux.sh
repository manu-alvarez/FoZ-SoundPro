#!/usr/bin/env bash
# ==============================================================================
# FoZ SoundPro — Lanzador Local para Linux (con detección de puertos libres)
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
  printf "\033[33m[AVISO] Python no detectado. Abriendo index.html en el navegador por defecto...\033[0m\n"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${SCRIPT_DIR}/web/index.html" >/dev/null 2>&1 &
  else
    printf "\033[31m[ERROR] No hay python3 ni xdg-open. Instala Python 3 (python3 --version) para usar el servidor local.\033[0m\n"
    exit 1
  fi
fi
