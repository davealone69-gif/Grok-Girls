"""OpenAI-compatible Hermes mock for the browser suites.

Serves on 127.0.0.1:PORT (default 7870):
  GET  /v1/models            -> {"object":"list","data":[{"id":"local-hermes-8b"},...]}
  POST /v1/chat/completions  -> SSE stream (stream:true) or plain JSON.

Behaviour helpers (driven by the last user message):
  - if the user message asks for an avatar design (contains "create a girl",
    "make her", "design", "hair" + "outfit", etc.) the reply includes the
    🧬 structured single-line JSON block so suites can exercise the
    catalog-validated apply path.
  - if asked to "fail", the server replies HTTP 500.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODELS = ["local-hermes-8b", "hermes-3-llama-3.1-8b"]
PORT = 7870

BASE_TAIL = '🧬{"hairColor":"vibrant ruby red","hair":"long glamorous waves","makeup":"dark smokey eyeshadow with winged eyeliner","outfit":"red and black lace corset lingerie with matching satin panties, sheer fishnet stockings, and ruby velvet choker","scene":"vintage tufted dark leather armchair, moody boudoir with crimson edge lighting","lighting":"noir","skinTone":"olive"}'


def _looks_like_design(messages):
    text = " ".join(m.get("content", "") for m in messages[-2:]).lower()
    design = ("create a girl" in text or "make her" in text or "design her" in text
              or ("change her" in text) or ("hair" in text and "outfit" in text))
    return design


def _reply_for(messages, stream):
    text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    if "fail" in text.lower():
        return None  # caller returns 500
    base = "Absolutely! I've styled her to match your vision."
    if _looks_like_design(messages):
        base += "\nDone \u2014 check her out in the studio."
        reply = base + "\n" + BASE_TAIL
    else:
        reply = base + " (Hermes mock reply)"
    return reply


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silence
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            return self._json({"object": "list", "data": [{"id": m} for m in MODELS]})
        return self._json({"error": "not found"}, 404)

    def do_POST(self):
        if not self.path.rstrip("/").endswith("/chat/completions"):
            return self._json({"error": "not found"}, 404)
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._json({"error": "bad json"}, 400)
        messages = payload.get("messages", [])
        stream = bool(payload.get("stream"))
        reply = _reply_for(messages, stream)
        if reply is None:
            return self._json({"error": {"message": "mock failure"}}, 500)
        if not stream:
            return self._json({"id": "cmpl-1", "object": "chat.completion",
                               "choices": [{"index": 0, "message": {"role": "assistant", "content": reply},
                                            "finish_reason": "stop"}]})
        # SSE stream: word by word so token callbacks actually fire
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        words = reply.split(" ")
        for i, w in enumerate(words):
            chunk = {"id": "c1", "object": "chat.completion.chunk",
                     "choices": [{"index": 0, "delta": {"content": w + (" " if i < len(words) - 1 else "")},
                                  "finish_reason": None}]}
            data = "data: " + json.dumps(chunk) + "\n\n"
            try:
                self.wfile.write(data.encode())
                self.wfile.flush()
            except BrokenPipeError:
                return
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()


def serve_forever(port=PORT):
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


if __name__ == "__main__":
    srv = serve_forever()
    print(f"mock hermes on 127.0.0.1:{PORT}")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        srv.shutdown()
