/* HDR image-based lighting resources. Float textures here are sampling resources, not render targets. */

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

export const DEFAULT_IBL_SETTINGS: IblSettings = { intensity: 1, rotation: 0, exposure: 0 };

const STUDIO_FACE_VALUES: [number, number, number][] = [
  [1.2, 1.08, 0.98], [0.72, 0.76, 0.84], [0.34, 0.39, 0.5],
  [0.055, 0.055, 0.075], [0.82, 0.86, 0.96], [0.26, 0.22, 0.3]
];

const pipelineCache = new WeakMap<WebGL2RenderingContext, IblPipeline>();

function createEnvironmentTexture(gl: WebGL2RenderingContext, size: number): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('IBL: unable to create cubemap');
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  for (let face = 0; face < 6; face++) {
    const data = new Float32Array(size * size * 4);
    const c = STUDIO_FACE_VALUES[face];
    for (let y = 0; y < size; y++) {
      const v = y / Math.max(1, size - 1);
      const vertical = 0.72 + 0.28 * (1 - v);
      for (let x = 0; x < size; x++) {
        const u = x / Math.max(1, size - 1);
        const panel = 0.92 + 0.08 * Math.sin(u * Math.PI);
        const p = (y * size + x) * 4;
        data[p] = c[0] * vertical * panel;
        data[p + 1] = c[1] * vertical * panel;
        data[p + 2] = c[2] * vertical * panel;
        data[p + 3] = 1;
      }
    }
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.FLOAT, data);
  }
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  return texture;
}

function radicalInverseVdC(bits: number): number {
  let b = bits >>> 0;
  b = ((b << 16) | (b >>> 16)) >>> 0;
  b = (((b & 0x55555555) << 1) | ((b & 0xAAAAAAAA) >>> 1)) >>> 0;
  b = (((b & 0x33333333) << 2) | ((b & 0xCCCCCCCC) >>> 2)) >>> 0;
  b = (((b & 0x0F0F0F0F) << 4) | ((b & 0xF0F0F0F0) >>> 4)) >>> 0;
  return b * 2.3283064365386963e-10;
}

function geometrySchlickGGX(ndotV: number, roughness: number): number {
  const k = ((roughness + 1) * (roughness + 1)) / 8;
  return ndotV / (ndotV * (1 - k) + k);
}

function createBrdfLut(gl: WebGL2RenderingContext, size = 256): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('IBL: unable to create BRDF LUT');
  const samples = 64;
  const data = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y++) {
    const roughness = Math.max(0.001, (y + 0.5) / size);
    const alpha = roughness * roughness;
    for (let x = 0; x < size; x++) {
      const ndotV = Math.max(0.001, (x + 0.5) / size);
      const sinV = Math.sqrt(Math.max(0, 1 - ndotV * ndotV));
      const vx = sinV, vz = ndotV;
      let scale = 0, bias = 0;
      for (let i = 0; i < samples; i++) {
        const u1 = i / samples;
        const u2 = radicalInverseVdC(i);
        const phi = 2 * Math.PI * u1;
        const cosTheta = Math.sqrt((1 - u2) / (1 + (alpha * alpha - 1) * u2));
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        const hx = Math.cos(phi) * sinTheta;
        const hy = Math.sin(phi) * sinTheta;
        const hz = cosTheta;
        const voh = Math.max(0, vx * hx + vz * hz);
        const lx = 2 * voh * hx - vx;
        const ly = 2 * voh * hy;
        const lz = 2 * voh * hz - vz;
        const ndotL = Math.max(0, lz);
        const ndotH = Math.max(0, hz);
        if (ndotL <= 0 || ndotH <= 0) continue;
        const gv = geometrySchlickGGX(ndotV, roughness);
        const gl = geometrySchlickGGX(ndotL, roughness);
        const gvis = (gv * gl * voh) / Math.max(ndotH * ndotV, 1e-5);
        const fc = Math.pow(1 - voh, 5);
        scale += (1 - fc) * gvis;
        bias += fc * gvis;
      }
      const p = (y * size + x) * 2;
      data[p] = scale / samples;
      data[p + 1] = bias / samples;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, size, size, 0, gl.RG, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function generateStudioEnvironment(gl: WebGL2RenderingContext, size = 256): WebGLTexture {
  return createEnvironmentTexture(gl, Math.max(16, Math.min(1024, Math.round(size))));
}

export function createIblPipeline(gl: WebGL2RenderingContext, size = 256): IblPipeline {
  const cached = pipelineCache.get(gl);
  if (cached) return cached;
  const cubeSize = Math.max(16, Math.min(1024, Math.round(size)));
  const pipeline: IblPipeline = {
    environment: createEnvironmentTexture(gl, cubeSize),
    irradiance: createEnvironmentTexture(gl, 64),
    prefiltered: createEnvironmentTexture(gl, cubeSize),
    brdfLut: createBrdfLut(gl, 256)
  };
  pipelineCache.set(gl, pipeline);
  return pipeline;
}

export function destroyIblPipeline(gl: WebGL2RenderingContext, ibl: IblPipeline): void {
  gl.deleteTexture(ibl.environment);
  gl.deleteTexture(ibl.irradiance);
  gl.deleteTexture(ibl.prefiltered);
  gl.deleteTexture(ibl.brdfLut);
  if (pipelineCache.get(gl) === ibl) pipelineCache.delete(gl);
}
