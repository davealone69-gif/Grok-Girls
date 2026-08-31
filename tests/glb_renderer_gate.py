#!/usr/bin/env python3
"""Deterministic browser gate for the existing GLB HD PBR renderer."""
import base64
import json
import struct
from playwright.sync_api import sync_playwright


def make_glb():
    pos = struct.pack('<9f', -0.7, -0.6, 0.0, 0.7, -0.6, 0.0, 0.0, 0.7, 0.0)
    normal = struct.pack('<9f', 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0)
    uv = struct.pack('<6f', 0.0, 1.0, 1.0, 1.0, 0.5, 0.0)
    indices = struct.pack('<3H', 0, 1, 2)
    chunks, offsets, cursor = [pos, normal, uv, indices], [], 0
    for chunk in chunks:
        cursor = (cursor + 3) & ~3
        offsets.append(cursor)
        cursor += len(chunk)
    blob = bytearray(cursor)
    for off, chunk in zip(offsets, chunks): blob[off:off + len(chunk)] = chunk
    doc = {
        'asset': {'version': '2.0', 'generator': 'Grok-Girls CI GLB gate'}, 'scene': 0,
        'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3}]}],
        'buffers': [{'byteLength': len(blob)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': offsets[0], 'byteLength': len(pos)},
            {'buffer': 0, 'byteOffset': offsets[1], 'byteLength': len(normal)},
            {'buffer': 0, 'byteOffset': offsets[2], 'byteLength': len(uv)},
            {'buffer': 0, 'byteOffset': offsets[3], 'byteLength': len(indices)},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
            {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': 3, 'type': 'VEC2'},
            {'bufferView': 3, 'componentType': 5123, 'count': 3, 'type': 'SCALAR'},
        ],
    }
    raw_json = json.dumps(doc, separators=(',', ':')).encode()
    raw_json += b' ' * ((4 - len(raw_json) % 4) % 4)
    raw_bin = bytes(blob) + b'\0' * ((4 - len(blob) % 4) % 4)
    total = 12 + 8 + len(raw_json) + 8 + len(raw_bin)
    return (struct.pack('<III', 0x46546C67, 2, total)
            + struct.pack('<II', len(raw_json), 0x4E4F534A) + raw_json
            + struct.pack('<II', len(raw_bin), 0x004E4942) + raw_bin)


def main():
    encoded = base64.b64encode(make_glb()).decode()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 640, 'height': 480})
        page.goto('http://localhost:8080/', wait_until='networkidle')
        page.wait_for_timeout(500)
        result = page.evaluate('''async (b64) => {
          const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
          const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
          document.body.appendChild(canvas);
          const gl = canvas.getContext('webgl2');
          if (!gl) return {ok:false, error:'WebGL2 unavailable'};
          const d = window.__hdDebug;
          if (!d?.GltfHdPbrRenderer || !d?.createRenderTarget || !d?.getRenderTargetCapabilities) return {ok:false, error:'GLB HD PBR diagnostics missing'};
          const caps1 = d.getRenderTargetCapabilities(gl), caps2 = d.getRenderTargetCapabilities(gl);
          const target = d.createRenderTarget(gl, {width:64, height:64, color:'rgba16f', depth:'depth32f'});
          const renderer = new d.GltfHdPbrRenderer(gl, {exposure:1});
          await renderer.load(data);
          renderer.render(64, 64);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          const px = new Uint8Array(4); gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const primitiveCount = renderer.primitiveCount;
          const loaded = renderer.loaded;
          renderer.destroy(); target.destroy();
          return {ok:true, loaded, primitiveCount, capsStable:JSON.stringify(caps1)===JSON.stringify(caps2), selectedColor:target.colorInternal, selectedDepth:target.depthInternal, complete, center:[...px]};
        }''', encoded)
        browser.close()
    assert result.get('ok'), result
    assert result.get('loaded') is True, result
    assert result.get('primitiveCount') == 1, result
    assert result.get('capsStable'), result
    print(json.dumps(result))


if __name__ == '__main__':
    main()
