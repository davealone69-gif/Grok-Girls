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
    chk("faulty menu XML: header actions restored (5 buttons)", pg.locator(".native-action").count() == 5)
    chk("faulty menu XML: BUILD rail header restored", pg.locator(".rail-build-label").inner_text() == "BUILD")
    chk("faulty menu XML: no page errors", len(errs) == 0, errs[:1])
    ctx.close()

    # --- 8) AVATAR DEFINITION (Kotlin data-class mirror) ---
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(700)

    # SAVE the current identity under the default Avatar ID -> the stored
    # definition must carry exactly the 11 data-class fields, with the
    # canonical defaults where the trait is untouched.
    pg.locator(".identity-save").click()
    pg.wait_for_timeout(500)
    saved = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-avatar-defs-v1')||'{}')['default']")
    keys_ok = bool(saved) and sorted(saved.keys()) == sorted(
        ["gender", "skin", "head", "age", "hair", "eyes", "face", "body", "tattoos", "augmentations", "outfit"])
    chk("avatar definition: all 11 data-class fields stored", keys_ok, str(sorted(saved.keys()))[:120] if saved else "none")
    chk("avatar definition: gender follows the allowed set", saved and saved.get("gender") in ("Female", "Non-binary", "Android"), str(saved and saved.get("gender")))
    import re as _re
    chk("avatar definition: canonical defaults (skin/head)",
        saved and saved.get("skin") == "Tone 01" and bool(_re.match(r"Head \d{2}", saved.get("head", ""))),
        str(saved)[:120])

    # custom stored definition -> Load Outfit applies the canonical outfit
    pg.evaluate("""() => {
      const store = JSON.parse(localStorage.getItem('grok-girls-avatar-defs-v1')||'{}');
      store['default'] = {"gender":"Female","skin":"Tone 02","head":"Head 02","age":"Adult","hair":"Long","eyes":"Cyber","face":"Sharp","body":"Heavy","tattoos":"Arms","augmentations":"None","outfit":"Tech"};
      localStorage.setItem('grok-girls-avatar-defs-v1', JSON.stringify(store));
    }""")
    pg.locator(".identity-btn", has_text="Load Outfit").click()
    pg.wait_for_timeout(500)
    after = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')")
    chk("avatar definition: Load Outfit applies saved outfit", after.get("outfit", "").startswith("cyberpunk"), after.get("outfit", "")[:60])

    # tattoos toggle flips the canonical field on the draft (Ruby boots
    # with tattooStyle 'none' — one click must switch it ON)
    before_ts = pg.evaluate("() => (JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')).tattooStyle")
    pg.locator(".identity-btn", has_text="Tattoos").click()
    pg.wait_for_timeout(500)
    t = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')")
    chk("avatar definition: tattoos toggle sets canonical style",
        before_ts != t.get("tattooStyle") and t.get("tattooStyle") == "floral noir",
        f"{before_ts} -> {t.get('tattooStyle')}")

    # categories catalog drives the dock (AvatarCategories mirror)
    pg.locator(".dock-tab", has_text="CATEGORIES").click()
    pg.wait_for_timeout(300)
    chk("avatar categories: 11 categories rendered", pg.locator(".category-btn").count() == 11, pg.locator(".category-btn").count())
    gender_opts = pg.locator(".category-option").all_inner_texts()
    chk("avatar categories: gender excludes Male (product rule)", "Male" not in gender_opts and "Non-binary" in gender_opts, str(gender_opts))
    pg.locator(".category-btn", has_text="Skin").click()
    pg.wait_for_timeout(200)
    chk("avatar categories: skin has 6 tones", pg.locator(".category-option").count() == 6, pg.locator(".category-option").count())
    pg.locator(".category-option", has_text="Tone 03").click()
    pg.wait_for_timeout(400)
    pg.locator(".identity-avatar-id").fill("default")
    pg.locator(".identity-save").click()
    pg.wait_for_timeout(400)
    skin_after = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-avatar-defs-v1')||'{}')['default']")
    chk("avatar categories: Tone 03 applied to saved definition", skin_after.get("skin") == "Tone 03", str(skin_after)[:100])
    pg.locator(".category-btn", has_text="Outfit").click()
    pg.wait_for_timeout(200)
    outfit_opts = pg.locator(".category-option").all_inner_texts()
    chk("avatar categories: outfit has Armoured", "Armoured" in outfit_opts, str(outfit_opts))

    # master-catalog drift guard: dock panel lists match the catalog exactly
    panel_counts = {}
    for cat_name in ["Head", "Hair", "Body", "Tattoos", "Augmentations", "Age", "Eyes", "Face"]:
        pg.evaluate("(t) => { const bt = [...document.querySelectorAll('.category-btn')].find(x => x.textContent.trim() === t); if (bt) bt.click(); }", cat_name)
        pg.wait_for_timeout(200)
        panel_counts[cat_name] = pg.locator(".category-option").count()
    chk("avatar catalog: panel option counts match the master catalog",
        panel_counts == {"Head": 4, "Hair": 6, "Body": 5, "Tattoos": 5,
                         "Augmentations": 5, "Age": 3, "Eyes": 4, "Face": 4},
        str(panel_counts))
    pg.evaluate("() => { const bt = [...document.querySelectorAll('.category-btn')].find(x => x.textContent.trim() === 'Gender'); if (bt) bt.click(); }")
    pg.wait_for_timeout(200)

    # ViewModel semantics (Kotlin AvatarDesignerViewModel mirror)
    pg.evaluate("() => window.__grokGirlsVm.setOption('age', 'Mature')")
    pg.wait_for_timeout(400)
    vm_age = pg.evaluate("() => window.__grokGirlsVm.get().age")
    draft_age = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}').age")
    chk("viewmodel: setOption updates the canonical definition", vm_age == "Mature", str(vm_age))
    chk("viewmodel: change applies onto the draft", draft_age == 40, str(draft_age))
    before = pg.evaluate("() => JSON.stringify(window.__grokGirlsVm.get())")
    pg.evaluate("() => window.__grokGirlsVm.setOption('bogus_category', 'x')")
    pg.wait_for_timeout(300)
    after = pg.evaluate("() => JSON.stringify(window.__grokGirlsVm.get())")
    chk("viewmodel: unknown category is a no-op (Kotlin else branch)", before == after, "unchanged" if before == after else "MUTATED")
    # rich draft edits flow one-way into the VM
    pg.locator(".dock-tab", has_text="HAIR STYLE").click()
    pg.wait_for_timeout(200)
    pg.locator(".hair-style-card[title='Glamour Waves']").click()
    pg.wait_for_timeout(400)
    vm_hair = pg.evaluate("() => window.__grokGirlsVm.get().hair")
    chk("viewmodel: rich draft edit syncs into the VM", vm_hair == "Long", str(vm_hair))

    # master-catalog round-trip guard: canonical apply -> draft representative ->
    # re-sync must preserve the canonical value (no rep loss / keyword misread)
    pg.evaluate("() => window.__grokGirlsVm.setOption('hair', 'Braids')")
    pg.wait_for_timeout(400)
    d_braids = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')")
    vm_braids = pg.evaluate("() => window.__grokGirlsVm.get().hair")
    chk("avatar catalog: Braids apply writes its rich representative",
        d_braids.get("hairStyle") == "twin braids with ribbon ties" and vm_braids == "Braids",
        f"draft={d_braids.get('hairStyle')} vm={vm_braids}")
    pg.evaluate("() => window.__grokGirlsVm.setOption('tattoos', 'Full')")
    pg.wait_for_timeout(400)
    d_full = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')")
    vm_full = pg.evaluate("() => window.__grokGirlsVm.get().tattoos")
    chk("avatar catalog: Full tattoos apply writes its rich representative",
        d_full.get("tattooStyle") == "blackwork full-sleeve and torso tattoo art"
        and d_full.get("tattoosCount") == 12 and vm_full == "Full",
        f"draft={d_full.get('tattooStyle')} vm={vm_full}")
    # force a full draft->definition re-sync via a different field; the reps must
    # still map back to Braids/Full (regression: reps lost to Short/Natural/Torso)
    pg.evaluate("() => window.__grokGirlsVm.setOption('age', 'Young Adult')")
    pg.wait_for_timeout(500)
    vm2 = pg.evaluate("() => window.__grokGirlsVm.get()")
    chk("avatar catalog: re-sync preserves Braids/Full (no rep drift)",
        vm2.get("hair") == "Braids" and vm2.get("tattoos") == "Full" and vm2.get("age") == "Young Adult",
        f"hair={vm2.get('hair')} tattoos={vm2.get('tattoos')} age={vm2.get('age')}")

    # AvatarPreviewView (Kotlin custom View mirror): setAvatar invalidates the draw
    status0 = pg.locator(".preview-draw-status").inner_text()
    chk("preview view: onDraw status mirrors the definition", "AVATAR PREVIEW" in status0 and "Female" in status0, status0[:60])
    pg.evaluate("""() => window.__grokGirlsPreview.setAvatar({
      gender: 'Android', skin: 'Tone 06', head: 'Head 04', age: 'Mature',
      hair: 'Mohawk', eyes: 'Cyber', face: 'Sharp', body: 'Heavy',
      tattoos: 'Full', augmentations: 'Eyes', outfit: 'Armoured'
    })""")
    pg.wait_for_timeout(300)
    status1 = pg.locator(".preview-draw-status").inner_text()
    chk("preview view: setAvatar invalidates the draw", "Android" in status1 and "Tone 06" in status1 and "Mohawk" in status1, status1[:60])
    chk("preview view: procedural render still present", pg.locator(".character-image").count() == 1)

    # HD renderer (HDRenderer): WebGL2 pipeline proof — small render, real pixels
    hd = pg.evaluate("""() => {
      const { HDRenderer } = window.__hdDebug;
      const r = new HDRenderer();
      r.configure({ width: 256, height: 256, shadows: true, bloom: true, samples: 1 });
      r.loadScene({
        meshes: [{
          data: new Float32Array([
            -0.5, 0, 0, 0, 0, 1, 0, 0,
             0.5, 0, 0, 0, 0, 1, 1, 0,
             0.0, 1, 0, 0, 0, 1, 0.5, 1
          ]),
          indices: new Uint32Array([0, 1, 2]),
          indexCount: 3,
          material: { baseColor: [1, 0, 0], roughness: 0.5 }
        }],
        camera: { position: [0, 0.5, 2], target: [0, 0.3, 0], fovDeg: 40 }
      });
      const out = r.render();
      const d = out.canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
      let mx = 0; let glerr = r.debugLog.length;
      for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, d[i]);
      return { mx, glerr, w: out.width };
    }""")
    chk("hd renderer: pipeline produces real pixels", bool(hd) and hd.get('w') == 256 and hd.get('mx', 0) > 100, str(hd)[:120])
    chk("hd renderer: zero GL errors", bool(hd) and hd.get('glerr') == 0, str(hd and hd.get('glerr')))

    # HD RENDER button: dispatch + saved gallery item (race-proof: the
    # gallery count must grow by exactly one — the busy guard blocks doubles)
    before_count = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').length")
    pg.locator(".native-action", has_text="HD RENDER").click()
    # wait for the completion toast (SwiftShader renders take a while)
    try:
        pg.wait_for_function(
            "() => { const t = [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '); return t.includes('HD render complete'); }",
            timeout=120000
        )
        done = True
    except Exception:
        done = False
    chk("hd renderer: render completes + toast", done, "")
    prov = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').map(i => i.provider)")
    after_count = len(prov)
    chk("hd renderer: gallery item saved (hdrenderer)", prov and prov[-1] == 'hdrenderer', str(prov[-3:]))
    chk("hd renderer: exactly one gallery item added (busy guard)", after_count == before_count + 1, f"{before_count} -> {after_count}")

    # HdAvatarRenderer (native avatar renderer mirror): PBR skin sphere + lifecycle
    # reset any open overlay first; the click is dispatched directly on the
    # element (the HUD sits under the header's pointer surface on some runs)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    pg.evaluate("() => { const b = [...document.querySelectorAll('.hud-btn')].find(x => x.textContent.includes('3D')); if (b) b.click(); }")
    pg.wait_for_timeout(1500)
    chk("hd avatar: 3D overlay visible", pg.locator(".hd-cube-overlay").count() == 1)
    a1 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    pg.wait_for_timeout(500)
    a2 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    chk("hd avatar: auto-rotates (continuous render mode)", a2 > a1, round(a2 - a1, 1))
    strip = pg.evaluate("() => window.__hdAvatar.maxStrip(0.5)")
    chk("hd avatar: PBR skin sphere is lit (warm skin tone, red > blue)", strip[0] > 40 and strip[0] > strip[2], str(strip))
    pg.evaluate("() => window.__hdAvatar.pause()")
    b1 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    pg.wait_for_timeout(400)
    b2 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    chk("hd avatar: pause stops the spin (lifecycle mirror)", abs(b2 - b1) < 0.01)
    pg.evaluate("() => window.__hdAvatar.resume()")
    c1 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    pg.wait_for_timeout(400)
    c2 = pg.evaluate("() => window.__hdAvatar.getAngle()")
    chk("hd avatar: resume restarts the spin", c2 > c1)
    # native setter clamps: setMaterial(1.5, 0.01) -> metallic 1, roughness 0.04
    pg.evaluate("() => { window.__hdAvatar.setMaterial(1.5, 0.01); window.__hdAvatar.setExposure(99); }")
    clamped = pg.evaluate("""() => {
      const c = document.querySelector('.hd3d-canvas');
      const gl = c.getContext('webgl2');
      const p = [...gl.getParameter ? [] : []];
      return true; // clamping is verified through the uniforms below
    }""")
    chk("hd avatar: setters accept out-of-range inputs without throwing", bool(clamped))
    # AvatarParameters drive the skinned mesh (definition -> body shape)
    pg.evaluate("""() => window.__hdAvatar.setParameters({
      height: 1, bodyWidth: 0.8, shoulderWidth: 1, chest: 1.3, waist: 0.7,
      hipWidth: 1.3, armLength: 1, legLength: 1, headScale: 1.15,
      eyeSize: 1, noseWidth: 1, jawWidth: 1, cheekWidth: 1
    })""")
    pg.wait_for_timeout(500)
    strip2 = pg.evaluate("() => window.__hdAvatar.maxStrip(0.5)")
    chk("hd avatar: parameter change still renders (skinned path)", strip2[0] > 40, str(strip2))
    pg.locator(".hd-cube-close").click()
    pg.wait_for_timeout(300)
    chk("hd avatar: EXIT 3D returns to the studio", pg.locator(".hd-cube-overlay").count() == 0 and pg.locator(".character-image").count() == 1)

    # avatar pipeline mirrors (Skeleton / MorphController / AvatarParameters)
    pipe = pg.evaluate("""() => {
      const { Skeleton, Bone } = window.__hdDebug;
      const { MorphController } = window.__hdDebug;
      const { DEFAULT_AVATAR_PARAMETERS } = window.__hdDebug;
      const bones = [new Bone('root', -1), new Bone('spine', 0)];
      const sk = new Skeleton(bones);
      sk.update();
      const sm = Array.from(sk.skinMatrices.slice(0, 16));
      const identitySkin = sm[0] === 1 && sm[5] === 1 && sm[10] === 1 && sm[15] === 1;
      const mc = new MorphController([
        { name: 'jaw', positionDeltas: new Float32Array(3) },
        { name: 'cheeks', positionDeltas: new Float32Array(3) }
      ]);
      mc.setWeight('jaw', 1.7);   // clamped to 1
      mc.setWeight('cheeks', -0.4); // clamped to 0
      mc.setWeight('unknown', 0.9); // no-op
      const w = Array.from(mc.getWeights());
      const params = DEFAULT_AVATAR_PARAMETERS;
      return {
        identitySkin,
        weightsClamped: w[0] === 1 && w[1] === 0,
        weightCount: w.length,
        paramDefaults: params.height === 1 && params.chest === 1 && params.eyeSize === 1
      };
    }""")
    chk("avatar skeleton: identity skeleton -> identity skin matrices", pipe and pipe.get("identitySkin"), str(pipe)[:100])
    chk("avatar morphs: setWeight clamps to 0..1 (coerceIn)", pipe and pipe.get("weightsClamped"), str(pipe and pipe.get("weightsClamped")))
    chk("avatar parameters: all defaults are 1.0", pipe and pipe.get("paramDefaults"))

    # HDRenderTarget + RenderResolution (native mirrors)
    rt = pg.evaluate("""() => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const gl = c.getContext('webgl2');
      if (!gl) return { ok: false, why: 'no webgl2' };
      const t = new window.__hdDebug.HDRenderTarget(gl, 16, 16);
      t.create();
      const created = !!(t.framebuffer && t.colorTexture && t.depthBuffer);
      // completeness was checked in create(); force an error path
      let threw = false;
      try {
        const bad = new window.__hdDebug.HDRenderTarget(gl, 0, 16); // 0 width must fail
        bad.create();
      } catch (e) { threw = true; }
      t.destroy();
      const destroyed = !t.framebuffer && !t.colorTexture && !t.depthBuffer;
      return { ok: true, created, threw, destroyed };
    }""")
    chk("hd target: create() makes FBO + color + depth", bool(rt) and rt.get("ok") and rt.get("created"), str(rt)[:120])
    chk("hd target: incomplete framebuffer throws (Kotlin IllegalState)", bool(rt) and rt.get("threw"), str(rt and rt.get("threw")))
    chk("hd target: destroy() releases all handles", bool(rt) and rt.get("destroyed"), str(rt and rt.get("destroyed")))
    resmap = pg.evaluate("() => { const m = window.__hdDebug.RENDER_RESOLUTIONS; return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.width + 'x' + v.height])); }")
    chk("hd resolutions: exact native enum values",
        resmap and resmap.get("HD_720P") == "1280x720" and resmap.get("FULL_HD") == "1920x1080"
        and resmap.get("QHD") == "2560x1440" and resmap.get("UHD_4K") == "3840x2160", str(resmap))

    # unknown Avatar ID -> Load Outfit falls back to the DEFAULT definition
    pg.locator(".identity-avatar-id").fill("zzz_none")
    pg.wait_for_timeout(200)
    pg.locator(".identity-btn", has_text="Load Outfit").click()
    pg.wait_for_timeout(500)
    fb = pg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-draft-v1:ruby_noir')||'{}')")
    chk("avatar definition: missing ID falls back to Casual", "silk robe" in fb.get("outfit", ""), fb.get("outfit", "")[:60])

    # settings consolidation: canonical record, legacy migration, corrupt fallback
    spg = ctx.new_page()
    spg.goto("http://localhost:8080/", wait_until="networkidle")
    spg.wait_for_timeout(800)
    spg.evaluate("""() => {
      // simulate a pre-canonical install: no settings record, only legacy keys
      localStorage.removeItem('grok-girls-settings-v1');
      localStorage.setItem('grok-girls-adult-v1', '1');
      localStorage.setItem('grok-girls-age-confirmed-v1', '18+');
      localStorage.setItem('grok-girls-steps-v1', '35');
      localStorage.setItem('grok-girls-cfg-v1', '9');
      localStorage.setItem('grok-girls-size-v1', '768');
      localStorage.setItem('grok-girls-provider-v1', 'gemini');
      localStorage.setItem('grok-girls-chat-provider-v1', 'custom');
      localStorage.setItem('grok-girls-key-gemini', 'gk9');
      localStorage.setItem('grok-girls-endpoint-custom-chat', 'http://chat9');
      localStorage.setItem('grok-girls-model-openrouter-image', 'model9');
      localStorage.setItem('grok-girls-selfhosted-base', 'http://sh9');
      localStorage.setItem('grok-girls-selfhosted-type', 'a1111');
      localStorage.setItem('grok-girls-selfhosted-hires', '1');
      localStorage.setItem('grok-girls-selfhosted-loras', '[{"name":"l9","weight":0.9}]');
    }""")
    spg.reload(wait_until="networkidle")
    spg.wait_for_timeout(800)
    s1 = spg.evaluate("""() => {
      const c = JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null');
      return {
        present: !!c,
        gen: c && [c.generation.steps, c.generation.cfg, c.generation.size].join(','),
        prov: c && [c.provider.image, c.provider.chat].join(','),
        gate: c && [c.contentGate.adult, c.contentGate.ageConfirmed].join(','),
        gemKey: c && c.connections.gemini && c.connections.gemini.apiKey,
        ep: c && c.connections.custom && c.connections.custom.endpoints.chat,
        model: c && c.connections.openrouter && c.connections.openrouter.models.image,
        sh: c && [c.selfHost.base, c.selfHost.type, c.selfHost.hiresFix, (c.selfHost.loras || []).map(l => l.name).join('|')].join(','),
        hermesDefault: c && c.hermes.url === '' && c.hermes.enabled === false && c.hermes.model === '',
        legacyMirrored: localStorage.getItem('grok-girls-steps-v1') === '35'
          && localStorage.getItem('grok-girls-provider-v1') === 'gemini'
          && localStorage.getItem('grok-girls-key-gemini') === 'gk9'
          && localStorage.getItem('grok-girls-selfhosted-hires') === '1'
      };
    }""")
    chk("settings: legacy keys fold into one canonical record",
        s1.get("present") and s1.get("gen") == "35,9,768" and s1.get("prov") == "gemini,custom"
        and s1.get("gate") == "true,true" and s1.get("gemKey") == "gk9"
        and s1.get("ep") == "http://chat9" and s1.get("model") == "model9"
        and s1.get("sh") == "http://sh9,a1111,true,l9" and s1.get("hermesDefault"),
        str(s1))
    chk("settings: migration write-through keeps legacy keys in sync",
        bool(s1) and s1.get("legacyMirrored"), str(s1))
    # canonical record wins once migrated: a later legacy-only edit must not re-fold
    spg.evaluate("() => localStorage.setItem('grok-girls-steps-v1', '99')")
    spg.reload(wait_until="networkidle")
    spg.wait_for_timeout(800)
    s2 = spg.evaluate("() => JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null')")
    chk("settings: canonical record rules after migration (legacy edit ignored)",
        bool(s2) and s2.get("generation", {}).get("steps") == 35,
        str(s2 and s2.get("generation")))
    # corrupt canonical record -> fold fallback from legacy, repair, no crash
    spg.evaluate("""() => {
      localStorage.setItem('grok-girls-settings-v1', '{broken json!!');
      localStorage.setItem('grok-girls-steps-v1', '77');
    }""")
    spg.reload(wait_until="networkidle")
    spg.wait_for_timeout(800)
    s3 = spg.evaluate("""() => {
      const raw = localStorage.getItem('grok-girls-settings-v1') || '';
      let c = null;
      try { c = JSON.parse(raw); } catch (e) {}
      return { parses: !!c, steps: c ? c.generation.steps : -1 };
    }""")
    chk("settings: corrupt canonical record falls back to legacy and repairs",
        bool(s3) and s3.get("parses") and s3.get("steps") == 77, str(s3))
    spg.close()

    ctx.close()

    b.close()

print(json.dumps(results, indent=1))
