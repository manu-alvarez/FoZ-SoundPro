#!/usr/bin/env bash
# ==============================================================================
# FoZ SoundPro — System & Environment Doctor
# Script de diagnóstico reproducible para auditar el entorno de desarrollo y
# verificar los requisitos de cara al equipo de destino (macOS / Windows 8GB).
# ==============================================================================

set -u

# Colores y formato
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD="\033[1m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  CYAN="\033[36m"
  DIM="\033[2m"
  RESET="\033[0m"
else
  BOLD=""
  GREEN=""
  YELLOW=""
  RED=""
  CYAN=""
  DIM=""
  RESET=""
fi

TOTAL_CHECKS=0
TOTAL_PASS=0
TOTAL_WARN=0
TOTAL_FAIL=0

check_pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  TOTAL_PASS=$((TOTAL_PASS + 1))
  printf "  ${GREEN}[OK]${RESET} %s\n" "$1"
}

check_warn() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  TOTAL_WARN=$((TOTAL_WARN + 1))
  printf "  ${YELLOW}[WARN]${RESET} %s\n" "$1"
}

check_fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  printf "  ${RED}[FAIL]${RESET} %s\n" "$1"
}

section() {
  printf "\n${BOLD}${CYAN}=== %s ===${RESET}\n" "$1"
}

# Localizar raíz del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

printf "${BOLD}FoZ SoundPro — Diagnóstico del Sistema y Entorno${RESET}\n"
printf "${DIM}Directorio del proyecto: %s${RESET}\n" "$PROJECT_ROOT"
printf "${DIM}Fecha: $(date)${RESET}\n"

# ------------------------------------------------------------------------------
# 1. Sistema Operativo y Arquitectura
# ------------------------------------------------------------------------------
section "1. Sistema Operativo y Arquitectura"

OS_NAME="$(uname -s)"
KERNEL_VER="$(uname -r)"
ARCH_NAME="$(uname -m)"

case "$OS_NAME" in
  Darwin)
    OS_PRETTY="macOS $(sw_vers -productVersion 2>/dev/null || echo '')"
    ;;
  Linux)
    OS_PRETTY="Linux ($KERNEL_VER)"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    OS_PRETTY="Windows ($OS_NAME)"
    ;;
  *)
    OS_PRETTY="$OS_NAME ($KERNEL_VER)"
    ;;
esac

check_pass "Sistema operativo detectado: ${OS_PRETTY}"
check_pass "Arquitectura de CPU: ${ARCH_NAME}"

# Identificar modelo de procesador
CPU_MODEL=""
if [ "$OS_NAME" = "Darwin" ]; then
  CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo '')"
elif [ -f /proc/cpuinfo ]; then
  CPU_MODEL="$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^[ \t]*//')"
fi

if [ -n "$CPU_MODEL" ]; then
  printf "       ${DIM}Modelo CPU: %s${RESET}\n" "$CPU_MODEL"
fi

# ------------------------------------------------------------------------------
# 2. Memoria RAM y Almacenamiento
# ------------------------------------------------------------------------------
section "2. Memoria RAM y Recursos de Almacenamiento"

RAM_BYTES=0
RAM_GB="0"

if [ "$OS_NAME" = "Darwin" ]; then
  RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  if [ "$RAM_BYTES" -gt 0 ]; then
    RAM_GB="$(awk -v bytes="$RAM_BYTES" 'BEGIN { printf "%.1f", bytes / (1024*1024*1024) }')"
  fi
elif [ -f /proc/meminfo ]; then
  RAM_KB="$(grep -i MemTotal /proc/meminfo | awk '{print $2}')"
  RAM_GB="$(awk -v kb="$RAM_KB" 'BEGIN { printf "%.1f", kb / (1024*1024) }')"
elif command -v powershell.exe >/dev/null 2>&1; then
  RAM_KB="$(powershell.exe -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize" 2>/dev/null | tr -d '\r\n')"
  if [ -n "$RAM_KB" ]; then
    RAM_GB="$(awk -v kb="$RAM_KB" 'BEGIN { printf "%.1f", kb / (1024*1024) }')"
  fi
fi

