/* ------------------------------------------------------------------ */
/* GltfAccessor — the bridge between GLB data and WebGL (milestone 8). */
/* Handles component decoding + interleaved bufferView de-interleaving */
/* (mirrors native GltfAvatarLoader accessor handling; sparse          */
/* accessors are skipped, not decoded).                                */
/* ------------------------------------------------------------------ */

import { GltfAsset } from './GltfTypes';

// Sparse morph accessors are shared by every material primitive in this asset.
// Cache decoded views once per parsed GLB instead of expanding the same 52
// targets twelve times.
const decodedAccessorCache = new WeakMap<GltfAsset, Map<number, ArrayBufferView>>();

function componentCount(type: string): number {
  switch (type) {
    case 'SCALAR':
      return 1;
    case 'VEC2':
      return 2;
    case 'VEC3':
      return 3;
    case 'VEC4':
      return 4;
    case 'MAT2':
      return 4;
    case 'MAT3':
      return 9;
    case 'MAT4':
      return 16;
    default:
      throw new Error(`Unsupported accessor type: ${type}`);
  }
}

function componentSize(type: number): number {
  switch (type) {
    case 5120: // BYTE
    case 5121: // UNSIGNED_BYTE
      return 1;
    case 5122: // SHORT
    case 5123: // UNSIGNED_SHORT
      return 2;
    case 5125: // UNSIGNED_INT
    case 5126: // FLOAT
      return 4;
    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

function componentArray(type: number, buffer: ArrayBuffer): ArrayBufferView {
  switch (type) {
    case 5120:
      return new Int8Array(buffer);
    case 5121:
      return new Uint8Array(buffer);
    case 5122:
      return new Int16Array(buffer);
    case 5123:
      return new Uint16Array(buffer);
    case 5125:
      return new Uint32Array(buffer);
    case 5126:
      return new Float32Array(buffer);
    default:
      throw new Error('Unsupported component type');
  }
}

/** Reinterpret any accessor view as Float32 (float data assumed). */
export function toFloat32(view: ArrayBufferView): Float32Array {
  if (view instanceof Float32Array) return view;
  const out = new Float32Array(view.byteLength / 4);
  const dv = new DataView(view.buffer, view.byteOffset, view.byteLength);
  for (let i = 0; i < out.length; i++) {
    out[i] = dv.getFloat32(i * 4, true);
  }
  return out;
}

function viewRange(asset: GltfAsset, viewIndex: number): { view: NonNullable<GltfAsset['json']['bufferViews']>[number]; start: number; end: number } {
  const view = asset.json.bufferViews?.[viewIndex];
  if (!view) throw new Error(`Missing bufferView ${viewIndex}`);
  if ((view.buffer ?? 0) !== 0) throw new Error(`Unsupported external buffer ${view.buffer}`);
  const start = view.byteOffset ?? 0;
  const end = start + view.byteLength;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > asset.binary.byteLength) {
    throw new Error(`bufferView ${viewIndex} exceeds GLB BIN chunk`);
  }
  return { view, start, end };
}

function readSparseIndex(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5121: return view.getUint8(offset);
    case 5123: return view.getUint16(offset, true);
    case 5125: return view.getUint32(offset, true);
    default: throw new Error(`Invalid sparse index component type: ${componentType}`);
  }
}

export function readAccessor(asset: GltfAsset, accessorIndex: number): ArrayBufferView {
  const cache = decodedAccessorCache.get(asset) ?? new Map<number, ArrayBufferView>();
  decodedAccessorCache.set(asset, cache);
  const cached = cache.get(accessorIndex);
  if (cached) return cached;

  const json = asset.json;
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);

  const components = componentCount(accessor.type);
  const componentBytes = componentSize(accessor.componentType);
  const elementBytes = components * componentBytes;
  if (!Number.isSafeInteger(accessor.count) || accessor.count < 0) {
    throw new Error(`Accessor ${accessorIndex} has invalid count`);
  }
  const outputBuffer = new ArrayBuffer(accessor.count * elementBytes);
  const output = new Uint8Array(outputBuffer);

  // Dense base data. A sparse-only accessor starts as all zeros.
  if (accessor.bufferView !== undefined) {
    const { view, start, end } = viewRange(asset, accessor.bufferView);
    const stride = view.byteStride ?? elementBytes;
    const base = start + (accessor.byteOffset ?? 0);
    const required = accessor.count === 0 ? 0 : (accessor.count - 1) * stride + elementBytes;
    if (!Number.isSafeInteger(base) || stride < elementBytes || base < start || base + required > end) {
      throw new Error(`Accessor ${accessorIndex} exceeds bufferView ${accessor.bufferView}`);
    }
    const source = new Uint8Array(asset.binary);
    for (let i = 0; i < accessor.count; i++) {
      const from = base + i * stride;
      output.set(source.subarray(from, from + elementBytes), i * elementBytes);
    }
  } else if (!accessor.sparse) {
    throw new Error(`Accessor ${accessorIndex} has neither bufferView nor sparse data`);
  }

  if (accessor.sparse) {
    const sparse = accessor.sparse;
    if (!Number.isSafeInteger(sparse.count) || sparse.count < 0 || sparse.count > accessor.count) {
      throw new Error(`Accessor ${accessorIndex} has invalid sparse count`);
    }
    const iv = viewRange(asset, sparse.indices.bufferView);
    const indexBytes = componentSize(sparse.indices.componentType);
    const indexOffset = iv.start + (sparse.indices.byteOffset ?? 0);
    if (indexOffset < iv.start || indexOffset + sparse.count * indexBytes > iv.end) {
      throw new Error(`Sparse indices for accessor ${accessorIndex} exceed bufferView`);
    }
    const vv = viewRange(asset, sparse.values.bufferView);
    const valueOffset = vv.start + (sparse.values.byteOffset ?? 0);
    if (valueOffset < vv.start || valueOffset + sparse.count * elementBytes > vv.end) {
      throw new Error(`Sparse values for accessor ${accessorIndex} exceed bufferView`);
    }
    const dataView = new DataView(asset.binary);
    let previous = -1;
    for (let i = 0; i < sparse.count; i++) {
      const target = readSparseIndex(dataView, indexOffset + i * indexBytes, sparse.indices.componentType);
      if (target <= previous || target >= accessor.count) {
        throw new Error(`Sparse indices for accessor ${accessorIndex} must be strictly increasing and in range`);
      }
      previous = target;
      const from = valueOffset + i * elementBytes;
      output.set(new Uint8Array(asset.binary, from, elementBytes), target * elementBytes);
    }
  }

  const decoded = componentArray(accessor.componentType, outputBuffer);
  cache.set(accessorIndex, decoded);
  return decoded;
}

