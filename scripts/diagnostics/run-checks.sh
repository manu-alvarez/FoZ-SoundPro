#!/usr/bin/env bash
# ==============================================================================
# FoZ SoundPro — Suite de Diagnóstico y Comprobaciones Automatizadas
# Punto de entrada unificado para auditar entorno, audio, MIDI, esquemas,
# distribución web estática y paquete portátil para Windows.
# ==============================================================================

set -u

# Formato y colores en terminal
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Localizar Python
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

banner() {
  printf "\n${BOLD}${CYAN}====================================================================${RESET}\n"
  printf "${BOLD}${CYAN} %s${RESET}\n" "$1"
  printf "${BOLD}${CYAN}====================================================================${RESET}\n\n"
}

STATUS_DOCTOR=0
STATUS_WAV=0
STATUS_MIDI=0
STATUS_SCHEMA=0
STATUS_WEB=0
STATUS_ZIP=0

printf "\n${BOLD}Iniciando Suite de Pruebas de FoZ SoundPro — Beatmaker AI Studio${RESET}\n"
printf "${DIM}Raíz del proyecto: %s${RESET}\n\n" "$PROJECT_ROOT"

# 1. Diagnóstico del Entorno
banner "PASO 1/6: Auditoría del Entorno y Requisitos Técnicos"
if [ -x "${PROJECT_ROOT}/scripts/diagnostics/doctor.sh" ]; then
  "${PROJECT_ROOT}/scripts/diagnostics/doctor.sh"
  STATUS_DOCTOR=$?
else
  printf "${RED}[FAIL] No se encontró scripts/diagnostics/doctor.sh${RESET}\n"
  STATUS_DOCTOR=1
fi

# 2. Generación y Validación de WAV Sintético
banner "PASO 2/6: Generación y Verificación de Audio WAV Sintético"
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" "${PROJECT_ROOT}/scripts/audio/generate_test_wav.py"
  STATUS_WAV=$?
else
  STATUS_WAV=1
fi

# 3. Generación y Validación de Patrón MIDI
banner "PASO 3/6: Generación y Verificación de Archivo MIDI SMF1"
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" "${PROJECT_ROOT}/scripts/midi/generate_demo_midi.py"
  STATUS_MIDI=$?
else
  STATUS_MIDI=1
fi

# 4. Validación de Esquemas de Proyecto (.foz)
banner "PASO 4/6: Verificación de Esquemas de Proyecto (.foz)"
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" "${PROJECT_ROOT}/tests/test_project_schema.py"
  STATUS_SCHEMA=$?
else
  STATUS_SCHEMA=1
fi

# 5. Integridad de la Distribución Web
banner "PASO 5/6: Verificación de Integridad Web (Sin dependencias externas)"
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" "${PROJECT_ROOT}/tests/test_web_integrity.py"
  STATUS_WEB=$?
else
  STATUS_WEB=1
fi

# 6. Generación y Verificación del Paquete Portátil (ZIP)
banner "PASO 6/6: Generación y Verificación del Paquete Portátil Windows/Mac"
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" "${PROJECT_ROOT}/scripts/automation/build_portable_zip.py"
  STATUS_ZIP=$?
else
  STATUS_ZIP=1
fi

# Resumen General
banner "RESUMEN GENERAL DE PRUEBAS TÉCNICAS"

print_status_line() {
  local name="$1"
  local code="$2"
  if [ "$code" -eq 0 ]; then
    printf "  • %-46s ${GREEN}[APROBADA]${RESET}\n" "$name"
  else
    printf "  • %-46s ${RED}[FALLIDA (código %s)]${RESET}\n" "$name" "$code"
  fi
}

print_status_line "1. Diagnóstico del entorno (doctor.sh)" "$STATUS_DOCTOR"
print_status_line "2. Audio PCM WAV sintético (44.1kHz, 16b)" "$STATUS_WAV"
print_status_line "3. Patrón MIDI GM Canal 10 (90 BPM)" "$STATUS_MIDI"
print_status_line "4. Esquemas de proyecto (.foz versionado)" "$STATUS_SCHEMA"
print_status_line "5. Integridad web estática (PWA y offline)" "$STATUS_WEB"
print_status_line "6. Paquete portátil ZIP y suma SHA-256" "$STATUS_ZIP"

printf "\n${BOLD}Artefactos principales disponibles:${RESET}\n"
printf "  • Aplicación Web Estática: ${DIM}%s/web/index.html${RESET}\n" "$PROJECT_ROOT"
printf "  • Paquete Portátil ZIP:     ${DIM}%s/dist/FoZ_SoundPro_Portable_v1.2.zip${RESET}\n" "$PROJECT_ROOT"
printf "  • Suma Criptográfica:      ${DIM}%s/dist/FoZ_SoundPro_Portable_v1.2.zip.sha256${RESET}\n" "$PROJECT_ROOT"

OVERALL_STATUS=0
if [ "$STATUS_DOCTOR" -ne 0 ] || [ "$STATUS_WAV" -ne 0 ] || [ "$STATUS_MIDI" -ne 0 ] || \
   [ "$STATUS_SCHEMA" -ne 0 ] || [ "$STATUS_WEB" -ne 0 ] || [ "$STATUS_ZIP" -ne 0 ]; then
  OVERALL_STATUS=1
  printf "\n${BOLD}${RED}✖ AL MENOS UNA PRUEBA HA FALLADO.${RESET}\n\n"
else
  printf "\n${BOLD}${GREEN}✔ TODAS LAS PRUEBAS (6/6) HAN SIDO SUPERADAS SATISFACTORIAMENTE.${RESET}\n\n"
fi

exit $OVERALL_STATUS
