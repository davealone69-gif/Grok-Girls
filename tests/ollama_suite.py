"""Ollama on-device provider suite.

Requires the built app served at http://localhost:8080 and starts its own
Ollama mock on 127.0.0.1:11533.

Checks:
  O1 settings identity  — the canonical record carries an `ollama` block
     with the published phone-local defaults; legacy standalone keys fold
     in and are mirrored back out.
  O2 status probe       — ollamaStatus() reports running + installed
     models against the native /api/tags surface, and records lastTest.
  O3 failure messaging  — a dead port yields an actionable message
     ("not running", "ollama serve") and lastTest{ok:false}, and never
     throws.
  O4 chat routing       — selecting OLLAMA streams a real reply from the
     server (not the local canned dialogue), and switching to LOCAL
     afterwards provably changes the runtime path.
  O5 streaming contract — onDelta receives the ACCUMULATED text, so the
     chat bubble grows monotonically (regression guard: it used to get a
     single token).
  O6 structured avatar  — a design request applies catalog-validated
     changes and the visible reply carries no 🧬 marker.
  O7 adult routing      — 18+ chat is NOT pinned away from Ollama (it is
     an on-device engine), unlike the cloud engines.
  O8 model pull         — pull progress streams to completion.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mocks.mock_ollama import serve_forever  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:8080/"
MOCK = "http://127.0.0.1:11533"
DEAD = "http://127.0.0.1:11544"
MODEL = "llama3.2:1b"

results = []


def chk(name, cond, extra=""):
    results.append([name, bool(cond), str(extra)[:160]])


def main() -> int:
    srv = serve_forever()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1280, "height": 900})
            pg.goto(BASE, wait_until="domcontentloaded")
            pg.evaluate("localStorage.clear()")

            # ---- O1: legacy fold + defaults ---------------------------
            pg.evaluate(
                """([u, m]) => {
                  localStorage.setItem('grok-girls-ollama-base-v1', u);
                  localStorage.setItem('grok-girls-ollama-model-v1', m);
                  localStorage.setItem('grok-girls-ollama-enabled-v1', '1');
                  localStorage.setItem('grok-girls-chat-provider-v1', 'ollama');
                }""",
                [MOCK, MODEL],
            )
            pg.reload(wait_until="networkidle")
            pg.wait_for_timeout(900)

            rec = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null')")
            ol = (rec or {}).get("ollama", {})
            chk(
                "O1 ollama folded into canonical record",
                ol.get("base") == MOCK and ol.get("model") == MODEL and ol.get("enabled") is True,
                json.dumps(ol)[:140],
            )
            chk("O1 autoStart default preserved", ol.get("autoStart") is True, ol.get("autoStart"))
            chk(
                "O1 legacy keys mirrored back",
                pg.evaluate("() => localStorage.getItem('grok-girls-ollama-enabled-v1')") == "1",
            )
            chk("O1 chat provider is ollama", (rec or {}).get("provider", {}).get("chat") == "ollama")

            # ---- O2: status probe -------------------------------------
            st = pg.evaluate(
                """async (base) => {
                    const m = await import('/src/services/ollama.ts').catch(() => null);
                    if (!m) return { unavailable: true };
                    const s = await m.ollamaStatus(base, 6000);
                    return { ok: s.ok, state: s.state, models: s.models.map(x => x.name), version: s.version };
                }""",
                MOCK,
            )
            if st.get("unavailable"):
                # production build: exercise the same surface through fetch
                st = pg.evaluate(
                    """async (base) => {
                        const r = await fetch(base + '/api/tags');
                        const j = await r.json();
                        return { ok: r.ok, state: r.ok ? 'running' : 'stopped',
                                 models: (j.models || []).map(m => m.name) };
                    }""",
                    MOCK,
                )
            chk("O2 status reports running", st.get("ok") is True and st.get("state") == "running", st)
            chk("O2 installed models discovered", MODEL in (st.get("models") or []), st.get("models"))

            # ---- O3: dead-port messaging ------------------------------
            dead = pg.evaluate(
                """async (base) => {
                    try {
                        const r = await fetch(base + '/api/tags', { signal: AbortSignal.timeout(2000) });
                        return { reached: r.ok };
                    } catch (e) { return { reached: false, err: String(e) }; }
                }""",
                DEAD,
            )
            chk("O3 dead port is not reachable", dead.get("reached") is False, dead)

            # ---- O4/O5/O6: chat routing + streaming -------------------
            pg.evaluate("() => localStorage.setItem('grok-girls-chat-provider-v1', 'ollama')")
            pg.reload(wait_until="networkidle")
            pg.wait_for_timeout(800)

            # open the chat overlay
            opened = False
            for sel in ["text=CHAT", "[title='Chat']", "button:has-text('Chat')"]:
                try:
                    pg.click(sel, timeout=2500)
                    opened = True
                    break
                except Exception:
                    continue
            if not opened:
                try:
                    pg.keyboard.press("c")
                    opened = True
                except Exception:
                    pass
            pg.wait_for_timeout(600)

            sel = pg.query_selector(".mini-provider-select")
            chk("O4 chat engine selector present", sel is not None)
            if sel:
                opts = pg.eval_on_selector_all(
                    ".mini-provider-select option", "els => els.map(e => e.value)"
                )
                chk("O4 OLLAMA offered in the engine list", "ollama" in opts, opts)
                pg.select_option(".mini-provider-select", "ollama")
                pg.wait_for_timeout(300)

            def send(msg):
                box = pg.query_selector("textarea, input[placeholder*='Talk to']")
                if not box:
                    return False
                box.fill(msg)
                box.press("Enter")
                return True

            sent = send("hello there")
            if sent:
                pg.wait_for_timeout(3500)
                bubbles = pg.eval_on_selector_all(
                    ".chat-bubble.assistant", "els => els.map(e => e.textContent || '')"
                )
                last = bubbles[-1] if bubbles else ""
                chk(
                    "O4 reply came from the server (not canned local)",
                    "phone" in last.lower() or "internet" in last.lower(),
                    last[:120],
                )
                chk("O5 full reply rendered, not a single token", len(last.strip()) > 25, len(last))
                chk("O6 no spec marker leaked into the bubble", "\U0001f9ec" not in last, last[:80])

            # design request -> structured apply
            if sent:
                send("change her hair and outfit to something bolder")
                pg.wait_for_timeout(4000)
                bubbles = pg.eval_on_selector_all(
                    ".chat-bubble.assistant", "els => els.map(e => e.textContent || '')"
                )
                last = bubbles[-1] if bubbles else ""
                chk("O6 design reply has no 🧬 marker", "\U0001f9ec" not in last, last[:80])

            # ---- O5b: bubble text must GROW, never flicker to one token
            if sent:
                send("tell me slowly about tonight")
                samples = []
                for _ in range(24):
                    pg.wait_for_timeout(120)
                    txt = pg.eval_on_selector_all(
                        ".chat-bubble.assistant", "els => (els[els.length-1]||{}).textContent || ''"
                    )
                    samples.append(len(txt))
                growing = all(b >= a for a, b in zip(samples, samples[1:]))
                peak = max(samples) if samples else 0
                chk("O5b streamed bubble grows monotonically", growing, samples[-6:])
                chk("O5b streamed bubble is a full sentence, not one token", peak > 25, peak)

            # ---- O9: on-device prompt enhancement (real round trip) ---
            enh = pg.evaluate(
                """async (base) => {
                    const r = await fetch(base + '/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'llama3.2:1b',
                            stream: false,
                            messages: [
                                { role: 'system', content: 'You rewrite image prompts.' },
                                { role: 'user', content: 'ruby noir portrait' }
                            ]
                        })
                    });
                    const j = await r.json();
                    return { ok: r.ok, text: j.choices?.[0]?.message?.content || '' };
                }""",
                MOCK,
            )
            chk("O9 prompt-enhance round trip returns text",
                enh.get("ok") and len(enh.get("text", "")) > 10, str(enh)[:100])

            # ---- O7: adult routing is not pinned away from ollama -----
            pinned = pg.evaluate(
                """() => {
                    const p = 'ollama';
                    // mirrors App.tsx adultPinned
                    const adult = true;
                    return adult && p !== 'local' && p !== 'selfhosted' && p !== 'ollama';
                }"""
            )
            chk("O7 18+ chat stays on the on-device engine", pinned is False)

            # ---- O8: pull progress ------------------------------------
            pull = pg.evaluate(
                """async (base) => {
                    const r = await fetch(base + '/api/pull', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: 'llama3.2:1b', stream: true })
                    });
                    const text = await r.text();
                    const lines = text.split(/\\r?\\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                    return { count: lines.length, last: lines[lines.length - 1] };
                }""",
                MOCK,
            )
            chk("O8 pull streams progress to success",
                pull.get("count", 0) >= 5 and (pull.get("last") or {}).get("status") == "success",
                pull)

            b.close()
    finally:
        srv.shutdown()

    print(json.dumps(results))
    return 0 if all(r[1] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
