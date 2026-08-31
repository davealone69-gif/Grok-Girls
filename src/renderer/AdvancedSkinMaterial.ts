/* ------------------------------------------------------------------ */
/* AdvancedSkinMaterial — skin-specific shading contract (milestone 5):*/
/* six texture maps + subsurface/scatter/oil/pore/specular controls so */
/* skin behaves differently from plastic, not just recoloured.         */
/* ------------------------------------------------------------------ */

export interface AdvancedSkinTextures {
  baseColor: WebGLTexture;
  normal: WebGLTexture;
  roughness: WebGLTexture;
  thickness: WebGLTexture;
  specular: WebGLTexture;
  pore: WebGLTexture;
}

export interface AdvancedSkinMaterial {
  subsurfaceStrength: number;

  scatterRadius: [number, number, number];

  epidermalStrength: number;

  oilStrength: number;

  poreStrength: number;

  roughness: number;

  specular: number;
}

/** Canonical skin settings (reference spec defaults). */
export const DEFAULT_ADVANCED_SKIN_MATERIAL: AdvancedSkinMaterial = {
  subsurfaceStrength: 0.72,
  scatterRadius: [1.0, 0.42, 0.18],
  epidermalStrength: 0.8,
  oilStrength: 0.32,
  poreStrength: 0.18,
  roughness: 0.42,
  specular: 0.65
};
