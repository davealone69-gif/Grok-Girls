const encoder = new TextEncoder();

function align4(value: number): number { return (value + 3) & ~3; }
function writeU32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value >>> 0, true); }
function jsonChunk(value: unknown): Uint8Array { const raw = encoder.encode(JSON.stringify(value)); const out = new Uint8Array(align4(raw.length)); out.set(raw); out.fill(0x20, raw.length); return out; }

/** Minimal valid GLB containing one renderable triangle. Useful for deterministic CI smoke tests. */
export function createGlbSmokeAsset(): ArrayBuffer {
  const positions = new Float32Array([-0.8, -0.8, 0, 0.8, -0.8, 0, 0, 0.8, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  const indices = new Uint16Array([0, 1, 2]);
  const chunks = [new Uint8Array(positions.buffer), new Uint8Array(normals.buffer), new Uint8Array(uvs.buffer), new Uint8Array(indices.buffer)];
  let cursor = 0;
  const offsets: number[] = [];
  for (const chunk of chunks) { offsets.push(cursor); cursor = align4(cursor + chunk.byteLength); }
  const bin = new Uint8Array(cursor);
  chunks.forEach((chunk, i) => bin.set(chunk, offsets[i]));
  const json = jsonChunk({
    asset: { version: '2.0', generator: 'Grok-Girls HD CI' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.72, 0.42, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.5 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.8, -0.8, 0], max: [0.8, 0.8, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: chunks[0].byteLength },
      { buffer: 0, byteOffset: offsets[1], byteLength: chunks[1].byteLength },
      { buffer: 0, byteOffset: offsets[2], byteLength: chunks[2].byteLength },
      { buffer: 0, byteOffset: offsets[3], byteLength: chunks[3].byteLength }
    ],
    buffers: [{ byteLength: bin.byteLength }]
  });
  const total = 12 + 8 + json.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total); const view = new DataView(out.buffer);
  writeU32(view, 0, 0x46546c67); writeU32(view, 4, 2); writeU32(view, 8, total);
  let p = 12; writeU32(view, p, json.byteLength); writeU32(view, p + 4, 0x4e4f534a); out.set(json, p + 8); p += 8 + json.byteLength;
  writeU32(view, p, bin.byteLength); writeU32(view, p + 4, 0x004e4942); out.set(bin, p + 8);
  return out.buffer;
}
