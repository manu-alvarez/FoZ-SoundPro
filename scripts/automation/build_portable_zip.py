#!/usr/bin/env python3
"""
FoZ SoundPro — Creador y Verificador del Paquete Portátil (ZIP)
==============================================================
Empaqueta la distribución completa y portable de FoZ SoundPro para
el ordenador principal y el PC Windows de destino (Intel i5 / 8GB RAM).
Excluye .git, cachés, modelos pesados y archivos temporales.
Calcula el checksum SHA-256 y verifica la integridad del archivo ZIP.
"""

import hashlib
import os
import sys
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DIST_DIR = PROJECT_ROOT / "dist"
ZIP_NAME = "FoZ_SoundPro_Portable_v1.1.zip"
TARGET_ZIP = DIST_DIR / ZIP_NAME
CHECKSUM_FILE = DIST_DIR / f"{ZIP_NAME}.sha256"

# Archivos y carpetas a incluir
INCLUDE_PATHS = [
    "web",
    "workspace",
    "scripts",
    "docs",
    "config",
    "start_windows.bat",
    "start_mac.sh",
    "start_linux.sh",
    "README.md",
    "AGENTS.md",
]

# Patrones a excluir estrictamente
EXCLUDE_PATTERNS = [
    ".git",
    ".DS_Store",
    "Thumbs.db",
    "__pycache__",
    ".pytest_cache",
    ".vscode",
    ".idea",
    "dist",
    "tmp",
    "temp",
    "logs",
]


def should_exclude(rel_path_str: str) -> bool:
    parts = rel_path_str.replace("\\", "/").split("/")
    for part in parts:
      if part in EXCLUDE_PATTERNS:
        return True
      if part.endswith(".pyc") or part.endswith(".pyo"):
        return True
    return False


def build_and_verify_zip() -> bool:
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("FoZ SoundPro — Generador de Paquete Portátil")
    print("=" * 60)
    print(f"[*] Directorio de origen: {PROJECT_ROOT}")
    print(f"[*] Archivo destino:      {TARGET_ZIP}")

    total_files = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(TARGET_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
      for item in INCLUDE_PATHS:
        item_path = PROJECT_ROOT / item
        if not item_path.exists():
          print(f"    [!] Aviso: {item} no encontrado, omitiendo.")
          continue

        if item_path.is_file():
          rel_p = str(item_path.relative_to(PROJECT_ROOT))
          if not should_exclude(rel_p):
            zf.write(item_path, arcname=rel_p)
            total_files += 1
            total_uncompressed_bytes += item_path.stat().st_size
        elif item_path.is_dir():
          for root, dirs, files in os.walk(item_path):
            for f in files:
              full_f = Path(root) / f
              rel_p = str(full_f.relative_to(PROJECT_ROOT))
              if not should_exclude(rel_p):
                zf.write(full_f, arcname=rel_p)
                total_files += 1
                total_uncompressed_bytes += full_f.stat().st_size

    compressed_size = TARGET_ZIP.stat().st_size
    print(f"[+] Archivo ZIP empaquetado correctamente:")
    print(f"    • Total archivos incluidos: {total_files}")
    print(f"    • Tamaño descomprimido:    {total_uncompressed_bytes / 1024:.1f} KB")
    print(f"    • Tamaño comprimido (ZIP):  {compressed_size / 1024:.1f} KB")

    # 1. Comprobación de integridad del ZIP
    print("[*] Verificando integridad interna del ZIP (testzip)...")
    with zipfile.ZipFile(TARGET_ZIP, "r") as zf:
      corrupted = zf.testzip()
      if corrupted is not None:
        print(f"[FAIL] Archivo corrupto detectado dentro del ZIP: {corrupted}")
        return False

    print("    [OK] Integridad estructural y suma CRC32 verificadas sin errores.")

    # 2. Generación de Checksum SHA-256
    print("[*] Calculando hash criptográfico SHA-256...")
    sha256 = hashlib.sha256()
    with open(TARGET_ZIP, "rb") as f:
      while chunk := f.read(65536):
        sha256.update(chunk)
    digest = sha256.hexdigest()

    CHECKSUM_FILE.write_text(f"{digest}  {ZIP_NAME}\n", encoding="utf-8")
    print(f"    SHA-256: {digest}")
    print(f"    Archivo de suma guardado en: {CHECKSUM_FILE.name}")

    print("\n[OK] Paquete portátil generado y validado con éxito.")
    return True


if __name__ == "__main__":
  success = build_and_verify_zip()
  sys.exit(0 if success else 1)