/**
 * Decode a sparse-only FLOAT VEC3 morph directly into a compact primitive.
 * This avoids retaining 52 full 299k-vertex arrays while uploading each
 * material partition. Dense accessors use the shared decoder as fallback.
 */
export function readFloatVec3AccessorCompact(
  asset: GltfAsset,
  accessorIndex: number,
  sourceToCompact: Int32Array,
  compactVertexCount: number
): Float32Array {
  const accessor = asset.json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing morph accessor ${accessorIndex}`);
  if (accessor.type !== 'VEC3' || accessor.componentType !== 5126) {
    throw new Error(`Morph accessor ${accessorIndex} must be FLOAT VEC3`);
  }
  const sparse = accessor.sparse;
  if (!sparse || accessor.bufferView !== undefined) {
    const dense = toFloat32(readAccessor(asset, accessorIndex));
    const compact = new Float32Array(compactVertexCount * 3);
    for (let source = 0; source < sourceToCompact.length; source++) {
      const target = sourceToCompact[source];
      if (target >= 0) {
        const from = source * 3;
        if (from + 3 > dense.length) throw new Error(`Morph accessor ${accessorIndex} vertex index is out of range`);
        compact.set(dense.subarray(from, from + 3), target * 3);
      }
    }
    return compact;
  }
  if (!Number.isSafeInteger(sparse.count) || sparse.count < 0 || sparse.count > accessor.count) {
    throw new Error(`Morph accessor ${accessorIndex} has invalid sparse count`);
  }
  const iv = viewRange(asset, sparse.indices.bufferView);
  const indexBytes = componentSize(sparse.indices.componentType);
  const indexOffset = iv.start + (sparse.indices.byteOffset ?? 0);
  if (indexOffset < iv.start || indexOffset + sparse.count * indexBytes > iv.end) {
    throw new Error(`Morph accessor ${accessorIndex} sparse indices exceed bufferView`);
  }
  const vv = viewRange(asset, sparse.values.bufferView);
  const valueOffset = vv.start + (sparse.values.byteOffset ?? 0);
  if (valueOffset < vv.start || valueOffset + sparse.count * 12 > vv.end) {
    throw new Error(`Morph accessor ${accessorIndex} sparse values exceed bufferView`);
  }
  const dataView = new DataView(asset.binary);
  const compact = new Float32Array(compactVertexCount * 3);
  let previous = -1;
  for (let i = 0; i < sparse.count; i++) {
    const source = readSparseIndex(dataView, indexOffset + i * indexBytes, sparse.indices.componentType);
    if (source <= previous || source >= accessor.count) {
      throw new Error(`Morph accessor ${accessorIndex} sparse indices are not strictly increasing/in range`);
    }
    previous = source;
    const target = sourceToCompact[source] ?? -1;
    if (target >= 0) {
      const from = valueOffset + i * 12;
      const to = target * 3;
      compact[to] = dataView.getFloat32(from, true);
      compact[to + 1] = dataView.getFloat32(from + 4, true);
      compact[to + 2] = dataView.getFloat32(from + 8, true);
    }
  }
  return compact;
}

/** Release expanded dense/sparse accessor arrays once mesh data is compacted. */
export function clearAccessorCache(asset: GltfAsset): void {
  decodedAccessorCache.delete(asset);
}
