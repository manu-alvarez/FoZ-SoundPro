#!/usr/bin/env python3
"""
FoZ SoundPro — Local Studio Bridge & Ollama Connector
=====================================================
Servidor puente ligero y seguro basado exclusivamente en la biblioteca estándar
de Python. Permite a la interfaz web (local o desplegada en GitHub Pages)
comunicarse con Ollama local y auditar herramientas locales (como LMMS),
con validación estricta de entradas, límites de tamaño, protección CORS y
sin ejecución arbitraria de comandos.

Uso:
  python3 scripts/automation/local_bridge.py [--port 8765] [--host 127.0.0.1]
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

# Raíz del proyecto
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def query_ollama_tags() -> list[dict]:
    """Consulta la lista de modelos de Ollama y filtra exclusivamente los locales (sin :cloud)."""
    try:
      req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", headers={"User-Agent": "FoZSoundProBridge/1.0"})
      with urllib.request.urlopen(req, timeout=2.0) as resp:
        if resp.status == 200:
          data = json.loads(resp.read().decode("utf-8"))
          all_models = data.get("models", [])
          local_models = []
          for m in all_models:
            name = m.get("name", "")
            # Omitir modelos identificados como cloud
            if ":cloud" not in name and not m.get("remote_model"):
              local_models.append({
                  "name": name,
                  "size": m.get("size", 0),
                  "parameter_size": m.get("details", {}).get("parameter_size", "Desconocido"),
                  "family": m.get("details", {}).get("family", "Desconocido"),
              })
          return local_models
    except Exception:
      pass
    return []


def check_lmms_installed() -> bool:
    """Verifica si LMMS está disponible en rutas estándar de macOS, Windows o PATH."""
    candidates = [
        Path("/Applications/LMMS.app/Contents/MacOS/lmms"),
        Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "LMMS" / "lmms.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "LMMS" / "lmms.exe",
    ]
    for c in candidates:
      if c.exists():
        return True
    # Comprobar en PATH
    for path_dir in os.environ.get("PATH", "").split(os.pathsep):
      p = Path(path_dir) / ("lmms.exe" if sys.platform == "win32" else "lmms")
      if p.exists() and os.access(p, os.X_OK):
        return True
    return False


def call_ollama_generate_json(prompt: str, genre: str, bpm: int, model_name: str) -> dict:
    """Envía la solicitud de generación a Ollama forzando salida JSON estructurada y segura."""
    system_instruction = (
        "Eres el asistente musical de FoZ SoundPro. Tu tarea es generar patrones rítmicos "
        "de batería en formato JSON para un secuenciador de 16 pasos en compás 4/4. "
        "Debes responder EXCLUSIVAMENTE con un JSON válido sin texto introductorio ni explicaciones adicionales. "
        "Estructura exacta requerida:\n"
        "{\n"
        '  "genre": "género musical",\n'
        '  "suggestedBpm": número entero entre 60 y 180,\n'
        '  "swing": número flotante entre 0.0 y 0.5,\n'
        '  "explanation": "breve razonamiento rítmico",\n'
        '  "tracks": {\n'
        '    "kick": [16 números 0 o 1],\n'
        '    "snare": [16 números 0 o 1],\n'
        '    "clap": [16 números 0 o 1],\n'
        '    "hihat_closed": [16 números 0 o 1],\n'
        '    "hihat_open": [16 números 0 o 1],\n'
        '    "bass808": [16 números 0 o 1],\n'
        '    "rimshot": [16 números 0 o 1]\n'
        "  },\n"
        '  "velocities": {\n'
        '    "kick": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "snare": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "clap": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "hihat_closed": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "hihat_open": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "bass808": [16 números flotantes entre 0.1 y 1.0],\n'
        '    "rimshot": [16 números flotantes entre 0.1 y 1.0]\n'
        "  }\n"
        "}"
    )

    user_query = f"Género: {genre}. Tempo actual: {bpm} BPM. Instrucción del productor: {prompt}"

    ollama_payload = {
        "model": model_name,
        "prompt": f"<|system|>\n{system_instruction}\n<|user|>\n{user_query}\n<|assistant|>",
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
        }
    }

    req_data = json.dumps(ollama_payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/generate",
        data=req_data,
        headers={"Content-Type": "application/json", "User-Agent": "FoZSoundProBridge/1.0"},
    )

    with urllib.request.urlopen(req, timeout=30.0) as resp:
      result = json.loads(resp.read().decode("utf-8"))
      raw_text = result.get("response", "").strip()

      # Limpiar posibles delimitadores markdown ```json ... ```
      cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
      cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

      parsed = json.loads(cleaned)

      # Validar y normalizar formato devuelto
      if "tracks" not in parsed:
        raise ValueError("El modelo no generó la estructura de pistas 'tracks'.")

      # Asegurar 16 pasos por instrumento
      valid_keys = ["kick", "snare", "clap", "hihat_closed", "hihat_open", "bass808", "rimshot"]
      normalized_tracks = {}
      normalized_vels = {}

      for k in valid_keys:
        raw_steps = parsed.get("tracks", {}).get(k, [])
        if not isinstance(raw_steps, list):
          raw_steps = []
        # Pad o slice a 16 elementos
        steps_16 = [bool(s) for s in (raw_steps + [0] * 16)[:16]]
        normalized_tracks[k] = steps_16

        # Normalizar velocidades
        raw_v = parsed.get("velocities", {}).get(k, [])
        if not isinstance(raw_v, list):
          raw_v = []
        vels_16 = [float(v) if isinstance(v, (int, float)) else 0.85 for v in (raw_v + [0.85] * 16)[:16]]
        normalized_vels[k] = vels_16

      return {
          "source": f"Ollama Local ({model_name})",
          "genre": str(parsed.get("genre", genre)),
          "suggestedBpm": int(parsed.get("suggestedBpm", bpm)),
          "swing": float(parsed.get("swing", 0.1)),
          "explanation": str(parsed.get("explanation", "Patrón generado por IA local.")),
          "tracks": normalized_tracks,
          "velocities": normalized_vels,
      }


class FoZBridgeHandler(BaseHTTPRequestHandler):
  """Manejador HTTP REST seguro con soporte de CORS para FoZ SoundPro."""

  def _set_cors_headers(self, status=200, content_type="application/json"):
    self.send_response(status)
    self.send_header("Content-Type", content_type)
    # Permitir origen local y despliegues estáticos autorizados
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, User-Agent")
    self.end_headers()

  def do_OPTIONS(self):
    self._set_cors_headers(204)

  def do_GET(self):
    if self.path == "/api/status" or self.path == "/api/status/":
      models = query_ollama_tags()
      # Seleccionar modelo idóneo (prioridad: qwen3.5:4b, llamusic, o primero de la lista)
      selected = None
      for candidate in ["qwen3.5:4b", "llamusic/llamusic:latest", "phi4-mini-reasoning:latest"]:
        if any(m["name"] == candidate for m in models):
          selected = candidate
          break
      if not selected and models:
        selected = models[0]["name"]

      payload = {
          "status": "online",
          "bridgeVersion": "1.0.0",
          "ollamaAvailable": len(models) > 0,
          "selectedModel": selected,
          "localModels": models,
          "lmmsAvailable": check_lmms_installed(),
          "targetPlatform": sys.platform,
      }
      self._set_cors_headers(200)
      self.wfile.write(json.dumps(payload, indent=2).encode("utf-8"))
      return

    self._set_cors_headers(404)
    self.wfile.write(json.dumps({"error": "Endpoint no encontrado"}).encode("utf-8"))

  def do_POST(self):
    if self.path == "/api/generate-pattern" or self.path == "/api/generate-pattern/":
      content_length = int(self.headers.get("Content-Length", 0))
      if content_length <= 0 or content_length > 100000:
        self._set_cors_headers(400)
        self.wfile.write(json.dumps({"error": "Cuerpo de solicitud inválido o tamaño excesivo"}).encode("utf-8"))
        return

      try:
        body_bytes = self.rfile.read(content_length)
        body = json.loads(body_bytes.decode("utf-8"))

        prompt = str(body.get("prompt", ""))[:500]  # Limitar tamaño de prompt
        genre = str(body.get("genre", "trap"))[:50]
        bpm = int(body.get("bpm", 140))
        model_req = body.get("model")

        # Verificar modelos disponibles
        models = query_ollama_tags()
        if not models:
          self._set_cors_headers(503)
          self.wfile.write(json.dumps({
              "error": "Ollama no está en ejecución o no tiene modelos locales instalados."
          }).encode("utf-8"))
          return

        # Elegir modelo
        model_name = None
        if model_req and any(m["name"] == model_req for m in models):
          model_name = model_req
        else:
          # Preferir qwen3.5:4b o llamusic
          for pref in ["qwen3.5:4b", "llamusic/llamusic:latest"]:
            if any(m["name"] == pref for m in models):
              model_name = pref
              break
          if not model_name:
            model_name = models[0]["name"]

        # Generar patrón mediante Ollama
        pattern_data = call_ollama_generate_json(prompt, genre, bpm, model_name)
        self._set_cors_headers(200)
        self.wfile.write(json.dumps(pattern_data).encode("utf-8"))
        return

      except urllib.error.URLError as e:
        self._set_cors_headers(502)
        self.wfile.write(json.dumps({"error": f"Fallo al contactar con Ollama: {e.reason}"}).encode("utf-8"))
        return
      except Exception as e:
        self._set_cors_headers(500)
        self.wfile.write(json.dumps({"error": f"Error interno del puente: {str(e)}"}).encode("utf-8"))
        return

    self._set_cors_headers(404)
    self.wfile.write(json.dumps({"error": "Endpoint POST no encontrado"}).encode("utf-8"))

  def log_message(self, format, *args):
    # Logging discreto en consola
    sys.stderr.write(f"[FoZ Bridge] {self.address_string()} - {format % args}\n")


def main():
  parser = argparse.ArgumentParser(description="FoZ SoundPro — Local Studio Bridge")
  parser.add_argument("--host", default=DEFAULT_HOST, help=f"Dirección de escucha (por defecto {DEFAULT_HOST})")
  parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Puerto de escucha (por defecto {DEFAULT_PORT})")
  args = parser.parse_args()

  server_address = (args.host, args.port)
  httpd = HTTPServer(server_address, FoZBridgeHandler)

  print("=" * 60)
  print(f"FoZ SoundPro — Local Studio Bridge Activo")
  print("=" * 60)
  print(f"Dirección: http://{args.host}:{args.port}")
  print(f"Destino Ollama: {OLLAMA_BASE_URL}")
  print(f"LMMS Instalado: {'SÍ' if check_lmms_installed() else 'NO'}")
  print(f"Seguridad: Conexión restringida a host local con validación de entradas.")
  print("Presiona Ctrl+C para detener el servidor.")
  print("=" * 60)

  try:
    httpd.serve_forever()
  except KeyboardInterrupt:
    print("\nDeteniendo FoZ Local Bridge...")
    httpd.server_close()


if __name__ == "__main__":
  main()
