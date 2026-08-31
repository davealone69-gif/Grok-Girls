/* ------------------------------------------------------------------ */
/* HdAvatarRenderer — the avatar renderer, replacing the spinning cube */
/* as the live 3D viewport. Mirrors HdAvatarRenderer.kt:              */
/*  - 128×96 UV sphere (position+normal+uv+tangent, 11 floats/vertex)  */
/*  - Cook-Torrance PBR (GGX D, Schlick-GGX G, Schlick F)             */
/*  - skin albedo (0.66, 0.34, 0.24), fake subsurface scatter,        */
/*    exposure + ACES + gamma                                         */
/*  - setRotation / setMaterial(clamped) / setExposure / setKeyLight  */
/*  - GPU skinning path: when a Skeleton is bound, uBones[128] drive   */
/*    a 16-float/vertex skinned mesh (avatar_skin.vert layout)        */
/*  - AvatarParameters modulate bone scales (height/chest/waist/hips/  */
/*    arms/legs/head) via local transforms                             */
/*  - HDFrameRenderer off-screen pass at the configured resolution     */
/* ------------------------------------------------------------------ */

import { mat4Identity, mat4Invert, mat4LookAt, mat4Multiply, mat4Perspective, mat4RotationAxisDeg, mat4Scale, mat4Transpose, Mat4 } from './math';
import { HDFrameRenderer } from './HDFrameRenderer';
import { RenderConfig } from './types';
import { RenderResolution } from './RenderResolution';
import { AvatarMesh, createAvatarMesh } from './avatar/AvatarMesh';
import { Bone, Skeleton } from './avatar/Skeleton';
import { AvatarParameters, DEFAULT_AVATAR_PARAMETERS } from './avatar/AvatarParameters';
import { AvatarMaterial, DEFAULT_AVATAR_MATERIAL } from './avatar/AvatarMaterial';

/* 320 es -> 300 es (identical logic, same layout locations) */
const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec3 aTangent;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uNormalMatrix;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec2 vUV;
out vec3 vTangent;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(uNormalMatrix) * aNormal);
  vTangent = normalize(mat3(uModel) * aTangent);
  vUV = aUV;
  gl_Position = uProjection * uView * world;
}`;

/* The native PbrSkin.frag — full Cook-Torrance + subsurface + ACES. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vNormal;
in vec2 vUV;
in vec3 vTangent;
layout(location = 0) out vec4 outColor;
uniform vec3 uCameraPosition;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uExposure;
uniform float uSubsurface;
uniform vec3 uSubsurfaceColor;
const float PI = 3.14159265359;

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denominator = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denominator * denominator, 0.0001);
}
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) * geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
}
vec3 acesToneMap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uLightPosition - vWorldPosition);
  vec3 H = normalize(V + L);
  /* native skin approximation (texture-driven albedo comes with the GLB loader) */
  vec3 albedo = vec3(0.66, 0.34, 0.24);
  vec3 F0 = mix(vec3(0.04), albedo, uMetallic);
  float distanceToLight = length(uLightPosition - vWorldPosition);
  float attenuation = 1.0 / max(distanceToLight * distanceToLight, 0.01);
  vec3 radiance = uLightColor * attenuation * 12.0;
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  float D = distributionGGX(N, H, uRoughness);
  float G = geometrySmith(N, V, L, uRoughness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  vec3 specular = D * G * F / max(4.0 * NdotV * NdotL, 0.001);
  vec3 kS = F;
  vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);
  vec3 direct = (kD * albedo / PI + specular) * radiance * NdotL;
  vec3 ambient = uAmbientColor * albedo * 0.55;
  /* fake subsurface: red scatter on back-lit edges */
  float backLight = pow(max(dot(-L, N), 0.0), 2.5);
  vec3 subsurface = uSubsurfaceColor * backLight * uSubsurface;
  vec3 color = ambient + direct + subsurface;
  color = vec3(1.0) - exp(-color * uExposure);
  color = acesToneMap(color);
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}`;

