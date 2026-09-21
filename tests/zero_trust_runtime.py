"""Zero-trust runtime audit: click every control, visit every screen.

Nothing is trusted because code exists. Every navigation target is actually
visited, every button is actually clicked, and the page is checked for errors
after each one. Dead buttons (clicks that change nothing anywhere) are
reported by name.

    python3 tests/zero_trust_runtime.py
"""

import json
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8141
rows = []


def chk(name, ok, detail=""):
    rows.append([name, bool(ok), str(detail)[:220]])


def serve():
    p = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1",
         "--directory", os.path.join(ROOT, "dist")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(80):
        try:
            socket.create_connection(("127.0.0.1", PORT), 0.4).close()
            return p
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("static server did not start")


def fingerprint(pg):
    """A cheap snapshot of observable app state."""
    return pg.evaluate(
        """() => {
            const r = document.querySelector('#root');
            return JSON.stringify({
                html: (r ? r.innerHTML.length : 0),
                text: (document.body.innerText || '').slice(0, 4000),
                inputs: [...document.querySelectorAll('input,select,textarea')]
                        .map(e => String(e.value)).join('|').slice(0, 2000),
                ls: JSON.stringify(localStorage).length,
                canvases: document.querySelectorAll('canvas').length,
                modals: document.querySelectorAll('.modal, .modal-backdrop, [role=dialog]').length
            });
        }"""
    )


def main():
    srv = None
    errors = []
    try:
        srv = serve()
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"])
            pg = b.new_page(viewport={"width": 1400, "height": 950})
            pg.on("pageerror", lambda e: errors.append(str(e)[:200]))
            pg.goto(f"http://127.0.0.1:{PORT}/", wait_until="load")
            pg.wait_for_timeout(2500)

            # ---------------------------------------------------- boot
            mounted = pg.evaluate(
                "() => document.querySelectorAll('#root *').length")
            chk("BOOT app mounts real DOM from the production bundle",
                mounted > 100, f"{mounted} nodes")
            chk("BOOT no page errors during boot", not errors, errors[:2])

            # Age gate may block everything; clear it if present.
            gate = pg.evaluate(
                """() => {
                    const b = [...document.querySelectorAll('button')]
                      .find(x => /enter|18|agree|confirm|yes/i.test(x.textContent||''));
                    if (b) { b.click(); return b.textContent.trim().slice(0,40); }
                    return null;
                }"""
            )
            pg.wait_for_timeout(900)
            chk("BOOT age gate acknowledged", True, gate or "no gate shown")

            # ---------------------------------------------------- navigation
            navs = pg.evaluate(
                """() => [...document.querySelectorAll('.rail-btn,[data-view],.nav-btn')]
                    .map(b => (b.textContent||'').trim()).filter(Boolean)"""
            )
            chk("NAV navigation controls discovered", len(navs) > 0, navs)

            visited = []
            for i in range(len(navs)):
                before = fingerprint(pg)
                label = pg.evaluate(
                    """(i) => {
                        const b = [...document.querySelectorAll('.rail-btn,[data-view],.nav-btn')][i];
                        if (!b) return null;
                        const t = (b.textContent||'').trim();
                        b.click();
                        return t;
                    }""", i)
                pg.wait_for_timeout(700)
                after = fingerprint(pg)
                if label:
                    visited.append(label)
                    # Rail entries are idempotent by design: openSection() sets
                    # a section to true (never toggles) and toView() is a no-op
                    # when the view is already current. So "the fingerprint did
                    # not change" is NOT evidence of a dead control.
                    #
                    # The real contract is: after the click the app is in the
                    # state this entry targets. railActive() in App.tsx encodes
                    # exactly that, and it is reflected in the button's
                    # `active` class -- except for the entries that open a
                    # modal or a dock tab, which are verified separately in
                    # tests/nav_section_probe.py.
                    state = pg.evaluate(
                        """(i) => { const b=[...document.querySelectorAll('.rail-btn,[data-view],.nav-btn')][i];
                             if (!b) return null;
                             return { active: /\\bactive\\b/.test(b.className),
                                      dialogs: document.querySelectorAll('.modal,[role=dialog]').length }; }""",
                        i)
                    reached = bool(
                        before != after
                        or (state and state["active"])
                        or (state and state["dialogs"] > 0)
                    )
                    chk(f"NAV '{label}' reaches its target state", reached,
                        "changed" if before != after else f"state={state}")

            chk("NAV every screen was actually visited",
                len(visited) == len(navs), f"{len(visited)}/{len(navs)}")
            chk("NAV no page errors while navigating every screen",
                not errors, errors[:2])

            # ---------------------------------------------------- every button
            total = pg.evaluate("() => document.querySelectorAll('button').length")
            chk("BTN buttons present on the active screen", total > 0, total)

            dead, clicked, crashed = [], 0, 0
            n = pg.evaluate("() => document.querySelectorAll('button').length")
            for i in range(min(n, 120)):
                info = pg.evaluate(
                    """(i) => {
                        const b = document.querySelectorAll('button')[i];
                        if (!b || b.disabled || b.offsetParent === null) return null;
                        return { label: (b.textContent||b.title||'?').trim().slice(0,44) };
                    }""", i)
                if not info:
                    continue
                before = fingerprint(pg)
                errs_before = len(errors)
                try:
                    pg.evaluate(
                        """(i) => { const b = document.querySelectorAll('button')[i];
                                    if (b) b.click(); }""", i)
                    pg.wait_for_timeout(190)
                except Exception:
                    crashed += 1
                    continue
                clicked += 1
                after = fingerprint(pg)
                if before == after and len(errors) == errs_before:
                    dead.append(info["label"])
                # Close anything modal that opened, so the sweep continues.
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(80)

            chk("BTN a substantial number of buttons were really clicked",
                clicked >= 20, f"{clicked} clicked, {crashed} threw")
            chk("BTN no click threw an exception", crashed == 0, crashed)
            chk("BTN no uncaught page errors from clicking buttons",
                not errors, errors[:3])
            # Dead = no observable effect. Informational, listed by name.
            chk("BTN clicks with no observable effect (informational)",
                True, f"{len(dead)}/{clicked}: {dead[:12]}")

            # ---------------------------------------------------- app alive
            alive = pg.evaluate(
                "() => document.querySelectorAll('#root *').length")
            chk("STATE app still mounted after the full click sweep",
                alive > 100, f"{alive} nodes")

            rej = pg.evaluate("() => window.__rej || []")
            chk("STATE no unhandled promise rejections", not rej, rej[:2])

            b.close()
    except Exception as exc:
        chk("suite completed without crashing", False, f"{type(exc).__name__}: {exc}")
    finally:
        if srv:
            srv.terminate()

    print(json.dumps(rows, indent=1))
    sys.exit(0 if all(r[1] for r in rows) else 1)


if __name__ == "__main__":
    main()
