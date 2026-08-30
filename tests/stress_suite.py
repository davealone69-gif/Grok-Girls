from playwright.sync_api import sync_playwright
import os
AXE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'node_modules', 'axe-core', 'axe.min.js')
import json, time

out = {}
def rec(section, name, value, detail=""):
    out.setdefault(section, []).append({"name": name, "value": value, "detail": str(detail)[:160]})

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A1: load timing ----------
    for label, vp in [("desktop", (1280, 900)), ("phone", (393, 851))]:
        pg = b.new_page(viewport={"width": vp[0], "height": vp[1]})
        t0 = time.time()
        pg.goto("http://localhost:8080/", wait_until="load")
        t_load = time.time() - t0
        pg.wait_for_selector(".character-image", timeout=10000)
        t_img = time.time() - t0
        nav = pg.evaluate("JSON.stringify(performance.getEntriesByType('navigation').map(n=>({dcl:n.domContentLoadedEventEnd, l:n.loadEventEnd})))")
        rec("perf", f"{label} load event", round(t_load, 2), "s")
        rec("perf", f"{label} viewport img ready", round(t_img, 2), "s")
        rec("perf", f"{label} nav timing", nav)
        pg.close()

    # ---------- A2: 30 sequential local renders (heap + storage growth) ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    heap0 = pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize : 0")
    t0 = time.time()
    for i in range(30):
        pg.locator("button", has_text="GENERATE RENDER").first.click()
        pg.wait_for_timeout(420)
    t30 = time.time() - t0
    heap1 = pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize : 0")
    g = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').length")
    ls_size = pg.evaluate("JSON.stringify(localStorage).length")
    rec("perf", "30 renders total time", round(t30, 2), "s")
    rec("perf", "30 renders heap growth", f"{(heap1-heap0)/1048576:.1f}", "MB")
    rec("perf", "gallery items after 30", g)
    rec("perf", "localStorage used after 30", f"{ls_size/1048576:.2f}", "MB")
    pg.close()

    # ---------- A3: 100 chat messages ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(300)
    t0 = time.time()
    for i in range(100):
        pg.locator(".companion-input").fill(f"message number {i}")
        pg.locator(".btn-send-chat").click()
        pg.wait_for_timeout(60)
    t100 = time.time() - t0
    bubbles = pg.locator(".chat-bubble").count()
    rec("perf", "100 chat round-trips", round(t100, 2), "s")
    rec("perf", "chat bubbles rendered", bubbles)
    pg.close()

    # ---------- A4: 200-item gallery render ----------
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.evaluate("""
      () => {
        const items = [];
        for (let i = 0; i < 200; i++) {
          items.push({ id: 'stress-' + i, avatarId: 'ruby_noir', mode: 'image', prompt: 'p' + i,
            assetUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23333"/></svg>'),
            provider: 'local', createdAt: Date.now() - i, favorite: i % 5 === 0 });
        }
        localStorage.setItem('grok-girls-gallery-v1', JSON.stringify(items));
      }
    """)
    pg.reload(wait_until="networkidle")
    t0 = time.time()
    pg.locator(".rail-btn[title='Generation Archive']").click()
    pg.wait_for_selector(".gallery-card", timeout=10000)
    t_grid = time.time() - t0
    cards = pg.locator(".gallery-card").count()
    rec("perf", "200-item gallery grid time", round(t_grid, 2), "s")
    rec("perf", "gallery cards rendered", cards)
    # lightbox open/close
    pg.locator(".gallery-card").first.click()
    pg.wait_for_timeout(300)
    lb = pg.locator(".lightbox-frame").count()
    pg.locator(".lightbox-backdrop").click(position={"x": 5, "y": 5})
    pg.wait_for_timeout(200)
    rec("perf", "lightbox opens with 200 items", lb == 1)
    pg.evaluate("localStorage.removeItem('grok-girls-gallery-v1')")
    pg.close()

    # ---------- A5: main-thread jank during color wheel drag ----------
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.locator("button.dock-tab", has_text="HAIR COLOR").first.click()
    pg.wait_for_timeout(300)
    wheel = pg.locator("canvas").first.bounding_box()
    if wheel:
        cx, cy = wheel["x"] + wheel["width"]/2, wheel["y"] + wheel["height"]/2
        pg.mouse.move(cx, cy)
        pg.mouse.down()
        gaps = pg.evaluate("""
          () => new Promise(res => {
            const gaps = [];
            let last = performance.now();
            // measure only while the pointer is down (live preview renders
            // on release by design — that one-time commit is not 'jank')
            const stop = () => res(gaps);
            window.addEventListener('pointerup', stop, { once: true });
            const tick = t => {
              if (!window.__dragging) return res(gaps);
              gaps.push(t - last); last = t;
              if (gaps.length < 60) requestAnimationFrame(tick); else res(gaps);
            };
            window.__dragging = true;
            requestAnimationFrame(tick);
          })
        """)
        for i in range(40):
            pg.mouse.move(cx + 60 * (1 if i % 2 else -1), cy + 40 * (1 if i % 4 else -1))
            pg.wait_for_timeout(16)
        pg.mouse.up()
        max_gap = max(gaps)
        rec("perf", "max rAF frame gap during drag", f"{max_gap:.0f}", "ms")
    pg.close()

    # ---------- B1: double-click GENERATE guard ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    # synchronous double-dispatch: both handlers run in the same task — the
    # exact race the busyRef guard must close (button also disables on busy)
    pg.locator("button", has_text="GENERATE RENDER").first.evaluate("el => { el.click(); el.click(); }")
    pg.wait_for_timeout(1200)
    g = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').length")
    rec("concurrency", "double-click -> gallery items", g, "expect 1")
    pg.close()

    # ---------- B2: provider switch mid-flight (slow mock on 7861) ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.evaluate("""
      () => {
        localStorage.setItem('grok-girls-selfhosted-base', 'http://localhost:7861');
        localStorage.setItem('grok-girls-selfhosted-type', 'a1111');
        localStorage.setItem('grok-girls-provider-v1', 'selfhosted');
      }
    """)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.locator("button", has_text="GENERATE RENDER").first.click()
    pg.wait_for_timeout(700)  # render in flight (5s mock)
    pg.locator(".footer-provider-select").select_option("local")
    pg.wait_for_timeout(1200)
    crashed = pg.locator(".app-container").count() == 0
    g = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').length")
    busy = pg.locator(".btn-generate-media").inner_text()
    rec("concurrency", "mid-flight engine switch: no crash", not crashed)
    rec("concurrency", "mid-flight gallery items", g)
    rec("concurrency", "mid-flight button state", busy)
    pg.wait_for_timeout(4500)  # let the slow render land
    g2 = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').length")
    rec("concurrency", "slow render lands after switch", g2)
    pg.close()

    # ---------- B3: corrupted localStorage recovery ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.evaluate("localStorage.setItem('grok-girls-state-v2', '{{{{not json')")
    pg.evaluate("localStorage.setItem('grok-girls-gallery-v1', '[broken')")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(500)
    booted = pg.locator(".app-container").count() == 1
    girl_ok = pg.locator(".preset-card").count() >= 1
    rec("stability", "boot with corrupted persona store", booted)
    rec("stability", "seed fallback after corruption", girl_ok)
    pg.close()

    # ---------- B4: persistence matrix after reload ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(200)
    pg.locator(".companion-input").fill("persist me")
    pg.locator(".btn-send-chat").click()
    pg.wait_for_timeout(400)
    pg.locator(".rail-btn[title='Preset Identities']").click()
    pg.wait_for_timeout(300)
    pg.locator(".persona-name-input, .name-input").first.fill("Persist Test")
    pg.locator("button", has_text="SAVE AVATAR").first.click()
    pg.wait_for_timeout(300)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(500)
    chat = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-chat-v1:ruby_noir')||'[]').length")
    name = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-state-v2')||'[]')[0].name")
    rec("stability", "chat survives reload", chat >= 2, chat)
    rec("stability", "persona rename survives reload", name, name)
    pg.close()

    # ---------- B5: IndexedDB migration (legacy base64 -> assetKey) ----------
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    png1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    pg.evaluate("""(d) => {
      localStorage.setItem('grok-girls-gallery-v1', JSON.stringify([{
        id: 'mig_1', avatarId: 'ruby_noir', mode: 'image', prompt: 'legacy',
        assetUrl: d, provider: 'local', createdAt: Date.now(), favorite: false
      }]));
      let girls = [];
      try { girls = JSON.parse(localStorage.getItem('grok-girls-state-v2') || '[]'); } catch (e) {}
      const g = girls.find(x => x.id === 'ruby_noir') || { id: 'ruby_noir', name: 'Ruby' };
      g.previewUrl = d; g.thumbnailUrl = d;
      localStorage.setItem('grok-girls-state-v2', JSON.stringify([g, ...girls.filter(x => x.id !== 'ruby_noir')]));
    }""", png1)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1500)  # async hydration + migration
    gitem = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-gallery-v1')||'[]').find(x => x.id === 'mig_1') || {}")
    girl = pg.evaluate("JSON.parse(localStorage.getItem('grok-girls-state-v2')||'[]').find(x => x.id === 'ruby_noir') || {}")
    idb = pg.evaluate("""() => new Promise(res => {
      const rq = indexedDB.open('grok-girls-assets');
      rq.onsuccess = () => {
        const db = rq.result;
        const t = db.transaction('images', 'readonly');
        const c = t.objectStore('images').count();
        c.onsuccess = () => res(c.result);
        c.onerror = () => res(-1);
      };
      rq.onerror = () => res(-2);
    })""")
    rec("migration", "gallery item migrated to assetKey", bool(gitem.get("assetKey")), json.dumps(gitem)[:140])
    rec("migration", "gallery localStorage has no data URL", not (gitem.get("assetUrl") or "").startswith("data:"), (gitem.get("assetUrl") or "none")[:40])
    rec("migration", "persona photo migrated to previewAssetKey", bool(girl.get("previewAssetKey")), json.dumps(girl)[:140])
    rec("migration", "persona localStorage has no data URL", not (girl.get("previewUrl") or "").startswith("data:"), (girl.get("previewUrl") or "none")[:40])
    rec("migration", "IndexedDB image records", idb, "expect >= 3")
    pg.close()

    # ---------- C: accessibility (axe-core) ----------
    for label, vp, extra in [("desktop", (1280, 900), None), ("phone", (393, 851), None)]:
        pg = b.new_page(viewport={"width": vp[0], "height": vp[1]})
        pg.goto("http://localhost:8080/", wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.add_script_tag(path=AXE)
        r = pg.evaluate("""async () => {
          const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } });
          return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
        }""")
        rec("a11y", f"{label} axe violations", json.dumps(r)[:400])
        pg.close()
    # chat overlay a11y
    pg = b.new_page(viewport={"width": 393, "height": 851})
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.locator(".rail-btn[title='Interactive Dialogue']").click()
    pg.wait_for_timeout(300)
    pg.add_script_tag(path=AXE)
    r = pg.evaluate("""async () => {
      const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } });
      return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    }""")
    rec("a11y", "chat overlay axe violations", json.dumps(r)[:300])
    # manual: alt text, button names
    missing_alt = pg.evaluate("Array.from(document.images).filter(i => !i.alt).length")
    unnamed_btns = pg.evaluate("Array.from(document.querySelectorAll('button')).filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).length")
    rec("a11y", "images without alt", missing_alt)
    rec("a11y", "buttons without accessible name", unnamed_btns)
    pg.close()

    b.close()

print(json.dumps(out, indent=1))