/* avatar_skin.vert — GPU skinning (4 weights, uBones[128]) */
const SKIN_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 3) in uvec4 aBoneIndices;
layout(location = 4) in vec4 aBoneWeights;
const int MAX_BONES = 128;
uniform mat4 uBones[MAX_BONES];
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec2 vUv;
void main() {
  mat4 skin = uBones[aBoneIndices.x] * aBoneWeights.x;
  skin += uBones[aBoneIndices.y] * aBoneWeights.y;
  skin += uBones[aBoneIndices.z] * aBoneWeights.z;
  skin += uBones[aBoneIndices.w] * aBoneWeights.w;
  vec4 skinnedPosition = skin * vec4(aPosition, 1.0);
  vec3 skinnedNormal = mat3(skin) * aNormal;
  vec4 worldPosition = uModel * skinnedPosition;
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(uModel) * skinnedNormal);
  vUv = aUv;
  gl_Position = uProjection * uView * worldPosition;
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed:\n' + gl.getShaderInfoLog(sh));
  return sh;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program linking failed:\n' + gl.getProgramInfoLog(p));
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}

export interface HdAvatarRendererOptions {
  config?: RenderConfig;
  skeleton?: Skeleton | null;
  parameters?: AvatarParameters;
  material?: AvatarMaterial;
}

