# CORS-enabled mock A1111 that returns a ~1.6MB PNG
import base64, json, os
from http.server import BaseHTTPRequestHandler, HTTPServer

# build a big PNG-ish base64 blob (valid data URL structure; decode size ~1.6MB)
# Use a real 1x1 PNG repeated is invalid; instead craft PNG header + random payload
png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + os.urandom(1200000)).decode()

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        body = b"[]"
        if self.path.startswith("/sdapi/v1/sd-models"):
            body = json.dumps([{"title": "mock-model"}]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors(); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(n)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors(); self.end_headers()
        self.wfile.write(json.dumps({"images": [png]}).encode())
    def log_message(self, *a): pass

HTTPServer(("0.0.0.0", 7860), H).serve_forever()
