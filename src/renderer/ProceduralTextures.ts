/* ------------------------------------------------------------------ */
/* ProceduralTextures — web mirror of the native texture layer.        */
/*                                                                     */
/* Mirrors native PbrTexture/GltfTextures upload semantics:            */
/*   - RGBA8 storage + mipmaps (LINEAR_MIPMAP_LINEAR / LINEAR /        */
/*     REPEAT) — maps are uploaded NON-sRGB and the shader linearizes  */
/*     base color with pow(2.2), exactly like native HdPbrShader.      */
/*                                                                     */
/* Mirrors native HdPbrShader unit layout:                             */
/*   0 baseColor | 1 normal | 2 metallicRoughness | 3 occlusion |      */
/*   4 emissive                                                        */
/*   (occlusion/emissive are absent here -> uHas*Map flags = 0)        */
/*                                                                     */
/* The HdAvatarRenderer fragment samples these maps with the native    */
/* channel conventions:                                                */
/*   - baseColor: sRGB albedo (shader pow-2.2 linearizes it)           */
/*   - metallicRoughness: G = roughness, B = metallic, R unused        */
/*   - normal: tangent-space *2-1 (TBN in shader, vTangent.w handed-   */
/*     ness), canvas +x = tangent, canvas +y (down) = bitangent        */
/*                                                                     */
/* Later GLB/texture parity can swap the canvas sources for decoded    */
/* glTF images behind the same interface + uniform contract.           */
/* ------------------------------------------------------------------ */

export interface ProceduralSkinMaps {
  baseColor: WebGLTexture;
  normal: WebGLTexture;
  metallicRoughness: WebGLTexture;
}

export interface ProceduralTextureOptions {
  /** Deterministic RNG seed — same seed -> identical maps. */
  seed?: number;
  /** Square map resolution (power of two for clean mipmaps). */
  size?: number;
}

/** mulberry32 — small deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ProceduralTextures: 2D canvas unavailable');
  return [canvas, ctx];
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/* ---- base color: skin albedo with soft variation + freckles ---- */
function paintBaseColor(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  // vertical gradient, sRGB values (the shader pow-2.2 linearizes)
  const top: [number, number, number] = [238, 192, 166];
  const bottom: [number, number, number] = [224, 170, 148];
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
  grad.addColorStop(1, `rgb(${bottom[0]},${bottom[1]},${bottom[2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // large blood-suffusion blotches (very subtle redness)
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 20 + rng() * 70;
    const dr = 12 + rng() * 14;
    const dg = (rng() - 0.5) * 8;
    const db = (rng() - 0.5) * 6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${clamp255(top[0] + dr)},${clamp255(top[1] + dg)},${clamp255(top[2] + db)},${0.05 + rng() * 0.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // freckles
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 2.2;
    const a = 0.08 + rng() * 0.14;
    const shift = (rng() - 0.5) * 26;
    ctx.fillStyle = `rgba(${clamp255(top[0] + shift - 10)},${clamp255(top[1] + shift - 12)},${clamp255(top[2] + shift - 14)},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---- metallic-roughness: G = roughness (data, not sRGB), B = 0 ---- */
function paintMetallicRoughness(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  const baseRough = 0.44; // skin
  ctx.fillStyle = `rgb(255,${Math.round(baseRough * 255)},0)`;
  ctx.fillRect(0, 0, size, size);

  // soft zone variation
  for (let i = 0; i < 50; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 24 + rng() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dv = (rng() - 0.5) * 26;
    g.addColorStop(0, `rgba(255,${clamp255(Math.round(baseRough * 255) + dv)},0,0.35)`);
    g.addColorStop(1, 'rgba(255,128,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // fine pore-scale speckle
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const dv = (rng() - 0.5) * 16;
    ctx.fillStyle = `rgba(255,${clamp255(Math.round(baseRough * 255) + dv)},0,0.25)`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/* ---- normal: tangent-space, base (128,128,255) + micro pores ---- */
function paintNormal(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // large soft bumps (very subtle)
  for (let i = 0; i < 36; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 30 + rng() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const amp = 4 + rng() * 8;
    g.addColorStop(0, `rgba(${128 + amp},${128 + amp},255,0.5)`);
    g.addColorStop(1, 'rgba(128,128,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // pores: darker pit + offset highlight (canvas +x = tangent, +y = bitangent)
  for (let i = 0; i < 2400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.6 + rng() * 1.4;
    const depth = 6 + rng() * 10;
    ctx.fillStyle = `rgba(${128 - depth},${128 - depth},255,0.55)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${128 + depth * 0.6},${128 + depth * 0.6},255,0.3)`;
    ctx.beginPath();
    ctx.arc(x + r * 1.4, y + r * 1.4, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Upload a canvas as RGBA8 + mipmaps (native PbrTexture defaults). */
function uploadTexture(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('ProceduralTextures: gl.createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/**
 * Generate procedural skin maps and upload them as GL textures.
 * Deterministic for a given seed — safe to call at renderer startup.
 */
export function createProceduralSkinMaps(
  gl: WebGL2RenderingContext,
  opts: ProceduralTextureOptions = {}
): ProceduralSkinMaps {
  const size = opts.size ?? 512;
  const rng = mulberry32(opts.seed ?? 0x9e3779b9);

  const [baseCanvas, baseCtx] = makeCanvas(size);
  paintBaseColor(baseCtx, size, rng);

  const [normalCanvas, normalCtx] = makeCanvas(size);
  paintNormal(normalCtx, size, rng);

  const [mrCanvas, mrCtx] = makeCanvas(size);
  paintMetallicRoughness(mrCtx, size, rng);

  return {
    baseColor: uploadTexture(gl, baseCanvas),
    normal: uploadTexture(gl, normalCanvas),
    metallicRoughness: uploadTexture(gl, mrCanvas)
  };
}

/** Delete the generated GL textures. */
export function destroyProceduralSkinMaps(
  gl: WebGL2RenderingContext,
  maps: ProceduralSkinMaps
): void {
  gl.deleteTexture(maps.baseColor);
  gl.deleteTexture(maps.normal);
  gl.deleteTexture(maps.metallicRoughness);
}
