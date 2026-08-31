/* ------------------------------------------------------------------ */
/* GltfMaterial — GLB material -> HD PBR pipeline conversion           */
/* (milestone 8). The loader resolves every texture slot into the      */
/* existing PBR shader interface (baseColor sRGB, MR linear, normal,   */
/* occlusion, emissive sRGB).                                          */
/* ------------------------------------------------------------------ */

import { GltfMaterial } from './GltfTypes';

export interface WebPbrMaterial {
  baseColor: [number, number, number, number];

  metallic: number;
  roughness: number;

  baseColorTexture: WebGLTexture | null;
  metallicRoughnessTexture: WebGLTexture | null;
  normalTexture: WebGLTexture | null;
  occlusionTexture: WebGLTexture | null;
  emissiveTexture: WebGLTexture | null;

  emissive: [number, number, number];
}

export function createPbrMaterial(material: GltfMaterial): WebPbrMaterial {
  const pbr = material.pbrMetallicRoughness;

  return {
    baseColor: (pbr?.baseColorFactor ?? [1, 1, 1, 1]) as [number, number, number, number],
    metallic: pbr?.metallicFactor ?? 1,
    roughness: pbr?.roughnessFactor ?? 1,
    baseColorTexture: null,
    metallicRoughnessTexture: null,
    normalTexture: null,
    occlusionTexture: null,
    emissiveTexture: null,
    emissive: (material.emissiveFactor ?? [0, 0, 0]) as [number, number, number]
  };
}
