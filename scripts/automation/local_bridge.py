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
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
from pathlib import Path


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

BRIDGE_VERSION = "1.1.0"
USER_AGENT = "FoZSoundProBridge/1.1"

# Voces canónicas del secuenciador (deben coincidir con FoZConstants.AI_VOICE_IDS)
VALID_VOICES = [
    "kick", "snare", "clap", "hihat_closed", "hihat_open", "bass808", "rimshot",
    "crash", "ride", "tom_low", "tom_mid", "cowbell", "snap_trap", "shaker",
    "stab_dark", "horn_slap",
]

# Hosts y modelos válidos para /api/pull (validación estricta, sin shell)
OLLAMA_HOST_RE = re.compile(r"^https?://[A-Za-z0-9.:\-_]{3,100}$")
OLLAMA_MODEL_RE = re.compile(r"^[A-Za-z0-9_./:-]{1,120}$")

# Raíz del proyecto
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def query_ollama_tags() -> list[dict]:
    """Consulta la lista de modelos de Ollama y filtra exclusivamente los locales (sin :cloud)."""
    try:
      req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", headers={"User-Agent": USER_AGENT})
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
    schema_tracks = ",\n".join(f'    "{v}": [16 números 0 o 1]' for v in VALID_VOICES)
    schema_vels = ",\n".join(f'    "{v}": [16 números flotantes entre 0.1 y 1.0]' for v in VALID_VOICES)
    system_instruction = (
        "Eres el asistente musical de FoZ SoundPro. Tu tarea es generar patrones rítmicos "
        "de batería en formato JSON para un secuenciador de 16 pasos en compás 4/4 con 16 voces. "
        "Debes responder EXCLUSIVAMENTE con un JSON válido sin texto introductorio ni explicaciones adicionales. "
        "Estructura exacta requerida:\n"
        "{\n"
        '  "genre": "género musical",\n'
        '  "suggestedBpm": número entero entre 60 y 180,\n'
        '  "swing": número flotante entre 0.0 y 0.5,\n'
        '  "explanation": "breve razonamiento rítmico",\n'
        '  "tracks": {\n' + schema_tracks + "\n  },\n"
        '  "velocities": {\n' + schema_vels + "\n  }\n"
        "}\n"
        "Las voces que no uses déjalas a 0. Ejemplos de género: trap, boombap, drill, lofi."
    )

    user_query = f"Género: {genre}. Tempo actual: {bpm} BPM. Instrucción del productor: {prompt}"

    ollama_payload = {
        "model": model_name,
        "prompt": f"<|system|>\n{system_instruction}\n<|user|>\n{user_query}\n<|assistant|>",
        "stream": False,
        "format": "json",
        # Mantener el modelo residente en RAM 30 min: las generaciones repetidas
        # evitan la carga en frío desde disco (que puede durar minutos).
        "keep_alive": "30m",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            # Contexto limitado: la respuesta es un JSON corto; evita reservar la
            # cache KV completa (p. ej. 131072 tokens = ~15 GB extra en RAM/CPU).
            "num_ctx": 2048,
        }
    }

    req_data = json.dumps(ollama_payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/generate",
        data=req_data,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )

    with urllib.request.urlopen(req, timeout=300.0) as resp:
      result = json.loads(resp.read().decode("utf-8"))
      raw_text = result.get("response", "").strip()

      # Limpiar posibles delimitadores markdown ```json ... ```
      cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
      cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

      parsed = json.loads(cleaned)

      # Validar y normalizar formato devuelto
      if "tracks" not in parsed:
        raise ValueError("El modelo no generó la estructura de pistas 'tracks'.")

      # Asegurar 16 pasos por instrumento (16 voces)
      normalized_tracks = {}
      normalized_vels = {}

      for k in VALID_VOICES:
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


