import { AvatarMaterial } from '../avatar/AvatarMaterial';
import { GltfMaterial } from './GltfTypes';

export interface GltfMaterialBinding extends AvatarMaterial {
  baseColorTextureIndex: number | null;
  metallicRoughnessTextureIndex: number | null;
  normalTextureIndex: number | null;
  occlusionTextureIndex: number | null;
  emissiveTextureIndex: number | null;
  baseColorFactor: [number, number, number, number];
  emissiveFactor: [number, number, number];
  normalScale: number;
  occlusionStrength: number;
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff: number;
  doubleSided: boolean;
}

function color4(value: number[] | undefined, fallback: [number, number, number, number]): [number, number, number, number] {
  return [value?.[0] ?? fallback[0], value?.[1] ?? fallback[1], value?.[2] ?? fallback[2], value?.[3] ?? fallback[3]];
}

export function materialFromGltf(material: GltfMaterial | undefined): GltfMaterialBinding {
  const pbr = material?.pbrMetallicRoughness;
  const base = color4(pbr?.baseColorFactor, [1, 1, 1, 1]);
  return {
    baseColorTexture: pbr?.baseColorTexture?.index,
    normalTexture: material?.normalTexture?.index,
    roughnessTexture: pbr?.metallicRoughnessTexture?.index,
    metallicTexture: pbr?.metallicRoughnessTexture?.index,
    aoTexture: material?.occlusionTexture?.index,
    baseColorR: base[0],
    baseColorG: base[1],
    baseColorB: base[2],
    roughness: Math.min(1, Math.max(0.04, pbr?.roughnessFactor ?? 1)),
    metallic: Math.min(1, Math.max(0, pbr?.metallicFactor ?? 1)),
    subsurface: 0,
    subsurfaceRadius: 1,
    baseColorTextureIndex: pbr?.baseColorTexture?.index ?? null,
    metallicRoughnessTextureIndex: pbr?.metallicRoughnessTexture?.index ?? null,
    normalTextureIndex: material?.normalTexture?.index ?? null,
    occlusionTextureIndex: material?.occlusionTexture?.index ?? null,
    emissiveTextureIndex: material?.emissiveTexture?.index ?? null,
    baseColorFactor: base,
    emissiveFactor: [material?.emissiveFactor?.[0] ?? 0, material?.emissiveFactor?.[1] ?? 0, material?.emissiveFactor?.[2] ?? 0],
    normalScale: material?.normalTexture?.scale ?? 1,
    occlusionStrength: material?.occlusionTexture?.strength ?? 1,
    alphaMode: material?.alphaMode ?? 'OPAQUE',
    alphaCutoff: material?.alphaCutoff ?? 0.5,
    doubleSided: material?.doubleSided ?? false,
  };
}
