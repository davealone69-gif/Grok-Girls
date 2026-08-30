import base64, json, os, time
from http.server import BaseHTTPRequestHandler, HTTPServer
png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + os.urandom(30000)).decode()
class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        body = json.dumps([{"title": "slow-model"}]).encode() if "sd-models" in self.path else b"[]"
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors(); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(n)
        time.sleep(5)  # slow render
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors(); self.end_headers()
        self.wfile.write(json.dumps({"images": [png]}).encode())
    def log_message(self, *a): pass
HTTPServer(("0.0.0.0", 7861), H).serve_forever()
