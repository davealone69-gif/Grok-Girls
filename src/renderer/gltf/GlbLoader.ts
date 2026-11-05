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
  if (length !== data.byteLength) throw new Error('GLB declared length does not match file size');

  let offset = 12;
  let chunkIndex = 0;
  let json: GltfJson | undefined;
  let binary = new ArrayBuffer(0);
  let hasBinary = false;
  while (offset < length) {
    if (offset + 8 > length) throw new Error('Truncated GLB chunk header');
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || chunkLength > length - offset) throw new Error('Invalid GLB chunk length');
    if (chunkIndex === 0 && chunkType !== JSON_CHUNK) throw new Error('GLB JSON chunk must be first');
    const chunk = data.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === JSON_CHUNK) {
      if (json !== undefined || chunkIndex !== 0) throw new Error('GLB must contain exactly one leading JSON chunk');
      // GLB pads the JSON chunk with trailing NUL bytes to a 4-byte
      // boundary (spec 4.4.2) — stripping them is required, so the
      // control character in this pattern is deliberate.
      // eslint-disable-next-line no-control-regex
      const text = new TextDecoder().decode(chunk).replace(/\u0000+$/g, '').trim();
      json = JSON.parse(text) as GltfJson;
    } else if (chunkType === BIN_CHUNK) {
      if (hasBinary || json === undefined) throw new Error('GLB must contain at most one BIN chunk after JSON');
      binary = chunk;
      hasBinary = true;
    }
    offset += 0;
    chunkIndex++;
  }
  if (offset !== length) throw new Error('GLB chunks do not consume declared container length');
  if (!json) throw new Error('GLB JSON chunk missing');
  if (!hasBinary) throw new Error('GLB BIN chunk missing');
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

const decodedCache = new WeakMap<GltfAsset, Map<number, ArrayBufferView>>();

function viewRange(asset: GltfAsset, index: number): { start: number; end: number; stride?: number } {
  const view = asset.json.bufferViews?.[index];
  if (!view) throw new Error(`Missing bufferView ${index}`);
  if (view.buffer !== 0) throw new Error(`Unsupported external buffer ${view.buffer}`);
  const start = view.byteOffset ?? 0, end = start + view.byteLength;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > asset.binary.byteLength) {
    throw new Error(`bufferView ${index} exceeds GLB BIN chunk`);
  }
  return { start, end, stride: view.byteStride };
}

export function readAccessor(asset: GltfAsset, index: number): ArrayBufferView {
  const cache = decodedCache.get(asset) ?? new Map<number, ArrayBufferView>();
  decodedCache.set(asset, cache);
  const cached = cache.get(index);
  if (cached) return cached;
  const accessor = asset.json.accessors?.[index];
  if (!accessor) throw new Error(`Missing accessor ${index}`);

  const components = componentCount(accessor.type);
  const size = componentSize(accessor.componentType);
  const elementBytes = components * size;
  if (!Number.isSafeInteger(accessor.count) || accessor.count < 0) throw new Error(`Accessor ${index} has invalid count`);
  const outputBuffer = new ArrayBuffer(accessor.count * elementBytes);
  const output = new Uint8Array(outputBuffer);

  if (accessor.bufferView !== undefined) {
    const range = viewRange(asset, accessor.bufferView);
    const stride = range.stride ?? elementBytes;
    const base = range.start + (accessor.byteOffset ?? 0);
    const required = accessor.count === 0 ? 0 : (accessor.count - 1) * stride + elementBytes;
    if (stride < elementBytes || base < range.start || base + required > range.end) {
      throw new Error(`Accessor ${index} exceeds bufferView`);
    }
    const source = new Uint8Array(asset.binary);
    for (let i = 0; i < accessor.count; i++) {
      const from = base + i * stride;
      output.set(source.subarray(from, from + elementBytes), i * elementBytes);
    }
  } else if (!accessor.sparse) {
    throw new Error(`Accessor ${index} has neither bufferView nor sparse data`);
  }

  if (accessor.sparse) {
    const sparse = accessor.sparse;
    if (!Number.isSafeInteger(sparse.count) || sparse.count < 0 || sparse.count > accessor.count) {
      throw new Error(`Accessor ${index} has invalid sparse count`);
    }
    const ir = viewRange(asset, sparse.indices.bufferView);
    const indexBytes = componentSize(sparse.indices.componentType);
    const indexOffset = ir.start + (sparse.indices.byteOffset ?? 0);
    if (indexOffset < ir.start || indexOffset + sparse.count * indexBytes > ir.end) {
      throw new Error(`Sparse indices for accessor ${index} exceed bufferView`);
    }
    const vr = viewRange(asset, sparse.values.bufferView);
    const valueOffset = vr.start + (sparse.values.byteOffset ?? 0);
    if (valueOffset < vr.start || valueOffset + sparse.count * elementBytes > vr.end) {
      throw new Error(`Sparse values for accessor ${index} exceed bufferView`);
    }
    const dv = new DataView(asset.binary);
    let previous = -1;
    for (let i = 0; i < sparse.count; i++) {
      let target: number;
      switch (sparse.indices.componentType) {
        case 5121: target = dv.getUint8(indexOffset + i * indexBytes); break;
        case 5123: target = dv.getUint16(indexOffset + i * indexBytes, true); break;
        case 5125: target = dv.getUint32(indexOffset + i * indexBytes, true); break;
        default: throw new Error('Invalid sparse index component type');
      }
      if (target <= previous || target >= accessor.count) throw new Error(`Sparse indices for accessor ${index} are not strictly increasing/in range`);
      previous = target;
      const from = valueOffset + i * elementBytes;
      output.set(new Uint8Array(asset.binary, from, elementBytes), target * elementBytes);
    }
  }

  const decoded = makeArray(accessor.componentType, outputBuffer);
  cache.set(index, decoded);
  return decoded;
}

export function clearAccessorCache(asset: GltfAsset): void {
  decodedCache.delete(asset);
}

export function readScalarIndices(asset: GltfAsset, index: number): Uint8Array | Uint16Array | Uint32Array {
  const accessor = asset.json.accessors?.[index];
  if (!accessor || accessor.type !== 'SCALAR') throw new Error(`Index accessor ${index} must be SCALAR`);
  if (accessor.componentType !== 5121 && accessor.componentType !== 5123 && accessor.componentType !== 5125) throw new Error(`Index accessor ${index} has invalid component type`);
  return readAccessor(asset, index) as Uint8Array | Uint16Array | Uint32Array;
}
