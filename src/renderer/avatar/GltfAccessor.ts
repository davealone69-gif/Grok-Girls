/* ------------------------------------------------------------------ */
/* GltfAccessor — the bridge between GLB data and WebGL (milestone 8). */
/* Handles component decoding + interleaved bufferView de-interleaving */
/* (mirrors native GltfAvatarLoader accessor handling; sparse          */
/* accessors are skipped, not decoded).                                */
/* ------------------------------------------------------------------ */

import { GltfAsset } from './GltfTypes';

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

export function readAccessor(asset: GltfAsset, accessorIndex: number): ArrayBufferView {
  const json = asset.json;

  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) {
    throw new Error(`Missing accessor ${accessorIndex}`);
  }

  if (accessor.bufferView === undefined) {
    throw new Error('Sparse/implicit accessor not supported yet');
  }

  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) {
    throw new Error('Missing bufferView');
  }

  const buffer = asset.binary;

  const componentBytes = componentSize(accessor.componentType);
  const components = componentCount(accessor.type);

  const stride = view.byteStride ?? componentBytes * components;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const byteLength = accessor.count * stride;

  const raw = buffer.slice(offset, offset + byteLength);

  // Interleaved data needs de-interleaving.
  if (stride !== componentBytes * components) {
    const source = new Uint8Array(buffer, offset, byteLength);
    const output = new Uint8Array(accessor.count * components * componentBytes);
    const elementSize = components * componentBytes;

    for (let i = 0; i < accessor.count; i++) {
      output.set(source.subarray(i * stride, i * stride + elementSize), i * elementSize);
    }

    return componentArray(accessor.componentType, output.buffer);
  }

  return componentArray(accessor.componentType, raw);
}
