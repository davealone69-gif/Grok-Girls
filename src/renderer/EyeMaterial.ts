/* ------------------------------------------------------------------ */
/* EyeMaterial — the eye shading contract: procedural maps,             */
/* independent per-eye parameters (iris scale/color, pupil radius,      */
/* cornea IOR, wetness, per-region roughness).                          */
/* ------------------------------------------------------------------ */

export interface EyeMaterial {
  irisTexture: WebGLTexture;
  irisNormalTexture: WebGLTexture;
  scleraTexture: WebGLTexture;

  irisColor: [number, number, number];

  irisScale: number;

  pupilRadius: number;

  corneaIOR: number;

  wetness: number;

  scleraRoughness: number;

  irisRoughness: number;
}

/** Brown iris tint matching the procedural iris gradient. */
export const DEFAULT_IRIS_COLOR: [number, number, number] = [0.36, 0.24, 0.13];

/** Canonical eye parameters (reference spec defaults). */
export const DEFAULT_EYE_PARAMETERS = {
  irisScale: 1.0,
  pupilRadius: 0.13,
  corneaIOR: 1.376,
  wetness: 1.0,
  scleraRoughness: 0.28,
  irisRoughness: 0.18
} as const;
