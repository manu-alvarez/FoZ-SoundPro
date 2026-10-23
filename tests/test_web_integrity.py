#!/usr/bin/env python3
"""
FoZ SoundPro — Test de Integridad de la Distribución Web
========================================================
Comprueba que todos los recursos de la web estática existan, que no haya
enlaces rotos ni dependencias críticas externas (CDN) para el modo offline.
"""

import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = PROJECT_ROOT / "web"


def verify_web_distribution() -> list[str]:
    errors = []
    index_html = WEB_DIR / "index.html"

    if not index_html.exists():
      return ["web/index.html no existe."]

    html_content = index_html.read_text(encoding="utf-8")

    # 1. Comprobar CSS referenciado
    css_matches = re.findall(r'<link\s+[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\']', html_content)
    for css_href in css_matches:
      if css_href.startswith("http://") or css_href.startswith("https://"):
        errors.append(f"Dependencia externa no permitida para modo offline en index.html: {css_href}")
      else:
        css_file = WEB_DIR / css_href
        if not css_file.exists():
          errors.append(f"Archivo CSS no encontrado: {css_href}")

    # 2. Comprobar Scripts referenciados
    js_matches = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html_content)
    for js_src in js_matches:
      if js_src.startswith("http://") or js_src.startswith("https://"):
        errors.append(f"Dependencia externa no permitida para modo offline en index.html: {js_src}")
      else:
        js_file = WEB_DIR / js_src
        if not js_file.exists():
          errors.append(f"Archivo JS no encontrado: {js_src}")

    # 3. Comprobar Manifest y Service Worker
    manifest_file = WEB_DIR / "manifest.json"
    if not manifest_file.exists():
      errors.append("web/manifest.json no existe.")
    else:
      m_content = manifest_file.read_text(encoding="utf-8")
      if '"start_url": "./index.html"' not in m_content:
        errors.append("web/manifest.json debe usar start_url relativa ('./index.html') para GitHub Pages.")

    sw_file = WEB_DIR / "sw.js"
    if not sw_file.exists():
      errors.append("web/sw.js no existe.")
    else:
      sw_content = sw_file.read_text(encoding="utf-8")
      if '"./index.html"' not in sw_content:
        errors.append("web/sw.js debe cachear rutas relativas ('./index.html') para subrutas de GitHub Pages.")

    # 4. Comprobar Workflow de GitHub Pages
    workflow_file = PROJECT_ROOT / ".github" / "workflows" / "deploy.yml"
    if not workflow_file.exists():
      errors.append(".github/workflows/deploy.yml no existe.")

    return errors


def main():
    print("=" * 60)
    print("FoZ SoundPro — Verificación de Integridad Web")
    print("=" * 60)

    errs = verify_web_distribution()
    if errs:
      for e in errs:
        print(f"  [FAIL] {e}")
      return 1
    else:
      print("  [OK] Distribución web estática verificada:")
      print("       • Sin dependencias externas de CDN para modo offline.")
      print("       • Todos los scripts y hojas de estilo locales están presentes.")
      print("       • Manifiesto PWA y Service Worker validados con rutas relativas.")
      print("       • Flujo de GitHub Actions para Pages configurado correctamente.")
      return 0


if __name__ == "__main__":
  sys.exit(main())
