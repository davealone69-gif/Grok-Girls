import { GltfAsset, GltfNode, GltfSkin } from './GltfTypes';
import { parseGlb, readAccessor } from './GlbLoader';
import { GltfGpuPrimitive, uploadGltfPrimitive, destroyGltfPrimitive } from './GltfMesh';
import { GltfMaterialBinding, materialFromGltf } from './GltfMaterial';
import { uploadGltfTexture, destroyGltfTextures, GltfGpuTextures } from './GltfTexture';

export interface GltfAvatarPrimitive {
  nodeIndex: number;
  meshIndex: number;
  primitive: GltfGpuPrimitive;
}

export interface GltfAvatar {
  asset: GltfAsset;
  nodes: GltfNode[];
  skins: GltfSkin[];
  primitives: GltfAvatarPrimitive[];
  materials: GltfMaterialBinding[];
  textures: Map<number, WebGLTexture>;
  morphWeights: Float32Array[];
  jointMatrices: Float32Array;
  destroy(): void;
}

function identity16(): Float32Array {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

function quatToMatrix(q: number[]): Float32Array {
  const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 1;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const m = identity16();
  m[0] = 1 - (yy + zz); m[1] = xy + wz; m[2] = xz - wy;
  m[4] = xy - wz; m[5] = 1 - (xx + zz); m[6] = yz + wx;
  m[8] = xz + wy; m[9] = yz - wx; m[10] = 1 - (xx + yy);
  return m;
}

function localMatrix(node: GltfNode): Float32Array {
  if (node.matrix && node.matrix.length === 16) return new Float32Array(node.matrix);
  const t = node.translation ?? [0, 0, 0];
  const s = node.scale ?? [1, 1, 1];
  const m = quatToMatrix(node.rotation ?? [0, 0, 0, 1]);
  m[0] *= s[0]; m[1] *= s[0]; m[2] *= s[0];
  m[4] *= s[1]; m[5] *= s[1]; m[6] *= s[1];
  m[8] *= s[2]; m[9] *= s[2]; m[10] *= s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

function invert(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) return identity16();
  const d = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return out;
}

export function updateGltfJointMatrices(avatar: GltfAvatar): void {
  const nodes = avatar.nodes;
  const world = nodes.map(() => identity16());
  const visiting = new Set<number>();
  const resolve = (index: number): Float32Array => {
    if (visiting.has(index)) throw new Error(`glTF node cycle at ${index}`);
    if (world[index] !== undefined && world[index][15] !== 0) return world[index];
    visiting.add(index);
    const node = nodes[index];
    const parent = nodes.findIndex(n => n.children?.includes(index));
    const local = localMatrix(node);
    world[index] = parent >= 0 ? multiply(resolve(parent), local) : local;
    visiting.delete(index);
    return world[index];
  };
  for (let i = 0; i < nodes.length; i++) resolve(i);

  avatar.jointMatrices.fill(0);
  let cursor = 0;
  for (const skin of avatar.skins) {
    const ibm = skin.inverseBindMatrices !== undefined ? readAccessor(avatar.asset, skin.inverseBindMatrices) as Float32Array : null;
    skin.joints.forEach((joint, i) => {
      const jointWorld = world[joint] ?? identity16();
      const bind = ibm ? ibm.subarray(i * 16, i * 16 + 16) : identity16();
      const matrix = multiply(jointWorld, bind);
      if (cursor + 16 <= avatar.jointMatrices.length) avatar.jointMatrices.set(matrix, cursor);
      cursor += 16;
    });
  }
}

export async function loadGltfAvatar(gl: WebGL2RenderingContext, data: ArrayBuffer): Promise<GltfAvatar> {
  const asset = parseGlb(data);
  const nodes = asset.json.nodes ?? [];
  const skins = asset.json.skins ?? [];
  const materials = (asset.json.materials ?? []).map(materialFromGltf);
  const textures = new Map<number, WebGLTexture>();
  const primitives: GltfAvatarPrimitive[] = [];

  try {
    for (let i = 0; i < (asset.json.textures ?? []).length; i++) textures.set(i, await uploadGltfTexture(gl, asset, i));
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      if (node.mesh === undefined) continue;
      const mesh = asset.json.meshes?.[node.mesh];
      if (!mesh) throw new Error(`Node ${ni} references missing mesh ${node.mesh}`);
      for (const primitive of mesh.primitives) {
        if ((primitive.mode ?? 4) !== 4) throw new Error('Only TRIANGLES glTF primitives are supported by the HD avatar path');
        primitives.push({ nodeIndex: ni, meshIndex: node.mesh, primitive: uploadGltfPrimitive(gl, asset, primitive) });
      }
    }
    const morphWeights = (asset.json.meshes ?? []).map(mesh => new Float32Array(mesh.weights ?? []));
    const avatar: GltfAvatar = {
      asset, nodes, skins, primitives, materials, textures, morphWeights,
      jointMatrices: new Float32Array(Math.max(16, skins.reduce((n, skin) => n + skin.joints.length, 0) * 16)),
      destroy() {
        for (const item of this.primitives) destroyGltfPrimitive(gl, item.primitive);
        destroyGltfTextures(gl, Object.fromEntries(this.textures.entries()) as GltfGpuTextures);
        this.textures.clear();
      },
    };
    updateGltfJointMatrices(avatar);
    return avatar;
  } catch (error) {
    for (const item of primitives) destroyGltfPrimitive(gl, item.primitive);
    destroyGltfTextures(gl, Object.fromEntries(textures.entries()) as GltfGpuTextures);
    throw error;
  }
}