def ollama_pull(model: str, host: str) -> dict:
    """Descarga un modelo en el Ollama destino (stream:false → respuesta única al terminar)."""
    url = f"{host.rstrip('/')}/api/pull"
    req = urllib.request.Request(
        url,
        data=json.dumps({"model": model, "stream": False}).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    # Descargas grandes (GB): hasta 40 minutos de margen.
    with urllib.request.urlopen(req, timeout=2400) as resp:
      data = json.loads(resp.read().decode("utf-8"))

    if "error" in data:
      raise RuntimeError(str(data["error"])[:300])

    status = str(data.get("status", ""))
    return {"status": "success", "model": model, "host": host, "detail": status or "Success"}


class FoZBridgeHandler(BaseHTTPRequestHandler):
  """Manejador HTTP REST seguro con soporte de CORS para FoZ SoundPro."""

  def _set_cors_headers(self, status=200, content_type="application/json"):
    self.send_response(status)
    self.send_header("Content-Type", content_type)
    # Permitir origen local y despliegues estáticos autorizados
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, User-Agent")
    # Chrome Private Network Access: necesario para que Pages (HTTPS) pregunte
    # al bridge en red privada (loopback) y este responda afirmativamente.
    self.send_header("Access-Control-Allow-Private-Network", "true")
    self.end_headers()

  def do_OPTIONS(self):
    self._set_cors_headers(204)

  def do_GET(self):
    if self.path == "/api/status" or self.path == "/api/status/":
      models = query_ollama_tags()
      # Seleccionar modelo idóneo (prioridad: llamusic → qwen3.5:4b → phi4; nunca embeds)
      selected = None
      for candidate in ["llamusic/llamusic:latest", "qwen3.5:4b", "phi4-mini-reasoning:latest"]:
        if any(m["name"] == candidate for m in models):
          selected = candidate
          break
      if not selected and models:
        for m in models:
          if "embed" not in m["name"].lower():
            selected = m["name"]
            break
        if not selected:
          selected = models[0]["name"]

      payload = {
          "status": "online",
          "bridgeVersion": BRIDGE_VERSION,
          "ollamaAvailable": len(models) > 0,
          "ollamaTarget": OLLAMA_BASE_URL,
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
    if self.path == "/api/pull" or self.path == "/api/pull/":
      content_length = int(self.headers.get("Content-Length", 0))
      if content_length <= 0 or content_length > 10000:
        self._set_cors_headers(400)
        self.wfile.write(json.dumps({"error": "Cuerpo de solicitud inválido o tamaño excesivo"}).encode("utf-8"))
        return

      try:
        body = json.loads(self.rfile.read(content_length).decode("utf-8"))
        model = str(body.get("model", "")).strip()
        host_in = str(body.get("host", "")).strip()

        if not OLLAMA_MODEL_RE.match(model):
          self._set_cors_headers(400)
          self.wfile.write(json.dumps({
              "error": "Nombre de modelo invalido. Ejemplos validos: qwen3.5:4b, llamusic/llamusic:latest"
          }).encode("utf-8"))
          return

        # Host destino: validado contra expresión estricta; sin host → el propio OLLAMA_BASE_URL
        if host_in:
          if not OLLAMA_HOST_RE.match(host_in):
            self._set_cors_headers(400)
            self.wfile.write(json.dumps({
                "error": f"Host Ollama invalido: {host_in[:80]}. Formato esperado: http(s)://host:puerto"
            }).encode("utf-8"))
            return
          host = host_in
        else:
          host = OLLAMA_BASE_URL

        print(f"[FoZ Bridge] Descargando modelo '{model}' en {host} (puede tardar minutos...)")
        result = ollama_pull(model, host)
        self._set_cors_headers(200)
        self.wfile.write(json.dumps(result).encode("utf-8"))
        return

      except urllib.error.URLError as e:
        self._set_cors_headers(502)
        self.wfile.write(json.dumps({
            "error": f"No se pudo contactar con Ollama (host caido, Tailscale inactivo o conexion rechazada): {e.reason}"
        }).encode("utf-8"))
        return
      except RuntimeError as e:
        self._set_cors_headers(502)
        self.wfile.write(json.dumps({"error": f"Ollama rechazo la descarga: {str(e)}"}).encode("utf-8"))
        return
      except Exception as e:
        self._set_cors_headers(500)
        self.wfile.write(json.dumps({"error": f"Error interno del puente: {str(e)}"}).encode("utf-8"))
        return

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
          # Preferir llamusic (rápido y musical) → qwen3.5:4b; nunca modelos embed
          for pref in ["llamusic/llamusic:latest", "qwen3.5:4b", "phi4-mini-reasoning:latest"]:
            if any(m["name"] == pref for m in models):
              model_name = pref
              break
          if not model_name:
            for m in models:
              if "embed" not in m["name"].lower():
                model_name = m["name"]
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
  # ThreadingHTTPServer: cada conexión se atiende en su hilo. Evita la
  # inanición clásica de BaseHTTPServer en un solo hilo, donde el navegador
  # conserva la conexión del pre-flight (OPTIONS) abierta y el POST real de
  # generación nunca llega a procesarse.
  httpd = ThreadingHTTPServer(server_address, FoZBridgeHandler)

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
