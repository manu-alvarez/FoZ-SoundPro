#!/usr/bin/env python3
"""
FoZ SoundPro — Servidor de Estudio con Detección Dinámica de Puertos Libres
==========================================================================
Busca automáticamente un puerto TCP libre (empezando en 9200) para evitar
cualquier colisión con servicios existentes del usuario (como 8080, 8082, etc.).
Sirve el directorio web/ y abre el navegador automáticamente.
"""

import argparse
import functools
import http.server
import os
import socket
import sys
import webbrowser
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = PROJECT_ROOT / "web"


def find_free_port(start_port: int = 9200, max_attempts: int = 100) -> int:
    """Busca y retorna el primer puerto TCP libre a partir de start_port."""
    for port in range(start_port, start_port + max_attempts):
      with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
          s.bind(("127.0.0.1", port))
          return port
        except OSError:
          continue
    # Si ninguno en el rango está libre, dejar que el SO asigne uno efímero
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
      s.bind(("127.0.0.1", 0))
      return s.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description="Lanzador local de FoZ SoundPro con puerto dinámico libre")
    parser.add_argument("--start-port", type=int, default=9200, help="Puerto inicial para buscar libres (por defecto 9200)")
    parser.add_argument("--no-browser", action="store_true", help="No abrir automáticamente el navegador")
    args = parser.parse_args()

    port = find_free_port(start_port=args.start_port)
    url = f"http://127.0.0.1:{port}"

    print("=" * 66)
    print("       FoZ SoundPro — Beatmaker AI Studio (Servidor Local)")
    print("=" * 66)
    print(f"[*] Comprobando disponibilidad de puertos...")
    print(f"[*] Puerto libre asignado: {port} (sin conflicto con otros servicios)")
    print(f"[*] Directorio servido:    {WEB_DIR}")
    print(f"[*] URL de acceso:         {url}")
    print("=" * 66)

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(WEB_DIR))

    try:
      with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        if not args.no_browser:
          print("[*] Abriendo FoZ SoundPro en tu navegador...")
          webbrowser.open(url)
        print("[*] Servidor activo. Presiona Ctrl+C para detenerlo.\n")
        httpd.serve_forever()
    except KeyboardInterrupt:
      print("\n[*] Servidor detenido por el usuario.")


if __name__ == "__main__":
  main()
