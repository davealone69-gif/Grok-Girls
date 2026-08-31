/* ------------------------------------------------------------------ */
/* ProceduralSkinTextures — procedural skin maps for the avatar        */
/* viewport (reference: native renderer.hd texture path).              */
/*                                                                     */
/* Produces three canvas-generated maps and uploads them:              */
/*   - baseColor: sRGB8_ALPHA8  (GPU decodes to linear at sample time) */
/*   - roughness: RGBA8, R channel = roughness (data, not sRGB)        */
/*   - normal:    RGBA8, tangent-space (x,y) variation around 128/128  */
/* The fragment samples them with factor uniforms and derivative-based */
/* TBN, so no tangent attribute is required.                           */
/* ------------------------------------------------------------------ */

export interface ProceduralSkinTextures {
  baseColor: WebGLTexture;
  roughness: WebGLTexture;
  normal: WebGLTexture;
  size: number;
}

function createTexture(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  internalFormat: number,
  format: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create WebGL texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * Soft grayscale noise blended with 'overlay' composite.
 * NOTE: putImageData ignores globalCompositeOperation, so the noise is
 * staged on a temp canvas and composited with drawImage (which honours
 * the overlay blend mode).
 */
function noise(ctx: CanvasRenderingContext2D, size: number, strength: number): void {
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * strength;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  const temp = makeCanvas(size);
  const tempCtx = temp.getContext('2d');
  if (!tempCtx) throw new Error('Unable to create 2D context');
  tempCtx.putImageData(image, 0, 0);

  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(temp, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function createBaseColor(size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D context');

  ctx.fillStyle = '#d99b82';
  ctx.fillRect(0, 0, size, size);

  noise(ctx, size, 22);

  // warm center glow fading into a darker, redder rim
  const gradient = ctx.createRadialGradient(
    size * 0.5, size * 0.45, size * 0.05,
    size * 0.5, size * 0.5, size * 0.7
  );
  gradient.addColorStop(0, 'rgba(255,190,165,0.18)');
  gradient.addColorStop(1, 'rgba(100,45,35,0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

function createRoughness(size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D context');

  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, size, size);

  noise(ctx, size, 55);

  return canvas;
}

function createNormal(size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create 2D context');

  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const variation = (Math.random() - 0.5) * 16;
    image.data[i] = 128 + variation;
    image.data[i + 1] = 128 + variation;
    image.data[i + 2] = 255;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return canvas;
}

export function createProceduralSkinTextures(
  gl: WebGL2RenderingContext,
  size = 1024
): ProceduralSkinTextures {
  const baseColorCanvas = createBaseColor(size);
  const roughnessCanvas = createRoughness(size);
  const normalCanvas = createNormal(size);
  const srgb8Alpha8 = gl.SRGB8_ALPHA8;
  const rgba8 = gl.RGBA8;

  return {
    baseColor: createTexture(gl, baseColorCanvas, srgb8Alpha8, gl.RGBA),
    roughness: createTexture(gl, roughnessCanvas, rgba8, gl.RGBA),
    normal: createTexture(gl, normalCanvas, rgba8, gl.RGBA),
    size
  };
}

/** Delete the generated GL textures (renderer release path). */
export function destroyProceduralSkinTextures(
  gl: WebGL2RenderingContext,
  textures: ProceduralSkinTextures
): void {
  gl.deleteTexture(textures.baseColor);
  gl.deleteTexture(textures.roughness);
  gl.deleteTexture(textures.normal);
}
