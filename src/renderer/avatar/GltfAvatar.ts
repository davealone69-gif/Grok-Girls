/* ------------------------------------------------------------------ */
/* GltfAvatar — loader entry point (milestone 8): GLB -> AvatarAsset   */
/* with real texture assignment, real skin evaluation, real morph      */
/* buffers. The asset renders through the EXISTING HD renderer (skin   */
/* program + fragment, shadow pass, cinematic output) — no second      */
/* competing rendering path.                                           */
/* ------------------------------------------------------------------ */

import { parseGlb } from './GlbLoader';
import { GltfAsset, GltfNode, GltfSkin } from './GltfTypes';
import { uploadPrimitive, GpuPrimitive } from './GltfMesh';
import { uploadGltfTexture } from './GltfImages';
import { WebPbrMaterial, createPbrMaterial } from './GltfMaterial';
import { computeGlobalTransforms, evaluateSkins } from './GltfSkeleton';
import { Mat4, mat4Identity } from '../math';

export interface AvatarAsset {
  /** Raw parsed GLB — kept for per-frame skin re-evaluation. */
  gltf: GltfAsset;

  primitives: GpuPrimitive[];

  materials: WebPbrMaterial[];

  nodes: GltfNode[];

  skins: GltfSkin[];

  morphWeights: Float32Array[];

  jointMatrices: Float32Array;

  /** Per-mesh global transform (first node referencing each mesh). */
  meshModels: Mat4[];
}

export async function loadAvatarGlb(
  gl: WebGL2RenderingContext,
  data: ArrayBuffer
): Promise<AvatarAsset> {
  const asset = parseGlb(data);

  const primitives: GpuPrimitive[] = [];
  const materials: WebPbrMaterial[] = [];

  for (const material of asset.json.materials ?? []) {
    materials.push(createPbrMaterial(material));
  }

  // Resolve every texture slot into the PBR material (sRGB for
  // base-color/emissive; linear for normal/MR/occlusion).
  for (let mi = 0; mi < materials.length; mi++) {
    const mat = asset.json.materials?.[mi];
    const out = materials[mi];
    const pbr = mat?.pbrMetallicRoughness;
    if (pbr?.baseColorTexture) {
      out.baseColorTexture = await uploadGltfTexture(gl, asset, pbr.baseColorTexture.index, true);
    }
    if (pbr?.metallicRoughnessTexture) {
      out.metallicRoughnessTexture = await uploadGltfTexture(gl, asset, pbr.metallicRoughnessTexture.index, false);
    }
    if (mat?.normalTexture) {
      out.normalTexture = await uploadGltfTexture(gl, asset, mat.normalTexture.index, false);
    }
    if (mat?.occlusionTexture) {
      out.occlusionTexture = await uploadGltfTexture(gl, asset, mat.occlusionTexture.index, false);
    }
    if (mat?.emissiveTexture) {
      out.emissiveTexture = await uploadGltfTexture(gl, asset, mat.emissiveTexture.index, true);
    }
  }

  const meshCount = asset.json.meshes?.length ?? 0;
  let meshIndex = 0;
  for (const mesh of asset.json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      primitives.push(uploadPrimitive(gl, asset, primitive, meshIndex));
    }
    meshIndex++;
  }

  const nodes = asset.json.nodes ?? [];
  const globals = computeGlobalTransforms(nodes);
  const jointMatrices = evaluateSkins(asset, globals);

  // Per-mesh model = global transform of the first node referencing it.
  const meshModels: Mat4[] = new Array(meshCount);
  const nodeOfMesh: number[] = new Array(meshCount).fill(-1);
  for (let n = 0; n < nodes.length; n++) {
    const m = nodes[n].mesh;
    if (m !== undefined && m >= 0 && m < meshCount && nodeOfMesh[m] === -1) {
      nodeOfMesh[m] = n;
    }
  }
  for (let m = 0; m < meshCount; m++) {
    meshModels[m] = nodeOfMesh[m] >= 0 ? globals[nodeOfMesh[m]] : mat4Identity();
  }

  const morphWeights: Float32Array[] = primitives.map((p) => p.morphs?.weights ?? new Float32Array(64));

  return {
    gltf: asset,
    primitives,
    materials,
    nodes,
    skins: asset.json.skins ?? [],
    morphWeights,
    jointMatrices,
    meshModels
  };
}

/** Free GL resources owned by the asset (release path). */
export function disposeAvatarAsset(gl: WebGL2RenderingContext, asset: AvatarAsset): void {
  for (const prim of asset.primitives) {
    gl.deleteVertexArray(prim.vao);
    if (prim.indexBuffer) gl.deleteBuffer(prim.indexBuffer);
  }
  const deleted = new Set<WebGLTexture>();
  for (const mat of asset.materials) {
    for (const tex of [mat.baseColorTexture, mat.metallicRoughnessTexture, mat.normalTexture, mat.occlusionTexture, mat.emissiveTexture]) {
      if (tex && !deleted.has(tex)) {
        deleted.add(tex);
        gl.deleteTexture(tex);
      }
    }
  }
}

/** Re-evaluate joint matrices from (possibly animated) node transforms. */
export function updateSkeleton(asset: AvatarAsset): void {
  const globals = computeGlobalTransforms(asset.nodes);
  asset.jointMatrices = evaluateSkins(asset.gltf, globals);
}
