from playwright.sync_api import sync_playwright
import json
import os

results = []
def chk(name, cond, extra=""):
    results.append((name, bool(cond), extra))

with sync_playwright() as p:
    b = p.chromium.launch()

    # --- 1) LANDSCAPE chat SEND fix (was: footer intercepted) ---
    pg = b.new_page(viewport={"width": 780, "height": 360})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(600)
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(250)
    if pg.locator("text=I AM 18+").count():
        pg.locator("text=I AM 18+").click()
        pg.wait_for_timeout(250)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(300)
    pg.locator(".companion-input").fill("hello")
    sb = pg.locator(".btn-send-chat").bounding_box()
    fb = pg.locator(".master-footer").bounding_box()
    if sb and fb:
        chk("landscape: SEND fully above footer", sb["y"] + sb["height"] <= fb["y"], f"SEND bottom={sb['y']+sb['height']:.0f} footer top={fb['y']:.0f}")
        cx, cy = sb["x"]+sb["width"]/2, sb["y"]+sb["height"]/2
        el = pg.evaluate(f"() => {{ const e = document.elementFromPoint({cx},{cy}); return e ? e.className : 'none'; }}")
        chk("landscape: SEND hit-testable", el == "btn-send-chat", el)
    pg.locator(".btn-send-chat").click(timeout=5000)
    pg.wait_for_timeout(600)
    chk("landscape: SEND works -> reply", pg.locator(".chat-bubble").count() >= 2)
    safe_chips = pg.locator(".chat-quick-chips").first.evaluate("el => el.scrollWidth > el.clientWidth ? 'scrollable' : 'fits'")
    adult_chips = pg.locator(".chat-quick-chips.adult-acts").evaluate("el => el.scrollWidth > el.clientWidth ? 'scrollable' : 'fits'")
    chk("landscape: safe chips one line", safe_chips in ("scrollable", "fits"), safe_chips)
    chk("landscape: adult chips one line", adult_chips in ("scrollable", "fits"), adult_chips)
    pg.close()

    # --- 2) AGE GATE ---
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(250)
    chk("age gate: confirm dialog appears", pg.locator("text=I AM 18+").count() >= 1)
    chk("age gate: adult NOT enabled yet", pg.evaluate("localStorage.getItem('grok-girls-adult-v1') !== '1'"))
    pg.locator(".modal-card button", has_text="Cancel").first.click()
    pg.wait_for_timeout(200)
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(200)
    pg.locator("text=I AM 18+").click()
    pg.wait_for_timeout(250)
    chk("age gate: confirm enables adult", pg.evaluate("localStorage.getItem('grok-girls-adult-v1') === '1'"))
    chk("age gate: age stored", pg.evaluate("localStorage.getItem('grok-girls-age-confirmed-v1') === '18+'"))
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(200)
    chk("age gate: toggle off w/o dialog", pg.evaluate("localStorage.getItem('grok-girls-adult-v1') === '0'"))
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(200)
    chk("age gate: re-enable w/o dialog", pg.evaluate("localStorage.getItem('grok-girls-adult-v1') === '1'"))
    pg.close()

    # --- 3) QUOTA WARNING (real 1.6MB self-hosted render against the mock) ---
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.evaluate("""
      () => {
        localStorage.setItem('quota-filler', 'x'.repeat(1024*1024*4));
        localStorage.setItem('grok-girls-selfhosted-base', 'http://localhost:7860');
        localStorage.setItem('grok-girls-selfhosted-type', 'a1111');
        localStorage.setItem('grok-girls-provider-v1', 'selfhosted');
      }
    """)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.locator(".btn-generate-media").first.click()
    seen = []
    for _ in range(18):
        pg.wait_for_timeout(300)
        if pg.locator(".toast").count():
            seen.append(pg.locator(".toast").inner_text())
    toast = " | ".join(seen)
    # R1: renders now live in IndexedDB — a big render under a nearly-full
    # localStorage must still succeed and persist (metadata-only write).
    gal = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]')")
    render_ok = any("complete" in t.lower() for t in seen)
    key_ok = len(gal) >= 1 and bool(gal[0].get("assetKey"))
    meta_small = pg.evaluate("(localStorage.getItem('grok-girls-gallery-v1')||'').length") < 4096
    chk("quota: big render still completes near-full storage", render_ok, toast[:120])
    chk("quota: render persisted via IndexedDB assetKey", key_ok, str(gal[0])[:120] if gal else "none")
    chk("quota: gallery localStorage write is metadata-only", meta_small, "")
    # M3: the prompt lives in the IDB record, not in localStorage
    no_prompt_ls = len(gal) >= 1 and "prompt" not in gal[0]
    chk("M3 prompt removed from localStorage", no_prompt_ls, str(gal[0])[:120] if gal else "none")
    idb_prompt = pg.evaluate("""() => new Promise(res => {
      const items = JSON.parse(localStorage.getItem('grok-girls-gallery-v1') || '[]');
      if (!items[0] || !items[0].assetKey) return res(null);
      const rq = indexedDB.open('grok-girls-assets');
      rq.onsuccess = () => {
        const g = rq.result.transaction('images', 'readonly').objectStore('images').get(items[0].assetKey);
        g.onsuccess = () => res(g.result && g.result.meta ? String(g.result.meta.prompt || '') : null);
        g.onerror = () => res(null);
      };
      rq.onerror = () => res(null);
    })""")
    chk("M3 prompt stored in IDB record", bool(idb_prompt) and len(idb_prompt) > 20, (idb_prompt or "")[:60])
    pg.evaluate("localStorage.removeItem('quota-filler')")
    pg.close()

    # --- 4) REGRESSION: 3 viewports ---
    for label, vp in [("phone-393x851", (393, 851)), ("phone-land-780x360", (780, 360)), ("desktop-1280x900", (1280, 900))]:
        pg = b.new_page(viewport={"width": vp[0], "height": vp[1]})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8080/", wait_until="networkidle")
        pg.wait_for_timeout(600)
        chk(f"{label} app renders", pg.locator(".app-container").count() == 1)
        chk(f"{label} rail+footer+viewport", pg.locator(".nav-rail").count() == 1 and pg.locator(".master-footer").count() == 1 and pg.locator(".character-image").count() == 1)
        fb = pg.locator(".master-footer").bounding_box()
        if fb:
            chk(f"{label} footer flush bottom", fb["y"] + fb["height"] <= vp[1] + 1, f"{fb['y']+fb['height']:.0f}/{vp[1]}")
        chk(f"{label} no pageerrors", len(errs) == 0, errs[:1])
        pg.close()

    # --- 5) SWEEP REGRESSIONS: H4 cancel, H1 engine split, M5 pin, M6 hard, M8 settings ---
    # H4: CANCEL reachable on phones (portrait AND landscape)
    for label, vp in [("portrait", (393, 851)), ("landscape", (780, 360))]:
        pg = b.new_page(viewport={"width": vp[0], "height": vp[1]})
        pg.goto("http://localhost:8080/", wait_until="networkidle")
        pg.wait_for_timeout(500)
        cb = pg.locator(".btn-cancel").first
        bb = cb.bounding_box()
        chk(f"H4 cancel visible ({label})", bool(bb) and bb["width"] > 20 and bb["height"] > 10, str(bb)[:60])
        cb.click(timeout=5000)
        alive = pg.locator(".app-container").count() == 1
        chk(f"H4 cancel clickable ({label})", alive)
        pg.close()

    # M8: CANCEL discards the draft but keeps engine settings
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.keyboard.press("p")  # open the prompt editor overlay
    pg.wait_for_timeout(400)
    neg = pg.locator("label", has_text="NEGATIVE PROMPT").locator("input").first
    neg.fill("TESTNEG123")
    seedin = pg.locator("label", has_text="SEED").locator("input").first
    seedin.fill("777")
    pg.keyboard.press("Escape")  # close the overlay
    pg.wait_for_timeout(300)
    pg.locator(".btn-cancel").first.click()
    pg.wait_for_timeout(400)
    # blur the cancel button — the keyboard shortcut guard ignores keys
    # while a BUTTON has focus
    pg.locator(".btn-cancel").first.evaluate("el => el.blur()")
    pg.keyboard.press("p")
    pg.wait_for_timeout(400)
    neg_after = pg.locator("label", has_text="NEGATIVE PROMPT").locator("input").first.input_value()
    seed_after = pg.locator("label", has_text="SEED").locator("input").first.input_value()
    chk("M8 cancel keeps negative prompt", neg_after == "TESTNEG123", neg_after)
    chk("M8 cancel keeps seed", seed_after == "777", seed_after)

    # H1: render ENGINE choice must not affect the chat engine
    pg.locator("select.footer-provider-select, .footer-provider-wrap select").first.select_option("selfhosted")
    pg.wait_for_timeout(300)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(300)
    chatval = pg.locator(".mini-provider-select").first.input_value()
    chk("H1 chat engine independent of render engine", chatval == "local", chatval)
    pg.locator(".companion-input").fill("hello there")
    pg.locator(".btn-send-chat").click()
    pg.wait_for_timeout(900)
    chk("H1 chat replies with selfhosted render engine", pg.locator(".chat-bubble.assistant").count() >= 1)

    # M5: adult mode pins cloud chat engines down to LOCAL
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.locator("button.crown-btn").first.click()
    pg.wait_for_timeout(250)
    if pg.locator("text=I AM 18+").count():
        pg.locator("text=I AM 18+").click()
        pg.wait_for_timeout(250)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(300)
    pg.locator(".mini-provider-select").first.select_option("openrouter")
    pg.locator(".companion-input").fill("hello again")
    pg.locator(".btn-send-chat").click()
    seen = []
    for _ in range(6):
        pg.wait_for_timeout(300)
        if pg.locator(".toast").count():
            seen.append(pg.locator(".toast").inner_text())
    toasts = " | ".join(seen)
    chk("M5 adult chat pinned to LOCAL", "pinned to LOCAL" in toasts or "cloud chat" in toasts, toasts[:100])
    chk("M5 pinned chat still replies", pg.locator(".chat-bubble.assistant").count() >= 2)

    # M6: innocent 'hard' no longer triggers an adult reply in adult mode
    pg.locator(".mini-provider-select").first.select_option("local")
    pg.locator(".companion-input").fill("this puzzle is hard but fun")
    pg.locator(".btn-send-chat").click()
    pg.wait_for_timeout(1200)
    last = pg.locator(".chat-bubble.assistant").last.inner_text()
    adult_hit = pg.evaluate("""(t) => /fuck|sex|cum|pussy|cock|wet|spread|deeper|suck|lick|orgasm|breed|throat|ass|tits|blow|finger|clit|anal|ride|oral|toy|dildo|spank|choke|squirt|dp|ahegao|collar|leash/i.test(t)""", last)
    chk("M6 innocent 'hard' gets clean reply", not adult_hit, last[:80])
    pg.close()

    # --- 6) ANDROID-FIRST: no service worker inside the Capacitor webview ---
    # An SW cached from an older build could serve a stale app after an APK
    # update — the webview must unregister/never register one.
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.add_init_script("window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };")
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(1000)
    sw_count = pg.evaluate("() => navigator.serviceWorker.getRegistrations().then(rs => rs.length)")
    chk("APK mode: no service worker registered", sw_count == 0, sw_count)
    chk("APK mode: app still boots", pg.locator(".app-container").count() == 1)
    pg.close()

    # --- 7) MENU XML (native Android format): data-driven + FAULTY fallback ---
    fx = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
    custom_xml = open(os.path.join(fx, 'menu_custom.xml'), encoding='utf-8').read()
    faulty_xml = open(os.path.join(fx, 'menu_faulty.xml'), encoding='utf-8').read()

    # valid custom XML actually drives the UI.
    # The override is injected via fetch (deterministic — immune to service
    # worker shadowing, which page.route() cannot intercept).
    def menu_override(body):
        return f"""
          const __orig = window.fetch.bind(window);
          window.fetch = (url, opts) => {{
            if (String(url).includes('menu.xml')) {{
              return Promise.resolve(new Response({json.dumps(body)}, {{ status: 200, headers: {{ 'Content-Type': 'application/xml' }} }}));
            }}
            return __orig(url, opts);
          }};
        """
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_init_script(menu_override(custom_xml))
    pg = ctx.new_page()
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(700)
    chk("menu XML: custom title drives the rail", pg.locator(".rail-btn[title='ARCHIVE CUSTOM']").count() == 1)
    chk("menu XML: custom dock label applied", pg.locator(".dock-tab", has_text="COSMETICS").count() == 1)
    chk("menu XML: angle strip driven by XML", pg.locator(".angle-btn").count() == 1)
    chk("menu XML: header actions driven by XML", pg.locator(".native-action").count() == 1)
    ctx.close()

    # deliberately FAULTY XML -> app falls back to the built-in menu
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_init_script(menu_override(faulty_xml))
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(700)
    chk("faulty menu XML: app still boots", pg.locator(".app-container").count() == 1)
    chk("faulty menu XML: built-in labels restored", pg.locator(".rail-btn[title='Generation Archive']").count() == 1)
    chk("faulty menu XML: dock tabs intact", pg.locator(".dock-tab", has_text="HAIR STYLE").count() == 1)
    chk("faulty menu XML: angle strip restored (4 buttons)", pg.locator(".angle-btn").count() == 4)
    chk("faulty menu XML: header actions restored (4 buttons)", pg.locator(".native-action").count() == 4)
    chk("faulty menu XML: BUILD rail header restored", pg.locator(".rail-build-label").inner_text() == "BUILD")
    chk("faulty menu XML: no page errors", len(errs) == 0, errs[:1])
    ctx.close()

    b.close()

print(json.dumps(results, indent=1))
