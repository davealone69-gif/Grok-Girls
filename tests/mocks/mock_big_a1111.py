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


def serve_forever(port=7860):
    """Start the mock in a daemon thread and return the server.

    The audit suite needs this running on 7860; without it the quota /
    IndexedDB checks fail with "Failed to fetch" because nothing answers.
    """
    import threading
    from http.server import ThreadingHTTPServer
    srv = ThreadingHTTPServer(("0.0.0.0", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 7860), H).serve_forever()
