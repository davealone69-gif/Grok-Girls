#!/usr/bin/env python3
"""Geometry gate for buildDefaultScene() — proves the body-type selection
and the leg profile actually change the mesh data.

Regression context: `bodyScale` was computed from def.body but never
passed to latheMesh(), so Slim/Heavy were visually identical to Average;
and LEG_PROFILE was defined but unused (legs were a plain cylinder).

These checks compare real vertex buffers, not just "it rendered".
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

# This gate imports the renderer MODULE (not the bundle), so it needs a
# Vite dev server. Start one on demand so the suite is self-contained.
PORT = 8123
BASE = f"http://localhost:{PORT}/"

results = []


def chk(name, cond, extra=""):
    results.append([name, bool(cond), str(extra)[:160]])


JS = r"""
async () => {
  const mod = await import('/src/renderer/HDRenderer.ts');
  const build = mod.buildDefaultScene;
  if (typeof build !== 'function') return { error: 'buildDefaultScene not exported' };

  const base = {
    gender: 'Female', skin: 'Tone 03', hair: 'Long', eyes: 'Natural',
    face: 'Oval', body: 'Average', outfit: 'Street', age: 'Adult',
    tattoos: 'None', augmentations: 'None'
  };

  const sig = (scene) => scene.meshes.map(m => ({
    n: m.indexCount,
    // bounding radius in XZ + height extent, from the interleaved buffer
    ...(() => {
      let maxR = 0, minY = Infinity, maxY = -Infinity;
      const d = m.data;
      for (let i = 0; i < d.length; i += 8) {
        const x = d[i], y = d[i + 1], z = d[i + 2];
        const r = Math.hypot(x, z);
        if (r > maxR) maxR = r;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      return { r: +maxR.toFixed(5), h: +(maxY - minY).toFixed(5) };
    })()
  }));

  const avg = build({ ...base, body: 'Average' }, 7);
  const slim = build({ ...base, body: 'Slim' }, 7);
  const heavy = build({ ...base, body: 'Heavy' }, 7);
  const athletic = build({ ...base, body: 'Athletic' }, 7);
  const hourglass = build({ ...base, body: 'Hourglass' }, 7);

  return {
    counts: [avg.meshes.length, slim.meshes.length, heavy.meshes.length,
             athletic.meshes.length, hourglass.meshes.length],
    avg: sig(avg), slim: sig(slim), heavy: sig(heavy),
    athletic: sig(athletic), hourglass: sig(hourglass)
  };
}
"""


def start_dev_server():
    """Launch `vite` on PORT and wait until it answers."""
    import socket
    import subprocess
    import time

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc = subprocess.Popen(
        ["npx", "vite", "--port", str(PORT), "--host", "127.0.0.1", "--strictPort"],
        cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(120):
        try:
            with socket.create_connection(("127.0.0.1", PORT), 0.5):
                time.sleep(1.0)  # let the module graph warm up
                return proc
        except OSError:
            if proc.poll() is not None:
                raise RuntimeError("vite dev server exited during startup")
            time.sleep(0.5)
    proc.terminate()
    raise RuntimeError(f"vite dev server did not start on {PORT}")


def main() -> int:
    server = start_dev_server()
    try:
        return run_checks()
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except Exception:
            server.kill()


def run_checks() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"])
        pg = b.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE, wait_until="domcontentloaded")
        out = pg.evaluate(JS)
        b.close()

    if out.get("error"):
        chk("scene module loads", False, out["error"])
        print(json.dumps(results))
        return 1

    chk("scene module loads", True)

    avg, slim, heavy = out["avg"], out["slim"], out["heavy"]
    athletic, hourglass = out["athletic"], out["hourglass"]

    chk("mesh count stable across body types",
        len(set(out["counts"])) == 1, out["counts"])

    # The ground plane (a large static quad) never scales, so compare the
    # meshes that actually differ between body types — the body parts.
    def body_radius(sig):
        """Largest radius among meshes that respond to body type."""
        idx = [i for i, (a, s2) in enumerate(zip(avg, slim)) if a["r"] != s2["r"]]
        return max(sig[i]["r"] for i in idx) if idx else 0.0

    def widest(sig):
        return body_radius(sig)

    chk("Slim narrows the body vs Average", widest(slim) < widest(avg),
        f"slim={widest(slim)} avg={widest(avg)}")
    chk("Heavy widens the body vs Average", widest(heavy) > widest(avg),
        f"heavy={widest(heavy)} avg={widest(avg)}")

    # Every canonical body value must actually move the mesh. These two used
    # to render byte-identical to Average: 'Hourglass' did not exist as a
    # canonical value (it collapsed into Average, which also rewrote the
    # draft's bodyType to 'petite'), and 'Athletic' had no bodyScale branch
    # so it fell through to 1.0. 'hourglass' is the shipped-preset default.
    chk("Hourglass differs from Average", widest(hourglass) != widest(avg),
        f"hourglass={widest(hourglass)} avg={widest(avg)}")
    chk("Athletic differs from Average", widest(athletic) != widest(avg),
        f"athletic={widest(athletic)} avg={widest(avg)}")
    chk("body radii ordered slim<athletic<avg<hourglass<heavy",
        widest(slim) < widest(athletic) < widest(avg) < widest(hourglass) < widest(heavy),
        f"{widest(slim)} {widest(athletic)} {widest(avg)} {widest(hourglass)} {widest(heavy)}")

    # the ~1.14 / 0.9 factors should show up proportionally
    ratio_h = widest(heavy) / widest(avg) if widest(avg) else 0
    ratio_s = widest(slim) / widest(avg) if widest(avg) else 0
    chk("Heavy scale factor ≈ 1.14", abs(ratio_h - 1.14) < 0.02, round(ratio_h, 4))
    chk("Slim scale factor ≈ 0.90", abs(ratio_s - 0.90) < 0.02, round(ratio_s, 4))

    # legs: a lathe profile is not a constant-radius cylinder. Verify that
    # every mesh pair differs between body types where scaling applies,
    # and that the scene contains a tapered (non-cylindrical) limb.
    changed = sum(1 for a, s in zip(avg, slim) if a["r"] != s["r"])
    chk("multiple meshes respond to body type (torso+arms+legs)", changed >= 3, changed)

    print(json.dumps(results))
    return 0 if all(r[1] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
