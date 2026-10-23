#!/usr/bin/env python3
"""
FoZ SoundPro — Generador y Verificador de Audio WAV de Prueba
===========================================================
Genera un archivo WAV PCM estándar (16 bits, 44100 Hz, estéreo) audible
utilizando exclusivamente la biblioteca estándar de Python (wave, struct, math).
Incluye verificación rigurosa de formato RIFF/WAVE, duración, tamaño y amplitud.
"""

import argparse
import math
import os
import struct
import sys
import wave
from pathlib import Path


def generate_tone_samples(
    sample_rate: int = 44100,
    duration_s: float = 2.0,
    base_freq: float = 440.0,
    peak_amplitude: float = 0.7,
) -> list[int]:
    """
    Genera muestras estéreo intercaladas (L, R, L, R...) para un tono
    armónico musical claramente audible con envolvente suave (anti-clic).
    - Canal Izquierdo: frecuencia fundamental (ej. 440 Hz) + sub-armónico.
    - Canal Derecho: quinta justa (ej. 660 Hz) + sub-armónico.
    - Envolvente: ataque de 50 ms y desvanecimiento de 100 ms.
    """
    total_frames = int(sample_rate * duration_s)
    attack_frames = int(sample_rate * 0.05)   # 50 ms
    release_frames = int(sample_rate * 0.10)  # 100 ms
    sustain_frames = total_frames - attack_frames - release_frames

    max_int16 = 32767
    target_amp = peak_amplitude * max_int16

    samples: list[int] = []

    for i in range(total_frames):
        t = i / sample_rate

        # Cálculo de la envolvente ADSR simple
        if i < attack_frames:
            env = i / attack_frames
        elif i < attack_frames + sustain_frames:
            env = 1.0
        else:
            rel_i = i - (attack_frames + sustain_frames)
            env = max(0.0, 1.0 - (rel_i / release_frames))

        # Izquierda: 440 Hz (0.75) + 220 Hz (0.25)
        sig_l = (0.75 * math.sin(2.0 * math.pi * base_freq * t) +
                 0.25 * math.sin(2.0 * math.pi * (base_freq * 0.5) * t))

        # Derecha: 660 Hz (quinta justa, 0.75) + 220 Hz (0.25)
        sig_r = (0.75 * math.sin(2.0 * math.pi * (base_freq * 1.5) * t) +
                 0.25 * math.sin(2.0 * math.pi * (base_freq * 0.5) * t))

        sample_l = int(sig_l * env * target_amp)
        sample_r = int(sig_r * env * target_amp)

        # Clamping por seguridad a 16 bits firmado
        sample_l = max(-32768, min(32767, sample_l))
        sample_r = max(-32768, min(32767, sample_r))

        samples.append(sample_l)
        samples.append(sample_r)

    return samples


