/* ------------------------------------------------------------------ */
/* GltfMorphs — real per-vertex morph delta data for the GLB renderer. */
/* Sparse accessors are expanded by the shared accessor cache.         */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor, toFloat32 } from './GltfAccessor';

export interface GltfMorph {
  position?: number;
  normal?: number;
  tangent?: number;
  weight: number;
}

export function readMorphTargets(asset: GltfAsset, primitive: GltfPrimitive): GltfMorph[][] {
  if (!primitive.targets) return [];
  return primitive.targets.map((target) => {
    const result: GltfMorph = { weight: 0 };
    if (target.POSITION !== undefined) result.position = target.POSITION;
    if (target.NORMAL !== undefined) result.normal = target.NORMAL;
    if (target.TANGENT !== undefined) result.tangent = target.TANGENT;
    return [result];
  });
}

export interface MorphBuffers {
  /** One full per-vertex delta array per target, null when the target omits that channel. */
  positionDeltas: Array<Float32Array | null>;
  normalDeltas: Array<Float32Array | null>;
  weights: Float32Array;
}

export const MAX_MORPHS = 64;

/** Decode true per-vertex morph deltas. Accessor caching prevents N× expansion. */
export function buildMorphBuffers(
  asset: GltfAsset,
  primitive: GltfPrimitive,
  sourceVertices?: number[]
): MorphBuffers | null {
  if (!primitive.targets?.length) return null;
  if (primitive.targets.length > MAX_MORPHS) {
    throw new Error(`GLB has ${primitive.targets.length} morph targets; maximum supported is ${MAX_MORPHS}`);
  }
  const positionDeltas: Array<Float32Array | null> = [];
  const normalDeltas: Array<Float32Array | null> = [];
  const compact = (data: Float32Array | null): Float32Array | null => {
    if (!data || !sourceVertices) return data;
    if (data.length % 3 !== 0) throw new Error('Morph accessor is not VEC3');
    const out = new Float32Array(sourceVertices.length * 3);
    for (let i = 0; i < sourceVertices.length; i++) {
      const from = sourceVertices[i] * 3;
      if (from + 3 > data.length) throw new Error('Morph accessor vertex index is out of range');
      out.set(data.subarray(from, from + 3), i * 3);
    }
    return out;
  };
  for (const target of primitive.targets) {
    positionDeltas.push(compact(target.POSITION === undefined ? null : toFloat32(readAccessor(asset, target.POSITION))));
    normalDeltas.push(compact(target.NORMAL === undefined ? null : toFloat32(readAccessor(asset, target.NORMAL))));
  }
  return {
    positionDeltas,
    normalDeltas,
    weights: new Float32Array(MAX_MORPHS)
  };
}
