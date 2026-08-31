/* ------------------------------------------------------------------ */
/* MorphTargets — morph-target data + GPU weight upload (milestone 6). */
/* Buffers are DELTAS: convert absolute GLB target positions to        */
/* deltas at load time before uploading.                               */
/* ------------------------------------------------------------------ */

export interface MorphTarget {
  name: string;

  positions: Float32Array;

  normals?: Float32Array;

  weight: number;
}

export interface MorphState {
  targets: MorphTarget[];

  weights: Float32Array;
}

/** Upload per-morph weights into the GPU morph shader's uMorphWeight. */
export function uploadMorphWeights(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  weights: Float32Array
): void {
  const location = gl.getUniformLocation(program, 'uMorphWeight');
  if (!location) {
    return;
  }

  gl.uniform1fv(location, weights);
}
