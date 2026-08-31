/* ------------------------------------------------------------------ */
/* HairMaterial — the hair shading contract: strand maps + melanin-    */
/* style color + dual-lobe anisotropic specular + root darkening.      */
/* ------------------------------------------------------------------ */

export interface HairMaterial {
  colorTexture: WebGLTexture;
  roughnessTexture: WebGLTexture;
  directionTexture: WebGLTexture;
  densityTexture: WebGLTexture;

  baseColor: [number, number, number];

  roughness: number;

  anisotropy: number;

  primarySpecular: number;
  secondarySpecular: number;

  rootDarkening: number;

  alphaCutoff: number;
}

/** Canonical hair parameters (reference spec defaults). */
export const DEFAULT_HAIR_PARAMETERS = {
  baseColor: [0.18, 0.07, 0.035] as [number, number, number],
  roughness: 0.42,
  anisotropy: 0.35,
  primarySpecular: 0.85,
  secondarySpecular: 0.35,
  rootDarkening: 0.28,
  alphaCutoff: 0.15
} as const;
