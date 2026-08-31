/* ------------------------------------------------------------------ */
/* RenderTarget — shared renderable-target factory with per-context    */
/* capability probing.                                                */
/*                                                                     */
/* Core rule: "can sample this texture?" != "can render into this     */
/* texture?" EXT_color_buffer_float must NEVER be used as proof of     */
/* renderability — some GL implementations (notably the WebKit         */
/* software GL used by headless CI browsers) advertise it yet return   */
/* FRAMEBUFFER_INCOMPLETE_ATTACHMENT for float color attachments.      */
/*                                                                     */
/* The factory therefore:                                              */
/*   1. probes EVERY candidate format on a real FBO (allocate ->       */
/*      attach -> gl.checkFramebufferStatus) — once per GL context,    */
/*   2. caches the per-format capability table (WeakMap),              */
/*   3. createRenderTarget() starts the fallback chain at the          */
/*      REQUESTED format and reports the ACTUALLY SELECTED format in   */
/*      the returned RenderTarget.colorInternal / depthInternal —      */
/*      callers must not assume their request was honored.             */
/*                                                                     */
/* Color chain per request:                                            */
/*   request rgba16f -> [RGBA16F, RGBA32F, RGBA8]                      */
/*   request rgba32f -> [RGBA32F, RGBA8]                               */
/*   request rgba8   -> [RGBA8]                                        */
/* Depth chain (independent): DEPTH_COMPONENT32F -> 24 -> 16.          */
/*                                                                     */
/* Sampling-only float textures are NOT affected: float textures stay  */
/* perfectly valid for *sampling* (IBL environment cubemaps, BRDF LUT  */
/* etc. keep their float formats); only *rendering into* float color   */
/* attachments is probed here.                                         */
/*                                                                     */
/* NOTE for mip-attached render targets (e.g. prefiltered environment  */
/* mips): probing the base level does NOT prove every mip level is     */
/* renderable. Build the actual cubemap/mip attachment configuration   */
/* and call checkFramebufferComplete() before rendering that level.    */
/* ------------------------------------------------------------------ */

/** Per-context, per-format renderability table (probed once). */
export interface RenderCapabilities {
  rgba16f: boolean;
  rgba32f: boolean;
  r16f: boolean;
  rg16f: boolean;
  rgba8: boolean;
  depth32f: boolean;
  depth24: boolean;
  depth16: boolean;
}

export interface RenderTarget {
  fbo: WebGLFramebuffer;
  color: WebGLTexture;
  depth: WebGLTexture | null;
  /** Internal format ACTUALLY used for the color attachment (may be a
   *  fallback from the requested format — check it, don't assume). */
  colorInternal: number;
  /** Internal format ACTUALLY used for the depth attachment (null if none). */
  depthInternal: number | null;
}

export type ColorFormatRequest = 'rgba16f' | 'rgba32f' | 'rgba8';

export interface RenderTargetOptions {
  width: number;
  height: number;
  /** Preferred color format; the factory falls back down the chain and
   *  reports the actual format via RenderTarget.colorInternal.
   *  Default: 'rgba16f'. */
  color?: ColorFormatRequest;
  /** Attach the best supported depth format (32F preferred, then 24,
   *  then 16). If no depth format is renderable the target is created
   *  without depth (depthInternal === null) rather than failing. */
  depth?: boolean;
}

const COLOR_FORMATS: Record<ColorFormatRequest, readonly [number, number, number]> = {
  rgba16f: [0x881a /* RGBA16F */, 0x1908 /* RGBA */, 0x140b /* HALF_FLOAT */],
  rgba32f: [0x8814 /* RGBA32F */, 0x1908 /* RGBA */, 0x1406 /* FLOAT */],
  rgba8: [0x8058 /* RGBA8 */, 0x1908 /* RGBA */, 0x1401 /* UNSIGNED_BYTE */]
};

const FALLBACK_CHAIN: Record<ColorFormatRequest, ColorFormatRequest[]> = {
  rgba16f: ['rgba16f', 'rgba32f', 'rgba8'],
  rgba32f: ['rgba32f', 'rgba8'],
  rgba8: ['rgba8']
};

const DEPTH_FORMATS: Array<{ key: keyof RenderCapabilities; internal: number; type: number }> = [
  { key: 'depth32f', internal: 0x8cac /* DEPTH_COMPONENT32F */, type: 0x1406 /* FLOAT */ },
  { key: 'depth24', internal: 0x81a6 /* DEPTH_COMPONENT24 */, type: 0x1405 /* UNSIGNED_INT */ },
  { key: 'depth16', internal: 0x81a5 /* DEPTH_COMPONENT16 */, type: 0x1403 /* UNSIGNED_SHORT */ }
];

