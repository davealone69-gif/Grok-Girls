/* ------------------------------------------------------------------ */
/* EyeTextures — procedural eye maps: iris (radial detail + pupil),    */
/* iris tangent-space normal, sclera (blood detail).                   */
/* ------------------------------------------------------------------ */

export interface EyeTextures {
  iris: WebGLTexture;
  irisNormal: WebGLTexture;
  sclera: WebGLTexture;
}

function canvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function upload(
  gl: WebGL2RenderingContext,
  source: HTMLCanvasElement
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Unable to create eye texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/** Iris: dark pupil, radial gradient + fibre strokes, limbal edge. */
function createIris(size: number): HTMLCanvasElement {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create iris context');
  }

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, size, size);

  const irisRadius = size * 0.42;
  const gradient = ctx.createRadialGradient(cx, cy, size * 0.035, cx, cy, irisRadius);
  gradient.addColorStop(0, '#15100b');
  gradient.addColorStop(0.18, '#55331e');
  gradient.addColorStop(0.48, '#8a5935');
  gradient.addColorStop(0.78, '#54321f');
  gradient.addColorStop(0.94, '#17100b');
  gradient.addColorStop(1, '#050403');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
  ctx.fill();

  // radial fibre detail
  for (let i = 0; i < 420; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * irisRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const length = 5 + Math.random() * 35;
    ctx.strokeStyle = `rgba(30,15,8,${0.15 + Math.random() * 0.4})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx + Math.cos(angle) * (radius + length), cy + Math.sin(angle) * (radius + length));
    ctx.stroke();
  }

  // pupil
  ctx.fillStyle = '#050403';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/** Iris normal map: fine tangential variation. */
function createIrisNormal(size: number): HTMLCanvasElement {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create iris normal context');
  }

  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 30;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = 255;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return c;
}

/** Sclera: off-white base with subtle blood-vessel detail. */
function createSclera(size: number): HTMLCanvasElement {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create sclera context');
  }

  ctx.fillStyle = '#eee9e4';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 300; i++) {
    ctx.strokeStyle = `rgba(150,35,35,${Math.random() * 0.18})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.8;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.25, y - 10, size * 0.7, y + 10, size, y);
    ctx.stroke();
  }

  return c;
}

export function createEyeTextures(
  gl: WebGL2RenderingContext,
  size = 1024
): EyeTextures {
  return {
    iris: upload(gl, createIris(size)),
    irisNormal: upload(gl, createIrisNormal(size)),
    sclera: upload(gl, createSclera(size))
  };
}

/** Delete the generated eye textures (renderer release path). */
export function destroyEyeTextures(
  gl: WebGL2RenderingContext,
  textures: EyeTextures
): void {
  gl.deleteTexture(textures.iris);
  gl.deleteTexture(textures.irisNormal);
  gl.deleteTexture(textures.sclera);
}
