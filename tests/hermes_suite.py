"""Hermes first-class provider suite.

Requires the app under test at http://localhost:8080 (dist served) and
starts its own OpenAI-compatible Hermes mock on 127.0.0.1:7870.

Checks:
  P1 provider identity  — legacy hermes keys fold into the canonical
     record; chat engine selector shows HERMES and runtime is enabled.
  P2 models discovery   — /v1/models via the AI Settings test button
     records lastTest{ok:true, models:[...]} and shows "Connected".
  P3 failure messaging  — unreachable endpoint yields a useful message
     and records lastTest{ok:false}.
  P4 chat routing       — Hermes chat streams a real reply (no local
     fallback text); selecting LOCAL afterwards switches the runtime
     path (local replies), proving the switch is not settings-only.
  P5 structured avatar  — a design request applies catalog-validated
     changes: canonical definition (hair=Long, skin=Tone …) updates and
     the reply text has no 🧬 marker.
"""
import json
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mocks.mock_hermes import serve_forever  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:8080/"
MOCK = "http://127.0.0.1:7870/v1"
MODEL = "hermes-3-llama-3.1-8b"

results = []
def chk(name, cond, extra=""):
    results.append([name, bool(cond), str(extra)[:140]])

def main() -> int:
    srv = serve_forever()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1280, "height": 900})

            # ---- seed legacy keys, then reload so the fold runs ----
            pg.goto(BASE, wait_until="domcontentloaded")
            pg.evaluate("localStorage.clear()")
            pg.evaluate("""([u, m]) => {
              localStorage.setItem('grok-girls-hermes-url-v1', u);
              localStorage.setItem('grok-girls-hermes-model-v1', m);
              localStorage.setItem('grok-girls-hermes-enabled-v1', '1');
              localStorage.setItem('grok-girls-chat-provider-v1', 'hermes');
            }""", [MOCK, MODEL])
            pg.reload(wait_until="networkidle")
            pg.wait_for_timeout(900)

            # P1 identity
            rec = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null')")
            hm = (rec or {}).get("hermes", {})
            chk("P1 hermes folded into canonical record",
                hm.get("url") == MOCK and hm.get("model") == MODEL and hm.get("enabled") is True,
                {k: hm.get(k) for k in ("url", "model", "enabled")})
            chk("P1 chat provider pref is hermes", (rec or {}).get("provider", {}).get("chat") == "hermes")

            # open chat overlay
            pg.locator(".rail-btn[title='Interactive Dialogue']").first.click()
            pg.wait_for_timeout(600)
            sel = pg.locator(".mini-provider-select").first
            chk("P1 chat selector shows HERMES", sel.input_value() == "hermes", sel.input_value())
            chip = pg.locator("text=HERMES ·")
            chk("P1 hermes status chip visible", chip.count() >= 1)

            # P2 models discovery via AI Settings
            pg.locator(".rail-btn[title='AI Provider Settings']").first.click()
            pg.wait_for_timeout(900)
            url_in = pg.locator("#grok-hermes-url")
            if url_in.count() == 0:
                chk("P2 hermes settings section mounted", False, "no #grok-hermes-url")
            else:
                chk("P2 hermes settings section mounted", True)
                chk("P2 url prefilled", url_in.input_value() == MOCK, url_in.input_value())
                pg.locator("#grok-hermes-test").first.click()
                pg.wait_for_timeout(1500)
                st = pg.locator("#grok-hermes-status").first.inner_text()
                chk("P2 test shows connected + models", "Connected" in st and "2 model(s)" in st, st)
                rec2 = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null').hermes.lastTest")
                chk("P2 lastTest ok + models", bool(rec2 and rec2.get("ok") and rec2.get("models") == ["local-hermes-8b", "hermes-3-llama-3.1-8b"]),
                    rec2)

                # P3 failure messaging (port 1 -> connection refused)
                pg.locator("#grok-hermes-url").fill("http://127.0.0.1:1/v1")
                pg.evaluate("() => { const el = document.querySelector('#grok-hermes-url'); el.dispatchEvent(new Event('change', { bubbles: true })); }")
                pg.wait_for_timeout(200)
                pg.locator("#grok-hermes-test").first.click()
                pg.wait_for_timeout(2500)
                st3 = pg.locator("#grok-hermes-status").first.inner_text()
                chk("P3 failure message is useful", ("✕" in st3 and "Cannot reach" in st3), st3)
                rec3 = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null').hermes.lastTest")
                chk("P3 lastTest ok:false recorded", bool(rec3 and rec3.get("ok") is False and rec3.get("error")), rec3)

                # restore good url for chat tests
                pg.locator("#grok-hermes-url").fill(MOCK)
                pg.evaluate("() => { const el = document.querySelector('#grok-hermes-url'); el.dispatchEvent(new Event('change', { bubbles: true })); }")
                pg.wait_for_timeout(200)
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(400)

            # back to chat
            pg.locator(".rail-btn[title='Interactive Dialogue']").first.click()
            pg.wait_for_timeout(600)

            def send(text: str):
                pg.locator(".companion-input").fill(text)
                pg.locator(".btn-send-chat").click()

            # P4a hermes streams real reply
            send("hello there")
            pg.wait_for_timeout(300)
            pg.locator(".chat-bubble.assistant").last.wait_for(state="visible", timeout=5000)
            pg.wait_for_function(
                "() => { const bs = [...document.querySelectorAll('.chat-bubble.assistant')]; return bs.length && bs[bs.length-1].textContent.includes('Hermes mock reply'); }",
                timeout=12000
            )
            last = pg.locator(".chat-bubble.assistant").last.inner_text()
            chk("P4 hermes reply streamed (no local fallback)",
                "Hermes mock reply" in last and "Local companion" not in last and "Provider note" not in last, last[:80])

            # P5 structured design request
            send("create a girl with vibrant ruby red hair, olive skin and a lace corset outfit")
            pg.wait_for_function(
                "() => { const bs = [...document.querySelectorAll('.chat-bubble.assistant')]; return bs.length >= 2 && bs[bs.length-1].textContent.includes('styled'); }",
                timeout=15000
            )
            pg.wait_for_timeout(900)  # let spec apply + canonical sync settle
            defs = pg.evaluate("""() => {
              const vm = window.__grokGirlsVm;
              return vm ? { hair: vm.get().hair, skin: vm.get().skin } : null;
            }""")
            chk("P5 canonical hair updated (Long)", bool(defs) and defs["hair"] == "Long", defs)
            chk("P5 canonical skin updated (Tone 04)", bool(defs) and defs["skin"] == "Tone 04", defs)
            last5 = pg.locator(".chat-bubble.assistant").last.inner_text()
            chk("P5 structured marker stripped from display", "🧬" not in last5, last5[-60:])

            # P4b switching the engine changes the runtime path (local)
            pg.locator(".mini-provider-select").first.select_option("local")
            pg.wait_for_timeout(200)
            send("hello")
            pg.wait_for_function(
                "() => { const bs = [...document.querySelectorAll('.chat-bubble.assistant')]; return bs.length >= 3 && bs[bs.length-1].textContent.includes('Hey there!'); }",
                timeout=8000
            )
            lastb = pg.locator(".chat-bubble.assistant").last.inner_text()
            chk("P4 switching selector to LOCAL routes to local engine", "Hey there!" in lastb, lastb[:60])
            chk("P4 hermes preference persisted as local",
                pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null').provider.chat") == "local")

            # ---- axe-free sanity: no page errors ----
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.reload(wait_until="networkidle")
            pg.wait_for_timeout(600)
            chk("P0 reload no page errors", len(errs) == 0, errs[:1])
            pg.close()
            b.close()
    finally:
        srv.shutdown()
    print(json.dumps(results))
    return 0

if __name__ == "__main__":
    sys.exit(main())