if [ "$(echo "$RAM_GB > 0" | bc 2>/dev/null || awk -v r="$RAM_GB" 'BEGIN { print (r > 0) }')" -eq 1 ]; then
  # Comprobar límite del equipo de destino: 8 GB
  IS_GE_8GB="$(awk -v r="$RAM_GB" 'BEGIN { print (r >= 7.5 ? 1 : 0) }')"
  if [ "$IS_GE_8GB" -eq 1 ]; then
    check_pass "Memoria RAM física: ${RAM_GB} GB (cumple el objetivo de referencia de 8 GB)"
  else
    check_warn "Memoria RAM física: ${RAM_GB} GB (inferior a los 8 GB recomendados para el equipo de destino)"
  fi
else
  check_warn "No se pudo determinar con precisión la memoria RAM disponible."
fi

# Espacio en disco disponible
DISK_FREE_GB=""
if command -v python3 >/dev/null 2>&1; then
  DISK_FREE_GB="$(python3 -c "import shutil; print(round(shutil.disk_usage('$PROJECT_ROOT').free / (1024**3), 1))" 2>/dev/null || echo '')"
fi

if [ -n "$DISK_FREE_GB" ]; then
  IS_DISK_OK="$(awk -v d="$DISK_FREE_GB" 'BEGIN { print (d >= 5.0 ? 1 : 0) }')"
  if [ "$IS_DISK_OK" -eq 1 ]; then
    check_pass "Espacio en disco disponible: ${DISK_FREE_GB} GB"
  else
    check_warn "Espacio en disco bajo: ${DISK_FREE_GB} GB disponibles (se recomiendan al menos 5 GB para audio y modelos)"
  fi
else
  # Fallback mediante df
  DISK_INFO="$(df -h "$PROJECT_ROOT" 2>/dev/null | tail -1 | awk '{print $4}')"
  if [ -n "$DISK_INFO" ]; then
    check_pass "Espacio en disco disponible: ${DISK_INFO}"
  else
    check_warn "No se pudo comprobar el espacio libre en disco."
  fi
fi

# ------------------------------------------------------------------------------
# 3. Control de Versiones (Git)
# ------------------------------------------------------------------------------
section "3. Control de Versiones (Git)"

if command -v git >/dev/null 2>&1; then
  GIT_VER="$(git --version 2>/dev/null || echo '')"
  check_pass "Git instalado: ${GIT_VER}"

  # Verificar si estamos dentro del repositorio
  if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo 'desconocida')"
    CURRENT_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'ninguno')"
    GIT_DIRTY="$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)"
    
    check_pass "Repositorio Git activo en rama '${CURRENT_BRANCH}', commit '${CURRENT_COMMIT}'"
    if [ -z "$GIT_DIRTY" ]; then
      check_pass "Árbol de trabajo limpio (sin modificaciones no registradas)"
    else
      check_warn "El árbol de trabajo tiene cambios pendientes o archivos sin seguimiento"
    fi
  else
    check_fail "El directorio del proyecto no es un repositorio Git válido."
  fi
else
  check_fail "Git no está instalado o no se encuentra en el PATH del sistema."
fi

# ------------------------------------------------------------------------------
# 4. Entorno Python
# ------------------------------------------------------------------------------
section "4. Entorno de Ejecución Python"

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

if [ -n "$PYTHON_BIN" ]; then
  PY_FULL_VER="$($PYTHON_BIN --version 2>&1)"
  PY_MAJOR="$($PYTHON_BIN -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)"
  PY_MINOR="$($PYTHON_BIN -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)"

  if [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 10 ]; then
    check_pass "Python disponible: ${PY_FULL_VER} (${PYTHON_BIN})"
  else
    check_warn "Versión de Python detectada (${PY_FULL_VER}); se recomienda Python 3.10 o superior"
  fi

  # Comprobar módulos de biblioteca estándar requeridos para audio y MIDI
  STDLIB_CHECK="$($PYTHON_BIN -c "import wave, struct, math, os, sys, pathlib, json, argparse; print('OK')" 2>/dev/null || echo 'FAIL')"
  if [ "$STDLIB_CHECK" = "OK" ]; then
    check_pass "Módulos requeridos de la biblioteca estándar disponibles (wave, struct, math, etc.)"
  else
    check_fail "Faltan módulos esenciales en la biblioteca estándar de Python."
  fi
else
  check_fail "No se encontró ningún intérprete de Python (python3 o python) en el PATH."
fi

# ------------------------------------------------------------------------------
# 5. DAW — LMMS (Linux MultiMedia Studio)
# ------------------------------------------------------------------------------
section "5. DAW — LMMS"

LMMS_BIN=""