const capabilityCache = new WeakMap<WebGL2RenderingContext, RenderCapabilities>();

function createProbeTexture(
  gl: WebGL2RenderingContext,
  internal: number,
  format: number,
  type: number
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('RenderTarget: createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** Is the given FBO complete right now? (used for per-mip verification). */
export function checkFramebufferComplete(gl: WebGL2RenderingContext, fbo: WebGLFramebuffer): boolean {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return complete;
}

/**
 * Probe this context's per-format renderability ONCE and cache it.
 * Every color candidate gets its own attachment test; depth candidates
 * are tested against a guaranteed-complete RGBA8 color attachment
 * (an FBO with only a depth attachment is incomplete in WebGL).
 */
export function probeCapabilities(gl: WebGL2RenderingContext): RenderCapabilities {
  const cached = capabilityCache.get(gl);
  if (cached) return cached;

  const caps: RenderCapabilities = {
    rgba16f: false,
    rgba32f: false,
    r16f: false,
    rg16f: false,
    rgba8: false,
    depth32f: false,
    depth24: false,
    depth16: false
  };

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('RenderTarget: createFramebuffer failed');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  const probeColor = (internal: number, format: number, type: number): boolean => {
    const tex = createProbeTexture(gl, internal, format, type);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.deleteTexture(tex);
    return ok;
  };

  caps.rgba16f = probeColor(0x881a, 0x1908, 0x140b); // RGBA16F
  caps.rgba32f = probeColor(0x8814, 0x1908, 0x1406); // RGBA32F
  caps.r16f = probeColor(0x822d /* R16F */, 0x1903 /* RED */, 0x140b);
  caps.rg16f = probeColor(0x822f /* RG16F */, 0x8227 /* RG */, 0x140b);
  caps.rgba8 = probeColor(0x8058, 0x1908, 0x1401); // RGBA8

  // Depth is probed against a guaranteed-complete RGBA8 color attachment.
  const colorTex = createProbeTexture(gl, 0x8058, 0x1908, 0x1401);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);
  for (const cand of DEPTH_FORMATS) {
    const depthTex = createProbeTexture(gl, cand.internal, gl.DEPTH_COMPONENT, cand.type);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    caps[cand.key] = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, null, 0);
    gl.deleteTexture(depthTex);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(colorTex);

  capabilityCache.set(gl, caps);
  return caps;
}

function createTexture2D(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('RenderTarget: createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/**
 * Create a complete render target. The requested color format starts
 * the fallback chain; the ACTUAL formats land in the returned target
 * (colorInternal / depthInternal). RGBA8 always exists in the chain,
 * so this never throws for format reasons.
 */
export function createRenderTarget(
  gl: WebGL2RenderingContext,
  opts: RenderTargetOptions
): RenderTarget {
  const caps = probeCapabilities(gl);
  const request = opts.color ?? 'rgba16f';

  let colorInternal = 0;
  let colorFormat = 0;
  let colorType = 0;
  for (const name of FALLBACK_CHAIN[request]) {
    const [internal, format, type] = COLOR_FORMATS[name];
    if (name === 'rgba8' || caps[name]) {
      colorInternal = internal;
      colorFormat = format;
      colorType = type;
      break;
    }
  }
  if (!colorInternal) {
    // Defensive: RGBA8 is core and always probed — this cannot happen.
    throw new Error('RenderTarget: no renderable color format');
  }

  let depthInternal: number | null = null;
  let depthType: number | null = null;
  if (opts.depth) {
    for (const cand of DEPTH_FORMATS) {
      if (caps[cand.key]) {
        depthInternal = cand.internal;
        depthType = cand.type;
        break;
      }
    }
  }

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('RenderTarget: createFramebuffer failed');
  const color = createTexture2D(gl, opts.width, opts.height, colorInternal, colorFormat, colorType);
  const depthTex =
    depthInternal !== null && depthType !== null
      ? createTexture2D(gl, opts.width, opts.height, depthInternal, gl.DEPTH_COMPONENT, depthType)
      : null;

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  if (depthTex) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
  }
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    gl.deleteTexture(color);
    if (depthTex) gl.deleteTexture(depthTex);
    gl.deleteFramebuffer(fbo);
    throw new Error('RenderTarget: framebuffer incomplete despite probed formats');
  }

  return { fbo, color, depth: depthTex, colorInternal, depthInternal };
}
