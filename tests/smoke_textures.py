#!/usr/bin/env python3
"""Smoke test: 3D avatar viewport with procedural skin texture maps."""
import os
import sys
from playwright.sync_api import sync_playwright

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))

    page.goto("http://127.0.0.1:8080", wait_until="networkidle", timeout=60000)

    # enable the 3D viewport like the audit suite does
    page.evaluate("() => { const b = [...document.querySelectorAll('.hud-btn')].find(x => x.textContent.includes('3D')); if (b) b.click(); }")
    page.wait_for_timeout(2500)

    overlay = page.locator(".hd-cube-overlay").count()
    print(f"overlay: {overlay}")

    a1 = page.evaluate("() => window.__hdAvatar.getAngle()")
    page.wait_for_timeout(600)
    a2 = page.evaluate("() => window.__hdAvatar.getAngle()")
    print(f"auto-rotate: {a1} -> {a2} ({(a2 - a1):.1f} deg)")

    strip = page.evaluate("() => window.__hdAvatar.maxStrip(0.5)")
    print(f"maxStrip(0.5): {strip}")

    center = page.evaluate("() => window.__hdAvatar.readCenterPixel()")
    print(f"center pixel: {center}")

    # Write artefacts to artifacts/ (gitignored), not the repo root, and never
    # to a hardcoded absolute path — this file ran on someone else's machine too.
    shot_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "artifacts")
    os.makedirs(shot_dir, exist_ok=True)
    page.screenshot(
        path=os.path.join(shot_dir, "web_avatar_textured.png"),
        clip={"x": 0, "y": 0, "width": 1280, "height": 900},
    )
    browser.close()

gl_errors = [e for e in errors if "shader" in e.lower() or "gl" in e.lower() or "webgl" in e.lower()]
print(f"console messages: {len(errors)}, GL/shader-related: {len(gl_errors)}")
for e in gl_errors[:6]:
    print("  GL:", e[:160])
if len(errors) > len(gl_errors):
    print("non-GL console messages:")
    for e in errors:
        if "shader" not in e.lower() and "webgl" not in e.lower():
            print("  ", e[:160])
