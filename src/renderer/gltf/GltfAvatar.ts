import { GltfAsset, GltfNode, GltfSkin } from './GltfTypes';
import { parseGlb, readAccessor } from './GlbLoader';
import { GltfGpuPrimitive, uploadGltfPrimitive, destroyGltfPrimitive } from './GltfMesh';
import { GltfMaterialBinding, materialFromGltf } from './GltfMaterial';
import { uploadGltfTexture } from './GltfTexture';

export interface GltfAvatarPrimitive {
  nodeIndex: number;
  meshIndex: number;
  primitiveIndex: number;
  skinIndex: number | null;
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

function identity16(): Float32Array { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

function quatToMatrix(q: number[]): Float32Array {
  const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 1;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const m = identity16();
  m[0] = 1 - (yy + zz); m[1] = xy + wz; m[2] = xz - wy;
  m[4] = xy - wz; m[5] = 1 - (xx + zz); m[6] = yz + wx;
  m[8] = xz + wy; m[9] = yz - wx; m[10] = 1 - (xx + yy);
  return m;
}

export function gltfLocalMatrix(node: GltfNode): Float32Array {
  if (node.matrix?.length === 16) return new Float32Array(node.matrix);
  const t = node.translation ?? [0, 0, 0], s = node.scale ?? [1, 1, 1];
  const m = quatToMatrix(node.rotation ?? [0, 0, 0, 1]);
  m[0] *= s[0]; m[1] *= s[0]; m[2] *= s[0]; m[4] *= s[1]; m[5] *= s[1]; m[6] *= s[1];
  m[8] *= s[2]; m[9] *= s[2]; m[10] *= s[2]; m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

export function updateGltfJointMatrices(avatar: GltfAvatar): void {
  const world: Array<Float32Array | undefined> = new Array(avatar.nodes.length);
  const resolving = new Set<number>();
  const resolve = (index: number): Float32Array => {
    if (world[index]) return world[index]!;
    if (resolving.has(index)) throw new Error(`glTF node cycle at ${index}`);
    const node = avatar.nodes[index]; if (!node) throw new Error(`Missing glTF node ${index}`);
    resolving.add(index);
    const parent = avatar.nodes.findIndex(n => n.children?.includes(index));
    const result = parent >= 0 ? multiply(resolve(parent), gltfLocalMatrix(node)) : gltfLocalMatrix(node);
    resolving.delete(index); world[index] = result; return result;
  };
  for (let i = 0; i < avatar.nodes.length; i++) resolve(i);
  avatar.jointMatrices.fill(0);
  let cursor = 0;
  for (const skin of avatar.skins) {
    const ibm = skin.inverseBindMatrices === undefined ? null : readAccessor(avatar.asset, skin.inverseBindMatrices) as Float32Array;
    for (let i = 0; i < skin.joints.length; i++) {
      const bind = ibm ? ibm.subarray(i * 16, i * 16 + 16) : identity16();
      avatar.jointMatrices.set(multiply(world[skin.joints[i]] ?? identity16(), bind), cursor);
      cursor += 16;
    }
  }
}

export async function loadGltfAvatar(gl: WebGL2RenderingContext, data: ArrayBuffer): Promise<GltfAvatar> {
  const asset = parseGlb(data), nodes = asset.json.nodes ?? [], skins = asset.json.skins ?? [];
  const materials = (asset.json.materials ?? []).map(materialFromGltf), textures = new Map<number, WebGLTexture>();
  const primitives: GltfAvatarPrimitive[] = [];
  const skinOffsets: number[] = [];
  let skinCursor = 0;
  for (let i = 0; i < skins.length; i++) { skinOffsets[i] = skinCursor; skinCursor += skins[i].joints.length; }
  if (skinCursor > 128) throw new Error(`GLB requires ${skinCursor} joints; HD shader limit is 128`);
  try {
    for (let i = 0; i < (asset.json.textures ?? []).length; i++) textures.set(i, await uploadGltfTexture(gl, asset, i));
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]; if (node.mesh === undefined) continue;
      const mesh = asset.json.meshes?.[node.mesh]; if (!mesh) throw new Error(`Node ${ni} references missing mesh ${node.mesh}`);
      const skinIndex = node.skin ?? null;
      if (skinIndex !== null && !skins[skinIndex]) throw new Error(`Node ${ni} references missing skin ${skinIndex}`);
      for (let pi = 0; pi < mesh.primitives.length; pi++) {
        const source = mesh.primitives[pi];
        if ((source.mode ?? 4) !== 4) throw new Error('Only TRIANGLES primitives are supported by the HD avatar path');
        const primitive = uploadGltfPrimitive(gl, asset, source);
        primitive.skinOffset = skinIndex === null ? 0 : skinOffsets[skinIndex];
        primitives.push({ nodeIndex: ni, meshIndex: node.mesh, primitiveIndex: pi, skinIndex, primitive });
      }
    }
    const avatar: GltfAvatar = {
      asset, nodes, skins, primitives, materials, textures,
      morphWeights: (asset.json.meshes ?? []).map(mesh => new Float32Array(mesh.weights ?? [])),
      jointMatrices: new Float32Array(Math.max(16, skinCursor * 16)),
      destroy() { for (const item of this.primitives) destroyGltfPrimitive(gl, item.primitive); for (const texture of this.textures.values()) gl.deleteTexture(texture); this.textures.clear(); },
    };
    updateGltfJointMatrices(avatar);
    return avatar;
  } catch (error) {
    for (const item of primitives) destroyGltfPrimitive(gl, item.primitive);
    for (const texture of textures.values()) gl.deleteTexture(texture);
    throw error;
  }
}
