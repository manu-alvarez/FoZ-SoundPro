#!/usr/bin/env python3
"""
FoZ SoundPro — Generador y Verificador de Archivo MIDI de Prueba
==============================================================
Genera un archivo Standard MIDI File (SMF Formato 1) con un patrón de batería
de 4 compases a 90 BPM en compás 4/4, utilizando el canal General MIDI 10 (bombo,
caja y hi-hat cerrado), sin dependencias externas (solo biblioteca estándar).
Incluye un analizador y verificador estructural de bajo nivel del protocolo MIDI.
"""

import argparse
import os
import struct
import sys
from pathlib import Path


def encode_vlq(value: int) -> bytes:
    """Codifica un entero en Variable-Length Quantity (VLQ) del estándar MIDI."""
    buf = value & 0x7F
    bytes_out = [buf]
    value >>= 7
    while value > 0:
        buf = (value & 0x7F) | 0x80
        bytes_out.append(buf)
        value >>= 7
    bytes_out.reverse()
    return bytes(bytes_out)


def decode_vlq(data: bytes, offset: int) -> tuple[int, int]:
    """Decodifica un VLQ desde un búfer binario en offset. Retorna (valor, bytes_leídos)."""
    value = 0
    bytes_read = 0
    while True:
        if offset + bytes_read >= len(data):
            raise ValueError("Búfer truncado mientras se leía valor de longitud variable (VLQ)")
        b = data[offset + bytes_read]
        bytes_read += 1
        value = (value << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return value, bytes_read


class MidiEvent:
    def __init__(self, tick: int, data: bytes, priority: int = 10):
        self.tick = tick
        self.data = data
        self.priority = priority  # Menor número = antes si coinciden en el mismo tick

    def __lt__(self, other: "MidiEvent") -> bool:
        if self.tick != other.tick:
            return self.tick < other.tick
        return self.priority < other.priority


def build_drum_pattern(ppq: int = 480) -> list[MidiEvent]:
    """
    Construye un patrón de batería de 4 compases a 4/4.
    Instrumentos en GM Canal 10 (código binario de canal 9):
      - 36: Bombo (Bass Drum 1)
      - 38: Caja (Acoustic Snare)
      - 42: Hi-Hat cerrado (Closed Hi-Hat)
    """
    events: list[MidiEvent] = []
    ch_byte = 0x09  # Canal 10 (0-indexed = 9)
    note_on_status = 0x90 | ch_byte
    note_off_status = 0x80 | ch_byte

    # Nombre de pista
    track_name = "FoZ Drums (GM Ch 10)".encode("utf-8")
    events.append(MidiEvent(0, bytes([0xFF, 0x03, len(track_name)]) + track_name, priority=0))

    # Program Change (Kit estándar GM)
    events.append(MidiEvent(0, bytes([0xC0 | ch_byte, 0x00]), priority=1))

    ticks_per_bar = 4 * ppq  # 1920 ticks por compás
    eighth_tick = ppq // 2   # 240 ticks (corchea)

    def add_note(tick: int, note: int, velocity: int, duration: int):
        events.append(MidiEvent(tick, bytes([note_on_status, note, velocity]), priority=5))
        events.append(MidiEvent(tick + duration, bytes([note_off_status, note, 0]), priority=4))

    for bar in range(4):
        bar_start = bar * ticks_per_bar

        # 1. Hi-Hat Cerrado (nota 42): Corcheas continuas (8 por compás)
        for i in range(8):
            t = bar_start + i * eighth_tick
            vel = 88 if (i % 2 == 0) else 70  # Acento en pulso principal
            add_note(t, 42, vel, duration=ppq // 4)

        # 2. Caja (nota 38): Backbeat en Beat 2 (ppq) y Beat 4 (3 * ppq)
        add_note(bar_start + ppq, 38, 102, duration=ppq // 2)
        add_note(bar_start + 3 * ppq, 38, 102, duration=ppq // 2)

        # Variación en el compás 4: ghost note en semicorchea previa al beat 4
        if bar == 3:
            add_note(bar_start + 3 * ppq - (ppq // 4), 38, 55, duration=ppq // 4)

        # 3. Bombo (nota 36):
        # Patrón clásico Boom-Bap con síncopa
        add_note(bar_start, 36, 108, duration=ppq // 2)            # Beat 1
        add_note(bar_start + ppq + eighth_tick, 36, 95, duration=ppq // 2)  # Beat 2.5
        add_note(bar_start + 2 * ppq, 36, 105, duration=ppq // 2)         # Beat 3

        if bar in (1, 3):
            # Golpe sincopado adicional en la última semicorchea
            add_note(bar_start + 3 * ppq + eighth_tick, 36, 92, duration=ppq // 4)

    # Fin de pista al final exacto de 4 compases (7680 ticks)
    total_ticks = 4 * ticks_per_bar
    events.append(MidiEvent(total_ticks, bytes([0xFF, 0x2F, 0x00]), priority=99))
    return events


def build_conductor_track(bpm: float = 90.0, ppq: int = 480) -> list[MidiEvent]:
    """Construye la pista de control (Tempo y Compás)."""
    events: list[MidiEvent] = []

    # Time Signature: 4/4, 24 MIDI clocks/click, 8 32nd notes per 24 MIDI clocks
    events.append(MidiEvent(0, bytes([0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]), priority=0))

    # Set Tempo: Microsegundos por negra
    us_per_quarter = int(round(60_000_000 / bpm))
    b0 = (us_per_quarter >> 16) & 0xFF
    b1 = (us_per_quarter >> 8) & 0xFF
    b2 = us_per_quarter & 0xFF
    events.append(MidiEvent(0, bytes([0xFF, 0x51, 0x03, b0, b1, b2]), priority=1))

    # Nombre de pista
    track_name = "Master Track / Conductor".encode("utf-8")
    events.append(MidiEvent(0, bytes([0xFF, 0x03, len(track_name)]) + track_name, priority=2))

    # Fin de pista
    total_ticks = 4 * 4 * ppq
    events.append(MidiEvent(total_ticks, bytes([0xFF, 0x2F, 0x00]), priority=99))
    return events


def serialize_track(events: list[MidiEvent]) -> bytes:
    """Convierte una lista de eventos absolutos en un chunk binario MTrk con delta-times."""
    events.sort()
    track_payload = bytearray()
    last_tick = 0

    for ev in events:
        delta = ev.tick - last_tick
        if delta < 0:
            raise ValueError(f"Delta time negativo detectado: {delta}")
        track_payload.extend(encode_vlq(delta))
        track_payload.extend(ev.data)
        last_tick = ev.tick

    chunk = bytearray(b"MTrk")
    chunk.extend(struct.pack(">I", len(track_payload)))
    chunk.extend(track_payload)
    return bytes(chunk)


def create_smf1_file(filepath: Path, bpm: float = 90.0, ppq: int = 480) -> None:
    """Genera un archivo Standard MIDI File Formato 1."""
    filepath.parent.mkdir(parents=True, exist_ok=True)

    header = bytearray(b"MThd")
    header.extend(struct.pack(">IHHH", 6, 1, 2, ppq))  # len=6, format=1, ntracks=2, ppq=480

    track0 = serialize_track(build_conductor_track(bpm=bpm, ppq=ppq))
    track1 = serialize_track(build_drum_pattern(ppq=ppq))

    with open(filepath, "wb") as f:
        f.write(header)
        f.write(track0)
        f.write(track1)


def verify_midi_file(filepath: Path, expected_bpm: float = 90.0, expected_bars: int = 4) -> tuple[bool, list[str]]:
    """
    Analiza y valida minuciosamente la estructura binaria del archivo MIDI generado:
    - Cabecera MThd, longitud, formato, pistas y división (PPQ).
    - Parsing de chunks MTrk y eventos de tiempo delta (VLQ).
    - Presencia de meta-eventos de Tempo (BPM) y Time Signature (4/4).
    - Presencia de notas de bombo (36), caja (38) y hi-hat (42) en Canal 10.
    - Duración exacta calculada en compases y ticks.
    """
    errors: list[str] = []
    logs: list[str] = []

    if not filepath.exists():
        return False, [f"El archivo no existe: {filepath}"]

    file_bytes = filepath.read_bytes()
    logs.append(f"Tamaño en disco: {len(file_bytes)} bytes")

    if len(file_bytes) < 14:
        return False, ["Archivo demasiado corto para contener cabecera MIDI MThd válida"]

    # 1. Cabecera MThd
    magic = file_bytes[0:4]
    if magic != b"MThd":
        return False, [f"Magic header inválido: {magic} (esperado b'MThd')"]

    header_len, midi_format, num_tracks, ppq = struct.unpack(">IHHH", file_bytes[4:14])
    logs.append(f"Formato SMF: {midi_format} ({'Multipista' if midi_format == 1 else 'Pista Única'})")
    logs.append(f"Número de pistas declaradas: {num_tracks}")
    logs.append(f"Resolución (PPQ / Division): {ppq} ticks por negra")

    if header_len != 6:
        errors.append(f"Longitud de cabecera inválida: {header_len} (debe ser 6)")
    if midi_format not in (0, 1):
        errors.append(f"Formato MIDI inesperado: {midi_format}")
    if ppq <= 0:
        errors.append(f"División inválida: {ppq}")

    offset = 14
    parsed_tracks = 0
    detected_bpm = None
    detected_time_sig = None
    notes_channel_9: dict[int, int] = {}
    total_ticks_by_track: list[int] = []

    # 2. Parsing de Chunks MTrk
    while offset < len(file_bytes):
        if offset + 8 > len(file_bytes):
            errors.append("Chunk MTrk incompleto al final del archivo")
            break

        chunk_id = file_bytes[offset:offset + 4]
        chunk_len = struct.unpack(">I", file_bytes[offset + 4:offset + 8])[0]
        offset += 8

        if chunk_id != b"MTrk":
            errors.append(f"Chunk inesperado: {chunk_id} en offset {offset - 8}")
            offset += chunk_len
            continue

        track_data = file_bytes[offset:offset + chunk_len]
        offset += chunk_len
        parsed_tracks += 1

        trk_offset = 0
        current_tick = 0
        running_status = None
        has_end_of_track = False

        while trk_offset < len(track_data):
            delta, v_len = decode_vlq(track_data, trk_offset)
            trk_offset += v_len
            current_tick += delta

            if trk_offset >= len(track_data):
                errors.append(f"Pista {parsed_tracks} truncada en lectura de evento")
                break

            status_byte = track_data[trk_offset]

            if status_byte == 0xFF:
                # Meta Evento
                running_status = None
                trk_offset += 1
                meta_type = track_data[trk_offset]
                trk_offset += 1
                meta_len, v_len = decode_vlq(track_data, trk_offset)
                trk_offset += v_len
                meta_payload = track_data[trk_offset:trk_offset + meta_len]
                trk_offset += meta_len

                if meta_type == 0x2F:
                    has_end_of_track = True
                elif meta_type == 0x51 and meta_len == 3:
                    us_per_beat = (meta_payload[0] << 16) | (meta_payload[1] << 8) | meta_payload[2]
                    detected_bpm = round(60_000_000 / us_per_beat, 2)
                elif meta_type == 0x58 and meta_len >= 2:
                    num = meta_payload[0]
                    den = 2 ** meta_payload[1]
                    detected_time_sig = f"{num}/{den}"

            elif status_byte in (0xF0, 0xF7):
                # SysEx
                running_status = None
                trk_offset += 1
                sysex_len, v_len = decode_vlq(track_data, trk_offset)
                trk_offset += v_len + sysex_len

            else:
                # Evento de canal
                if status_byte & 0x80:
                    status = status_byte
                    trk_offset += 1
                    running_status = status
                else:
                    if running_status is None:
                        errors.append(f"Running status sin comando previo en offset {trk_offset}")
                        break
                    status = running_status

                msg_type = status & 0xF0
                channel = status & 0x0F

                if msg_type in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                    param1 = track_data[trk_offset]
                    param2 = track_data[trk_offset + 1]
                    trk_offset += 2

                    if channel == 9 and msg_type == 0x90 and param2 > 0:
                        # Note On con velocidad > 0 en Canal 10
                        notes_channel_9[param1] = notes_channel_9.get(param1, 0) + 1

                elif msg_type in (0xC0, 0xD0):
                    param1 = track_data[trk_offset]
                    trk_offset += 1
                else:
                    errors.append(f"Comando de canal desconocido: 0x{msg_type:02X}")
                    break

        if not has_end_of_track:
            errors.append(f"Pista {parsed_tracks} no incluye meta-evento End of Track (0xFF 0x2F 0x00)")

        total_ticks_by_track.append(current_tick)

    # 3. Validaciones musicales y de protocolo
    if parsed_tracks != num_tracks:
        errors.append(f"Pistas analizadas ({parsed_tracks}) no coinciden con cabecera ({num_tracks})")

    logs.append(f"Tempo detectado: {detected_bpm} BPM")
    logs.append(f"Compás detectado: {detected_time_sig}")

    if detected_bpm is None or abs(detected_bpm - expected_bpm) > 0.5:
        errors.append(f"Tempo incorrecto: {detected_bpm} (esperado: {expected_bpm} BPM)")

    if detected_time_sig != "4/4":
        errors.append(f"Compás incorrecto: {detected_time_sig} (esperado: 4/4)")

    # Comprobación de instrumentos de batería (GM Drum Map)
    kick_count = notes_channel_9.get(36, 0)
    snare_count = notes_channel_9.get(38, 0)
    hihat_count = notes_channel_9.get(42, 0)

    logs.append(f"Notas registradas en Canal 10 (Percusión GM):")
    logs.append(f"  • Bombo (nota 36 / Bass Drum 1): {kick_count} impactos")
    logs.append(f"  • Caja (nota 38 / Acoustic Snare): {snare_count} impactos")
    logs.append(f"  • Hi-Hat cerrado (nota 42 / Closed HH): {hihat_count} impactos")

    if kick_count == 0:
        errors.append("No se detectaron notas de bombo (36) en Canal 10")
    if snare_count == 0:
        errors.append("No se detectaron notas de caja (38) en Canal 10")
    if hihat_count == 0:
        errors.append("No se detectaron notas de hi-hat cerrado (42) en Canal 10")

    # Duración total en ticks (4 compases = 4 * 4 * ppq = 7680 ticks)
    expected_total_ticks = expected_bars * 4 * ppq
    max_track_ticks = max(total_ticks_by_track) if total_ticks_by_track else 0
    calculated_bars = max_track_ticks / (4 * ppq)
    logs.append(f"Duración total en ticks: {max_track_ticks} ({calculated_bars:.1f} compases)")

    if max_track_ticks != expected_total_ticks:
        errors.append(f"Duración en ticks incorrecta: {max_track_ticks} (esperado: {expected_total_ticks})")

    return (len(errors) == 0), (logs + [f"ERROR: {e}" for e in errors])


def main() -> int:
    parser = argparse.ArgumentParser(description="Generador y verificador de archivo MIDI SMF para FoZ SoundPro")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("workspace/midi/demo_beat_90bpm.mid"),
        help="Ruta del archivo MIDI de salida (por defecto: workspace/midi/demo_beat_90bpm.mid)",
    )
    parser.add_argument(
        "--bpm",
        "-b",
        type=float,
        default=90.0,
        help="Tempo en BPM (por defecto: 90.0)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Solo verificar el archivo MIDI existente sin regenerarlo",
    )

    args = parser.parse_args()
    target_path = args.output

    print("=" * 60)
    print("FoZ SoundPro — Generador / Verificador de MIDI SMF1")
    print("=" * 60)

    if not args.verify_only:
        print(f"[*] Generando patrón de batería 4 compases @ {args.bpm} BPM en: {target_path}")
        create_smf1_file(target_path, bpm=args.bpm, ppq=480)
        print("[+] Archivo MIDI SMF1 escrito correctamente.")

    print(f"[*] Verificando estructura técnica de: {target_path}")
    is_valid, log_lines = verify_midi_file(
        filepath=target_path,
        expected_bpm=args.bpm,
        expected_bars=4,
    )

    for line in log_lines:
        print(f"    • {line}")

    if is_valid:
        print("\n[OK] Verificación técnica superada: Estructura Standard MIDI File Formato 1 válida.")
        print("     Canal 10 (Percusión General MIDI) verificado con bombo, caja y hi-hat.")
        print("     Nota: Para reproducir el audio de este archivo MIDI se requiere un sintetizador")
        print("     o DAW (ej. LMMS con SoundFont o sintetizador nativo).")
        return 0
    else:
        print("\n[FAIL] Falló la verificación técnica del archivo MIDI.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
