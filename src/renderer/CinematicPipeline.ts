/* ------------------------------------------------------------------ */
/* CinematicPipeline — the single final output pipeline (milestone 7). */
/*                                                                     */
/* Render order (per spec):                                            */
/*   HDR scene pass -> Depth/CoC -> Bloom extraction -> Bloom blur ->  */
/*   DOF -> TAA accumulation -> Exposure -> ACES tonemap -> Display    */
/*                                                                     */
/* CinematicPipeline is the settings holder (spec contract);           */
/* CinematicRenderer owns the GL machinery and orchestrates. Every     */
/* avatar scene renders through it:                                    */
/*   renderer.render(() => { avatarRenderer.render(avatar, camera); }) */
/* ------------------------------------------------------------------ */

import { createRenderTarget, RenderTarget } from './RenderTarget';

export interface CinematicSettings {
  exposure: number;
  bloomThreshold: number;
  bloomStrength: number;

  dofEnabled: boolean;
  focusDistance: number;
  aperture: number;

  taaEnabled: boolean;
  taaBlend: number;
}

export class CinematicPipeline {
  readonly settings: CinematicSettings;

  constructor() {
    this.settings = {
      exposure: 0,
      bloomThreshold: 1.0,
      bloomStrength: 0.18,
      dofEnabled: true,
      focusDistance: 1.8,
      aperture: 2.8,
      taaEnabled: true,
      taaBlend: 0.1
    };
  }

  resize(width: number, height: number): void {
    void width;
    void height;
  }
}

/** Fullscreen triangle (gl_VertexID) — no quad VBO needed. */
export function createFullscreenTriangle(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Failed to create fullscreen VAO');
  }
  gl.bindVertexArray(vao);
  gl.bindVertexArray(null);
  return vao;
}

/* ---- post-process shaders ---- */

