import { GltfAsset } from './GltfTypes';

export interface GltfGpuTextures {
  baseColor: WebGLTexture | null;
  metallicRoughness: WebGLTexture | null;
  normal: WebGLTexture | null;
  occlusion: WebGLTexture | null;
  emissive: WebGLTexture | null;
}

function dataUriToBlob(uri: string): Blob {
  const comma = uri.indexOf(',');
  if (comma < 0) throw new Error('Invalid data URI');
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (header.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: header.slice(5).split(';')[0] || 'application/octet-stream' });
  }
  return new Blob([decodeURIComponent(payload)], { type: header.slice(5) || 'text/plain' });
}

export async function decodeGltfImage(asset: GltfAsset, imageIndex: number): Promise<ImageBitmap | HTMLImageElement> {
  const image = asset.json.images?.[imageIndex];
  if (!image) throw new Error(`Missing image ${imageIndex}`);

  let blob: Blob;
  if (image.uri) {
    blob = image.uri.startsWith('data:') ? dataUriToBlob(image.uri) : await (await fetch(image.uri)).blob();
  } else if (image.bufferView !== undefined) {
    const view = asset.json.bufferViews?.[image.bufferView];
    if (!view || view.buffer !== 0) throw new Error(`Invalid embedded image ${imageIndex}`);
    blob = new Blob([asset.binary.slice(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)], { type: image.mimeType ?? 'application/octet-stream' });
  } else {
    throw new Error(`Image ${imageIndex} has no URI or bufferView`);
  }

  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadGltfTexture(gl: WebGL2RenderingContext, asset: GltfAsset, textureIndex: number): Promise<WebGLTexture> {
  const texture = asset.json.textures?.[textureIndex];
  if (!texture || texture.source === undefined) throw new Error(`Texture ${textureIndex} has no source`);
  const image = await decodeGltfImage(asset, texture.source);
  const gpu = gl.createTexture();
  if (!gpu) throw new Error('Unable to create GLB texture');
  gl.bindTexture(gl.TEXTURE_2D, gpu);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return gpu;
}

export function destroyGltfTextures(gl: WebGL2RenderingContext, textures: Partial<GltfGpuTextures>): void {
  for (const texture of Object.values(textures)) if (texture) gl.deleteTexture(texture);
}
