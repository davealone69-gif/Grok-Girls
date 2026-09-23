"""Mock phone-local Stable Diffusion server (A1111-compatible).

Implements just enough of the sd-server surface for the suite:

    GET  /                     -> liveness (the poll target)
    GET  /sdapi/v1/options     -> { sd_model_checkpoint }
    POST /sdapi/v1/txt2img     -> { images: [<base64 png>], info: "<json>" }

The returned image is a REAL PNG, encoded byte-for-byte here rather than
faked, so the client's Base64 -> pixels path is genuinely exercised: the
suite decodes it and asserts the dimensions. Requested width/height are
honoured, so a 256x384 request really does come back 256x384.

Run standalone:  python3 tests/mocks/mock_sd_server.py [port]
Import:          from mocks.mock_sd_server import serve_forever
"""

import json
import struct
import sys
import threading
import zlib
from base64 import b64encode
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 11534  # not 1234: the suite must never collide with a real server

# Fault injection, flipped by the suite to drive the error paths.
MODE = {"value": "ok"}


def _png(width: int, height: int, rgb=(220, 70, 90)) -> bytes:
    """Build a real, valid PNG. No external imaging library available, so
    the chunks are assembled by hand — this is a genuine decodable file."""
    r, g, b = rgb
    raw = b""
    for y in range(height):
        raw += b"\x00"  # filter type 0 for each scanline
        for x in range(width):
            # a soft gradient so the image is not a flat block
            raw += bytes(((r * x) // max(width - 1, 1), (g * y) // max(height - 1, 1), b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit truecolour
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def _send(self, code: int, payload: bytes, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self._cors()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/sdapi/v1/options"):
            self._send(200, json.dumps({"sd_model_checkpoint": "mock-sd-v1.safetensors"}).encode())
        elif self.path == "/" or self.path.startswith("/?"):
            # Liveness target. A real sd-server often serves a UI here.
            self._send(200, b"<html><body>sd-server</body></html>", "text/html")
        else:
            self._send(404, json.dumps({"detail": "not found"}).encode())

    def do_POST(self):
        if not self.path.startswith("/sdapi/v1/txt2img"):
            self._send(404, json.dumps({"detail": "not found"}).encode())
            return

        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        mode = MODE["value"]

        if mode == "http500":
            self._send(500, json.dumps({"detail": "CUDA out of memory"}).encode())
            return
        if mode == "http503":
            self._send(503, json.dumps({"detail": "model is loading"}).encode())
            return
        if mode == "empty":
            self._send(200, json.dumps({"images": [], "detail": "no image produced"}).encode())
            return
        if mode == "badb64":
            self._send(200, json.dumps({"images": ["!!!not base64!!!"]}).encode())
            return
        if mode == "notanimage":
            self._send(200, json.dumps({"images": [b64encode(b"plain text").decode()]}).encode())
            return
        # A truncated / non-JSON body. Before the fix this surfaced the raw
        # parser error ("Unexpected end of JSON input") straight to the user.
        if mode == "malformedjson":
            self._send(200, b'{"images": ["abc')
            return
        if mode == "emptybody":
            self._send(200, b"")
            return

        width = int(body.get("width") or 512)
        height = int(body.get("height") or 512)
        seed = body.get("seed")
        resolved_seed = seed if isinstance(seed, int) and seed >= 0 else 424242

        png = _png(width, height)
        payload = {
            "images": [b64encode(png).decode()],
            # A1111 really does nest a JSON *string* here.
            "info": json.dumps(
                {
                    "seed": resolved_seed,
                    "all_seeds": [resolved_seed],
                    "prompt": body.get("prompt", ""),
                    "negative_prompt": body.get("negative_prompt", ""),
                    "steps": body.get("steps"),
                    "cfg_scale": body.get("cfg_scale"),
                    "width": width,
                    "height": height,
                }
            ),
            "parameters": body,
        }
        self._send(200, json.dumps(payload).encode())


def serve_forever(port: int = PORT):
    """Start the mock in a daemon thread and return the server object."""
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    print(f"mock sd-server on http://127.0.0.1:{p}")
    ThreadingHTTPServer(("127.0.0.1", p), Handler).serve_forever()
