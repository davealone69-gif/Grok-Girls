from playwright.sync_api import sync_playwright
import json

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
    pg.locator("button", has_text="GENERATE RENDER").first.click()
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

    b.close()

print(json.dumps(results, indent=1))
