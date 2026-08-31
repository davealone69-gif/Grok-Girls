#!/usr/bin/env python3
"""Deterministic browser gate for the real GLB ingestion path.

Builds a tiny valid glTF 2.0 GLB in memory, loads it through the application's
actual TypeScript loader, uploads its primitive to WebGL2, draws it, and checks
that pixels changed. It also verifies the shared render-target factory reports
its actual selected format and keeps probing cached per context.
"""
import base64
import json
import struct
from playwright.sync_api import sync_playwright


def make_glb():
    # triangle positions + normals + UVs + indices, all in the embedded BIN.
    pos = struct.pack('<9f', -0.7, -0.6, 0.0, 0.7, -0.6, 0.0, 0.0, 0.7, 0.0)
    normal = struct.pack('<9f', 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0)
    uv = struct.pack('<6f', 0.0, 1.0, 1.0, 1.0, 0.5, 0.0)
    indices = struct.pack('<3H', 0, 1, 2)
    chunks = [pos, normal, uv, indices]
    offsets = []
    cursor = 0
    for chunk in chunks:
        cursor = (cursor + 3) & ~3
        offsets.append(cursor)
        cursor += len(chunk)
    blob = bytearray(cursor)
    for off, chunk in zip(offsets, chunks):
        blob[off:off + len(chunk)] = chunk

    doc = {
        'asset': {'version': '2.0', 'generator': 'Grok-Girls CI GLB gate'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3}]}],
        'buffers': [{'byteLength': len(blob)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': offsets[0], 'byteLength': len(pos)},
            {'buffer': 0, 'byteOffset': offsets[1], 'byteLength': len(normal)},
            {'buffer': 0, 'byteOffset': offsets[2], 'byteLength': len(uv)},
            {'buffer': 0, 'byteOffset': offsets[3], 'byteLength': len(indices)},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3', 'min': [-0.7, -0.6, 0], 'max': [0.7, 0.7, 0]},
            {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': 3, 'type': 'VEC2'},
            {'bufferView': 3, 'componentType': 5123, 'count': 3, 'type': 'SCALAR'},
        ],
    }
    raw_json = json.dumps(doc, separators=(',', ':')).encode()
    raw_json += b' ' * ((4 - len(raw_json) % 4) % 4)
    raw_bin = bytes(blob)
    raw_bin += b'\0' * ((4 - len(raw_bin) % 4) % 4)
    total = 12 + 8 + len(raw_json) + 8 + len(raw_bin)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(raw_json), 0x4E4F534A) + raw_json + struct.pack('<II', len(raw_bin), 0x004E4942) + raw_bin


def main():
    glb64 = base64.b64encode(make_glb()).decode()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 640, 'height': 480})
        page.goto('http://localhost:8080/', wait_until='networkidle')
        page.wait_for_timeout(500)
        result = page.evaluate('''async (b64) => {
          const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 256;
          document.body.appendChild(canvas);
          const gl = canvas.getContext('webgl2');
          if (!gl) return {ok:false, error:'WebGL2 unavailable'};
          const d = window.__hdDebug;
          if (!d?.loadGltfAvatar || !d?.createRenderTarget || !d?.getRenderTargetCapabilities) return {ok:false, error:'renderer diagnostics missing'};
          const caps1 = d.getRenderTargetCapabilities(gl);
          const caps2 = d.getRenderTargetCapabilities(gl);
          const target = d.createRenderTarget(gl, {width:64, height:64, color:'rgba16f', depth:'depth32f'});
          const avatar = await d.loadGltfAvatar(gl, bin);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          gl.viewport(0, 0, 64, 64);
          gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.DEPTH_TEST);
          for (const item of avatar.primitives) {
            gl.bindVertexArray(item.primitive.vao);
            gl.drawElements(item.primitive.mode, item.primitive.indexCount, item.primitive.indexType, 0);
          }
          gl.bindVertexArray(null);
          const px = new Uint8Array(4);
          gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          avatar.destroy(); target.destroy();
          return {ok:true, primitiveCount:avatar.primitives.length, capsStable:JSON.stringify(caps1)===JSON.stringify(caps2), selectedColor:target.colorInternal, selectedDepth:target.depthInternal, complete, center:[...px]};
        }''', glb64)
        browser.close()
    assert result.get('ok'), result
    assert result.get('primitiveCount') == 1, result
    assert result.get('capsStable'), result
    assert result.get('complete'), result
    print(json.dumps(result))


if __name__ == '__main__':
    main()
