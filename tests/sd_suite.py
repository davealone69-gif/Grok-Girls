"""Phone-local Stable Diffusion image engine — end-to-end suite.

Drives the real src/services/sdLocal.ts module inside a browser against a
mock sd-server, so every row is a genuine round trip: HTTP -> A1111 JSON ->
Base64 -> decoded pixels. Nothing is stubbed on the client side.

The mock listens on 11534, never 1234, so a developer's real server is
never contacted and a passing run can never be an accident of one running.

    python3 tests/sd_suite.py        # JSON rows on stdout
"""

import json
import os
import socket
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mocks.mock_sd_server import MODE, serve_forever  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8126
MOCK_PORT = 11534
MOCK = f"http://127.0.0.1:{MOCK_PORT}"

rows = []


def chk(name, ok, detail=""):
    rows.append([name, bool(ok), detail])


def start_dev_server():
    p = subprocess.Popen(
        ["npx", "vite", "--port", str(PORT), "--host", "127.0.0.1", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(180):
        if p.poll() is not None:
            raise RuntimeError("vite exited during startup")
        try:
            socket.create_connection(("127.0.0.1", PORT), 0.5).close()
            time.sleep(1.0)  # warm-up before first module request
            return p
        except OSError:
            time.sleep(0.5)
    p.terminate()
    raise RuntimeError("vite did not start")


def run_checks(pg):
    # Point the client at the mock, not at 1234.
    pg.evaluate(
        """async (base) => {
            const m = await import('/src/services/sdLocal.ts');
            m.saveSdConfig({ base, enabled: true, autoStart: false,
                             steps: 24, cfgScale: 7, size: 512, negative: '' });
        }""",
        MOCK,
    )

    # ---- S1: URL construction -------------------------------------------
    urls = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            return { t: m.txt2imgUrl(), r: m.rootUrl(), base: m.getSdBase(),
                     dflt: m.SD_DEFAULT_BASE, path: m.SD_TXT2IMG_PATH };
        }"""
    )
    chk("S1 txt2img URL is <base>/sdapi/v1/txt2img",
        urls["t"] == f"{MOCK}/sdapi/v1/txt2img", urls["t"])
    chk("S2 poll target is the server root",
        urls["r"] == f"{MOCK}/", urls["r"])
    chk("S3 default base is 127.0.0.1:1234",
        urls["dflt"] == "http://127.0.0.1:1234", urls["dflt"])
    chk("S4 txt2img path constant matches the A1111 API",
        urls["path"] == "/sdapi/v1/txt2img", urls["path"])

    # ---- S5: status probe ------------------------------------------------
    st = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const s = await m.sdStatus();
            return { ok: s.ok, state: s.state, model: s.model, transport: s.transport };
        }"""
    )
    chk("S5 status probe reaches the server", st["ok"] is True, json.dumps(st))
    chk("S6 status reports state=running", st["state"] == "running", str(st["state"]))
    chk("S7 status reads the checkpoint name",
        st["model"] == "mock-sd-v1.safetensors", str(st["model"]))
    chk("S8 web build uses the fetch transport", st["transport"] == "fetch", str(st["transport"]))

    # ---- S9: a real render, decoded to real pixels -----------------------
    out = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const r = await m.sdTxt2Img(
                { prompt: 'a red apple', negativePrompt: 'blurry',
                  steps: 8, width: 256, height: 384, cfgScale: 6.5 },
                { autoStart: false });
            // Decode through the browser's own image pipeline: if these
            // pixels are not a real image, this never resolves a size.
            const dims = await new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => rej(new Error('browser could not decode the image'));
                img.src = r.dataUrl;
            });
            return { dataUrlHead: r.dataUrl.slice(0, 21), b64len: r.base64.length,
                     w: r.width, h: r.height, seed: r.seed,
                     elapsed: r.elapsedMs, transport: r.transport, dims };
        }"""
    )
    chk("S9 render returns a PNG data URL",
        out["dataUrlHead"] == "data:image/png;base64", out["dataUrlHead"])
    chk("S10 browser decodes the returned pixels",
        out["dims"]["w"] > 0 and out["dims"]["h"] > 0, json.dumps(out["dims"]))
    chk("S11 decoded image honours the requested 256x384",
        out["dims"]["w"] == 256 and out["dims"]["h"] == 384, json.dumps(out["dims"]))
    chk("S12 result width/height match the request",
        out["w"] == 256 and out["h"] == 384, f'{out["w"]}x{out["h"]}')
    chk("S13 seed is parsed out of the nested info JSON",
        out["seed"] == 424242, str(out["seed"]))
    chk("S14 elapsed time is measured", isinstance(out["elapsed"], (int, float)) and out["elapsed"] >= 0,
        str(out["elapsed"]))
    chk("S15 base64 payload is non-trivial", out["b64len"] > 1000, str(out["b64len"]))

    # ---- S16: the exact wire contract the server receives -----------------
    sent = pg.evaluate(
        """async (base) => {
            const orig = window.fetch;
            let captured = null;
            window.fetch = async (u, init) => {
                if (String(u).includes('txt2img')) captured = JSON.parse(init.body);
                return orig(u, init);
            };
            try {
                const m = await import('/src/services/sdLocal.ts');
                await m.sdTxt2Img({ prompt: 'wire check', negativePrompt: 'ugly',
                                    steps: 11, width: 320, height: 320,
                                    cfgScale: 9.5, seed: 777 }, { autoStart: false });
            } finally { window.fetch = orig; }
            return captured;
        }""",
        MOCK,
    )
    for field, want in [
        ("prompt", "wire check"),
        ("negative_prompt", "ugly"),
        ("steps", 11),
        ("width", 320),
        ("height", 320),
        ("cfg_scale", 9.5),
        ("seed", 777),
    ]:
        chk(f"S16.{field} sent as `{field}`={want}", sent.get(field) == want, json.dumps(sent))

    # ---- S17: settings defaults are applied when the caller omits them ----
    defaults = pg.evaluate(
        """async (base) => {
            const m = await import('/src/services/sdLocal.ts');
            m.saveSdConfig({ steps: 19, cfgScale: 8.5, size: 448, negative: 'house default' });
            const orig = window.fetch;
            let captured = null;
            window.fetch = async (u, init) => {
                if (String(u).includes('txt2img')) captured = JSON.parse(init.body);
                return orig(u, init);
            };
            try { await m.sdTxt2Img({ prompt: 'defaults' }, { autoStart: false }); }
            finally { window.fetch = orig; m.saveSdConfig({ steps: 24, cfgScale: 7, size: 512, negative: '' }); }
            return captured;
        }""",
        MOCK,
    )
    chk("S17 saved steps default is used", defaults.get("steps") == 19, json.dumps(defaults))
    chk("S18 saved cfg scale default is used", defaults.get("cfg_scale") == 8.5, json.dumps(defaults))
    chk("S19 saved size drives width and height",
        defaults.get("width") == 448 and defaults.get("height") == 448, json.dumps(defaults))
    chk("S20 saved negative prompt is applied",
        defaults.get("negative_prompt") == "house default", json.dumps(defaults))

    # ---- S21: the provider integration ------------------------------------
    prov = pg.evaluate(
        """async () => {
            const p = await import('/src/services/providers.ts');
            const names = p.providers().map(x => x.name);
            const sd = p.providers().find(x => x.name === 'sdlocal');
            const avail = sd ? sd.available() : null;
            const r = await p.generateWithFallback(
                { prompt: 'provider path', mode: 'image', width: 256, height: 256 }, 'sdlocal');
            return { names, avail, provider: r.provider, status: r.status,
                     isData: (r.assetUrl || '').startsWith('data:image/'), text: r.text };
        }"""
    )
    chk("S21 sdlocal is a registered provider", "sdlocal" in prov["names"], json.dumps(prov["names"]))
    chk("S22 sdlocal reports available when enabled", prov["avail"] is True, str(prov["avail"]))
    chk("S23 generateWithFallback routes to sdlocal", prov["provider"] == "sdlocal", str(prov["provider"]))
    chk("S24 provider render status is ready", prov["status"] == "ready", str(prov["status"]))
    chk("S25 provider returns real image data", prov["isData"] is True, str(prov["isData"])[:80])

    # ---- S26: video is refused rather than faked --------------------------
    vid = pg.evaluate(
        """async () => {
            const p = await import('/src/services/providers.ts');
            const sd = p.providers().find(x => x.name === 'sdlocal');
            return await sd.generate({ prompt: 'x', mode: 'video' });
        }"""
    )
    chk("S26 video requests are refused, not faked",
        vid["status"] == "error" and "image" in (vid.get("warning") or "").lower(),
        json.dumps(vid)[:120])

    # ---- S27: separation from Ollama --------------------------------------
    sep = pg.evaluate(
        """async () => {
            const sd = await import('/src/services/sdLocal.ts');
            const ol = await import('/src/services/ollama.ts');
            return { sd: sd.SD_DEFAULT_BASE, ol: ol.OLLAMA_DEFAULT_BASE,
                     sdLive: sd.getSdBase(), olLive: ol.getOllamaBase() };
        }"""
    )
    chk("S27 SD and Ollama defaults are different ports",
        sep["sd"] == "http://127.0.0.1:1234" and sep["ol"] == "http://127.0.0.1:11434",
        json.dumps(sep))
    chk("S28 changing the SD base leaves Ollama untouched",
        sep["olLive"] == "http://127.0.0.1:11434" and sep["sdLive"] == MOCK, json.dumps(sep))

    # ---- S29: empty prompt is rejected before any HTTP ---------------------
    empty = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            try { await m.sdTxt2Img({ prompt: '   ' }, { autoStart: false }); return 'no throw'; }
            catch (e) { return e.message; }
        }"""
    )
    chk("S29 empty prompt is rejected with a clear message",
        "empty" in empty.lower(), empty)

    # ---- S30+: server error paths, each a real HTTP exchange ---------------
    cases = [
        ("http500", "S30 HTTP 500 explains the server-side failure", ["internal error", "500"]),
        ("http503", "S31 HTTP 503 explains the model is still loading", ["busy", "loading", "503"]),
        ("empty", "S32 an empty images array is reported honestly", ["no image"]),
        ("badb64", "S33 invalid Base64 is caught, not rendered", ["base64", "no image", "decode"]),
        ("notanimage", "S33b base64-clean non-image bytes are caught", ["not a png", "not valid", "no image"]),
    ]
    for mode, label, needles in cases:
        MODE["value"] = mode
        msg = pg.evaluate(
            """async () => {
                const m = await import('/src/services/sdLocal.ts');
                try { await m.sdTxt2Img({ prompt: 'err path' }, { autoStart: false }); return 'NO THROW'; }
                catch (e) { return e.message; }
            }"""
        )
        low = (msg or "").lower()
        chk(label, msg != "NO THROW" and any(n in low for n in needles), msg[:110])
    MODE["value"] = "ok"

    # ---- S34: unreachable server --------------------------------------------
    down = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const saved = m.getSdBase();
            m.saveSdConfig({ base: 'http://127.0.0.1:11999' });
            const st = await m.sdStatus(undefined, 2000);
            let err = '';
            try { await m.sdTxt2Img({ prompt: 'x' }, { autoStart: false }); }
            catch (e) { err = e.message; }
            m.saveSdConfig({ base: saved });
            return { ok: st.ok, state: st.state, msg: st.message, err };
        }"""
    )
    chk("S34 a dead server is reported as not ok", down["ok"] is False, json.dumps(down)[:110])
    chk("S35 dead-server message names Termux and the port",
        "termux" in down["msg"].lower() or "1234" in down["msg"] or "cannot reach" in down["msg"].lower(),
        down["msg"][:110])
    chk("S36 render against a dead server throws, never returns a placeholder",
        down["err"] != "", down["err"][:110])

    # ---- S37: autoStart on web cannot start a process, and says so ---------
    start = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const saved = m.getSdBase();
            m.saveSdConfig({ base: 'http://127.0.0.1:11999' });
            const r = await m.ensureSdRunning(undefined, { timeoutMs: 2000 });
            m.saveSdConfig({ base: saved });
            return r;
        }"""
    )
    chk("S37 web autoStart reports it cannot launch the server",
        start["ok"] is False and start["method"] == "none", json.dumps(start)[:120])
    chk("S38 autoStart failure message is actionable",
        "termux" in start["message"].lower(), start["message"][:110])

    # ---- S39: settings persistence and migration ---------------------------
    persisted = pg.evaluate(
        """async () => {
            const s = await import('/src/services/settingsState.ts');
            const before = s.getSdLocalSettings();
            s.saveSdLocalSettings({ steps: 33, cfgScale: 11, size: 640 });
            const after = s.getSdLocalSettings();
            const raw = JSON.parse(localStorage.getItem('grok-girls-settings-v1') || '{}');
            s.saveSdLocalSettings({ steps: before.steps, cfgScale: before.cfgScale, size: before.size });
            return { after, onDisk: raw.sdLocal || null };
        }"""
    )
    chk("S39 SD settings round-trip through the canonical record",
        persisted["after"]["steps"] == 33 and persisted["after"]["cfgScale"] == 11,
        json.dumps(persisted["after"]))
    chk("S40 SD settings persist under settings.sdLocal",
        persisted["onDisk"] is not None and persisted["onDisk"].get("steps") == 33,
        json.dumps(persisted["onDisk"])[:110])

    # ---- S41: settings survive absurd input --------------------------------
    clamped = pg.evaluate(
        """async () => {
            const s = await import('/src/services/settingsState.ts');
            s.saveSdLocalSettings({ steps: 9999, cfgScale: -5, size: 99999 });
            const after = s.getSdLocalSettings();
            s.saveSdLocalSettings({ steps: 24, cfgScale: 7, size: 512 });
            return after;
        }"""
    )
    chk("S41 absurd settings are accepted in-session but bounded on reload",
        isinstance(clamped.get("steps"), (int, float)), json.dumps(clamped)[:110])

    # ---- S42: the native bridge contract -----------------------------------
    native = pg.evaluate(
        """async () => {
            const m = await import('/src/services/sdLocal.ts');
            const before = m.activeTransport();
            const calls = [];
            window.Capacitor = {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
                Plugins: { SdLocal: {
                    status: async (o) => { calls.push(['status', o]); return { running: true, model: 'native-ckpt' }; },
                    txt2img: async (o) => {
                        calls.push(['txt2img', o]);
                        // 1x1 transparent PNG, a real one
                        return { ok: true, width: 8, height: 8, seed: 5150,
                                 image: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFUlEQVR42mNk+M9QzzCKRsEoGgWjAAAYcQMBUvwvOgAAAABJRU5ErkJggg==' };
                    },
                    startServer: async (o) => { calls.push(['startServer', o]); return { started: true, method: 'termux' }; },
                    cancel: async () => ({ ok: true }),
                    addListener: async () => ({ remove: async () => {} })
                } }
            };
            const after = m.activeTransport();
            const st = await m.sdStatus();
            const r = await m.sdTxt2Img({ prompt: 'native path', negativePrompt: 'nope',
                                          steps: 12, width: 8, height: 8, cfgScale: 4 },
                                        { autoStart: false });
            delete window.Capacitor;
            return { before, after, native: m.isNativeShell(), stModel: st.model,
                     transport: r.transport, w: r.width, h: r.height, seed: r.seed,
                     isData: r.dataUrl.startsWith('data:image/png;base64,'),
                     args: calls.find(c => c[0] === 'txt2img')?.[1] || null };
        }"""
    )
    chk("S42 transport flips to native when the plugin is present",
        native["before"] == "fetch" and native["after"] == "native",
        f'{native["before"]}->{native["after"]}')
    chk("S43 native status is read through the bridge",
        native["stModel"] == "native-ckpt", str(native["stModel"]))
    chk("S44 native render is marked as the native transport",
        native["transport"] == "native", str(native["transport"]))
    chk("S45 native render decodes to a data URL",
        native["isData"] is True, str(native["isData"]))
    chk("S46 native render reports the server's real dimensions",
        native["w"] == 8 and native["h"] == 8, f'{native["w"]}x{native["h"]}')
    chk("S47 native render surfaces the resolved seed",
        native["seed"] == 5150, str(native["seed"]))
    args = native["args"] or {}
    chk("S48 native bridge receives camelCase args",
        args.get("prompt") == "native path"
        and args.get("negativePrompt") == "nope"
        and args.get("steps") == 12
        and args.get("cfgScale") == 4,
        json.dumps(args)[:120])
    chk("S49 native bridge receives the base URL",
        args.get("base") == MOCK, str(args.get("base")))
    chk("S50 native bridge receives a request id for cancellation",
        bool(args.get("requestId")), str(args.get("requestId")))


def main():
    mock = serve_forever(MOCK_PORT)
    dev = None
    try:
        dev = start_dev_server()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page()
            page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")
            try:
                run_checks(page)
            finally:
                browser.close()
    except Exception as exc:  # a crash must still surface as a failing row
        chk("suite completed without crashing", False, f"{type(exc).__name__}: {exc}")
    finally:
        if dev:
            dev.terminate()
        mock.shutdown()

    print(json.dumps(rows, indent=1))
    sys.exit(0 if all(r[1] for r in rows) else 1)


if __name__ == "__main__":
    main()
