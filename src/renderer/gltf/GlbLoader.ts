import { GltfAccessor, GltfAsset, GltfComponentType, GltfJson } from './GltfTypes';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function parseGlb(data: ArrayBuffer): GltfAsset {
  if (data.byteLength < 12) throw new Error('GLB header truncated');
  const view = new DataView(data);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Invalid GLB magic');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('Unsupported GLB version');
  const length = view.getUint32(8, true);
  if (length < 12 || length > data.byteLength) throw new Error('Invalid GLB length');

  let offset = 12;
  let json: GltfJson | undefined;
  let binary = new ArrayBuffer(0);
  while (offset + 8 <= length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength > length - offset) throw new Error('GLB chunk exceeds container');
    const chunk = data.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === JSON_CHUNK) {
      const text = new TextDecoder().decode(chunk).replace(/\u0000+$/g, '').trim();
      json = JSON.parse(text) as GltfJson;
    } else if (chunkType === BIN_CHUNK) {
      binary = chunk;
    }
  }
  if (!json) throw new Error('GLB JSON chunk missing');
  const declared = json.buffers?.[0]?.byteLength;
  if (declared !== undefined && declared > binary.byteLength) throw new Error('GLB BIN chunk is shorter than declared buffer');
  return { json, binary };
}

function componentCount(type: GltfAccessor['type']): number {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    case 'MAT2': return 4;
    case 'MAT3': return 9;
    case 'MAT4': return 16;
  }
}

function componentSize(type: GltfComponentType): number {
  switch (type) {
    case 5120: case 5121: return 1;
    case 5122: case 5123: return 2;
    case 5125: case 5126: return 4;
  }
}

function makeArray(type: GltfComponentType, buffer: ArrayBuffer, byteOffset = 0, length?: number): ArrayBufferView {
  switch (type) {
    case 5120: return new Int8Array(buffer, byteOffset, length);
    case 5121: return new Uint8Array(buffer, byteOffset, length);
    case 5122: return new Int16Array(buffer, byteOffset, length);
    case 5123: return new Uint16Array(buffer, byteOffset, length);
    case 5125: return new Uint32Array(buffer, byteOffset, length);
    case 5126: return new Float32Array(buffer, byteOffset, length);
  }
}

export function readAccessor(asset: GltfAsset, index: number): ArrayBufferView {
  const accessor = asset.json.accessors?.[index];
  if (!accessor) throw new Error(`Missing accessor ${index}`);
  if (accessor.bufferView === undefined) throw new Error(`Accessor ${index}: sparse/implicit accessors are not supported`);
  const view = asset.json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`Missing bufferView ${accessor.bufferView}`);
  if (view.buffer !== 0) throw new Error(`Unsupported external buffer ${view.buffer}`);

  const components = componentCount(accessor.type);
  const size = componentSize(accessor.componentType);
  const elementBytes = components * size;
  const stride = view.byteStride ?? elementBytes;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const required = accessor.count === 0 ? 0 : (accessor.count - 1) * stride + elementBytes;
  if (base < 0 || base + required > asset.binary.byteLength) throw new Error(`Accessor ${index} exceeds BIN chunk`);

  if (stride === elementBytes) return makeArray(accessor.componentType, asset.binary, base, accessor.count * components);

  const bytes = new Uint8Array(accessor.count * elementBytes);
  const source = new Uint8Array(asset.binary, base, required);
  for (let i = 0; i < accessor.count; i++) {
    bytes.set(source.subarray(i * stride, i * stride + elementBytes), i * elementBytes);
  }
  return makeArray(accessor.componentType, bytes.buffer);
}

export function readScalarIndices(asset: GltfAsset, index: number): Uint8Array | Uint16Array | Uint32Array {
  const accessor = asset.json.accessors?.[index];
  if (!accessor || accessor.type !== 'SCALAR') throw new Error(`Index accessor ${index} must be SCALAR`);
  if (accessor.componentType !== 5121 && accessor.componentType !== 5123 && accessor.componentType !== 5125) throw new Error(`Index accessor ${index} has invalid component type`);
  return readAccessor(asset, index) as Uint8Array | Uint16Array | Uint32Array;
}