const POST_VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 positions[3] = vec2[](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  vec2 position = positions[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/** Bright-pass extraction. */
const BRIGHT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uBloomThreshold;
out vec4 outColor;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outColor = vec4(c * step(uBloomThreshold, l), 1.0);
}`;

/** Separable Gaussian blur (9-tap). */
const BLUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDirection;
out vec4 outColor;
void main() {
  vec2 texel = uDirection;
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;
  sum += texture(uTex, vUv + texel * 1.384615).rgb * 0.3162162;
  sum += texture(uTex, vUv - texel * 1.384615).rgb * 0.3162162;
  sum += texture(uTex, vUv + texel * 3.230769).rgb * 0.0702703;
  sum += texture(uTex, vUv - texel * 3.230769).rgb * 0.0702703;
  outColor = vec4(sum, 1.0);
}`;

/** Depth-of-field: CoC from linear depth, 6-tap disc blur. */
const DOF_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform float uFocusDistance;
uniform float uAperture;
uniform float uNear;
uniform float uFar;
out vec4 outColor;
void main() {
  float z = texture(uDepth, vUv).r;
  // Perspective depth -> linear depth.
  float linear = (2.0 * uNear) / (uFar + uNear - z * (uFar - uNear));
  float coc = clamp(abs(linear - uFocusDistance) * uAperture * 0.02, 0.0, 0.05);
  if (coc < 0.0008) {
    outColor = texture(uScene, vUv);
    return;
  }
  vec2 taps[6] = vec2[](
    vec2(1.0, 0.0), vec2(0.5, 0.866), vec2(-0.5, 0.866),
    vec2(-1.0, 0.0), vec2(-0.5, -0.866), vec2(0.5, -0.866)
  );
  vec3 sum = texture(uScene, vUv).rgb;
  for (int i = 0; i < 6; i++) {
    sum += texture(uScene, vUv + taps[i] * coc).rgb;
  }
  outColor = vec4(sum / 7.0, 1.0);
}`;

/** Temporal accumulation: mix current frame with history (ping-pong). */
const TAA_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uHistory;
uniform float uTaaBlend;
out vec4 outColor;
void main() {
  vec3 current = texture(uScene, vUv).rgb;
  vec3 history = texture(uHistory, vUv).rgb;
  outColor = vec4(mix(current, history, uTaaBlend), 1.0);
}`;

/** Final composite: scene + bloom -> exposure -> TAA -> ACES -> gamma. */
const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uHistory;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uTaaBlend;
out vec4 outColor;

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 current = scene + bloom * uBloomStrength;
  current *= exp2(uExposure);
  vec3 history = texture(uHistory, vUv).rgb;
  vec3 taa = mix(current, history, uTaaBlend);
  taa = aces(taa);
  taa = pow(taa, vec3(1.0 / 2.2));
  outColor = vec4(taa, 1.0);
}`;

/* ---- GL helpers ---- */

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Cinematic: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Cinematic compile failed:\n' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('Cinematic: createProgram failed');
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error('Cinematic link failed:\n' + log);
  }
  return p;
}

type Target = RenderTarget;

export class CinematicRenderer {
  readonly pipeline: CinematicPipeline;

  private gl: WebGL2RenderingContext;
  private triangle: WebGLVertexArrayObject;
  private width = 0;
  private height = 0;

  private hdr: Target | null = null;
  private bloomA: Target | null = null;
  private bloomB: Target | null = null;
  private dofTarget: Target | null = null;
  private historyA: Target | null = null;
  private historyB: Target | null = null;
  private historyActive = true;

  /** Actual HDR color format in use ('rgba16f', 'rgba32f' or 'rgba8'). */
  hdrFormat = 'rgba16f';

  private brightProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private dofProgram: WebGLProgram;
  private taaProgram: WebGLProgram;
  private compositeProgram: WebGLProgram;

  private brightUniforms: Record<string, WebGLUniformLocation | null>;
  private blurUniforms: Record<string, WebGLUniformLocation | null>;
  private dofUniforms: Record<string, WebGLUniformLocation | null>;
  private taaUniforms: Record<string, WebGLUniformLocation | null>;
  private compositeUniforms: Record<string, WebGLUniformLocation | null>;

  constructor(private readonly glCtor: WebGL2RenderingContext) {
    this.gl = glCtor;
    this.pipeline = new CinematicPipeline();
    this.triangle = createFullscreenTriangle(this.gl);
    this.brightProgram = linkProgram(this.gl, POST_VERTEX, BRIGHT_FRAGMENT);
    this.blurProgram = linkProgram(this.gl, POST_VERTEX, BLUR_FRAGMENT);
    this.dofProgram = linkProgram(this.gl, POST_VERTEX, DOF_FRAGMENT);
    this.taaProgram = linkProgram(this.gl, POST_VERTEX, TAA_FRAGMENT);
    this.compositeProgram = linkProgram(this.gl, POST_VERTEX, COMPOSITE_FRAGMENT);
    this.brightUniforms = cacheUniforms(this.gl, this.brightProgram, ['uScene', 'uBloomThreshold']);
    this.blurUniforms = cacheUniforms(this.gl, this.blurProgram, ['uTex', 'uDirection']);
    this.dofUniforms = cacheUniforms(this.gl, this.dofProgram, ['uScene', 'uDepth', 'uFocusDistance', 'uAperture', 'uNear', 'uFar']);
    this.taaUniforms = cacheUniforms(this.gl, this.taaProgram, ['uScene', 'uHistory', 'uTaaBlend']);
    this.compositeUniforms = cacheUniforms(this.gl, this.compositeProgram, ['uScene', 'uBloom', 'uHistory', 'uExposure', 'uBloomStrength', 'uTaaBlend']);
  }

  render(scene: () => void): void {
    this.syncSize();

    // 1. HDR scene.
    this.beginHdrPass();
    scene();
    this.endHdrPass();

    // 2. Bloom.
    this.extractBloom();
    this.blurBloom();

    // 3. DOF.
    if (this.pipeline.settings.dofEnabled) {
      this.applyDepthOfField();
    }

    // 4. Temporal accumulation.
    if (this.pipeline.settings.taaEnabled) {
      this.accumulateTemporal();
    }

    // 5. Final display (reads the pre-update history so the blend is
    //    current frame vs. previous frame — a true accumulation chain).
    this.composite();

    // Ping-pong flips after the composite read.
    this.historyActive = !this.historyActive;
  }

  private syncSize(): void {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const w = canvas.width;
    const h = canvas.height;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const gl = this.gl;
    this.hdr = createRenderTarget(gl, { width: w, height: h, depth: true });
    this.hdrFormat =
      this.hdr.colorInternal === gl.RGBA16F ? 'rgba16f' :
      this.hdr.colorInternal === gl.RGBA32F ? 'rgba32f' : 'rgba8';
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    this.bloomA = createRenderTarget(gl, { width: bw, height: bh });
    this.bloomB = createRenderTarget(gl, { width: bw, height: bh });
    this.dofTarget = createRenderTarget(gl, { width: w, height: h });
    this.historyA = createRenderTarget(gl, { width: w, height: h });
    this.historyB = createRenderTarget(gl, { width: w, height: h });
    this.historyActive = true;
    // clear history (first-frame TAA would otherwise sample garbage)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyA.fbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyB.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private beginHdrPass(): void {
    const gl = this.gl;
    const hdr = this.hdr;
    if (!hdr) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  private endHdrPass(): void {
    // renderScene manages viewport/state per call; restore default FB.
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  private extractBloom(): void {
    const gl = this.gl;
    const hdr = this.hdr;
    const out = this.bloomA;
    if (!hdr || !out) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, Math.max(1, this.width >> 1), Math.max(1, this.height >> 1));
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.brightProgram);
    this.bindTex(this.brightUniforms, 'uScene', 0, hdr.color, gl.TEXTURE_2D);
    this.set1f(this.brightUniforms, 'uBloomThreshold', this.pipeline.settings.bloomThreshold);
    this.drawFullscreen();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private blurBloom(): void {
    const gl = this.gl;
    const a = this.bloomA;
    const b = this.bloomB;
    if (!a || !b) return;
    const bw = Math.max(1, this.width >> 1);
    const bh = Math.max(1, this.height >> 1);

    // horizontal: a -> b
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.blurProgram);
    this.bindTex(this.blurUniforms, 'uTex', 0, a.color, gl.TEXTURE_2D);
    this.set2f(this.blurUniforms, 'uDirection', 1 / bw, 0);
    this.drawFullscreen();

    // vertical: b -> a
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.blurProgram);
    this.bindTex(this.blurUniforms, 'uTex', 0, b.color, gl.TEXTURE_2D);
    this.set2f(this.blurUniforms, 'uDirection', 0, 1 / bh);
    this.drawFullscreen();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private applyDepthOfField(): void {
    const gl = this.gl;
    const hdr = this.hdr;
    const out = this.dofTarget;
    if (!hdr || !out || !hdr.depth) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.dofProgram);
    this.bindTex(this.dofUniforms, 'uScene', 0, hdr.color, gl.TEXTURE_2D);
    this.bindTex(this.dofUniforms, 'uDepth', 1, hdr.depth, gl.TEXTURE_2D);
    this.set1f(this.dofUniforms, 'uFocusDistance', this.pipeline.settings.focusDistance);
    this.set1f(this.dofUniforms, 'uAperture', this.pipeline.settings.aperture);
    this.set1f(this.dofUniforms, 'uNear', 0.01);
    this.set1f(this.dofUniforms, 'uFar', 100);
    this.drawFullscreen();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private accumulateTemporal(): void {
    const gl = this.gl;
    const scene = this.dofEnabled() ? this.dofTarget : this.hdr;
    const src = this.historyActive ? this.historyA : this.historyB;
    const dst = this.historyActive ? this.historyB : this.historyA;
    if (!scene || !src || !dst) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.taaProgram);
    this.bindTex(this.taaUniforms, 'uScene', 0, scene.color, gl.TEXTURE_2D);
    this.bindTex(this.taaUniforms, 'uHistory', 1, src.color, gl.TEXTURE_2D);
    this.set1f(this.taaUniforms, 'uTaaBlend', this.pipeline.settings.taaBlend);
    this.drawFullscreen();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private composite(): void {
    const gl = this.gl;
    const scene = this.dofEnabled() ? this.dofTarget : this.hdr;
    const bloom = this.bloomA;
    const history = this.historyActive ? this.historyA : this.historyB;
    if (!scene || !bloom || !history) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.compositeProgram);
    this.bindTex(this.compositeUniforms, 'uScene', 0, scene.color, gl.TEXTURE_2D);
    this.bindTex(this.compositeUniforms, 'uBloom', 1, bloom.color, gl.TEXTURE_2D);
    this.bindTex(this.compositeUniforms, 'uHistory', 2, history.color, gl.TEXTURE_2D);
    this.set1f(this.compositeUniforms, 'uExposure', this.pipeline.settings.exposure);
    this.set1f(this.compositeUniforms, 'uBloomStrength', this.pipeline.settings.bloomStrength);
    this.set1f(this.compositeUniforms, 'uTaaBlend', this.pipeline.settings.taaBlend);
    this.drawFullscreen();
  }

  private dofEnabled(): boolean {
    return this.pipeline.settings.dofEnabled;
  }

  private drawFullscreen(): void {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindVertexArray(this.triangle);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  private bindTex(
    u: Record<string, WebGLUniformLocation | null>,
    name: string,
    unit: number,
    texture: WebGLTexture,
    target: number
  ): void {
    const loc = u[name];
    if (!loc) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, texture);
    gl.uniform1i(loc, unit);
  }

  private set1f(u: Record<string, WebGLUniformLocation | null>, name: string, v: number): void {
    const loc = u[name];
    if (loc) this.gl.uniform1f(loc, v);
  }

  private set2f(u: Record<string, WebGLUniformLocation | null>, name: string, x: number, y: number): void {
    const loc = u[name];
    if (loc) this.gl.uniform2f(loc, x, y);
  }

  dispose(): void {
    const gl = this.gl;
    for (const p of [this.brightProgram, this.blurProgram, this.dofProgram, this.taaProgram, this.compositeProgram]) {
      gl.deleteProgram(p);
    }
    gl.deleteVertexArray(this.triangle);
    for (const t of [this.hdr, this.bloomA, this.bloomB, this.dofTarget, this.historyA, this.historyB]) {
      if (!t) continue;
      gl.deleteTexture(t.color);
      if (t.depth) gl.deleteTexture(t.depth);
      gl.deleteFramebuffer(t.fbo);
    }
    this.hdr = this.bloomA = this.bloomB = this.dofTarget = this.historyA = this.historyB = null;
  }
}

function cacheUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[]
): Record<string, WebGLUniformLocation | null> {
  const cache: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    cache[name] = gl.getUniformLocation(program, name);
  }
  return cache;
}
