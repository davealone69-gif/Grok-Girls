/* ------------------------------------------------------------------ */
/* HDRenderer — real-time 3D HD renderer (WebGL2 offscreen pipeline).  */
/* Mirrors the native renderer/ API: configure(RenderConfig),          */
/* loadScene(scene), render() -> RenderResult, exportPng(file).        */
/*                                                                     */
/* Pipeline: shadow map (2 cascades) -> lit scene (PBR-ish lighting,   */
/* optional bloom + HDR) -> post FX (vignette, grain, ACES tone map)   */
/* -> offscreen canvas -> PNG. All headless — no DOM canvas needed.    */
/* ------------------------------------------------------------------ */

import { hexToRgb, Mat4, mat4Identity, mat4LookAt, mat4Multiply, mat4Ortho, mat4Perspective, mat4RotationX, mat4RotationY, mat4RotationZ, mat4Scale, mat4Translation } from './math';
import type { Light, Material, Mesh, RenderConfig, RenderResult, Scene } from './types';

/* ---------------------------------------------------------- shaders */

const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main() {
  gl_Position = uLightVP * uModel * vec4(aPos, 1.0);
}`;

const SHADOW_FS = `#version 300 es
precision highp float;
void main() {}`;

const SCENE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uLightVP0;
uniform mat4 uLightVP1;
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vShadow0;
out vec4 vShadow1;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vShadow0 = uLightVP0 * wp;
  vShadow1 = uLightVP1 * wp;
  gl_Position = uProj * uView * wp;
}`;

const SCENE_FS = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vShadow0;
in vec4 vShadow1;
uniform vec3 uCamPos;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform vec3 uEmissive;
uniform float uEmissiveIntensity;
uniform float uOpacity;
uniform sampler2D uShadowMap0;
uniform sampler2D uShadowMap1;
uniform float uShadowStrength;
out vec4 fragColor;

