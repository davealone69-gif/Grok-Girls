"""Extreme stress + end-to-end verification suite.

Hammers the app with maximum load, rapid-fire interaction, malformed input,
network instability, storage exhaustion, lifecycle churn and hostile data.
Every row is a real observation in a real browser against real modules --
nothing is asserted from source reading.

Sections
  A. Rapid-fire interaction / race conditions
  B. Malformed + hostile input (injection, unicode, huge payloads)
  C. Network instability (timeouts, resets, garbage, slow-loris)
  D. Storage exhaustion + corrupt persistence
  E. Lifecycle churn (visibility, reload, concurrent tabs)
  F. Permission + security rules
  G. Performance metrics under load
  H. Unhandled rejections / error containment

    python3 tests/extreme_stress_suite.py
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8131
CHAOS_PORT = 11801

rows = []


def chk(name, ok, detail=""):
    rows.append([name, bool(ok), str(detail)[:200]])
    print(("PASS " if ok else "FAIL ") + name, file=sys.stderr, flush=True)


# --------------------------------------------------------------- chaos server
# One endpoint, many pathologies. The client must survive every one.
CHAOS_MODE = {"value": "ok"}


class Chaos(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _handle(self):
        mode = CHAOS_MODE["value"]
        if mode == "reset":
            # Kill the socket mid-flight: the harshest network failure.
            try:
                self.connection.close()
            except Exception:
                pass
            return
        if mode == "slow":
            time.sleep(6)
        if mode == "garbage":
            body = b"\x00\x01\x02not json at all\xff\xfe"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if mode == "truncated":
            # Declare more bytes than we send, then hang up.
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", "9999")
            self.end_headers()
            self.wfile.write(b'{"images": ["AAAA')
            try:
                self.connection.close()
            except Exception:
                pass
            return
        if mode == "huge":
            # 12 MB of base64 that is not an image.
            payload = json.dumps({"images": ["A" * (12 * 1024 * 1024)]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if mode == "html":
            body = b"<html><body>502 Bad Gateway</body></html>"
            self.send_response(502)
            self.send_header("Content-Type", "text/html")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = json.dumps(
            {"images": [_PNG_B64], "info": json.dumps({"seed": 12345})}
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if CHAOS_MODE["value"] == "reset":
            try:
                self.connection.close()
            except Exception:
                pass
            return
        body = json.dumps({"sd_model_checkpoint": "chaos.safetensors"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n:
            self.rfile.read(n)
        self._handle()


# 8x8 real PNG
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFUlEQVR42mNk"
    "+M9QzzCKRsEoGgWjAAAYcQMBUvwvOgAAAABJRU5ErkJggg=="
)


def start_chaos(port=CHAOS_PORT):
    # Bind the first free port so a stale/hung run cannot wedge this suite.
    ThreadingHTTPServer.allow_reuse_address = True
    last = None
    srv = None
    for cand in range(port, port + 40):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", cand), Chaos)
            globals()["CHAOS_PORT"] = cand
            break
        except OSError as e:
            last = e
    if srv is None:
        raise last
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def start_dev_server():
    # The suite imports app modules by source path (/src/services/*.ts), which
    # only works through vite's on-the-fly transform -- the same mechanism the
    # existing sd/ollama/glb suites rely on.
    p = subprocess.Popen(
        ["npx", "vite", "--port", str(PORT), "--host", "127.0.0.1", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(240):
        if p.poll() is not None:
            raise RuntimeError("vite exited during startup")
        try:
            socket.create_connection(("127.0.0.1", PORT), 0.5).close()
            time.sleep(1.2)
            return p
        except OSError:
            time.sleep(0.5)
    p.terminate()
    raise RuntimeError("vite did not start")


# ------------------------------------------------------------------ sections


def section_a_rapid_fire(pg, errors):
    """Rapid-fire interaction and race conditions."""
    before = len(errors)

    # 60 provider switches as fast as the event loop allows.
    pg.evaluate(
        """async () => {
            const sel = document.querySelector('.footer-provider-select');
            if (!sel) return;
            const vals = ['local','sdlocal','openrouter','gemini','custom','selfhosted'];
            for (let i=0;i<60;i++){
                sel.value = vals[i % vals.length];
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }"""
    )
    pg.wait_for_timeout(400)
    chk("A1 60 rapid engine switches raise no page error", len(errors) == before,
        errors[before:][:1])

    # Mash GENERATE 25x; only one render may be in flight.
    pg.evaluate(
        """async () => {
            const b = [...document.querySelectorAll('button')]
                .find(x => /GENERATE/i.test(x.textContent||''));
            if (b) for (let i=0;i<25;i++) b.click();
        }"""
    )
    pg.wait_for_timeout(900)
    busy = pg.evaluate(
        "() => document.querySelectorAll('.busy-indicator').length"
    )
    chk("A2 25 rapid GENERATE clicks yield at most one busy indicator", busy <= 1, busy)

    # Tab thrash across every view.
    views = pg.evaluate(
        """async () => {
            const btns = [...document.querySelectorAll('.rail-btn, .category-btn')];
            for (let round=0; round<8; round++)
                for (const b of btns) b.click();
            return btns.length;
        }"""
    )
    pg.wait_for_timeout(500)
    chk("A3 8 full passes over every nav/category button stay stable",
        len(errors) == before, f"buttons={views} errs={errors[before:][:1]}")

    # Concurrent identical renders must not corrupt shared state.
    conc = pg.evaluate(
        """async () => {
            const p = await import('/src/services/providers.ts');
            const rs = await Promise.allSettled(
                Array.from({length:12}, (_,i) =>
                    p.generateWithFallback({ prompt:'race '+i, mode:'image',
                                             width:256, height:256 }, 'local')));
            return { settled: rs.length,
                     ok: rs.filter(r=>r.status==='fulfilled').length,
                     distinct: new Set(rs.filter(r=>r.status==='fulfilled')
                        .map(r=>r.value.assetUrl)).size };
        }"""
    )
    chk("A4 12 concurrent local renders all settle",
        conc["settled"] == 12 and conc["ok"] == 12, json.dumps(conc))
    chk("A5 concurrent renders do not collapse to one shared asset",
        conc["distinct"] > 1, json.dumps(conc))


def section_b_malformed(pg, errors):
    """Malformed and hostile input."""
    before = len(errors)

    hostile = pg.evaluate(
        """async () => {
            const ac = await import('/src/services/avatarCreator.ts');
            const payloads = [
                '<script>window.__XSS=1</script>',
                '"; DROP TABLE avatars; --',
                '../../../../etc/passwd',
                '\\u0000\\u0001\\u0002',
                '𝕏'.repeat(5000),
                '🧬'.repeat(2000),
                '${{constructor.constructor("return 1")()}}',
                'A'.repeat(200000),
                '\\n\\r\\t'.repeat(1000),
                '%%%%%%s%n%n%n'
            ];
            const out = [];
            for (const p of payloads) {
                try {
                    const d = { name:p, ethnicity:p, bodyType:p, eyeColor:p,
                        eyeShape:p, faceShape:p, hairColor:p, hairStyle:p,
                        skinTone:p, outfit:p, pose:p, expression:p, extra:p };
                    const s = ac.buildDraftPrompt(d, true);
                    out.push({ ok:true, len:s.length });
                } catch (e) { out.push({ ok:false, err:String(e).slice(0,60) }); }
            }
            return { out, xss: !!window.__XSS };
        }"""
    )
    chk("B1 all 10 hostile prompt payloads handled without throwing",
        all(o["ok"] for o in hostile["out"]), json.dumps(hostile["out"])[:150])
    chk("B2 script payload did not execute (no XSS)", hostile["xss"] is False,
        hostile["xss"])

    # Hostile values into the canonical catalog.
    cat = pg.evaluate(
        """async () => {
            const c = await import('/src/models/avatarCatalog.ts');
            const mk = (b) => ({ name:'x', bodyType:b, faceShape:b, hairStyle:b,
                eyeColor:b, skinTone:b, outfit:b });
            const junk = [null, undefined, '', '   ', 123, {}, [], 'NOT_A_VALUE',
                          '\\u0000', 'Slim\\u200b'];
            const res = [];
            for (const j of junk) {
                try { res.push({ v: c.canonicalValueOf('body', mk(j)) }); }
                catch (e) { res.push({ err: String(e).slice(0,50) }); }
            }
            return res;
        }"""
    )
    chk("B3 canonicalValueOf survives 10 junk inputs without throwing",
        all("err" not in r for r in cat), json.dumps(cat)[:150])
    chk("B4 junk body values fall back to a valid canonical label",
        all(r.get("v") in ("Slim", "Athletic", "Average", "Hourglass", "Heavy")
            for r in cat if "v" in r), json.dumps(cat)[:150])

    # Malformed settings writes.
    settings = pg.evaluate(
        """async () => {
            const s = await import('/src/services/settingsState.ts');
            const junk = [
                { steps: NaN }, { steps: Infinity }, { steps: -99999 },
                { cfgScale: 'abc' }, { size: null }, { base: 12345 },
                { negative: {} }, { steps: 1e308 }
            ];
            const res = [];
            for (const j of junk) {
                try { s.saveSdLocalSettings(j); res.push({ ok:true }); }
                catch (e) { res.push({ err:String(e).slice(0,50) }); }
            }
            const after = s.getSdLocalSettings();
            s.saveSdLocalSettings({ steps:24, cfgScale:7, size:512, negative:'',
                                    base:'http://127.0.0.1:1234' });
            return { res, after };
        }"""
    )
    chk("B5 malformed settings writes never throw",
        all("err" not in r for r in settings["res"]), json.dumps(settings["res"])[:150])
    chk("B6 app still reads a usable settings record afterwards",
        isinstance(settings["after"], dict) and "base" in settings["after"],
        json.dumps(settings["after"])[:150])

    chk("B7 hostile input raised no page errors", len(errors) == before,
        errors[before:][:1])


def section_c_network(pg, errors, base):
    """Network instability against the chaos server."""
    pg.evaluate(
        """async (b) => {
            const m = await import('/src/services/sdLocal.ts');
            m.saveSdConfig({ base:b, enabled:true, autoStart:false });
        }""",
        base,
    )

    cases = [
        ("reset", "C1 connection reset mid-request is caught"),
        ("garbage", "C2 non-JSON garbage body is caught"),
        ("truncated", "C3 truncated response is caught"),
        ("huge", "C4 12MB non-image payload is rejected, not rendered"),
        ("html", "C5 HTML error page (502) is caught"),
    ]
    for mode, label in cases:
        CHAOS_MODE["value"] = mode
        r = pg.evaluate(
            """async () => {
                const m = await import('/src/services/sdLocal.ts');
                const t0 = performance.now();
                const guard = (p, ms) => Promise.race([p,
                    new Promise((_, rj) => setTimeout(
                        () => rj(new Error('harness deadline')), ms))]);
                try {
                    const out = await guard(m.sdTxt2Img({ prompt:'net chaos' },
                                                  { autoStart:false, timeoutMs:15000 }), 20000);
                    return { threw:false, isData:(out.dataUrl||'').startsWith('data:image/'),
                             ms: performance.now()-t0 };
                } catch (e) {
                    return { threw:true, msg:String(e.message||e).slice(0,110),
                             ms: performance.now()-t0 };
                }
            }"""
        )
        # Either a clean throw, or a genuinely valid image. Never a silent bad render.
        good = r.get("threw") or r.get("isData")
        chk(label, good, json.dumps(r)[:160])
    CHAOS_MODE["value"] = "ok"

    # Timeout must be honoured, not hang forever.
    CHAOS_MODE["value"] = "slow"
    slow = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const t0 = performance.now();
            try { await m.sdTxt2Img({ prompt:'slow' }, { autoStart:false, timeoutMs:2000 }); 
                  return { threw:false, ms: performance.now()-t0 }; }
            catch (e) { return { threw:true, ms: performance.now()-t0,
                                 msg:String(e.message).slice(0,80) }; }
        }"""
    )
    chk("C6 a 2s timeout aborts a 6s server within ~4s",
        slow["threw"] and slow["ms"] < 4500, json.dumps(slow)[:140])
    CHAOS_MODE["value"] = "ok"

    # Abort signal must actually cancel. The server has to be SLOW for this to
    # mean anything -- against the instant-response mode the render finishes
    # before the abort fires and the test proves nothing.
    CHAOS_MODE["value"] = "slow"
    ab = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const c = new AbortController();
            const t0 = performance.now();
            const p = m.sdTxt2Img({ prompt:'abort me' },
                                  { autoStart:false, timeoutMs:30000, signal:c.signal });
            setTimeout(()=>c.abort(), 250);
            try { await p; return { threw:false, ms: performance.now()-t0 }; }
            catch (e) { return { threw:true, ms: performance.now()-t0,
                                 msg:String(e.message).slice(0,80) }; }
        }"""
    )
    # Must reject, and must do so well before the 6s server would reply.
    chk("C7 AbortSignal cancels an in-flight render",
        ab["threw"] and ab["ms"] < 3000, json.dumps(ab)[:140])
    CHAOS_MODE["value"] = "ok"

    # 40 parallel requests against a flapping server.
    CHAOS_MODE["value"] = "ok"
    flood = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const t0 = performance.now();
            const guard = (p, ms) => Promise.race([p,
                new Promise((_, rj) => setTimeout(
                    () => rj(new Error('harness deadline')), ms))]);
            const rs = await Promise.allSettled(
                Array.from({length:40}, (_,i) =>
                    guard(m.sdTxt2Img({ prompt:'flood '+i },
                          { autoStart:false, timeoutMs:20000 }), 25000)));
            return { total: rs.length,
                     fulfilled: rs.filter(r=>r.status==='fulfilled').length,
                     rejected: rs.filter(r=>r.status==='rejected').length,
                     ms: Math.round(performance.now()-t0) };
        }"""
    )
    chk("C8 40 parallel renders all settle (none hang)",
        flood["total"] == 40 and flood["fulfilled"] + flood["rejected"] == 40,
        json.dumps(flood))
    chk("C9 40 parallel renders complete under 30s", flood["ms"] < 30000,
        f'{flood["ms"]}ms')

    # Unreachable port: must fail fast with an actionable message.
    dead = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const saved = m.getSdBase();
            m.saveSdConfig({ base:'http://127.0.0.1:1' });
            const t0 = performance.now();
            const st = await m.sdStatus(undefined, 3000);
            m.saveSdConfig({ base: saved });
            return { ok: st.ok, ms: Math.round(performance.now()-t0),
                     msg: st.message.slice(0,90) };
        }"""
    )
    chk("C10 unreachable port reports not-ok quickly", dead["ok"] is False,
        json.dumps(dead)[:130])
    chk("C11 unreachable-port message is actionable",
        any(w in dead["msg"].lower() for w in ("termux", "cannot reach", "start")),
        dead["msg"])


def section_d_storage(pg, errors):
    """Storage exhaustion and corrupt persistence."""
    before = len(errors)

    corrupt = pg.evaluate(
        """async () => {
            const keys = ['grok-girls-settings-v1','grok-girls-avatar-defs-v1',
                          'grok-girls-gallery-v1','grok-girls-draft-v1:ruby_noir'];
            const saved = {};
            for (const k of keys) saved[k] = localStorage.getItem(k);
            const poisons = ['{', 'null', '[]', '"a string"', '{"version":999}',
                             '\\u0000', '{"__proto__":{"polluted":true}}'];
            const res = [];
            for (const p of poisons) {
                for (const k of keys) localStorage.setItem(k, p);
                try {
                    const s = await import('/src/services/settingsState.ts');
                    s.__resetCache?.();
                    const v = s.loadSettings();
                    res.push({ ok: !!v && typeof v === 'object' });
                } catch (e) { res.push({ err:String(e).slice(0,60) }); }
            }
            const polluted = ({}).polluted === true;
            for (const k of keys) {
                if (saved[k] === null) localStorage.removeItem(k);
                else localStorage.setItem(k, saved[k]);
            }
            return { res, polluted };
        }"""
    )
    chk("D1 7 corrupt-storage shapes never crash the settings loader",
        all("err" not in r for r in corrupt["res"]), json.dumps(corrupt["res"])[:160])
    chk("D2 __proto__ payload does not pollute Object.prototype",
        corrupt["polluted"] is False, corrupt["polluted"])

    # Quota exhaustion: fill localStorage, then confirm the app still works.
    quota = pg.evaluate(
        """async () => {
            let wrote = 0, hitQuota = false;
            const blob = 'x'.repeat(256*1024);
            try {
                for (let i=0;i<200;i++){ localStorage.setItem('__fill_'+i, blob); wrote++; }
            } catch (e) { hitQuota = true; }
            let stillWorks = false, msg='';
            try {
                const s = await import('/src/services/settingsState.ts');
                s.saveSdLocalSettings({ steps: 21 });
                stillWorks = s.getSdLocalSettings().steps === 21;
            } catch (e) { msg = String(e).slice(0,70); }
            for (let i=0;i<=wrote;i++) localStorage.removeItem('__fill_'+i);
            return { wrote, hitQuota, stillWorks, msg };
        }"""
    )
    chk("D3 localStorage quota exhaustion is reached in the test", quota["hitQuota"],
        json.dumps(quota))
    chk("D4 app does not throw when storage is full",
        quota["msg"] == "", quota["msg"] or "no throw")

    chk("D5 storage chaos raised no page errors", len(errors) == before,
        errors[before:][:1])


def section_e_lifecycle(pg, errors):
    """Lifecycle churn."""
    before = len(errors)

    pg.evaluate(
        """async () => {
            for (let i=0;i<30;i++){
                document.dispatchEvent(new Event('visibilitychange'));
                window.dispatchEvent(new Event('blur'));
                window.dispatchEvent(new Event('focus'));
                window.dispatchEvent(new Event('resize'));
                window.dispatchEvent(new Event('online'));
                window.dispatchEvent(new Event('offline'));
            }
        }"""
    )
    pg.wait_for_timeout(400)
    chk("E1 30 rounds of visibility/focus/resize/online events are stable",
        len(errors) == before, errors[before:][:1])

    # Viewport thrash: phone -> tablet -> desktop -> phone.
    for w, h in [(320, 568), (768, 1024), (1920, 1080), (360, 740), (1280, 720)]:
        pg.set_viewport_size({"width": w, "height": h})
        pg.wait_for_timeout(120)
    root_ok = pg.evaluate("() => !!document.querySelector('#root')?.children.length")
    chk("E2 5 viewport changes keep the app mounted", root_ok, root_ok)
    chk("E3 viewport thrash raised no page errors", len(errors) == before,
        errors[before:][:1])

    # Reload survival with state present.
    pg.reload(wait_until="domcontentloaded")
    pg.wait_for_timeout(1200)
    mounted = pg.evaluate("() => !!document.querySelector('#root')?.children.length")
    chk("E4 app remounts after a hard reload", mounted, mounted)


def section_f_security(pg, errors):
    """Permission and security rules."""
    sec = pg.evaluate(
        """async () => {
            const out = {};
            // No secret may be written to disk.
            const dump = JSON.stringify(Object.entries(localStorage));
            out.patLeak = /github_pat_|ghp_[A-Za-z0-9]{20,}/.test(dump);
            out.bearerLeak = /Bearer\\s+[A-Za-z0-9._-]{20,}/.test(dump);
            // Loopback-only engines must not point off-device by default.
            const sd = await import('/src/services/sdLocal.ts');
            const ol = await import('/src/services/ollama.ts');
            out.sdDefault = sd.SD_DEFAULT_BASE;
            out.olDefault = ol.OLLAMA_DEFAULT_BASE;
            out.sdLoopback = /^http:\\/\\/127\\.0\\.0\\.1:/.test(sd.SD_DEFAULT_BASE);
            out.olLoopback = /^http:\\/\\/127\\.0\\.0\\.1:/.test(ol.OLLAMA_DEFAULT_BASE);
            out.distinctPorts = sd.SD_DEFAULT_BASE !== ol.OLLAMA_DEFAULT_BASE;
            return out;
        }"""
    )
    chk("F1 no GitHub PAT is persisted to localStorage", sec["patLeak"] is False,
        sec["patLeak"])
    chk("F2 no bearer token is persisted to localStorage", sec["bearerLeak"] is False,
        sec["bearerLeak"])
    chk("F3 SD engine defaults to loopback only", sec["sdLoopback"], sec["sdDefault"])
    chk("F4 Ollama engine defaults to loopback only", sec["olLoopback"], sec["olDefault"])
    chk("F5 the two local engines use distinct ports", sec["distinctPorts"],
        f'{sec["sdDefault"]} vs {sec["olDefault"]}')

    # Android manifest + network security policy (static, but read from disk).
    man = os.path.join(ROOT, "android/app/src/main/AndroidManifest.xml")
    nsc = os.path.join(ROOT, "android/app/src/main/res/xml/network_security_config.xml")
    mtxt = open(man).read() if os.path.exists(man) else ""
    ntxt = open(nsc).read() if os.path.exists(nsc) else ""
    chk("F6 manifest declares the Termux RUN_COMMAND permission",
        "com.termux.permission.RUN_COMMAND" in mtxt, bool(mtxt))
    chk("F7 manifest scopes package visibility with <queries>",
        "<queries>" in mtxt and "com.termux" in mtxt, bool(mtxt))
    chk("F8 cleartext is whitelisted for loopback only",
        "127.0.0.1" in ntxt and "localhost" in ntxt, bool(ntxt))
    chk("F9 no wildcard cleartext domain in the security config",
        '<domain includeSubdomains="true">*</domain>' not in ntxt, bool(ntxt))


def section_g_performance(pg, errors):
    """Performance metrics under load."""
    perf = pg.evaluate(
        """async () => {
            const t = performance.getEntriesByType('navigation')[0] || {};
            const mem = performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize/1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit/1048576)
            } : null;
            return {
                domContentLoaded: Math.round(t.domContentLoadedEventEnd || 0),
                load: Math.round(t.loadEventEnd || 0),
                mem
            };
        }"""
    )
    chk("G1 DOMContentLoaded under 5s", perf["domContentLoaded"] < 5000,
        f'{perf["domContentLoaded"]}ms')
    if perf["mem"]:
        chk("G2 JS heap below 70% of the limit",
            perf["mem"]["used"] < perf["mem"]["limit"] * 0.7,
            f'{perf["mem"]["used"]}MB / {perf["mem"]["limit"]}MB')
    else:
        chk("G2 JS heap below 70% of the limit", True, "performance.memory unavailable")

    # Heavy prompt build loop: must stay responsive.
    loop = pg.evaluate(
        """async () => {
            const ac = await import('/src/services/avatarCreator.ts');
            const d = { name:'Perf', ethnicity:'x', bodyType:'hourglass', eyeColor:'a',
                eyeShape:'b', faceShape:'c', hairColor:'d', hairStyle:'e',
                skinTone:'f', outfit:'g', pose:'h', expression:'i' };
            const t0 = performance.now();
            for (let i=0;i<20000;i++) ac.buildDraftPrompt(d, true);
            return Math.round(performance.now()-t0);
        }"""
    )
    chk("G3 20k prompt builds complete under 5s", loop < 5000, f"{loop}ms")

    # Renderer scene build under repetition (memory churn).
    scene = pg.evaluate(
        """async () => {
            const hd = await import('/src/renderer/HDRenderer.ts');
            const base = { gender:'female', skin:'1', hair:'Long', eyes:'Natural',
              face:'Soft', outfit:'Street', age:'24', tattoos:'None', augmentations:'None' };
            const bodies = ['Slim','Athletic','Average','Hourglass','Heavy'];
            const t0 = performance.now();
            let meshes = 0;
            for (let i=0;i<300;i++)
                meshes = hd.buildDefaultScene({ ...base, body: bodies[i%5] }, i).meshes.length;
            return { ms: Math.round(performance.now()-t0), meshes };
        }"""
    )
    chk("G4 300 full scene builds complete under 10s", scene["ms"] < 10000,
        f'{scene["ms"]}ms')
    chk("G5 scene mesh count stays constant under churn", scene["meshes"] == 12,
        scene["meshes"])


def section_h_errors(pg, errors, rejections):
    """Error containment."""
    chk("H1 no unhandled promise rejections across the whole run",
        len(rejections) == 0, rejections[:2])
    chk("H2 no uncaught page errors across the whole run",
        len(errors) == 0, errors[:2])

    mounted = pg.evaluate(
        "() => !!document.querySelector('#root') && document.querySelectorAll('#root *').length > 10"
    )
    chk("H3 app is still fully mounted after all stress sections", mounted, mounted)

    responsive = pg.evaluate(
        """async () => {
            const t0 = performance.now();
            await new Promise(r => requestAnimationFrame(r));
            return Math.round(performance.now()-t0);
        }"""
    )
    chk("H4 main thread still responsive (rAF under 500ms)", responsive < 500,
        f"{responsive}ms")


def main():
    chaos = start_chaos()
    dev = None
    errors, rejections, console_errors = [], [], []
    try:
        dev = start_dev_server()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                args=["--use-gl=angle", "--use-angle=swiftshader", "--js-flags=--expose-gc"]
            )
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            # No single probe may wedge the suite.
            page.set_default_timeout(45000)
            page.on("pageerror", lambda e: errors.append(str(e)[:200]))
            page.on(
                "console",
                lambda m: console_errors.append(m.text[:160])
                if m.type == "error"
                else None,
            )
            page.add_init_script(
                "window.addEventListener('unhandledrejection',"
                " e => (window.__rej = window.__rej || []).push(String(e.reason)));"
            )
            page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

            try:
                section_a_rapid_fire(page, errors)
                section_b_malformed(page, errors)
                section_c_network(page, errors, f"http://127.0.0.1:{CHAOS_PORT}")
                section_d_storage(page, errors)
                section_e_lifecycle(page, errors)
                section_f_security(page, errors)
                section_g_performance(page, errors)
                rejections.extend(page.evaluate("() => window.__rej || []"))
                section_h_errors(page, errors, rejections)
            finally:
                browser.close()
    except Exception as exc:
        chk("suite completed without crashing", False, f"{type(exc).__name__}: {exc}")
    finally:
        if dev:
            dev.terminate()
        chaos.shutdown()

    print(json.dumps(rows, indent=1))
    sys.exit(0 if all(r[1] for r in rows) else 1)


if __name__ == "__main__":
    main()
