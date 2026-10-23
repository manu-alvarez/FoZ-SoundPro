#!/usr/bin/env python3
"""
FoZ SoundPro — Test de Esquema e Integridad de Proyectos (.foz)
==============================================================
Valida la sintaxis, esquema versionado y reglas musicales de los
archivos de proyecto nativos del estudio.
"""

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def validate_project_file(filepath: Path) -> list[str]:
    errors = []
    if not filepath.exists():
      return [f"Archivo no encontrado: {filepath}"]

    try:
      with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    except Exception as e:
      return [f"Error al parsear JSON: {e}"]

    # 1. Metadatos de cabecera
    if data.get("format") != "foz-soundpro-project":
      errors.append(f"Formato no coincide: {data.get('format')} (esperado 'foz-soundpro-project')")

    if not data.get("version"):
      errors.append("Falta la versión del esquema")

    bpm = data.get("bpm")
    if not isinstance(bpm, (int, float)) or bpm < 30 or bpm > 300:
      errors.append(f"BPM inválido: {bpm}")

    # 2. Pistas e instrumentos
    tracks = data.get("tracks")
    if not isinstance(tracks, list) or len(tracks) == 0:
      errors.append("Lista de pistas vacía o ausente")
      return errors

    required_ids = {"kick", "snare", "hihat_closed", "hihat_open", "clap", "bass808", "rimshot"}
    found_ids = set()

    for idx, trk in enumerate(tracks):
      t_id = trk.get("id")
      if not t_id:
        errors.append(f"Pista en índice {idx} no tiene 'id'")
        continue
      found_ids.add(t_id)

      steps = trk.get("steps")
      if not isinstance(steps, list) or len(steps) != 16:
        errors.append(f"Pista '{t_id}' debe tener exactamente 16 pasos (tiene {len(steps) if isinstance(steps, list) else 0})")

      vels = trk.get("velocities")
      if not isinstance(vels, list) or len(vels) != 16:
        errors.append(f"Pista '{t_id}' debe tener exactamente 16 valores de velocidad")

    missing = required_ids - found_ids
    if missing:
      errors.append(f"Faltan instrumentos esenciales en el proyecto: {missing}")

    return errors


def main():
    print("=" * 60)
    print("FoZ SoundPro — Verificación de Esquema de Proyectos")
    print("=" * 60)

    test_files = [
        PROJECT_ROOT / "workspace/projects/demo_trap_beat.foz",
        PROJECT_ROOT / "web/demo_project.foz",
    ]

    all_passed = True
    for p in test_files:
      rel_p = p.relative_to(PROJECT_ROOT)
      errs = validate_project_file(p)
      if errs:
        print(f"  [FAIL] {rel_p}:")
        for e in errs:
          print(f"         • {e}")
        all_passed = False
      else:
        print(f"  [OK]   {rel_p} conforme al estándar FoZ v1.0.0")

    return 0 if all_passed else 1


if __name__ == "__main__":
  sys.exit(main())
