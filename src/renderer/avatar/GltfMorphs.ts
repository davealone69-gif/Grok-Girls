/* ------------------------------------------------------------------ */
/* GltfMorphs — real per-vertex morph delta data for the GLB renderer. */
/* Sparse accessors are expanded by the shared accessor cache.         */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readFloatVec3AccessorCompact } from './GltfAccessor';

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

/** Decode true per-vertex morph deltas without retaining full source-mesh arrays. */
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
  const sourceCount = asset.json.accessors?.[primitive.attributes.POSITION]?.count ?? 0;
  const sourceToCompact = new Int32Array(sourceCount);
  sourceToCompact.fill(-1);
  if (sourceVertices) {
    for (let i = 0; i < sourceVertices.length; i++) {
      const source = sourceVertices[i];
      if (!Number.isInteger(source) || source < 0 || source >= sourceCount) {
        throw new Error('Morph source vertex index is out of range');
      }
      sourceToCompact[source] = i;
    }
  } else {
    for (let i = 0; i < sourceCount; i++) sourceToCompact[i] = i;
  }
  for (const target of primitive.targets) {
    positionDeltas.push(target.POSITION === undefined
      ? null
      : readFloatVec3AccessorCompact(asset, target.POSITION, sourceToCompact, sourceVertices?.length ?? sourceCount));
    normalDeltas.push(target.NORMAL === undefined
      ? null
      : readFloatVec3AccessorCompact(asset, target.NORMAL, sourceToCompact, sourceVertices?.length ?? sourceCount));
  }
  return {
    positionDeltas,
    normalDeltas,
    weights: new Float32Array(MAX_MORPHS)
  };
}
