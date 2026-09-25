/* ------------------------------------------------------------------ */
/* GltfMorphs — real per-vertex morph targets.                        */
/* 3DDD stores full POSITION deltas plus mesh.extras.targetNames.      */
/* We keep the complete arrays so the live editor can apply weights by */
/* rewriting the position buffer, matching the proven native renderer. */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor, toFloat32 } from './GltfAccessor';

export interface MorphBuffers {
  targetNames: string[];
  targetPositionDeltas: Float32Array[];
  targetNormalDeltas: Float32Array[];
  weights: Float32Array;
  /** Compatibility/debug view. The live path uses targetPositionDeltas. */
  positionDeltas: Float32Array;
  normalDeltas: Float32Array;
}

export const MAX_MORPHS = 64;

export function buildMorphBuffers(asset: GltfAsset, primitive: GltfPrimitive): MorphBuffers | null {
  if (!primitive.targets || primitive.targets.length === 0) return null;

  const mesh = asset.json.meshes?.find(m => m.primitives.includes(primitive));
  const names = mesh?.extras?.targetNames ?? [];
  const targetNames = primitive.targets.map((_, i) => names[i] ?? `target${i}`);

  const targetPositionDeltas: Float32Array[] = [];
  const targetNormalDeltas: Float32Array[] = [];

  for (const target of primitive.targets.slice(0, MAX_MORPHS)) {
    targetPositionDeltas.push(
      target.POSITION !== undefined ? toFloat32(readAccessor(asset, target.POSITION)) : new Float32Array()
    );
    targetNormalDeltas.push(
      target.NORMAL !== undefined ? toFloat32(readAccessor(asset, target.NORMAL)) : new Float32Array()
    );
  }

  return {
    targetNames,
    targetPositionDeltas,
    targetNormalDeltas,
    weights: new Float32Array(Math.min(primitive.targets.length, MAX_MORPHS)),
    positionDeltas: targetPositionDeltas[0] ?? new Float32Array(),
    normalDeltas: targetNormalDeltas[0] ?? new Float32Array()
  };
}

/** Apply named weights to a position array. Used by the WebGL live editor. */
export function morphPositions(base: Float32Array, morphs: MorphBuffers, weights: number[]): Float32Array {
  const out = base.slice();
  for (let targetIndex = 0; targetIndex < morphs.targetPositionDeltas.length; targetIndex++) {
    const weight = Math.max(0, Math.min(1, weights[targetIndex] ?? 0));
    if (!weight) continue;
    const delta = morphs.targetPositionDeltas[targetIndex];
    const limit = Math.min(out.length, delta.length);
    for (let i = 0; i < limit; i++) out[i] += delta[i] * weight;
  }
  return out;
}