# Búsqueda en rutas estándar de macOS, PATH y Windows
CANDIDATE_PATHS=(
  "/Applications/LMMS.app/Contents/MacOS/lmms"
  "$(command -v lmms 2>/dev/null || echo '')"
  "${PROGRAMFILES:-C:\Program Files}/LMMS/lmms.exe"
  "${PROGRAMFILES_X86:-C:\Program Files (x86)}/LMMS/lmms.exe"
)

for path in "${CANDIDATE_PATHS[@]}"; do
  if [ -n "$path" ] && [ -x "$path" ]; then
    LMMS_BIN="$path"
    break
  fi
done

if [ -n "$LMMS_BIN" ]; then
  LMMS_VERSION_OUTPUT="$("$LMMS_BIN" --version 2>&1 | head -n 1)"
  check_pass "LMMS detectado en: ${LMMS_BIN}"
  check_pass "Versión de LMMS: ${LMMS_VERSION_OUTPUT}"

  # Comprobar soporte de CLI (comando 'render' verificado en help)
  if "$LMMS_BIN" --help 2>&1 | grep -q "render <project>"; then
    check_pass "Soporte de renderizado CLI disponible ('lmms render')"
  else
    check_warn "El binario de LMMS no parece listar la acción 'render' en su ayuda."
  fi
else
  check_warn "LMMS no encontrado en las rutas estándar ni en el PATH."
  printf "       ${DIM}Para macOS: Instalar LMMS en /Applications/LMMS.app${RESET}\n"
  printf "       ${DIM}Para Windows: Instalar en %ProgramFiles%\\LMMS\\lmms.exe${RESET}\n"
fi

# ------------------------------------------------------------------------------
# 6. Proveedor de IA Local — Ollama
# ------------------------------------------------------------------------------
section "6. Proveedor de IA Local — Ollama"

if command -v ollama >/dev/null 2>&1; then
  OLLAMA_PATH="$(command -v ollama)"
  check_pass "Binario de Ollama encontrado en: ${OLLAMA_PATH}"

  # Comprobar si el servicio responde
  OLLAMA_LIST_OUTPUT="$(ollama list 2>&1)"
  OLLAMA_STATUS=$?

  if [ $OLLAMA_STATUS -eq 0 ]; then
    MODEL_COUNT="$(echo "$OLLAMA_LIST_OUTPUT" | tail -n +2 | grep -v '^$' | wc -l | tr -d ' ')"
    check_pass "Servicio de Ollama activo (${MODEL_COUNT} modelo(s) o alias registrados)"

    # Listar modelos detectados
    printf "       ${DIM}Modelos detectados:${RESET}\n"
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        printf "         ${DIM}• %s${RESET}\n" "$line"
      fi
    done < <(echo "$OLLAMA_LIST_OUTPUT" | tail -n +2 | awk '{size = ($4 ~ /B/) ? $3 " " $4 : $3; printf "%-32s %-12s\n", $1, size}')

    # Verificar si existe algún modelo pequeño (< 5 GB) viable para 8 GB RAM
    if echo "$OLLAMA_LIST_OUTPUT" | grep -Eq "(qwen3.5:4b|phi4-mini|llama|gemma)"; then
      check_pass "Se detectaron modelos compactos compatibles con el límite de 8 GB RAM."
    else
      check_warn "No se encontraron modelos compactos (<5 GB) adecuados para 8 GB de RAM."
    fi
  else
    check_warn "Ollama está instalado pero el demonio del servicio no responde (posiblemente detenido)."
  fi
else
  check_warn "Ollama no está instalado o no se encuentra en el PATH (opcional según la arquitectura)."
fi

# ------------------------------------------------------------------------------
# Resumen Final
# ------------------------------------------------------------------------------
section "Resumen del Diagnóstico"

printf "  Total de comprobaciones: %d\n" "$TOTAL_CHECKS"
printf "  ${GREEN}Comprobadas con éxito:  %d${RESET}\n" "$TOTAL_PASS"
printf "  ${YELLOW}Advertencias (avisos):  %d${RESET}\n" "$TOTAL_WARN"
printf "  ${RED}Fallos críticos:        %d${RESET}\n" "$TOTAL_FAIL"

if [ "$TOTAL_FAIL" -eq 0 ]; then
  printf "\n${BOLD}${GREEN}✔ Diagnóstico completado sin fallos críticos.${RESET}\n"
  exit 0
else
  printf "\n${BOLD}${RED}✖ Se encontraron fallos críticos en el entorno.${RESET}\n"
  exit 1
fi
