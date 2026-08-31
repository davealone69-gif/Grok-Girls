/* ------------------------------------------------------------------ */
/* IblPipeline — HDR image-based lighting (milestone 4).               */
/*                                                                     */
/* Bootstrap implementation: irradiance/prefiltered hold the studio    */
/* face colors (flat convolution — box-filtered mipmaps approximate    */
/* roughness prefiltering for a flat environment), and the BRDF LUT is */
/* a constant (1,0) stand-in. Sampling empty cubemaps would render     */
/* the IBL contribution black, so this keeps the milestone visible.    */
/*                                                                     */
/* Production path (unchanged shader interface): real HDR equirect     */
/* import + GPU equirect-to-cubemap conversion + irradiance            */
/* convolution + roughness prefiltering + generated BRDF LUT.          */
/* ------------------------------------------------------------------ */

export interface IblPipeline {
  environment: WebGLTexture;
  irradiance: WebGLTexture;
  prefiltered: WebGLTexture;
  brdfLut: WebGLTexture;
}

export interface IblSettings {
  intensity: number;
  rotation: number;
  exposure: number;
}

export const DEFAULT_IBL_SETTINGS: IblSettings = {
  intensity: 1.0,
  rotation: 0.0,
  exposure: 0.0
};

/** Bootstrap studio: six flat face colors (softbox-panel approximation). */
const STUDIO_FACE_VALUES: [number, number, number][] = [
  [1.0, 1.0, 1.0],
  [0.72, 0.72, 0.72],
  [0.45, 0.45, 0.45],
  [0.12, 0.12, 0.12],
  [0.82, 0.82, 0.82],
  [0.35, 0.35, 0.35]
];

/**
 * RGBA16F cubemap. When faceValues is provided the faces are filled
 * (FLOAT source — legal for 16F internal formats in WebGL2); otherwise
 * the texture is allocated empty (HALF_FLOAT, null data).
 */
function createEnvironmentTexture(
  gl: WebGL2RenderingContext,
  size: number,
  faceValues: [number, number, number][] | null = null
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Unable to create environment texture');
  }

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  for (let face = 0; face < 6; face++) {
    let data: Float32Array | null = null;
    if (faceValues) {
      data = new Float32Array(size * size * 4);
      const v = faceValues[face];
      for (let i = 0; i < data.length; i += 4) {
        data[i] = v[0];
        data[i + 1] = v[1];
        data[i + 2] = v[2];
        data[i + 3] = 1.0;
      }
    }
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      0,
      gl.RGBA16F,
      size,
      size,
      0,
      gl.RGBA,
      faceValues ? gl.FLOAT : gl.HALF_FLOAT,
      data
    );
  }

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

  return texture;
}

/**
 * RG16F BRDF integration LUT. Bootstrap: constant (1, 0) so the
 * specular-IBL term is prefiltered * F (production: generated LUT).
 */
function createBrdfLut(
  gl: WebGL2RenderingContext,
  size: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Unable to create BRDF LUT');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);

  const data = new Float32Array(size * size * 2);
  for (let i = 0; i < data.length; i += 2) {
    data[i] = 1.0;
    data[i + 1] = 0.0;
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, size, size, 0, gl.RG, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/**
 * Bootstrap HDR studio environment cubemap (six flat faces).
 * For production this is replaced by a real HDR equirectangular
 * environment and GPU convolution — the shader interface stays the same.
 */
export function generateStudioEnvironment(
  gl: WebGL2RenderingContext,
  size = 512
): WebGLTexture {
  return createEnvironmentTexture(gl, size, STUDIO_FACE_VALUES);
}

export function createIblPipeline(
  gl: WebGL2RenderingContext,
  size = 512
): IblPipeline {
  const environment = createEnvironmentTexture(gl, size);
  const irradiance = createEnvironmentTexture(gl, 64, STUDIO_FACE_VALUES);
  const prefiltered = createEnvironmentTexture(gl, size, STUDIO_FACE_VALUES);
  const brdfLut = createBrdfLut(gl, 256);

  return {
    environment,
    irradiance,
    prefiltered,
    brdfLut
  };
}

/** Delete the IBL GL textures (renderer release path). */
export function destroyIblPipeline(
  gl: WebGL2RenderingContext,
  ibl: IblPipeline
): void {
  gl.deleteTexture(ibl.environment);
  gl.deleteTexture(ibl.irradiance);
  gl.deleteTexture(ibl.prefiltered);
  gl.deleteTexture(ibl.brdfLut);
}
