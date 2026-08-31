/* ------------------------------------------------------------------ */
/* GltfMorphs — morph-target metadata + GPU delta buffers (milestone 8,*/
/* feeding the milestone-6 face system). GLB targets are deltas;       */
/* absolute targets must be converted at load.                         */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor, toFloat32 } from './GltfAccessor';

export interface GltfMorph {
  position?: number;
  normal?: number;
  tangent?: number;
  weight: number;
}

/** Metadata view of the primitive's morph targets. */
export function readMorphTargets(asset: GltfAsset, primitive: GltfPrimitive): GltfMorph[][] {
  if (!primitive.targets) {
    return [];
  }

  return primitive.targets.map((target) => {
    const result: GltfMorph = { weight: 0 };

    if (target.POSITION !== undefined) {
      result.position = target.POSITION;
    }
    if (target.NORMAL !== undefined) {
      result.normal = target.NORMAL;
    }
    if (target.TANGENT !== undefined) {
      result.tangent = target.TANGENT;
    }

    return [result];
  });
}

export interface MorphBuffers {
  positionDeltas: Float32Array; // 64 * 3
  normalDeltas: Float32Array; // 64 * 3
  weights: Float32Array; // 64
}

export const MAX_MORPHS = 64;

/** Extract delta buffers for the GPU morph uniforms (zero-filled). */
export function buildMorphBuffers(asset: GltfAsset, primitive: GltfPrimitive): MorphBuffers | null {
  if (!primitive.targets || primitive.targets.length === 0) {
    return null;
  }

  const positionDeltas = new Float32Array(MAX_MORPHS * 3);
  const normalDeltas = new Float32Array(MAX_MORPHS * 3);
  const weights = new Float32Array(MAX_MORPHS);

  const n = Math.min(primitive.targets.length, MAX_MORPHS);
  for (let i = 0; i < n; i++) {
    const target = primitive.targets[i];
    if (target.POSITION !== undefined) {
      positionDeltas.set(toFloat32(readAccessor(asset, target.POSITION)), i * 3);
    }
    if (target.NORMAL !== undefined) {
      normalDeltas.set(toFloat32(readAccessor(asset, target.NORMAL)), i * 3);
    }
  }

  return { positionDeltas, normalDeltas, weights };
}
