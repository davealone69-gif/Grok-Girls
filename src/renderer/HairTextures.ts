/* ------------------------------------------------------------------ */
/* HairTextures — procedural hair maps: strand color, roughness,       */
/* direction (tangent-space flow), density/alpha mask.                 */
/* ------------------------------------------------------------------ */

export interface HairTextures {
  color: WebGLTexture;
  roughness: WebGLTexture;
  direction: WebGLTexture;
  density: WebGLTexture;
}

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function upload(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create hair texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/** Strand color: dark base + individual hair strokes (root-to-tip). */
function createColor(size: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Hair color context unavailable');
  }

  ctx.fillStyle = '#342016';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 10 + Math.random() * 80;
    const brightness = 25 + Math.random() * 45;
    ctx.strokeStyle = `rgb(${brightness},${brightness * 0.65},${brightness * 0.45})`;
    ctx.lineWidth = 0.4 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, y + length);
    ctx.stroke();
  }

  return canvas;
}

/** Roughness: uniform mid-gray (scaled by the uRoughness uniform). */
function createRoughness(size: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Hair roughness context unavailable');
  }

  ctx.fillStyle = '#686868';
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

/** Direction: tangent-space flow, (128, 255, 128) = +Y (down strands). */
function createDirection(size: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Hair direction context unavailable');
  }

  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 128;
    image.data[i + 1] = 255;
    image.data[i + 2] = 128;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return canvas;
}

/** Density/alpha mask: white with a broken-up silhouette. */
function createDensity(size: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Hair density context unavailable');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // break up the hair silhouette
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.45})`;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 8);
  }

  return canvas;
}

export function createHairTextures(
  gl: WebGL2RenderingContext,
  size = 1024
): HairTextures {
  return {
    color: upload(gl, createColor(size)),
    roughness: upload(gl, createRoughness(size)),
    direction: upload(gl, createDirection(size)),
    density: upload(gl, createDensity(size))
  };
}

/** Delete the generated hair textures (renderer release path). */
export function destroyHairTextures(
  gl: WebGL2RenderingContext,
  textures: HairTextures
): void {
  gl.deleteTexture(textures.color);
  gl.deleteTexture(textures.roughness);
  gl.deleteTexture(textures.direction);
  gl.deleteTexture(textures.density);
}
