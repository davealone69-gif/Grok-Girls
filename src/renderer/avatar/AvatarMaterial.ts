/* AvatarMaterial — mirror of com.example.hdrenderer.avatar.AvatarMaterial. */

export interface AvatarMaterial {
  baseColorTexture?: number;
  normalTexture?: number;
  roughnessTexture?: number;
  metallicTexture?: number;
  aoTexture?: number;
  baseColorR?: number;
  baseColorG?: number;
  baseColorB?: number;
  roughness?: number;
  metallic?: number;
  subsurface?: number;
  subsurfaceRadius?: number;
}

export const DEFAULT_AVATAR_MATERIAL: AvatarMaterial = {
  baseColorTexture: 0,
  normalTexture: 0,
  roughnessTexture: 0,
  metallicTexture: 0,
  aoTexture: 0,
  baseColorR: 1,
  baseColorG: 1,
  baseColorB: 1,
  roughness: 0.5,
  metallic: 0.0,
  subsurface: 0.0,
  subsurfaceRadius: 1.0
};
