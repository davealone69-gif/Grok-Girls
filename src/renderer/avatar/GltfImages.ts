/* ------------------------------------------------------------------ */
/* GltfImages — embedded/data-URI texture loading (milestone 8).       */
/* Mirrors native GltfTextures: data-URIs + bufferView images, sampler */
/* state resolved per texture, sRGB storage for base-color/emissive.   */
/* ------------------------------------------------------------------ */

import { GltfAsset } from './GltfTypes';

export async function loadGltfImage(
  asset: GltfAsset,
  imageIndex: number
): Promise<HTMLImageElement> {
  const image = asset.json.images?.[imageIndex];
  if (!image) {
    throw new Error(`Missing image ${imageIndex}`);
  }

  if (image.uri) {
    const element = new Image();
    element.src = image.uri;
    await element.decode();
    return element;
  }

  if (image.bufferView === undefined || !image.mimeType) {
    throw new Error('Unsupported GLB image');
  }

  const view = asset.json.bufferViews?.[image.bufferView];
  if (!view) {
    throw new Error('Missing image bufferView');
  }

  const bytes = new Uint8Array(asset.binary, view.byteOffset ?? 0, view.byteLength);
  const blob = new Blob([bytes], { type: image.mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const element = new Image();
    element.src = url;
    await element.decode();
    return element;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resolveMinFilter(gl: WebGL2RenderingContext, f?: number): number {
  switch (f) {
    case 9728:
      return gl.NEAREST;
    case 9729:
      return gl.LINEAR;
    case 9984:
      return gl.NEAREST_MIPMAP_NEAREST;
    case 9985:
      return gl.LINEAR_MIPMAP_NEAREST;
    case 9986:
      return gl.NEAREST_MIPMAP_LINEAR;
    default:
      return gl.LINEAR_MIPMAP_LINEAR;
  }
}

function resolveMagFilter(gl: WebGL2RenderingContext, f?: number): number {
  return f === 9728 ? gl.NEAREST : gl.LINEAR;
}

function resolveWrap(gl: WebGL2RenderingContext, w?: number): number {
  switch (w) {
    case 33071:
      return gl.CLAMP_TO_EDGE;
    case 33648:
      return gl.MIRRORED_REPEAT;
    default:
      return gl.REPEAT;
  }
}

/** Upload a glTF texture; srgb = base-color/emissive (GPU-decoded). */
export async function uploadGltfTexture(
  gl: WebGL2RenderingContext,
  asset: GltfAsset,
  textureIndex: number,
  srgb = false
): Promise<WebGLTexture> {
  const texture = asset.json.textures?.[textureIndex];
  if (!texture || texture.source === undefined) {
    throw new Error(`Texture ${textureIndex} has no image`);
  }

  const image = await loadGltfImage(asset, texture.source);

  const gpu = gl.createTexture();
  if (!gpu) {
    throw new Error('Unable to create GLB texture');
  }

  const sampler = texture.sampler !== undefined
    ? asset.json.samplers?.[texture.sampler]
    : undefined;

  gl.bindTexture(gl.TEXTURE_2D, gpu);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, resolveMinFilter(gl, sampler?.minFilter));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, resolveMagFilter(gl, sampler?.magFilter));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, resolveWrap(gl, sampler?.wrapS));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, resolveWrap(gl, sampler?.wrapT));
  gl.bindTexture(gl.TEXTURE_2D, null);

  return gpu;
}
