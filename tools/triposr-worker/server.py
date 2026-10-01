#!/usr/bin/env python3
"""Grok-Girls stdlib-only TripoSR HTTP worker."""
from __future__ import annotations
import base64, json, os, shutil, subprocess, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = os.environ.get("TRIPOSR_HOST", "127.0.0.1")
PORT = int(os.environ.get("TRIPOSR_PORT", "8081"))
TRIPOSR_HOME = Path(os.environ.get("TRIPOSR_HOME", str(Path.home() / "TripoSR"))).expanduser()
PYTHON = os.environ.get("TRIPOSR_PYTHON", "python")
RUN_PY = Path(os.environ.get("TRIPOSR_RUN", str(TRIPOSR_HOME / "run.py"))).expanduser()
MAX_INPUT_BYTES = int(os.environ.get("TRIPOSR_MAX_INPUT_BYTES", str(12 * 1024 * 1024)))
MAX_JOB_SECONDS = int(os.environ.get("TRIPOSR_MAX_JOB_SECONDS", "1800"))
MIN_AVAILABLE_MB = int(os.environ.get("TRIPOSR_MIN_AVAILABLE_MB", "1800"))
JOB_LOCK = threading.Lock()

def available_memory_mb():
    try:
        values = {}
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                key, value = line.split(":", 1)
                values[key] = int(value.strip().split()[0])
        return (values.get("MemAvailable", 0) + values.get("SwapFree", 0)) // 1024
    except Exception:
        return 0

def json_error(handler, code, message):
    body = json.dumps({"ok": False, "error": message}).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    server_version = "GrokGirls-TripoSR/1.0"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def do_GET(self):
        if self.path != "/health":
            json_error(self, 404, "Not found")
            return
        ready = RUN_PY.is_file() and TRIPOSR_HOME.is_dir()
        payload = {
            "ok": ready,
            "engine": "triposr",
            "worker": "grokgirls-3d",
            "busy": JOB_LOCK.locked(),
            "available_memory_mb": available_memory_mb(),
            "run_py": str(RUN_PY),
            "message": "TripoSR worker ready" if ready else "TripoSR installation not found",
        }
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200 if ready else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/generate":
            json_error(self, 404, "Not found")
            return
        if not JOB_LOCK.acquire(blocking=False):
            json_error(self, 409, "3D worker is busy. Only one heavy 3D job is allowed at a time.")
            return
        work = None
        try:
            if not RUN_PY.is_file():
                json_error(self, 503, "TripoSR run.py was not found at " + str(RUN_PY))
                return
            free_mb = available_memory_mb()
            if free_mb and free_mb < MIN_AVAILABLE_MB:
                json_error(self, 503, "Insufficient available memory for 3D generation: " + str(free_mb) + " MB")
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_INPUT_BYTES * 2:
                json_error(self, 413, "Request body is too large.")
                return
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            encoded = str(request.get("image", "")).strip()
            if encoded.startswith("data:") and "," in encoded:
                encoded = encoded.split(",", 1)[1]
            image_bytes = base64.b64decode(encoded, validate=False)
            if not image_bytes or len(image_bytes) > MAX_INPUT_BYTES:
                json_error(self, 400, "Invalid or oversized image.")
                return
            texture = bool(request.get("texture", False))
            remove_background = bool(request.get("remove_background", True))
            resolution = max(96, min(int(request.get("mc_resolution", 192)), 256))
            work = Path(tempfile.mkdtemp(prefix="grokgirls-3d-"))
            image_path = work / "input.png"
            output_dir = work / "output"
            # TripoSR run.py exports to <output-dir>/0/mesh.glb but does not create that directory itself.
            # Create it here so the real on-device exporter cannot fail at the final write step.
            (output_dir / "0").mkdir(parents=True, exist_ok=True)
            image_path.write_bytes(image_bytes)
            cmd = [
                PYTHON, str(RUN_PY), str(image_path),
                "--device", "cpu", "--output-dir", str(output_dir),
                "--model-save-format", "glb", "--mc-resolution", str(resolution),
            ]
            if not remove_background:
                cmd.append("--no-remove-bg")
            if texture:
                cmd.extend(["--bake-texture", "--texture-resolution", "1024"])
            started = time.time()
            proc = subprocess.run(
                cmd, cwd=str(TRIPOSR_HOME), stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, timeout=MAX_JOB_SECONDS,
                check=False, text=True
            )
            elapsed = time.time() - started
            if proc.returncode != 0:
                json_error(self, 500, "TripoSR failed after %.1fs: %s" % (elapsed, proc.stdout[-4000:]))
                return
            glbs = list(output_dir.glob("*/mesh.glb"))
            if not glbs:
                json_error(self, 500, "TripoSR completed but did not produce mesh.glb.")
                return
            data = glbs[0].read_bytes()
            if data[:4] != b"glTF":
                json_error(self, 500, "TripoSR returned an invalid GLB.")
                return
            self.send_response(200)
            self.send_header("Content-Type", "model/gltf-binary")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-GrokGirls-Engine", "triposr")
            self.send_header("X-GrokGirls-Seconds", "%.1f" % elapsed)
            self.end_headers()
            self.wfile.write(data)
        except subprocess.TimeoutExpired:
            json_error(self, 504, "TripoSR job exceeded %s seconds." % MAX_JOB_SECONDS)
        except Exception as exc:
            json_error(self, 500, "3D worker error: " + str(exc))
        finally:
            if work:
                shutil.rmtree(work, ignore_errors=True)
            JOB_LOCK.release()

def main():
    print("Grok-Girls TripoSR worker listening on http://%s:%s" % (HOST, PORT), flush=True)
    print("TRIPOSR_HOME=" + str(TRIPOSR_HOME), flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

if __name__ == "__main__":
    main()
