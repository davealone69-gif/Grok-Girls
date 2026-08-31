export type ColorInternal = 'rgba16f' | 'rgba32f' | 'r16f' | 'rg16f' | 'rgba8';
export type DepthInternal = 'depth32f' | 'depth24' | 'depth16' | null;

export interface RenderTargetRequest {
  width: number;
  height: number;
  color?: ColorInternal;
  depth?: DepthInternal;
}

export interface RenderTargetCapabilities {
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
  framebuffer: WebGLFramebuffer;
  colorTexture: WebGLTexture;
  depthBuffer: WebGLRenderbuffer | null;
  colorInternal: number;
  colorFormat: ColorInternal;
  depthInternal: number | null;
  depthFormat: DepthInternal;
  width: number;
  height: number;
  destroy(): void;
}

interface ContextState { capabilities?: RenderTargetCapabilities; }
const states = new WeakMap<WebGL2RenderingContext, ContextState>();

function stateFor(gl: WebGL2RenderingContext): ContextState {
  let state = states.get(gl);
  if (!state) { state = {}; states.set(gl, state); }
  return state;
}

function colorDescriptor(gl: WebGL2RenderingContext, format: ColorInternal): { internal: number; format: number; type: number } {
  switch (format) {
    case 'rgba16f': return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    case 'rgba32f': return { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT };
    case 'r16f': return { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT };
    case 'rg16f': return { internal: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT };
    case 'rgba8': return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
  }
}

function depthDescriptor(gl: WebGL2RenderingContext, format: Exclude<DepthInternal, null>): number {
  switch (format) {
    case 'depth32f': return gl.DEPTH_COMPONENT32F;
    case 'depth24': return gl.DEPTH_COMPONENT24;
    case 'depth16': return gl.DEPTH_COMPONENT16;
  }
}

function probeColor(gl: WebGL2RenderingContext, format: ColorInternal): boolean {
  const desc = colorDescriptor(gl, format);
  const fb = gl.createFramebuffer(), tex = gl.createTexture();
  if (!fb || !tex) { if (fb) gl.deleteFramebuffer(fb); if (tex) gl.deleteTexture(tex); return false; }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, desc.internal, 4, 4, 0, desc.format, desc.type, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
  return ok;
}

function probeDepth(gl: WebGL2RenderingContext, format: Exclude<DepthInternal, null>): boolean {
  const fb = gl.createFramebuffer(), rb = gl.createRenderbuffer();
  if (!fb || !rb) { if (fb) gl.deleteFramebuffer(fb); if (rb) gl.deleteRenderbuffer(rb); return false; }
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, depthDescriptor(gl, format), 4, 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  // A depth-only FBO must explicitly disable color draw/read buffers.
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb);
  return ok;
}

export function getRenderTargetCapabilities(gl: WebGL2RenderingContext): RenderTargetCapabilities {
  const state = stateFor(gl);
  if (state.capabilities) return state.capabilities;
  state.capabilities = {
    rgba16f: probeColor(gl, 'rgba16f'),
    rgba32f: probeColor(gl, 'rgba32f'),
    r16f: probeColor(gl, 'r16f'),
    rg16f: probeColor(gl, 'rg16f'),
    rgba8: probeColor(gl, 'rgba8'),
    depth32f: probeDepth(gl, 'depth32f'),
    depth24: probeDepth(gl, 'depth24'),
    depth16: probeDepth(gl, 'depth16'),
  };
  return state.capabilities;
}

function colorFallback(requested: ColorInternal, caps: RenderTargetCapabilities): ColorInternal {
  const order: ColorInternal[] = requested === 'rgba8' ? ['rgba8']
    : requested === 'r16f' ? ['r16f', 'rgba8']
    : requested === 'rg16f' ? ['rg16f', 'rgba16f', 'rgba32f', 'rgba8']
    : requested === 'rgba32f' ? ['rgba32f', 'rgba16f', 'rgba8']
    : ['rgba16f', 'rgba32f', 'rgba8'];
  return order.find(format => caps[format]) ?? 'rgba8';
}

function depthFallback(requested: DepthInternal, caps: RenderTargetCapabilities): DepthInternal {
  if (!requested) return null;
  const order: Exclude<DepthInternal, null>[] = requested === 'depth16' ? ['depth16']
    : requested === 'depth24' ? ['depth24', 'depth16'] : ['depth32f', 'depth24', 'depth16'];
  return order.find(format => caps[format]) ?? null;
}

export function createRenderTarget(gl: WebGL2RenderingContext, request: RenderTargetRequest): RenderTarget {
  if (!Number.isInteger(request.width) || !Number.isInteger(request.height) || request.width <= 0 || request.height <= 0) {
    throw new Error(`Invalid render target size: ${request.width}x${request.height}`);
  }
  const caps = getRenderTargetCapabilities(gl);
  const colorFormat = colorFallback(request.color ?? 'rgba8', caps);
  const depthFormat = depthFallback(request.depth ?? 'depth24', caps);
  const color = colorDescriptor(gl, colorFormat);
  const framebuffer = gl.createFramebuffer(), colorTexture = gl.createTexture();
  if (!framebuffer || !colorTexture) throw new Error('Unable to allocate render target');

  gl.bindTexture(gl.TEXTURE_2D, colorTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, color.internal, request.width, request.height, 0, color.format, color.type, null);

  let depthBuffer: WebGLRenderbuffer | null = null;
  if (depthFormat) {
    depthBuffer = gl.createRenderbuffer();
    if (!depthBuffer) { gl.deleteFramebuffer(framebuffer); gl.deleteTexture(colorTexture); throw new Error('Unable to allocate depth buffer'); }
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, depthDescriptor(gl, depthFormat), request.width, request.height);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
  if (depthBuffer) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer); gl.deleteTexture(colorTexture); if (depthBuffer) gl.deleteRenderbuffer(depthBuffer);
    throw new Error(`Render target incomplete after fallback: 0x${status.toString(16)}`);
  }

  return {
    framebuffer, colorTexture, depthBuffer,
    colorInternal: color.internal, colorFormat,
    depthInternal: depthFormat ? depthDescriptor(gl, depthFormat) : null, depthFormat,
    width: request.width, height: request.height,
    destroy() { gl.deleteFramebuffer(framebuffer); gl.deleteTexture(colorTexture); if (depthBuffer) gl.deleteRenderbuffer(depthBuffer); },
  };
}

export function checkFramebufferComplete(gl: WebGL2RenderingContext, framebuffer: WebGLFramebuffer): boolean {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return complete;
}