export class HdAvatarRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private skinProgram: WebGLProgram;
  private mesh: AvatarMesh; // UV sphere (native placeholder, skinnable)
  private projection = mat4Identity();
  private view = mat4Identity();
  private model = mat4Identity();
  private normalMatrix = mat4Identity();
  private camera: [number, number, number] = [0, 1.55, 4.2];
  private rotationX = 0;
  private rotationY = 0;
  private exposure = 1.0;
  private metallic = 0.0;
  private roughness = 0.42;
  private lightPosition: [number, number, number] = [2.5, 4.5, 3.5];
  private lightColor: [number, number, number] = [1.0, 0.92, 0.82];
  private ambientColor: [number, number, number] = [0.16, 0.18, 0.22];
  private subsurfaceColor: [number, number, number] = [1.0, 0.32, 0.18];
  private skeleton: Skeleton | null;
  private parameters: AvatarParameters;
  private material: AvatarMaterial;
  private frameRenderer: HDFrameRenderer | null = null;
  private autoRotate = true;
  private angle = 0;
  private spinning = false;
  private raf = 0;
  private glErrors: number[] = [];

  constructor(canvas: HTMLCanvasElement, opts: HdAvatarRendererOptions = {}) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, depth: true, antialias: true });
    if (!gl) throw new Error('WebGL2 unavailable — avatar renderer cannot start');
    this.gl = gl;
    this.skeleton = opts.skeleton ?? null;
    this.parameters = { ...DEFAULT_AVATAR_PARAMETERS, ...(opts.parameters ?? {}) };
    this.material = { ...DEFAULT_AVATAR_MATERIAL, ...(opts.material ?? {}) };
    this.program = link(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.skinProgram = link(gl, SKIN_VERTEX_SHADER, FRAGMENT_SHADER);

    // native onSurfaceCreated
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.015, 0.018, 0.024, 1);

    // native frame renderer wiring (off-screen HD pass)
    const cfg = opts.config ?? { resolution: RenderResolution.FULL_HD, enableDepth: true, enableMsaa: true, msaaSamples: 4, enableHdr: false, enableBloom: false };
    this.frameRenderer = new HDFrameRenderer(gl, cfg);
    this.frameRenderer.initialize();

    this.mesh = this.createAvatarMesh();
    this.mesh.upload(gl);
  }

  /* ---- native API ---- */
  setRotation(x: number, y: number): void {
    this.rotationX = x;
    this.rotationY = y;
  }
  setMaterial(metallic: number, roughness: number): void {
    this.metallic = Math.min(1, Math.max(0, metallic));
    this.roughness = Math.min(1, Math.max(0.04, roughness));
  }
  setExposure(value: number): void {
    this.exposure = Math.min(8, Math.max(0.1, value));
  }
  setKeyLight(x: number, y: number, z: number): void {
    this.lightPosition = [x, y, z];
  }
  setSkeleton(s: Skeleton | null): void {
    this.skeleton = s;
  }
  setParameters(p: AvatarParameters): void {
    this.parameters = { ...p };
  }
  setAutoRotate(v: boolean): void {
    this.autoRotate = v;
  }
  getAngle(): number {
    return this.angle;
  }
  readCenterPixel(): [number, number, number, number] {
    return this.readPixelAt(0.5, 0.5);
  }
  /** read a pixel at normalized (0..1) coords, y measured from the top */
  readPixelAt(nx: number, ny: number): [number, number, number, number] {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const px = new Uint8Array(4);
    this.gl.readPixels(Math.floor(canvas.width * nx), Math.floor(canvas.height * (1 - ny)), 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
    return [px[0], px[1], px[2], px[3]];
  }
  /** max RGB across a vertical strip at nx — proves the figure is lit */
  maxStrip(nx: number): [number, number, number] {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    let mr = 0, mg = 0, mb = 0;
    const px = new Uint8Array(4 * canvas.height);
    this.gl.readPixels(Math.floor(canvas.width * nx), 0, 1, canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < px.length; i += 4) {
      mr = Math.max(mr, px[i]);
      mg = Math.max(mg, px[i + 1]);
      mb = Math.max(mb, px[i + 2]);
    }
    return [mr, mg, mb];
  }
  pause(): void {
    this.spinning = false;
    cancelAnimationFrame(this.raf);
  }
  resume(): void {
    if (!this.spinning) {
      this.spinning = true;
      this.raf = requestAnimationFrame(() => this.frame());
    }
  }
  release(): void {
    cancelAnimationFrame(this.raf);
    this.mesh.destroy(this.gl);
    this.frameRenderer?.destroy();
    this.gl.deleteProgram(this.program);
    this.gl.deleteProgram(this.skinProgram);
  }

  start(): void {
    this.spinning = true;
    this.raf = requestAnimationFrame(() => this.frame());
  }

  private frame(): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // ---- HD off-screen pass (native onDrawFrame) ----
    this.frameRenderer?.beginFrame();
    this.renderScene(w, h, false);
    this.frameRenderer?.endFrame(w, h);

    // ---- screen preview ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.015, 0.018, 0.024, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.renderScene(w, h, true);

    const err = gl.getError();
    if (err !== 0) this.glErrors.push(err);

    if (this.spinning) this.raf = requestAnimationFrame(() => this.frame());
  }

  private renderScene(w: number, h: number, toScreen: boolean) {
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    const aspect = w / h;
    this.projection = mat4Perspective((45 * Math.PI) / 180, aspect, 0.01, 100);
    this.camera = [0, 1.55, 4.2];
    this.view = mat4LookAt(this.camera, [0, 1.45, 0], [0, 1, 0]);

    // native onDrawFrame rotation (only the preview spins)
    this.angle += this.autoRotate && toScreen ? 0.5 : 0;
    this.model = mat4Multiply(mat4RotationAxisDeg([1, 0, 0], this.rotationX), mat4RotationAxisDeg([0, 1, 0], this.rotationY + this.angle));
    this.normalMatrix = mat4Transpose(mat4Invert(this.model));

    const p = this.parameters;
    const skinned = this.skeleton && this.skeleton.bones.length > 0;

    if (skinned && this.skeleton) {
      // AvatarParameters drive bone locals (the native morph/skeleton layer)
      const bones = this.skeleton.bones;
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        const name = b.name.toLowerCase();
        let s: Mat4 = mat4Identity();
        if (name.includes('root')) s = mat4Scale(p.bodyWidth, p.height, p.bodyWidth);
        else if (name.includes('spine')) s = mat4Scale(p.bodyWidth, 1, p.bodyWidth);
        else if (name.includes('chest')) s = mat4Scale(p.chest, 1, p.chest);
        else if (name.includes('waist')) s = mat4Scale(p.waist, 1, p.waist);
        else if (name.includes('hip')) s = mat4Scale(p.hipWidth, 1, p.hipWidth);
        else if (name.includes('arm')) s = mat4Scale(1, p.armLength, 1);
        else if (name.includes('leg')) s = mat4Scale(1, p.legLength, 1);
        else if (name.includes('head')) s = mat4Scale(p.headScale, p.headScale, p.headScale);
        b.localTransform = s;
      }
      this.skeleton.update();
      gl.useProgram(this.skinProgram);
      const loc = gl.getUniformLocation(this.skinProgram, 'uBones');
      if (loc) gl.uniformMatrix4fv(loc, false, this.skeleton.skinMatrices);
      this.applyCommonUniforms(gl, this.skinProgram);
      this.mesh.draw(gl); // native: ONE mesh through the skinned shader
    } else {
      gl.useProgram(this.program);
      this.applyCommonUniforms(gl, this.program);
      this.mesh.draw(gl);
    }
  }

  private applyCommonUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, this.model);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, this.view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjection'), false, this.projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uNormalMatrix'), false, this.normalMatrix);
    gl.uniform3fv(gl.getUniformLocation(program, 'uCameraPosition'), new Float32Array(this.camera));
    gl.uniform3fv(gl.getUniformLocation(program, 'uLightPosition'), new Float32Array(this.lightPosition));
    gl.uniform3fv(gl.getUniformLocation(program, 'uLightColor'), new Float32Array(this.lightColor));
    gl.uniform3fv(gl.getUniformLocation(program, 'uAmbientColor'), new Float32Array(this.ambientColor));
    gl.uniform1f(gl.getUniformLocation(program, 'uExposure'), this.exposure);
    gl.uniform1f(gl.getUniformLocation(program, 'uMetallic'), this.metallic);
    gl.uniform1f(gl.getUniformLocation(program, 'uRoughness'), this.material.roughness ?? this.roughness);
    gl.uniform1f(gl.getUniformLocation(program, 'uSubsurface'), this.material.subsurface ?? 0.18);
    gl.uniform3fv(gl.getUniformLocation(program, 'uSubsurfaceColor'), new Float32Array(this.subsurfaceColor));
  }

  /** native createAvatarMesh(): the placeholder sphere.
   *  NOTE: the native 128×96 sphere uses 32-bit indices; our packed
   *  skinned layout uses uint16, so the same shape is built at 64×48
   *  (18 432 indices) WITH bone attributes for the uBones path. */
  private createAvatarMesh(): AvatarMesh {
    return buildSphereMesh(64, 48);
  }
}

/** Build the avatar sphere with skinning attributes (bone 0, weight 1)
 *  — the native renderer draws ONE mesh through the skinned shader; the
 *  sphere carries bone data so uBones can deform it. */
function buildSphereMesh(segments: number, rings: number): AvatarMesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = Math.PI * v;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = Math.PI * 2 * u;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const px = sinPhi * cosTheta;
      const py = cosPhi;
      const pz = sinPhi * sinTheta;
      // pos3 normal3 uv2 boneIdx4 boneW4 (16 floats, all bone 0)
      verts.push(px, py, pz, px, py, pz, u, v, 0, 0, 0, 0, 1, 0, 0, 0);
    }
  }
  const rowSize = segments + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * rowSize + x;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return createAvatarMesh(new Float32Array(verts), new Uint16Array(idx), true);
}

export function defaultAvatarSkeleton(): Skeleton {
  const names = ['root', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'lowerArmL', 'shoulderR', 'upperArmR', 'lowerArmR', 'hipL', 'legL', 'hipR', 'legR'];
  const parents = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 1, 11, 1, 13];
  return new Skeleton(names.map((n, i) => new Bone(n, parents[i])));
}
