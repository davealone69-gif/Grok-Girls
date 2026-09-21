"""Faithful Ollama mock for the browser suites.

Serves on 127.0.0.1:PORT (default 11533) and mirrors the real server's
two surfaces, because the app uses both:

  native API (used by the Kotlin bridge + status probes)
    GET  /api/version          -> {"version": "0.5.7"}
    GET  /api/tags             -> {"models":[{name,size,details{...}}, ...]}
    POST /api/chat             -> NDJSON stream of {"message":{"content":...}}
    POST /api/pull             -> NDJSON stream of progress objects

  OpenAI-compatible (used by the browser fetch transport)
    GET  /v1/models            -> {"object":"list","data":[{"id":...}]}
    POST /v1/chat/completions  -> SSE stream, or single JSON when stream=false

Behaviour helpers driven by the last user message:
  - an avatar-design request appends the 🧬 structured single-line JSON
    block, exercising the catalog-validated apply path;
  - a message containing "fail" returns HTTP 500;
  - a message containing "slowly" delays between tokens.

CORS is permissive (mirrors OLLAMA_ORIGINS=*) so the fetch transport works
from the page under test.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 11533
VERSION = "0.5.7"

MODELS = [
    {
        "name": "llama3.2:1b",
        "model": "llama3.2:1b",
        "size": 1321098329,
        "modified_at": "2026-09-01T10:00:00Z",
        "details": {"parameter_size": "1.2B", "quantization_level": "Q8_0"},
    },
    {
        "name": "qwen2.5:1.5b",
        "model": "qwen2.5:1.5b",
        "size": 986443776,
        "modified_at": "2026-09-05T10:00:00Z",
        "details": {"parameter_size": "1.5B", "quantization_level": "Q4_K_M"},
    },
]

SPEC_TAIL = (
    '\U0001f9ec{"hairColor":"vibrant ruby red","hair":"long glamorous waves",'
    '"makeup":"dark smokey eyeshadow with winged eyeliner",'
    '"scene":"vintage tufted dark leather armchair, moody boudoir with crimson edge lighting",'
    '"lighting":"noir","skinTone":"olive"}'
)


def _last_user(messages):
    for m in reversed(messages):
        if m.get("role") == "user":
            return (m.get("content") or "").lower()
    return ""


def _looks_like_design(text):
    return (
        "create a girl" in text
        or "make her" in text
        or "design her" in text
        or "change her" in text
        or ("hair" in text and "outfit" in text)
    )


def reply_for(messages):
    """Returns (text, should_fail, slow)."""
    text = _last_user(messages)
    if "fail" in text:
        return None, True, False
    slow = "slowly" in text
    base = "Hey you. Running entirely on your phone, no internet needed."
    if _looks_like_design(text):
        return base + " I restyled myself just how you asked.\n" + SPEC_TAIL, False, slow
    return base, False, slow


def tokenize(text):
    """Split into word-ish tokens the way a real model streams them."""
    out, cur = [], ""
    for ch in text:
        cur += ch
        if ch in " \n":
            out.append(cur)
            cur = ""
    if cur:
        out.append(cur)
    return out


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # ---------------------------------------------------------- helpers
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _stream_head(self, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self._cors()
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()

    def _chunk(self, data: bytes):
        self.wfile.write(b"%x\r\n" % len(data) + data + b"\r\n")
        self.wfile.flush()

    def _end_chunks(self):
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # -------------------------------------------------------------- GET
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/version":
            return self._json({"version": VERSION})
        if path == "/api/tags":
            return self._json({"models": MODELS})
        if path == "/v1/models":
            return self._json(
                {"object": "list", "data": [{"id": m["name"], "object": "model"} for m in MODELS]}
            )
        return self._json({"error": "not found"}, 404)

    # ------------------------------------------------------------- POST
    def do_POST(self):
        path = self.path.split("?")[0]
        body = self._body()

        if path == "/api/chat":
            return self._native_chat(body)
        if path == "/v1/chat/completions":
            return self._openai_chat(body)
        if path == "/api/pull":
            return self._pull(body)
        return self._json({"error": "not found"}, 404)

    def _native_chat(self, body):
        messages = body.get("messages") or []
        text, should_fail, slow = reply_for(messages)
        if should_fail:
            return self._json({"error": "simulated server failure"}, 500)
        if not body.get("stream", True):
            return self._json(
                {"model": body.get("model"), "message": {"role": "assistant", "content": text}, "done": True}
            )
        self._stream_head("application/x-ndjson")
        for tok in tokenize(text):
            if slow:
                time.sleep(0.02)
            self._chunk(
                (json.dumps({"model": body.get("model"), "message": {"role": "assistant", "content": tok}, "done": False}) + "\n").encode()
            )
        self._chunk((json.dumps({"model": body.get("model"), "message": {"role": "assistant", "content": ""}, "done": True}) + "\n").encode())
        self._end_chunks()

    def _openai_chat(self, body):
        messages = body.get("messages") or []
        text, should_fail, slow = reply_for(messages)
        if should_fail:
            return self._json({"error": {"message": "simulated server failure"}}, 500)
        if not body.get("stream", False):
            return self._json(
                {
                    "id": "chatcmpl-mock",
                    "object": "chat.completion",
                    "model": body.get("model"),
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                }
            )
        self._stream_head("text/event-stream")
        for tok in tokenize(text):
            if slow:
                time.sleep(0.02)
            evt = {
                "id": "chatcmpl-mock",
                "object": "chat.completion.chunk",
                "model": body.get("model"),
                "choices": [{"index": 0, "delta": {"content": tok}}],
            }
            self._chunk(("data: " + json.dumps(evt) + "\n\n").encode())
        self._chunk(b"data: [DONE]\n\n")
        self._end_chunks()

    def _pull(self, body):
        model = body.get("model") or "llama3.2:1b"
        total = 1321098329
        self._stream_head("application/x-ndjson")
        self._chunk((json.dumps({"status": "pulling manifest"}) + "\n").encode())
        for pct in (25, 50, 75, 100):
            self._chunk(
                (json.dumps({"status": f"pulling {model}", "completed": total * pct // 100, "total": total}) + "\n").encode()
            )
        self._chunk((json.dumps({"status": "success"}) + "\n").encode())
        self._end_chunks()


def serve_forever(port=PORT):
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


if __name__ == "__main__":
    s = serve_forever()
    print(f"mock ollama on http://127.0.0.1:{PORT}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        s.shutdown()