float shadowAmount(sampler2D map, vec4 shadowCoord, float bias) {
  vec3 ndc = shadowCoord.xyz / max(shadowCoord.w, 1e-5);
  if (ndc.x < -1.0 || ndc.x > 1.0 || ndc.y < -1.0 || ndc.y > 1.0 || ndc.z < -1.0 || ndc.z > 1.0) return 1.0;
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float closest = texture(map, uv).r;
  float current = ndc.z * 0.5 + 0.5;
  return current - bias <= closest ? 1.0 : 0.0;
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorldPos);

  // light 0: warm key (directional)
  vec3 L0 = normalize(vec3(-0.55, -0.35, 0.72));
  float ndl0 = max(dot(N, L0), 0.0);
  vec3 H0 = normalize(L0 + V);
  float spec0 = pow(max(dot(N, H0), 0.0), 48.0) * (1.0 - uRoughness);
  vec3 keyColor = vec3(1.0, 0.85, 0.72) * 1.5;

  // light 1: cool fill (directional, opposite)
  vec3 L1 = normalize(vec3(0.62, 0.05, 0.45));
  float ndl1 = max(dot(N, L1), 0.0);
  vec3 fillColor = vec3(0.38, 0.45, 0.62) * 0.6;

  // light 2: accent point behind/above (cyan-magenta edge)
  vec3 LP = vec3(0.0, 2.3, -2.8);
  vec3 L2 = normalize(LP - vWorldPos);
  float ndl2 = max(dot(N, L2), 0.0);
  vec3 accentColor = vec3(0.65, 0.3, 0.95) * 1.2;

  float sh0 = shadowAmount(uShadowMap0, vShadow0, 0.0022);
  float sh1 = shadowAmount(uShadowMap1, vShadow1, 0.0028);
  float shadow = mix(1.0, min(sh0, sh1), uShadowStrength);

  vec3 albedo = uBaseColor;
  if (uMetallic > 0.0) {
    albedo *= vec3(0.6, 0.65, 0.75);
  }
  vec3 ambient = albedo * vec3(0.05, 0.055, 0.07);
  vec3 diff = albedo * (keyColor * ndl0 + fillColor * ndl1 + accentColor * ndl2) * shadow;
  vec3 spec = vec3(1.0) * spec0 * shadow * 0.85 * uMetallic;
  vec3 col = ambient + diff + spec + uEmissive * uEmissiveIntensity;

  float g = min(uRoughness * 0.08 + 0.001, 0.05); // subtle material noise
  float n = fract(sin(dot(vUV * 41.7, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * g;

  // ground-projected vignette (studio pool)
  float edge = distance(vWorldPos.xz, vec2(0.0, -0.7));
  col *= 1.0 - smoothstep(2.2, 4.2, edge) * 0.5;

  fragColor = vec4(col, uOpacity);
}`;

const POST_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform float uBloom;
uniform vec2 uRes;
uniform float uSeed;
out vec4 fragColor;

void main() {
  vec3 col = texture(uScene, vUV).rgb;

  // bloom: sample a small cross
  vec2 t = 1.0 / uRes;
  vec3 bloom = vec3(0.0);
  bloom += texture(uScene, vUV + vec2(1.5, 0.0) * t).rgb;
  bloom += texture(uScene, vUV + vec2(-1.5, 0.0) * t).rgb;
  bloom += texture(uScene, vUV + vec2(0.0, 1.5) * t).rgb;
  bloom += texture(uScene, vUV + vec2(0.0, -1.5) * t).rgb;
  bloom += texture(uScene, vUV + vec2(3.0, 1.0) * t).rgb;
  bloom += texture(uScene, vUV + vec2(-3.0, 1.0) * t).rgb;
  bloom += texture(uScene, vUV + vec2(1.0, 3.0) * t).rgb;
  bloom += texture(uScene, vUV + vec2(-1.0, -3.0) * t).rgb;
  bloom *= 0.125;
  // bloom only bright pixels
  vec3 b = bloom * smoothstep(0.55, 1.0, dot(bloom, vec3(0.333)));
  col += b * uBloom;

  // ACES-ish tone map
  col = clamp(col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);

  // vignette
  vec2 c = vUV - 0.5;
  col *= 1.0 - dot(c, c) * 0.55;

  // film grain
  float n = fract(sin(dot(vUV * uRes, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
  col += (n - 0.5) * 0.022;

  fragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------- glues */

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    throw new Error('shader compile failed: ' + info);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(p);
    throw new Error('program link failed: ' + info);
  }
  return p;
}

function createFramebuffer(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  hdr: boolean
): { fb: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer; hdr: boolean } {
  // Try the requested format; fall back to LDR when float render targets
  // are unsupported (EXT_color_buffer_float missing — e.g. SwiftShader).
  const attempt = (internal: number, type: number): number | null => {
    const fb = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      gl.deleteRenderbuffer(depth);
      return null;
    }
    return 1; // success — the caller re-reads the bound objects below
  };

  const build = (internal: number, type: number): { fb: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer } => {
    const fb = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, depth };
  };

  // probe float support on a tiny framebuffer first
  let hdrOk = false;
  if (hdr) {
    const probe = gl.createFramebuffer()!;
    const ptex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, ptex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ptex, 0);
    hdrOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(probe);
    gl.deleteTexture(ptex);
  }

  const f = hdr && hdrOk ? build(gl.RGBA16F, gl.HALF_FLOAT) : build(gl.RGBA8, gl.UNSIGNED_BYTE);
  return { ...f, hdr: hdr && hdrOk };
}

function disposeFramebuffer(gl: WebGL2RenderingContext, f: { fb: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer }) {
  gl.deleteFramebuffer(f.fb);
  gl.deleteTexture(f.tex);
  gl.deleteRenderbuffer(f.depth);
}

/* ------------------------------------------------------ default scene */

const TAU = Math.PI * 2;

/** Lathe profile: radius per height step (0 = crown, 1 = base). */
const BODY_PROFILE = [
  0.0, 0.36, 0.52, 0.62, 0.68, 0.72, 0.74, 0.74, 0.73, 0.71,
  0.69, 0.68, 0.67, 0.67, 0.68, 0.7, 0.73, 0.76, 0.8, 0.84,
  0.88, 0.9, 0.9, 0.89, 0.87, 0.84, 0.8, 0.75, 0.7, 0.66,
  0.63, 0.6, 0.55, 0.48, 0.4, 0.33
];
const ARM_PROFILE = [0.0, 0.2, 0.34, 0.44, 0.5, 0.53, 0.53, 0.5, 0.44, 0.36, 0.28, 0.2, 0.14, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06];
const LEG_PROFILE = [0.0, 0.12, 0.2, 0.26, 0.3, 0.33, 0.35, 0.37, 0.39, 0.4, 0.4, 0.38, 0.34, 0.3, 0.26, 0.23, 0.21, 0.19, 0.17, 0.15];

const SEG = 12;

/** Build a lathe mesh from a radius profile; v goes 0..1 down the axis. */
function latheMesh(profile: number[]): Mesh {
  const rings = profile.length;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < rings; j++) {
    const v = j / (rings - 1);
    const r = profile[j];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * TAU;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      verts.push(x, v, z, x, 0, z, i / SEG, v);
    }
  }
  for (let j = 0; j < rings - 1; j++) {
    for (let i = 0; i < SEG; i++) {
      const i2 = (i + 1) % SEG;
      const a = j * SEG + i;
      const b = j * SEG + i2;
      const c = (j + 1) * SEG + i;
      const d = (j + 1) * SEG + i2;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { data: new Float32Array(verts), indices: new Uint32Array(idx), indexCount: idx.length, material: undefined };
}

function uvSphere(rings: number, cols: number, rx: number, ry: number, rz: number): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const phi = v * Math.PI;
    const y = Math.cos(phi) * ry;
    const rr = Math.sin(phi);
    for (let i = 0; i <= cols; i++) {
      const a = (i / cols) * TAU;
      const x = Math.cos(a) * rr * rx;
      const z = Math.sin(a) * rr * rz;
      verts.push(x, y, z, x, y, z, i / cols, v);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { data: new Float32Array(verts), indices: new Uint32Array(idx), indexCount: idx.length };
}

function cylinder(rTop: number, rBottom: number, height: number): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * TAU;
    const x = Math.cos(a);
    const z = Math.sin(a);
    verts.push(x * rTop, 0, z * rTop, x, 0, z, i / SEG, 0);
    verts.push(x * rBottom, height, z * rBottom, x, 0, z, i / SEG, 1);
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  return { data: new Float32Array(verts), indices: new Uint32Array(idx), indexCount: idx.length };
}

/** Build the default noir avatar scene from a canonical definition. */
export function buildDefaultScene(def: {
  gender: string;
  skin: string;
  hair: string;
  eyes: string;
  face: string;
  body: string;
  outfit: string;
  age: string;
  tattoos: string;
  augmentations: string;
}, seed = 7): Scene {
  const skinIdx = parseInt((def.skin.match(/\d+/)?.[0] ?? '1'), 10) - 1;
  const SKIN: [number, number, number][] = [
    [0.94, 0.78, 0.7],
    [0.9, 0.73, 0.64],
    [0.82, 0.65, 0.55],
    [0.7, 0.56, 0.48],
    [0.55, 0.4, 0.32],
    [0.35, 0.24, 0.19]
  ];
  const skin = SKIN[Math.max(0, Math.min(5, skinIdx))];
  const skinHex = (m: number) => skin.map(c => Math.min(1, c * m)) as [number, number, number];

  const bodyScale = def.body === 'Heavy' ? 1.14 : def.body === 'Slim' ? 0.9 : 1.0;
  const hairR = def.hair === 'Long' ? 0.95 : def.hair === 'Short' || def.hair === 'Mohawk' || def.hair === 'Ponytail' ? 0.82 : def.hair === 'Bald' ? 0.6 : 0.85;
  const HAIR: [number, number, number][] = [
    [0.47, 0.07, 0.12], // crimson
    [0.32, 0.15, 0.55], // violet
    [0.08, 0.08, 0.12], // black
    [0.85, 0.82, 0.78], // platinum
    [0.55, 0.2, 0.25], // burgundy
    [0.85, 0.75, 0.5], // champagne
    [0.5, 0.2, 0.15], // auburn
    [0.1, 0.85, 0.85] // cyan
  ];
  const hair = HAIR[Math.max(0, Math.min(HAIR.length - 1, (seed * 5 + 3) % HAIR.length))];
  const eyeColor = def.eyes === 'Cyber' || def.eyes === 'Glowing' ? ([0.6, 0.2, 0.95] as [number, number, number]) : ([0.55, 0.4, 0.3] as [number, number, number]);
  const OUT = def.outfit === 'Armoured' ? ([0.16, 0.18, 0.24] as [number, number, number]) : def.outfit === 'Formal' ? ([0.35, 0.06, 0.12] as [number, number, number]) : def.outfit === 'Tech' ? ([0.12, 0.3, 0.34] as [number, number, number]) : def.outfit === 'Street' ? ([0.1, 0.1, 0.12] as [number, number, number]) : ([0.28, 0.07, 0.16] as [number, number, number]);
  const hasTat = def.tattoos !== 'None';
  const hasAug = def.augmentations !== 'None';
  const metallic = def.outfit === 'Armoured' || def.outfit === 'Tech' ? 0.55 : 0.12;
  const roughness = def.outfit === 'Armoured' ? 0.35 : 0.55;

  const meshes: Mesh[] = [];
  const S = (n: number) => n * bodyScale;

  // floor
  const floorV: number[] = [];
  const floorI: number[] = [];
  const fx = 3.6;
  for (let r = 0; r <= 8; r++) {
    for (let c = 0; c <= 8; c++) {
      const x = -fx + (c / 8) * fx * 2;
      const z = -fx + (r / 8) * fx * 2;
      floorV.push(x, 0, z, 0, 1, 0, c / 8, r / 8);
    }
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const a = r * 9 + c;
      floorI.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
    }
  }
  meshes.push({ data: new Float32Array(floorV), indices: new Uint32Array(floorI), indexCount: floorI.length, material: { baseColor: [0.055, 0.05, 0.075], roughness: 0.92, metallic: 0.0 } });

  // torso (lathe, height 0.86, base at y=0)
  const torso = latheMesh(BODY_PROFILE);
  torso.material = { baseColor: OUT, roughness, metallic };
  meshes.push(torso);

  // head
  const head = uvSphere(16, 20, 0.3, 0.36, 0.3);
  head.material = { baseColor: skinHex(1.0), roughness: 0.5, metallic: 0.03 };
  meshes.push(head);

  // hair (upper sphere shell)
  const hairMesh = uvSphere(12, 16, hairR, hairR * 0.72, hairR);
  hairMesh.material = { baseColor: hair, roughness: 0.35, metallic: 0.22 };
  meshes.push(hairMesh);

  // eyes
  const eye = uvSphere(6, 8, 0.052, 0.045, 0.05);
  eye.material = { baseColor: eyeColor, roughness: 0.12, metallic: 0.1, emissive: eyeColor, emissiveIntensity: def.eyes === 'Glowing' ? 2.2 : 0.55, bloom: true };
  meshes.push(eye);
  meshes.push({ ...eye, data: eye.data, indices: eye.indices, indexCount: eye.indexCount, material: eye.material });

  // lips
  const lips = uvSphere(6, 8, 0.09, 0.05, 0.06);
  lips.material = { baseColor: [0.72, 0.16, 0.28], roughness: 0.3, metallic: 0.08 };
  meshes.push(lips);

  // arms (two lathes, rotated out)
  const armL = latheMesh(ARM_PROFILE);
  armL.material = { baseColor: skinHex(1.0), roughness: 0.5, metallic: 0.03 };
  meshes.push(armL);
  const armR = { ...armL, data: armL.data, indices: armL.indices, indexCount: armL.indexCount, material: armL.material };
  meshes.push(armR);

  // legs (two cylinders)
  const legL = cylinder(0.16, 0.13, 0.75);
  legL.material = { baseColor: skinHex(0.96), roughness: 0.5, metallic: 0.03 };
  meshes.push(legL);
  const legR = { ...legL, data: legL.data, indices: legL.indices, indexCount: legL.indexCount, material: legL.material };
  meshes.push(legR);

  // choker
  const choker = cylinder(0.19, 0.19, 0.045);
  choker.material = { baseColor: [0.75, 0.06, 0.1], roughness: 0.3, metallic: 0.5 };
  meshes.push(choker);

  // tattoo bands
  const bandMat: Material = { baseColor: [0.03, 0.02, 0.05], roughness: 0.8, metallic: 0.0, opacity: 0.75 };
  if (hasTat) {
    const b1 = cylinder(0.655, 0.65, 0.045);
    b1.material = bandMat;
    meshes.push(b1);
    const b2 = cylinder(0.28, 0.26, 0.04);
    b2.material = bandMat;
    meshes.push(b2);
  }
  // augment glow seams
  const augMat: Material = { baseColor: [0.55, 0.25, 1.0], emissive: [0.55, 0.25, 1.0], emissiveIntensity: 2.0, roughness: 0.3, metallic: 0.4, bloom: true };
  if (hasAug) {
    const a1 = cylinder(0.66, 0.66, 0.02);
    a1.material = augMat;
    meshes.push(a1);
    const a2 = cylinder(0.345, 0.345, 0.015);
    a2.material = augMat;
    meshes.push(a2);
  }

  return {
    meshes,
    lights: [
      { kind: 'directional', direction: [-0.55, -0.35, 0.72], color: [1, 0.85, 0.72], intensity: 1.5 },
      { kind: 'directional', direction: [0.62, 0.05, 0.45], color: [0.38, 0.45, 0.62], intensity: 0.6 },
      { kind: 'point', position: [0, 2.3, -2.8], color: [0.65, 0.3, 0.95], intensity: 1.2 }
    ],
    camera: {
      position: [0.35, 1.02, 2.6],
      target: [0, 0.55, 0],
      up: [0, 1, 0],
      fovDeg: 38
    }
  };
}

/* ---------------------------------------------------------- renderer */

export interface HDRendererOptions {
  canvas?: HTMLCanvasElement;
  onProgress?: (pct: number) => void;
}

export class HDRenderer {
  private gl: WebGL2RenderingContext;
  private config: RenderConfig;
  private scene: Scene | null = null;
  private shadowProg: WebGLProgram;
  private sceneProg: WebGLProgram;
  private postProg: WebGLProgram;
  private shadowFbs: { fb: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer; hdr: boolean }[] = [];
  private hdrFb: { fb: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer; hdr: boolean } | null = null;
  private postVao: WebGLVertexArrayObject;
  private onProgress?: (pct: number) => void;
  /** stage-by-stage GL error log (diagnostics) */
  debugLog: string[] = [];

  private logStage(tag: string) {
    const e = this.gl.getError();
    if (e !== 0) this.debugLog.push(`${tag}: GL_ERROR ${e}`);
  }

  constructor(canvas?: HTMLCanvasElement, onProgress?: (pct: number) => void) {
    const c = canvas ?? document.createElement('canvas');
    const gl = c.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, depth: true });
    if (!gl) throw new Error('WebGL2 unavailable — the HD renderer cannot start');
    this.gl = gl;
    this.config = { width: 1920, height: 1920, hdr: true, shadows: true, bloom: true, samples: 3 };
    this.onProgress = onProgress;
    this.shadowProg = linkProgram(gl, SHADOW_VS, SHADOW_FS);
    this.sceneProg = linkProgram(gl, SCENE_VS, SCENE_FS);
    this.postProg = linkProgram(gl, POST_VS, POST_FS);
    this.postVao = gl.createVertexArray()!;
  }

  /** renderer.configure(RenderConfig(...)) */
  configure(config: RenderConfig): HDRenderer {
    this.config = { ...this.config, ...config };
    return this;
  }

  /** renderer.loadScene(scene) */
  loadScene(scene: Scene): HDRenderer {
    this.scene = scene;
    return this;
  }

  private shadowMapSize(): number {
    return Math.min(2048, Math.max(512, Math.round(this.config.width! / 1.5)));
  }

  private buildShadowFbs(w: number, h: number) {
    const gl = this.gl;
    for (const f of this.shadowFbs) disposeFramebuffer(gl, f);
    this.shadowFbs = [];
    for (let i = 0; i < 2; i++) {
      const fb = gl.createFramebuffer()!;
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // NOTE: no COMPARE_REF_TO_TEXTURE — the scene shader samples these
      // with a plain sampler2D and does the depth comparison itself
      // (compare-mode textures would be incomplete for sampler2D and
      // trigger GL_INVALID_OPERATION on every draw).
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('shadow framebuffer incomplete: ' + st);
      this.shadowFbs.push({ fb, tex, depth: null as unknown as WebGLRenderbuffer, hdr: false });
    }
  }

  private computeLightMatrices(): { view: Mat4; proj: Mat4; proj2: Mat4 } {
    const light = (this.scene?.lights?.find(l => l.kind === 'directional')?.direction ?? [-0.55, -0.35, 0.72]) as [number, number, number];
    const dist = 6.5;
    const cx = (this.scene?.camera.target ?? [0, 0.5, 0]) as [number, number, number];
    const eye: [number, number, number] = [
      cx[0] + light[0] * dist,
      cx[1] + light[1] * dist,
      cx[2] + light[2] * dist
    ];
    const view = mat4LookAt(eye, cx, [0, 1, 0]);
    const proj = mat4Ortho(-3.2, 3.2, -3.2, 3.2, 0.5, 12);
    const proj2 = mat4Ortho(-1.4, 1.4, -1.4, 1.4, 0.2, 5);
    return { view, proj, proj2 };
  }

  private uploadMesh(gl: WebGL2RenderingContext, prog: WebGLProgram, mesh: Mesh, model: Mat4, uLightVP0: WebGLUniformLocation, uLightVP1: WebGLUniformLocation, vp0: Mat4, vp1: Mat4) {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
    const stride = 8 * 4;
    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aNormal = gl.getAttribLocation(prog, 'aNormal');
    const aUV = gl.getAttribLocation(prog, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 24);
    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uModel'), false, model);
    gl.uniformMatrix4fv(uLightVP0, false, vp0);
    gl.uniformMatrix4fv(uLightVP1, false, vp1);
    const mat = mesh.material ?? {};
    const bc = mat.baseColor ?? [0.5, 0.5, 0.5];
    gl.uniform3fv(gl.getUniformLocation(prog, 'uBaseColor'), new Float32Array(bc));
    gl.uniform1f(gl.getUniformLocation(prog, 'uMetallic'), mat.metallic ?? 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'uRoughness'), mat.roughness ?? 0.5);
    const em = mat.emissive ?? [0, 0, 0];
    gl.uniform3fv(gl.getUniformLocation(prog, 'uEmissive'), new Float32Array(em));
    gl.uniform1f(gl.getUniformLocation(prog, 'uEmissiveIntensity'), mat.emissiveIntensity ?? 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'uOpacity'), mat.opacity ?? 1);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
    gl.deleteVertexArray(vao);
    gl.deleteBuffer(buf);
    gl.deleteBuffer(idx);
  }

  /** renderer.render() */
  render(): RenderResult {
    const gl = this.gl;
    if (!this.scene) throw new Error('no scene loaded — call loadScene(scene) first');
    const W = Math.max(64, Math.round(this.config.width ?? 1920));
    const H = Math.max(64, Math.round(this.config.height ?? 1920));
    const samples = Math.max(1, Math.round(this.config.samples ?? 3));
    const t0 = performance.now();
    const onP = this.onProgress;

    // the default framebuffer belongs to the canvas — size it to the
    // render target so the post pass isn't clipped
    const c = gl.canvas as HTMLCanvasElement;
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }

    const shadowSize = this.shadowMapSize();
    this.buildShadowFbs(shadowSize, shadowSize);
    if (this.hdrFb) disposeFramebuffer(gl, this.hdrFb);
    this.hdrFb = createFramebuffer(gl, W, H, this.config.hdr !== false);

    const light = this.computeLightMatrices();
    const vp0 = mat4Multiply(light.proj, light.view);
    const vp1 = mat4Multiply(light.proj2, light.view);

    const cam = this.scene.camera;
    const aspect = W / H;
    const proj = mat4Perspective(((cam.fovDeg ?? 40) * Math.PI) / 180, aspect, 0.08, 40);
    const view = mat4LookAt(cam.position, cam.target, cam.up ?? [0, 1, 0]);

    const sceneJitter = (k: number) => {
      // per-sample camera jitter for anti-aliased multi-pass accumulation
      const j = 0.0045 * k;
      return mat4Translation((k === 0 ? 0 : (k % 2 ? j : -j)), (k === 0 ? 0 : (k % 3 ? j : -j)), 0);
    };

    // --- pass 1: shadows
    gl.useProgram(this.shadowProg);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.colorMask(false, false, false, false);
    const uLightVP = gl.getUniformLocation(this.shadowProg, 'uLightVP')!;
    const uModelS = gl.getUniformLocation(this.shadowProg, 'uModel')!;
    const models = this.modelMatrices();
    for (let ci = 0; ci < 2; ci++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbs[ci].fb);
      gl.viewport(0, 0, shadowSize, shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uLightVP, false, ci === 0 ? vp0 : vp1);
      for (let m = 0; m < this.scene.meshes.length; m++) {
        gl.uniformMatrix4fv(uModelS, false, models[m]);
        this.drawShadowMesh(this.scene.meshes[m]);
      }
    }
    gl.colorMask(true, true, true, true);
    this.logStage('shadow-pass');
    onP?.(15);

    // --- pass 2: scene (accumulated samples)
    gl.useProgram(this.sceneProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.sceneProg, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.sceneProg, 'uView'), false, view);
    gl.uniform3fv(gl.getUniformLocation(this.sceneProg, 'uCamPos'), new Float32Array(cam.position));
    gl.uniform1f(gl.getUniformLocation(this.sceneProg, 'uShadowStrength'), this.config.shadows === false ? 0 : 0.85);
    gl.uniform1i(gl.getUniformLocation(this.sceneProg, 'uShadowMap0'), 0);
    gl.uniform1i(gl.getUniformLocation(this.sceneProg, 'uShadowMap1'), 1);
    const uLVP0 = gl.getUniformLocation(this.sceneProg, 'uLightVP0')!;
    const uLVP1 = gl.getUniformLocation(this.sceneProg, 'uLightVP1')!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFb.fb);
    gl.viewport(0, 0, W, H);
    const bg = this.config.background ?? [0.015, 0.012, 0.03];
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    this.logStage('scene-pass-setup');
    for (let k = 0; k < samples; k++) {
      const jitter = sceneJitter(k);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.sceneProg, 'uView'), false, mat4Multiply(view, jitter));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowFbs[0].tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowFbs[1].tex);
      for (let m = 0; m < this.scene.meshes.length; m++) {
        this.uploadMesh(gl, this.sceneProg, this.scene.meshes[m], models[m], uLVP0, uLVP1, vp0, vp1);
      }
      this.logStage('scene-pass-sample-' + k);
      onP?.(15 + Math.round(((k + 1) / samples) * 55));
    }
    gl.disable(gl.BLEND);
    this.logStage('scene-pass-end');
    onP?.(75);

    // --- pass 3: post FX (bloom + tone map + vignette + grain)
    gl.useProgram(this.postProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(this.postVao);
    const pbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPosP = gl.getAttribLocation(this.postProg, 'aPos');
    gl.enableVertexAttribArray(aPosP);
    gl.vertexAttribPointer(aPosP, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.hdrFb.tex);
    gl.uniform1i(gl.getUniformLocation(this.postProg, 'uScene'), 0);
    gl.uniform1f(gl.getUniformLocation(this.postProg, 'uBloom'), this.config.bloom === false ? 0 : 0.35);
    gl.uniform2f(gl.getUniformLocation(this.postProg, 'uRes'), W, H);
    gl.uniform1f(gl.getUniformLocation(this.postProg, 'uSeed'), (this.config.seed ?? 7) % 9999);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.logStage('post-pass');
    gl.deleteBuffer(pbuf);
    onP?.(95);

    // read back
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(gl.canvas as HTMLCanvasElement, 0, 0);
    const ms = Math.round(performance.now() - t0);
    onP?.(100);
    return { canvas: out, pngDataUrl: out.toDataURL('image/png'), width: W, height: H, ms };
  }

  /** renderer.exportPng(file) — browser equivalent: PNG data URL. */
  exportPng(result?: RenderResult): string {
    const r = result ?? this.render();
    return r.pngDataUrl;
  }

  private modelMatrices(): Mat4[] {
    const m: Mat4[] = [];
    const I = mat4Identity();
    // [0] floor
    m.push(I);
    // [1] torso (height 0.86)
    m.push(mat4Multiply(mat4Scale(1.3, 0.95, 1.3), mat4Translation(0, 0.02, 0)));
    // [2] head
    m.push(mat4Multiply(mat4RotationX(-0.08), mat4Translation(0, 1.12, 0)));
    // [3] hair
    m.push(mat4Multiply(mat4Scale(1.18, 1.1, 1.18), mat4Multiply(mat4RotationX(-0.08), mat4Translation(0, 1.17, 0))));
    // [4] left eye, [5] right eye
    m.push(mat4Translation(-0.13, 1.2, 0.26));
    m.push(mat4Translation(0.13, 1.2, 0.26));
    // [6] lips
    m.push(mat4Multiply(mat4RotationX(0.1), mat4Translation(0, 1.13, 0.27)));
    // [7] left arm, [8] right arm
    m.push(mat4Multiply(mat4RotationZ(-0.16), mat4Multiply(mat4Scale(0.5, 1.15, 0.5), mat4Translation(-0.42, 0.84, 0))));
    m.push(mat4Multiply(mat4RotationZ(0.16), mat4Multiply(mat4Scale(0.5, 1.15, 0.5), mat4Translation(0.42, 0.84, 0))));
    // [9] left leg, [10] right leg
    m.push(mat4Multiply(mat4Scale(1.05, 1, 1.05), mat4Translation(-0.16, 0.02, 0)));
    m.push(mat4Multiply(mat4Scale(1.05, 1, 1.05), mat4Translation(0.16, 0.02, 0)));
    // [11] choker
    m.push(mat4Translation(0, 1.02, 0));
    // [12] tattoo upper, [13] tattoo lower (optional)
    m.push(mat4Translation(0, 0.55, 0));
    m.push(mat4Translation(0, 0.3, 0));
    // [14] augment upper, [15] augment lower (optional)
    m.push(mat4Translation(0, 0.57, 0));
    m.push(mat4Translation(0, 0.32, 0));
    return m;
  }

  private drawShadowMesh(mesh: Mesh) {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.shadowProg, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 32, 0);
    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
    gl.deleteVertexArray(vao);
    gl.deleteBuffer(buf);
    gl.deleteBuffer(idx);
  }

  dispose() {
    const gl = this.gl;
    for (const f of this.shadowFbs) disposeFramebuffer(gl, f);
    if (this.hdrFb) disposeFramebuffer(gl, this.hdrFb);
    gl.deleteProgram(this.shadowProg);
    gl.deleteProgram(this.sceneProg);
    gl.deleteProgram(this.postProg);
    gl.deleteVertexArray(this.postVao);
  }
}

export { hexToRgb, mat4Identity, mat4LookAt, mat4Multiply, mat4Ortho, mat4Perspective, mat4RotationX, mat4RotationY, mat4Scale, mat4Translation };
export type { Light, Material, Mesh };
