/* ------------------------------------------------------------------ */
/* GltfSkeleton — actual skin-joint evaluation from the node hierarchy */
/* + inverse bind matrices (milestone 8 production piece #1).          */
/* Joint matrix = globalNodeTransform * inverseBindMatrix, computed on */
/* the CPU and uploaded once per animated frame (mirrors native        */
/* SkeletonMatrices: global chain × cached inverse-bind).              */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfNode } from './GltfTypes';
import { readAccessor, toFloat32 } from './GltfAccessor';
import { Mat4, mat4Identity, mat4Multiply, mat4Scale, mat4Translation } from '../math';

export const MAX_JOINTS = 256;

/** Local TRS (or matrix) -> Mat4 (column-major). */
function nodeLocalMatrix(node: GltfNode): Mat4 {
  if (node.matrix) {
    const m = new Float32Array(16);
    m.set(node.matrix);
    return m;
  }

  const t = node.translation ?? [0, 0, 0];
  const s = node.scale ?? [1, 1, 1];
  const r = node.rotation ?? [0, 0, 0, 1];

  // T * R * S
  let out = mat4Multiply(quatToMat4(r), mat4Scale(s[0], s[1], s[2]));
  out = mat4Multiply(mat4Translation(t[0], t[1], t[2]), out);
  return out;
}

export function quatToMat4(q: number[]): Mat4 {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  const m = new Float32Array(16);
  m[0] = 1 - (yy + zz);
  m[1] = xy + wz;
  m[2] = xz - wy;
  m[3] = 0;
  m[4] = xy - wz;
  m[5] = 1 - (xx + zz);
  m[6] = yz + wx;
  m[7] = 0;
  m[8] = xz + wy;
  m[9] = yz - wx;
  m[10] = 1 - (xx + yy);
  m[11] = 0;
  m[12] = 0;
  m[13] = 0;
  m[14] = 0;
  m[15] = 1;
  return m;
}

/** Global (rest-pose) transforms for every node. */
export function computeGlobalTransforms(nodes: GltfNode[]): Mat4[] {
  const count = nodes.length;
  const globals: Mat4[] = new Array(count);
  const parents: number[] = new Array(count).fill(-1);

  for (let i = 0; i < count; i++) {
    const children = nodes[i].children;
    if (children) {
      for (const c of children) {
        if (c >= 0 && c < count) parents[c] = i;
      }
    }
  }

  const compute = (i: number): Mat4 => {
    if (globals[i]) return globals[i];
    const local = nodeLocalMatrix(nodes[i]);
    const p = parents[i];
    globals[i] = p >= 0 ? mat4Multiply(compute(p), local) : local;
    return globals[i];
  };

  for (let i = 0; i < count; i++) {
    compute(i);
  }
  return globals;
}

/**
 * Evaluate joint matrices for the first skin:
 * jointMatrices[joint] = globalTransform(jointNode) * inverseBindMatrix.
 * Returns MAX_JOINTS * 16 floats (zero-filled beyond the joint count).
 */
export function evaluateSkins(asset: GltfAsset, globals: Mat4[]): Float32Array {
  const out = new Float32Array(MAX_JOINTS * 16);
  const skin = asset.json.skins?.[0];
  if (!skin) return out;

  const joints = skin.joints ?? [];
  let ibm: Float32Array = new Float32Array(0);

  if (skin.inverseBindMatrices !== undefined) {
    ibm = toFloat32(readAccessor(asset, skin.inverseBindMatrices));
  }

  const n = Math.min(joints.length, MAX_JOINTS);
  for (let j = 0; j < n; j++) {
    const nodeIndex = joints[j];
    const global = nodeIndex >= 0 && nodeIndex < globals.length ? globals[nodeIndex] : mat4Identity();
    const ib = ibm.subarray(j * 16, j * 16 + 16);
    const m = mat4Multiply(global, ib);
    out.set(m, j * 16);
  }
  return out;
}
