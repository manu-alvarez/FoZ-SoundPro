@echo off
REM ============================================================================
REM FoZ SoundPro — Lanzador Portatil para Windows (Intel i5 / 8GB RAM)
REM Detecta automaticamente puertos libres (a partir de 9200) para evitar colisiones.
REM ============================================================================

title FoZ SoundPro — Beatmaker AI Studio
color 0B

echo ============================================================================
echo           FoZ SoundPro — Beatmaker AI Studio (Modo Portatil)
echo ============================================================================
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Python detectado. Asignando puerto libre y abriendo navegador...
    python scripts\automation\serve_studio.py
) else (
    echo [AVISO] Python no encontrado en el PATH.
    echo Abriendo la estacion directamente en tu navegador por defecto...
    start "" web\index.html
)

echo.
echo ============================================================================
pause
