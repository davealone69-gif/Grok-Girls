/* ------------------------------------------------------------------ */
/* SkinMaterial — the full skin shading material contract for the      */
/* avatar viewport: PBR maps + thickness map + subsurface parameters.  */
/*                                                                     */
/* Reference: native renderer.hd HdPbrTextures/HdPbrMaterial layering  */
/* (baseColor/normal/roughness/thickness units 0..3; factor uniforms;  */
/* SSS via wrap light + thickness map).                                */
/* ------------------------------------------------------------------ */

export interface SkinMaterial {
  baseColorTexture: WebGLTexture;
  roughnessTexture: WebGLTexture;
  normalTexture: WebGLTexture;
  thicknessTexture: WebGLTexture;

  baseColorFactor: [number, number, number, number];

  roughness: number;
  metallic: number;

  subsurfaceStrength: number;
  subsurfaceRadius: [number, number, number];
}

/** Canonical defaults for the skin subsurface model (reference spec). */
export const DEFAULT_SUBSURFACE_STRENGTH = 0.65;
export const DEFAULT_SUBSURFACE_RADIUS: [number, number, number] = [1.0, 0.55, 0.4];
