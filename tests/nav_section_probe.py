"""Probe the four nav entries the sweep flagged as 'no observable change'.

openSection() is idempotent (sets the section to true, never toggles), so a
click on an ALREADY-OPEN section is correctly a no-op. This proves each entry
really works by first collapsing the target section, then clicking the nav
button and asserting the section actually opened.
"""

import json
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8147
rows = []


def chk(n, ok, d=""):
    rows.append([n, bool(ok), str(d)[:200]])


def serve():
    p = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1",
         "--directory", os.path.join(ROOT, "dist")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        try:
            socket.create_connection(("127.0.0.1", PORT), 0.4).close()
            return p
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("no server")


# nav label -> accordion trigger text that must become expanded
TARGETS = [
    ("Eyes", "EYES"),
    ("Accessories", "CLOTHING"),
    # 'Hair' routes to the STYLE dock tab (setDockTab('style')), not the
    # accordion -- see App.tsx case 'hair'. Probe the dock tab instead.
    ("Hair", "@dock:style"),
    ("Builder", None),   # Builder just switches the view
]


def main():
    srv = None
    try:
        srv = serve()
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"])
            pg = b.new_page(viewport={"width": 1400, "height": 950})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
            pg.goto(f"http://127.0.0.1:{PORT}/", wait_until="load")
            pg.wait_for_timeout(2500)
            pg.evaluate(
                """() => { const b=[...document.querySelectorAll('button')]
                    .find(x=>/enter|18|agree|confirm/i.test(x.textContent||''));
                    if(b) b.click(); }""")
            pg.wait_for_timeout(800)

            for label, section in TARGETS:
                if section == "@dock:style":
                    # Move to a different dock tab first so the click has work to do.
                    pg.evaluate(
                        """() => { const t=[...document.querySelectorAll('.dock-tab,[class*=dock-tab]')]
                             .find(x=>/color/i.test(x.textContent||'')); if(t) t.click(); }""")
                    pg.wait_for_timeout(400)
                    before = pg.evaluate(
                        "() => (document.querySelector('.dock-tab.active,[class*=dock-tab][class*=active]')||{}).textContent || ''")
                    clicked = pg.evaluate(
                        """(l) => { const b=[...document.querySelectorAll('.rail-btn,[data-view],.nav-btn')]
                             .find(x=>(x.textContent||'').includes(l));
                             if(!b) return false; b.click(); return true; }""", label)
                    pg.wait_for_timeout(700)
                    after = pg.evaluate(
                        "() => (document.querySelector('.dock-tab.active,[class*=dock-tab][class*=active]')||{}).textContent || ''")
                    styled = pg.evaluate(
                        "() => /style/i.test((document.querySelector('.dock-tab.active,[class*=dock-tab][class*=active]')||{}).textContent||'')")
                    chk(f"NAV '{label}' switches the dock to the STYLE tab",
                        clicked and styled, f"before={before!r} after={after!r}")
                    continue
                if section:
                    # Collapse every accordion so the target is definitely closed.
                    pg.evaluate(
                        """() => [...document.querySelectorAll('.accordion-trigger')]
                             .forEach(t => { const w = t.parentElement;
                               if (w && w.querySelector('.accordion-body,.accordion-content'))
                                 t.click(); })""")
                    pg.wait_for_timeout(400)
                    closed = pg.evaluate(
                        """(s) => { const t=[...document.querySelectorAll('.accordion-trigger')]
                             .find(x=>(x.textContent||'').toUpperCase().includes(s));
                             if(!t) return 'missing';
                             const w=t.parentElement;
                             return !!(w && w.querySelector('.accordion-body,.accordion-content')); }""",
                        section)
                else:
                    # Navigate away so 'Builder' has something to change.
                    pg.evaluate(
                        """() => { const b=[...document.querySelectorAll('.rail-btn')]
                             .find(x=>/Gallery/i.test(x.textContent||'')); if(b) b.click(); }""")
                    pg.wait_for_timeout(500)
                    closed = pg.evaluate(
                        "() => (document.body.innerText||'').slice(0,600)")

                clicked = pg.evaluate(
                    """(l) => { const b=[...document.querySelectorAll('.rail-btn,[data-view],.nav-btn')]
                         .find(x=>(x.textContent||'').includes(l));
                         if(!b) return false; b.click(); return true; }""", label)
                pg.wait_for_timeout(700)

                if section:
                    now_open = pg.evaluate(
                        """(s) => { const t=[...document.querySelectorAll('.accordion-trigger')]
                             .find(x=>(x.textContent||'').toUpperCase().includes(s));
                             if(!t) return 'missing';
                             const w=t.parentElement;
                             return !!(w && w.querySelector('.accordion-body,.accordion-content')); }""",
                        section)
                    chk(f"NAV '{label}' opens the {section} section from a collapsed state",
                        clicked and now_open is True,
                        f"clicked={clicked} before={closed} after={now_open}")
                else:
                    # 'Builder' is the 💀 rail entry; its label text also appears
                    # in the help modal, so matching by text is unreliable.
                    # Match the icon and assert the rail entry becomes active,
                    # which is exactly what railActive('appearance') encodes.
                    pg.evaluate(
                        """() => { const b=[...document.querySelectorAll('.rail-btn')]
                             .find(x=>(x.textContent||'').includes('\U0001F5BC')); if(b) b.click(); }""")
                    pg.wait_for_timeout(700)
                    gallery = pg.evaluate(
                        """() => [...document.querySelectorAll('.rail-btn')]
                             .filter(b=>/\\bactive\\b/.test(b.className))
                             .map(b=>b.textContent.trim())""")
                    pg.evaluate(
                        """() => { const b=[...document.querySelectorAll('.rail-btn')]
                             .find(x=>(x.textContent||'').includes('\U0001F480')); if(b) b.click(); }""")
                    pg.wait_for_timeout(700)
                    builder = pg.evaluate(
                        """() => [...document.querySelectorAll('.rail-btn')]
                             .filter(b=>/\\bactive\\b/.test(b.className))
                             .map(b=>b.textContent.trim())""")
                    ok = (any('Gallery' in x for x in gallery)
                          and any('Builder' in x for x in builder))
                    chk(f"NAV '{label}' round-trips Gallery -> Builder",
                        ok, f"gallery={gallery} builder={builder}")

            chk("no page errors during the probe", not errs, errs[:2])
            b.close()
    except Exception as e:
        chk("probe completed", False, f"{type(e).__name__}: {e}")
    finally:
        if srv:
            srv.terminate()
    print(json.dumps(rows, indent=1))
    sys.exit(0 if all(r[1] for r in rows) else 1)


if __name__ == "__main__":
    main()
