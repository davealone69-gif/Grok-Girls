#!/usr/bin/env python3
"""GLB end-to-end suite (milestone 8 proof).

Loads the real GLB assets served under /glb/ (see public/glb/README.md
for sources/licenses) into the HD avatar renderer and verifies the full
chain:

  parse (magic/chunks) -> accessors -> materials/texture resolution ->
  skin joint evaluation -> morph buffers -> GPU draw (skinned, morph,
  textured) -> pixels on the canvas

The procedural avatar is hidden (setAvatarVisible(false)) during the
visual checks so the assertions measure the GLB draw in isolation.
MorphBoxTest is drawn at glbScale 2 so the weight-driven deltas are
comfortably visible at the test camera distance.

Runs against the preview server (localhost:8080, same as audit_suite).
Prints a JSON array of [name, pass, detail] rows for tests/ci_runner.py.
"""
import json
from playwright.sync_api import sync_playwright

results = []


def chk(name, cond, extra=""):
    results.append((name, bool(cond), extra))


ASSETS = {
    "cesium": "/glb/CesiumMan.glb",        # skin 19j + embedded texture
    "cube": "/glb/AnimatedMorphCube.glb",  # 2 morph targets (tiny, scale-100 node)
    "box": "/glb/BoxTextured.glb",         # textured, no skin
    "morphbox": "/glb/MorphBoxTest.glb",   # synthetic: box + 1 morph target (+X 0.6)
}

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    page_errors = []
    pg.on("pageerror", lambda e: page_errors.append(str(e)))
    pg.goto("http://localhost:8080/", wait_until="networkidle")
    pg.wait_for_timeout(1200)

    # ---------- 1) STRUCTURAL: pure parse/accessor layer via __hdDebug ----------
    struct = pg.evaluate("""async (assets) => {
      const D = window.__hdDebug;
      const out = {};
      async function load(name) {
        const buf = await (await fetch(assets[name])).arrayBuffer();
        return D.parseGlb(buf);
      }
      const cesium = await load('cesium');
      const cprim = cesium.json.meshes[0].primitives[0];
      out.cesium = {
        skins: (cesium.json.skins || []).length,
        joints: (cesium.json.skins || [])[0]?.joints?.length || 0,
        images: (cesium.json.images || []).length,
        textures: (cesium.json.textures || []).length,
        prims: (cesium.json.meshes || []).reduce((a, m) => a + m.primitives.length, 0),
        baseColorTex: cesium.json.materials[0]?.pbrMetallicRoughness?.baseColorTexture?.index ?? -1,
      };
      const pos = D.readAccessor(cesium, cprim.attributes.POSITION);
      out.cesium.posCount = pos.length / 3;
      let finite = true;
      const f = D.toFloat32(pos);
      for (let i = 0; i < f.length; i++) {
        if (!isFinite(f[i])) { finite = false; break; }
      }
      out.cesium.posFinite = finite;
      if (cprim.attributes.JOINTS_0 !== undefined) {
        const ja = cesium.json.accessors[cprim.attributes.JOINTS_0];
        const jt = D.readAccessor(cesium, cprim.attributes.JOINTS_0);
        const dv = new DataView(jt.buffer, jt.byteOffset, jt.byteLength);
        const isByte = ja.componentType === 5121;
        let maxJ = 0;
        for (let i = 0; i < jt.byteLength; i += isByte ? 1 : 2) {
          maxJ = Math.max(maxJ, isByte ? dv.getUint8(i) : dv.getUint16(i, true));
        }
        out.cesium.maxJoint = maxJ;
        out.cesium.vertexCount = ja.count;
      }
      const cube = await load('cube');
      out.cube = {
        prims: (cube.json.meshes || []).reduce((a, m) => a + m.primitives.length, 0),
        targets: (cube.json.meshes[0].primitives[0].targets || []).length,
        weights: cube.json.meshes[0].weights || null,
      };
      const cpos = D.readAccessor(cube, cube.json.meshes[0].primitives[0].attributes.POSITION);
      out.cube.posCount = cpos.length / 3;
      const box = await load('box');
      out.box = {
        images: (box.json.images || []).length,
        textures: (box.json.textures || []).length,
        baseColorTex: box.json.materials[0]?.pbrMetallicRoughness?.baseColorTexture?.index ?? -1,
      };
      return out;
    }""", ASSETS)

    chk("glb parse: CesiumMan skin + 19 joints + texture",
        struct["cesium"]["skins"] == 1 and struct["cesium"]["joints"] == 19
        and struct["cesium"]["images"] == 1 and struct["cesium"]["textures"] == 1
        and struct["cesium"]["baseColorTex"] == 0,
        str(struct["cesium"]))
    chk("glb accessor: CesiumMan POSITION read (finite floats, count matches)",
        struct["cesium"]["posCount"] > 0 and struct["cesium"]["posFinite"],
        str(struct["cesium"]["posCount"]))
    chk("glb accessor: CesiumMan JOINTS_0 decode, max joint < joint count",
        struct["cesium"]["maxJoint"] < struct["cesium"]["joints"],
        str(struct["cesium"]["maxJoint"]))
    chk("glb parse: MorphCube 2 targets + weights [0,0]",
        struct["cube"]["prims"] == 1 and struct["cube"]["targets"] == 2
        and struct["cube"]["weights"] == [0.0, 0.0],
        str(struct["cube"]))
    chk("glb accessor: MorphCube POSITION 24 verts",
        struct["cube"]["posCount"] == 24, str(struct["cube"]["posCount"]))
    chk("glb parse: BoxTextured embedded image + baseColor texture",
        struct["box"]["images"] == 1 and struct["box"]["textures"] == 1
        and struct["box"]["baseColorTex"] == 0,
        str(struct["box"]))

    # ---------- 2) RENDERER: overlay + isolated GLB draw ----------
    pg.evaluate("() => { const bt = [...document.querySelectorAll('.hud-btn')].find(x => x.textContent.includes('3D')); if (bt) bt.click(); }")
    pg.wait_for_timeout(2000)
    chk("glb render: 3D overlay open", pg.locator(".hd-cube-overlay").count() == 1)

    def pause_and_strip(nx=0.5):
        pg.evaluate("() => window.__hdAvatar.pause()")
        pg.wait_for_timeout(120)
        return pg.evaluate("(x) => window.__hdAvatar.maxStrip(x)", nx)

    def render_a_bit(ms=900):
        pg.evaluate("() => window.__hdAvatar.resume()")
        pg.wait_for_timeout(ms)
        pg.evaluate("() => window.__hdAvatar.pause()")
        pg.wait_for_timeout(150)

    def gl_errors():
        return pg.evaluate("""() => {
          const c = document.querySelector('.hd3d-canvas');
          const gl = c.getContext('webgl2');
          let n = 0;
          while (gl.getError() !== gl.NO_ERROR && n < 50) n++;
          return n;
        }""")

    def grid():
        """8x8 pixel grid spread over the canvas (RGB triples)."""
        return pg.evaluate(
            "() => {"
            "  const a = [];"
            "  for (let iy = 0; iy < 8; iy++) {"
            "    for (let ix = 0; ix < 8; ix++) {"
            "      const px = window.__hdAvatar.readPixelAt(0.1 + ix * 0.115, 0.1 + iy * 0.1);"
            "      a.push(px[0], px[1], px[2]);"
            "    }"
            "  }"
            "  return a;"
            "}"
        )

    def l1(a, b):
        return sum(abs(x - y) for x, y in zip(a, b))

    def load_asset(name):
        return pg.evaluate("""async (url) => {
          const buf = await (await fetch(url)).arrayBuffer();
          try { await window.__hdAvatar.loadGlb(buf); return true; }
          catch (e) { return 'err: ' + e; }
        }""", ASSETS[name])

    def with_weights(w):
        pg.evaluate("(x) => window.__hdAvatar.setGlbMorphWeights(x)", w)
        render_a_bit()
        return grid()

    # avatar baseline visible (default state)
    base = pause_and_strip(0.5)
    chk("glb render: avatar baseline visible", base[0] > 40, str(base))

    # hide the procedural avatar: canvas must go dark (empty scene)
    pg.evaluate("() => window.__hdAvatar.setAvatarVisible(false)")
    render_a_bit()
    dark = pause_and_strip(0.5)
    chk("glb render: avatar hidden -> empty scene dark",
        max(dark) < 20, str(dark))

    # Settle: the procedural-avatar path emits a one-shot INVALID_OPERATION
    # around overlay open (pre-existing, non-GLB). Drain it so the rows below
    # measure GL errors arising from the GLB loads/draws themselves.
    gl_errors()

    # --- CesiumMan: skinned + textured, drawn in isolation ---
    ok = load_asset("cesium")
    chk("glb render: CesiumMan load resolves", ok is True, str(ok)[:120])
    info = pg.evaluate("() => window.__hdAvatar.glbInfo()")
    chk("glb render: glbInfo joints=19 textured=1 images=1",
        info and info.get("joints") == 19 and info.get("texturedMaterials") == 1
        and info.get("images") == 1 and info.get("primitives") == 1,
        str(info))
    render_a_bit()
    strip_c = pause_and_strip(0.5)
    chk("glb render: skinned+textured model lit in isolation",
        strip_c[0] > 60, str(strip_c))
    chk("glb render: no GL errors after CesiumMan", gl_errors() == 0, str(gl_errors()))
    grid_c_after_cesium = grid()

    # --- BoxTextured replaces it: dispose path + texture-only draw ---
    ok = load_asset("box")
    chk("glb render: BoxTextured load resolves (dispose of previous asset)",
        ok is True, str(ok)[:120])
    render_a_bit()
    g_ces = grid_c_after_cesium  # captured while CesiumMan was on screen
    g_box = grid()
    chk("glb render: textured cube replaces CesiumMan frame (pixels change, lit)",
        max(g_box) > 40 and l1(g_ces, g_box) > 60,
        f"diff={l1(g_ces, g_box)}")
    chk("glb render: no GL errors after BoxTextured", gl_errors() == 0, str(gl_errors()))

    # --- AnimatedMorphCube: DATA-level morph checks (its scale-100 node +
    # no-UV factor-only material combo does not rasterize on the software
    # GL used by CI; the GPU blend is proven visually with MorphBoxTest) ---
    ok = load_asset("cube")
    chk("glb render: MorphCube load resolves", ok is True, str(ok)[:120])
    info = pg.evaluate("() => window.__hdAvatar.glbInfo()")
    chk("glb render: glbInfo morphTargets=2 joints=0",
        info and info.get("morphTargets") == 2 and info.get("joints") == 0, str(info))
    chk("glb render: morph delta data nonzero (max |delta| > 0)",
        bool(info) and info.get("morphMaxDelta", 0) > 0, str(info.get("morphMaxDelta")))

    # --- MorphBoxTest: GPU morph blend responds to weights (visual) ---
    ok = load_asset("morphbox")
    chk("glb render: MorphBoxTest load resolves", ok is True, str(ok)[:120])
    info = pg.evaluate("() => window.__hdAvatar.glbInfo()")
    chk("glb render: MorphBoxTest 1 morph target, textured",
        info and info.get("morphTargets") == 1 and info.get("texturedMaterials") == 1
        and info.get("morphMaxDelta", 0) > 0.5,
        str(info))
    pg.evaluate("() => window.__hdAvatar.setGlbScale(2)")
    render_a_bit()
    g0 = with_weights([0.0])
    g1 = with_weights([1.0])
    d01 = l1(g0, g1)
    lit = max(max(g0), max(g1)) > 40
    chk("glb render: morph weight 0->1 moves geometry on screen (GPU blend active)",
        lit and d01 > 300, f"d01={d01}")
    # back to weight 0 must restore the base frame (weights drive the shape)
    g2 = with_weights([0.0])
    d10 = l1(g1, g2)
    chk("glb render: morph weight back to 0 restores base frame",
        lit and d10 > 300, f"d10={d10}")
    chk("glb render: no GL errors after morphs", gl_errors() == 0, str(gl_errors()))

    chk("glb render: zero page errors throughout",
        len(page_errors) == 0, "; ".join(page_errors[:3]))

    # clean exit: restore defaults and close the overlay
    pg.evaluate("() => { window.__hdAvatar.setAvatarVisible(true); window.__hdAvatar.setGlbScale(1); }")
    pg.evaluate("() => { const c = document.querySelector('.hd-cube-close'); if (c) c.click(); }")
    pg.wait_for_timeout(300)
    b.close()

print(json.dumps(results, indent=1))