def write_wav_file(filepath: Path, samples: list[int], sample_rate: int = 44100) -> None:
    """Escribe las muestras en un archivo WAV PCM de 16 bits estéreo."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    total_frames = len(samples) // 2

    with wave.open(str(filepath), "wb") as wf:
        wf.setnchannels(2)        # Estéreo
        wf.setsampwidth(2)        # 16 bits = 2 bytes
        wf.setframerate(sample_rate)
        wf.setnframes(total_frames)

        packed_data = struct.pack(f"<{len(samples)}h", *samples)
        wf.writeframes(packed_data)


def verify_wav_file(
    filepath: Path,
    expected_channels: int = 2,
    expected_sampwidth: int = 2,
    expected_rate: int = 44100,
    expected_duration: float = 2.0,
) -> tuple[bool, list[str]]:
    """
    Verifica minuciosamente la validez del archivo WAV generado:
    1. Apertura e inspección con módulo wave estándar.
    2. Comprobación binaria del contenedor RIFF/WAVE.
    3. Validación del tamaño exacto del archivo en disco.
    4. Comprobación del contenido sonoro (no silencio, RMS y pico).
    """
    errors: list[str] = []
    logs: list[str] = []

    if not filepath.exists():
        return False, [f"El archivo no existe: {filepath}"]

    actual_size = filepath.stat().st_size
    logs.append(f"Tamaño en disco: {actual_size:,} bytes")

    # 1. Inspección mediante módulo wave
    try:
        with wave.open(str(filepath), "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            comptype = wf.getcomptype()
            duration = nframes / framerate

            logs.append(f"Canales: {channels} ({'Estéreo' if channels == 2 else 'Mono'})")
            logs.append(f"Profundidad de bits: {sampwidth * 8} bits")
            logs.append(f"Frecuencia de muestreo: {framerate} Hz")
            logs.append(f"Total de tramas: {nframes:,}")
            logs.append(f"Duración: {duration:.3f} s")
            logs.append(f"Compresión: {comptype}")

            if channels != expected_channels:
                errors.append(f"Canales incorrectos: {channels} (esperado: {expected_channels})")
            if sampwidth != expected_sampwidth:
                errors.append(f"Ancho de muestra incorrecto: {sampwidth} (esperado: {expected_sampwidth})")
            if framerate != expected_rate:
                errors.append(f"Frecuencia incorrecta: {framerate} Hz (esperado: {expected_rate} Hz)")
            if abs(duration - expected_duration) > 0.01:
                errors.append(f"Duración incorrecta: {duration:.3f}s (esperado: {expected_duration:.3f}s)")
            if comptype != "NONE":
                errors.append(f"Compresión detectada: {comptype} (debe ser NONE para PCM sin comprimir)")

            raw_frames = wf.readframes(nframes)
    except wave.Error as e:
        return False, [f"Error al analizar cabecera WAV: {e}"]

    # 2. Comprobación binaria de estructura RIFF/WAVE
    with open(filepath, "rb") as bf:
        riff_header = bf.read(12)
        if len(riff_header) < 12:
            errors.append("Encabezado RIFF truncado")
        else:
            riff_id, riff_size, wave_id = struct.unpack("<4sI4s", riff_header)
            if riff_id != b"RIFF":
                errors.append(f"Identificador RIFF no coincide: {riff_id}")
            if wave_id != b"WAVE":
                errors.append(f"Identificador de formato WAVE no coincide: {wave_id}")
            if riff_size + 8 != actual_size:
                errors.append(f"Tamaño declarado en RIFF ({riff_size + 8}) no coincide con tamaño en disco ({actual_size})")

    # 3. Comprobación de señal de audio (RMS y no silencio)
    total_samples = len(raw_frames) // 2
    if total_samples > 0:
        unpacked = struct.unpack(f"<{total_samples}h", raw_frames)
        samples_l = unpacked[0::2]
        samples_r = unpacked[1::2]

        peak_l = max(abs(s) for s in samples_l)
        peak_r = max(abs(s) for s in samples_r)
        rms_l = math.sqrt(sum(s * s for s in samples_l) / len(samples_l))
        rms_r = math.sqrt(sum(s * s for s in samples_r) / len(samples_r))

        logs.append(f"Pico canal L: {peak_l:,} / 32767 ({peak_l / 32767 * 100:.1f}%)")
        logs.append(f"Pico canal R: {peak_r:,} / 32767 ({peak_r / 32767 * 100:.1f}%)")
        logs.append(f"RMS canal L: {rms_l:,.1f}")
        logs.append(f"RMS canal R: {rms_r:,.1f}")

        if peak_l < 1000 or peak_r < 1000:
            errors.append("La señal de audio está casi en silencio (pico < 1000)")
        if rms_l < 500 or rms_r < 500:
            errors.append("Energía RMS excesivamente baja (posible silencio no deseado)")
    else:
        errors.append("No se pudieron leer tramas de audio")

    return (len(errors) == 0), (logs + [f"ERROR: {e}" for e in errors])


def main() -> int:
    parser = argparse.ArgumentParser(description="Generador y verificador de archivo WAV sintético de prueba")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("workspace/exports/test_synthetic_tone.wav"),
        help="Ruta del archivo WAV de salida (por defecto: workspace/exports/test_synthetic_tone.wav)",
    )
    parser.add_argument(
        "--duration",
        "-d",
        type=float,
        default=2.0,
        help="Duración en segundos (por defecto: 2.0)",
    )
    parser.add_argument(
        "--freq",
        "-f",
        type=float,
        default=440.0,
        help="Frecuencia fundamental en Hz (por defecto: 440.0)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Solo verificar el archivo existente sin regenerarlo",
    )

    args = parser.parse_args()
    target_path = args.output

    print("=" * 60)
    print("FoZ SoundPro — Generador / Verificador de Audio WAV")
    print("=" * 60)

    if not args.verify_only:
        print(f"[*] Generando tono sintético armónico en: {target_path}")
        print(f"    Parámetros: {args.duration}s, 44100 Hz, 16-bit estéreo, f0={args.freq} Hz")
        samples = generate_tone_samples(
            sample_rate=44100,
            duration_s=args.duration,
            base_freq=args.freq,
        )
        write_wav_file(target_path, samples, sample_rate=44100)
        print("[+] Archivo WAV escrito correctamente.")

    print(f"[*] Verificando estructura técnica de: {target_path}")
    is_valid, log_lines = verify_wav_file(
        filepath=target_path,
        expected_channels=2,
        expected_sampwidth=2,
        expected_rate=44100,
        expected_duration=args.duration,
    )

    for line in log_lines:
        print(f"    • {line}")

    if is_valid:
        print("\n[OK] Verificación técnica superada: formato PCM estándar y audio audible válidos.")
        print("     Nota: Esta prueba garantiza la integridad sintética de generación.")
        print("     La reproducción en altavoces o auriculares requiere verificación manual del usuario.")
        return 0
    else:
        print("\n[FAIL] Falló la verificación técnica del archivo WAV.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
