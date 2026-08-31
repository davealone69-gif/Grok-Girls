/* ------------------------------------------------------------------ */
/* HdAvatarRenderer — the avatar renderer, replacing the spinning cube */
/* as the live 3D viewport. Mirrors HdAvatarRenderer.kt:              */
/*  - UV sphere mesh: pos/normal/uv/tangent4, bone indices (uint8) +   */
/*    weights (tangent unused by the current reference shader)         */
/*  - Cook-Torrance PBR (GGX D, Schlick-GGX G, Schlick F) driven by    */
/*    PROCEDURAL skin textures (ProceduralSkinTextures.ts): sRGB base  */
/*    color, R-channel roughness map, tangent-space normal map with    */
/*    derivative TBN; factor uniforms + point light with intensity;    */
/*    Reinhard tone map + gamma (reference: native renderer.hd spec)   */
/*  - setRotation / setMaterial(clamped) / setExposure (inert) /       */
/*    setKeyLight                                                      */
/*  - EYE SYSTEM (milestone 1): procedural sclera/iris/pupil maps +   */
/*    iris normal, dedicated eye shader with cornea Fresnel wet layer  */
/*    and PBR specular; two eye spheres parented to the avatar         */
/*  - HAIR (milestone 2): procedural strand color/roughness/direction/ */
/*    density maps, dedicated hair shader with anisotropic dual-lobe   */
/*    specular + root darkening + alpha cutoff; hair shell over skull  */
/*  - SHADOWS (milestone 3): depth-only pass to a 2048² 32F depth      */
/*    texture, 3x3 PCF + slope-scaled bias + strength, shadow sampled  */
/*    on unit 7 in the skin PBR pass (eyes/hair cast shadows too)      */
/*  - HDR + IBL (milestone 4): bootstrap studio cubemaps (irradiance   */
/*    64², prefiltered 512², BRDF LUT 256²) on units 4/5/6, diffuse +  */
/*    specular IBL in the skin pass, exposure (2^ev) + ACES tone map   */
/*  - GPU skinning path: when a Skeleton is bound, uBones[128] drive   */
/*    a 17-float/vertex skinned mesh (avatar_skin.vert layout)        */
/*  - AvatarParameters modulate bone scales (height/chest/waist/hips/  */
/*    arms/legs/head) via local transforms                             */
/*  - HDFrameRenderer off-screen pass at the configured resolution     */
/* ------------------------------------------------------------------ */

import { mat4Identity, mat4Invert, mat4LookAt, mat4Multiply, mat4Ortho, mat4Perspective, mat4RotationAxisDeg, mat4RotationY, mat4Scale, mat4Translation, mat4Transpose, Mat4 } from './math';
import { HDFrameRenderer } from './HDFrameRenderer';
import { RenderConfig } from './types';
import { RenderResolution } from './RenderResolution';
import { AvatarMesh, createAvatarMesh } from './avatar/AvatarMesh';
import { Bone, Skeleton } from './avatar/Skeleton';
import { AvatarParameters, DEFAULT_AVATAR_PARAMETERS } from './avatar/AvatarParameters';
import { AvatarMaterial, DEFAULT_AVATAR_MATERIAL } from './avatar/AvatarMaterial';
import { createProceduralSkinTextures, destroyProceduralSkinTextures, createThicknessTexture, destroyThicknessTexture, createSpecularTexture, destroySpecularTexture, createPoreTexture, destroyPoreTexture, createWrinkleTexture, destroyWrinkleTexture, ProceduralSkinTextures } from './ProceduralSkinTextures';
import { DEFAULT_ADVANCED_SKIN_MATERIAL } from './AdvancedSkinMaterial';
import { createEyeTextures, destroyEyeTextures, EyeTextures } from './EyeTextures';
import { EyeShader } from './EyeShader';
import { DEFAULT_EYE_PARAMETERS, DEFAULT_IRIS_COLOR } from './EyeMaterial';
import { createHairTextures, destroyHairTextures, HairTextures } from './HairTextures';
import { HairShader } from './HairShader';
import { DEFAULT_HAIR_PARAMETERS } from './HairMaterial';
import { createShadowMap, destroyShadowMap, ShadowMap } from './ShadowMap';
import { ShadowShader } from './ShadowShader';
import { createIblPipeline, destroyIblPipeline, DEFAULT_IBL_SETTINGS, IblPipeline } from './IblPipeline';

/* 300 es — vertex shader for the non-skinned path. Native attribute
 * layout: 0 pos, 1 normal, 2 uv, 3 tangent (vec4, w = handedness). */
const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vTexCoord;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vWorldNormal = normalize(mat3(transpose(inverse(uModel))) * aNormal);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * uView * world;
}`;

/* PbrSkin.frag — Cook-Torrance PBR + wrap-light subsurface scattering
 * driven by procedural skin textures (thickness map on unit 3);
 * factor uniforms + point light (reference: native renderer.hd
 * HdAvatarPbrShader spec, ES 3.00). */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vTexCoord;
layout(location = 0) out vec4 outColor;
uniform sampler2D uBaseColorTexture;
uniform sampler2D uRoughnessTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uSkinThickness;
uniform sampler2D uSkinSpecularMap;
uniform sampler2D uSkinPore;
uniform sampler2D uWrinkleMap;
uniform vec4 uBaseColorFactor;
uniform float uMetallicFactor;
uniform float uRoughnessFactor;
uniform float uSubsurfaceStrength;
uniform vec3 uScatterRadius;
uniform float uEpidermalStrength;
uniform float uOilStrength;
uniform float uPoreStrength;
uniform float uSkinSpecular;
uniform float uWrinkleStrength;
uniform float uExpressionIntensity;
uniform vec3 uCameraPosition;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform sampler2D uShadowMap;
uniform mat4 uLightViewProjection;
uniform float uShadowBias;
uniform float uShadowStrength;
uniform samplerCube uIrradianceMap;
uniform samplerCube uPrefilteredMap;
uniform sampler2D uBrdfLut;
uniform float uIblIntensity;
uniform float uEnvironmentRotation;
uniform float uExposure;
uniform vec3 uEmissiveFactor;
const float PI = 3.14159265359;

vec3 sampleNormal(float detailStrength) {
  vec3 N = normalize(vWorldNormal);
  vec3 tangentNormal = texture(uNormalTexture, vTexCoord).xyz * 2.0 - 1.0;
  tangentNormal.xy *= detailStrength;
  tangentNormal = normalize(tangentNormal);
  vec3 dp1 = dFdx(vWorldPosition);
  vec3 dp2 = dFdy(vWorldPosition);
  vec2 duv1 = dFdx(vTexCoord);
  vec2 duv2 = dFdy(vTexCoord);
  vec3 T = normalize(dp1 * duv2.y - dp2 * duv1.y);
  vec3 B = normalize(-dp1 * duv2.x + dp2 * duv1.x);
  mat3 TBN = mat3(T, B, N);
  return normalize(TBN * tangentNormal);
}


float calculateShadow(vec3 worldPosition, vec3 normal, vec3 lightDirection) {
  vec4 lightSpace = uLightViewProjection * vec4(worldPosition, 1.0);
  vec3 projection = lightSpace.xyz / lightSpace.w;
  projection = projection * 0.5 + 0.5;

  if (projection.z > 1.0 || projection.x < 0.0 || projection.x > 1.0 || projection.y < 0.0 || projection.y > 1.0) {
    return 1.0;
  }

  float bias = max(uShadowBias * (1.0 - dot(normal, lightDirection)), uShadowBias * 0.25);
  vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));

  float visibility = 0.0;
  // 3x3 PCF.
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float depth = texture(uShadowMap, projection.xy + vec2(x, y) * texelSize).r;
      visibility += projection.z - bias <= depth ? 1.0 : 0.0;
    }
  }
  visibility /= 9.0;

  return mix(1.0, visibility, uShadowStrength);
}

vec3 skinScatter(vec3 N, vec3 L, vec3 V, vec3 albedo, float thickness) {
  float NdotL = dot(N, L);
  // Wrapped diffuse lets light affect shallow skin angles.
  float wrapped = clamp((NdotL + 0.45) / 1.45, 0.0, 1.0);
  // Back-scattering term.
  vec3 backLight = normalize(-L + N * 0.35);
  float transmission = pow(max(dot(V, backLight), 0.0), 2.5);
  // Multi-channel (red/green/blue) subsurface response.
  vec3 redScatter = vec3(1.0, 0.28, 0.16);
  vec3 greenScatter = vec3(0.45, 0.12, 0.08);
  vec3 blueScatter = vec3(0.16, 0.035, 0.025);
  vec3 scatter = redScatter * uScatterRadius.r;
  scatter += greenScatter * uScatterRadius.g;
  scatter += blueScatter * uScatterRadius.b;
  return scatter * (wrapped * 0.45 + transmission * thickness) * albedo * uSubsurfaceStrength;
}

vec3 skinSpecular(vec3 N, vec3 V, vec3 L, float roughness, float specularStrength) {
  vec3 H = normalize(V + L);
  float NoV = max(dot(N, V), 0.0);
  float NoL = max(dot(N, L), 0.0);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
  float a = roughness * roughness;
  float a2 = a * a;
  float denominator = NoH * NoH * (a2 - 1.0) + 1.0;
  float D = a2 / max(PI * denominator * denominator, 0.00001);
  float k = (roughness + 1.0);
  k = k * k / 8.0;
  float G = (NoV / max(NoV * (1.0 - k) + k, 0.00001)) *
            (NoL / max(NoL * (1.0 - k) + k, 0.00001));
  float F0 = 0.04 * specularStrength;
  float F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
  return vec3(D * G * F / max(4.0 * NoV * NoL, 0.001));
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

mat3 rotationY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

vec3 calculateDiffuseIbl(vec3 N, vec3 albedo, float metallic) {
  vec3 direction = rotationY(uEnvironmentRotation) * N;
  vec3 irradiance = texture(uIrradianceMap, direction).rgb;
  vec3 F0 = mix(vec3(0.04), albedo, metallic);
  vec3 F = fresnelSchlick(max(dot(N, normalize(uCameraPosition - vWorldPosition)), 0.0), F0);
  vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);
  return irradiance * albedo * kD;
}

vec3 calculateSpecularIbl(vec3 N, vec3 V, vec3 albedo, float metallic, float roughness) {
  vec3 R = reflect(-V, N);
  R = rotationY(uEnvironmentRotation) * R;
  float mip = roughness * 5.0;
  vec3 prefiltered = textureLod(uPrefilteredMap, R, mip).rgb;
  vec3 F0 = mix(vec3(0.04), albedo, metallic);
  vec3 F = fresnelSchlick(max(dot(N, V), 0.0), F0);
  vec2 brdf = texture(uBrdfLut, vec2(max(dot(N, V), 0.0), roughness)).rg;
  return prefiltered * (F * brdf.x + brdf.y);
}

vec3 toneMapACES(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec4 baseColor = texture(uBaseColorTexture, vTexCoord) * uBaseColorFactor;
  vec3 baseSkin = baseColor.rgb;

  float baseRough = texture(uRoughnessTexture, vTexCoord).r * uRoughnessFactor;

  float thickness = texture(uSkinThickness, vTexCoord).r;
  float specularMap = texture(uSkinSpecularMap, vTexCoord).r;

  // Pore microdetail — uniformly smooth skin reads as CG mannequin.
  float pore = texture(uSkinPore, vTexCoord * 4.0).r;
  float poreVariation = (pore - 0.5) * uPoreStrength;
  float skinRoughness = clamp(baseRough + poreVariation, 0.04, 1.0);

  // Expression-driven wrinkles (driven by uExpressionIntensity).
  float wrinkleMask = texture(uWrinkleMap, vTexCoord).r;
  float expressionWrinkle = wrinkleMask * uWrinkleStrength * uExpressionIntensity;
  skinRoughness = clamp(skinRoughness + expressionWrinkle * 0.12, 0.04, 1.0);
  float facialDetailStrength = 1.0 + expressionWrinkle * 0.35;

  float metallic = clamp(uMetallicFactor, 0.0, 1.0);

  vec3 N = sampleNormal(facialDetailStrength);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uLightPosition - vWorldPosition);
  vec3 H = normalize(V + L);
  float distanceToLight = length(uLightPosition - vWorldPosition);
  float attenuation = 1.0 / max(distanceToLight * distanceToLight, 0.01);
  vec3 radiance = uLightColor * uLightIntensity * attenuation;
  float NdotL = max(dot(N, L), 0.0);

  // Dielectric diffuse (skin is not a metal).
  vec3 F0 = mix(vec3(0.04), baseSkin, metallic);
  vec3 F = fresnelSchlick(max(dot(N, V), 0.0), F0);
  vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);
  vec3 diffuse = kD * baseSkin / PI;

  float shadow = calculateShadow(vWorldPosition, N, L);

  // Multi-channel subsurface + broad specular + tight oil highlight.
  vec3 scatter = skinScatter(N, L, V, baseSkin, thickness);
  vec3 broadSpecular = skinSpecular(N, V, L, skinRoughness, uSkinSpecular * specularMap);
  vec3 oilHighlight = skinSpecular(N, V, L, 0.12, uOilStrength);

  vec3 skinLighting = (diffuse + broadSpecular + oilHighlight) * radiance * NdotL * shadow;
  skinLighting += scatter * radiance;

  // Skin-tuned IBL response.
  vec3 diffuseIbl = calculateDiffuseIbl(N, baseSkin, metallic);
  vec3 specularIbl = calculateSpecularIbl(N, V, baseSkin, metallic, skinRoughness);
  vec3 skinIbl = (diffuseIbl * 0.72 + specularIbl * 1.15) * uIblIntensity;

  vec3 emissive = uEmissiveFactor;

  vec3 color = skinIbl + skinLighting + emissive;

  color *= pow(2.0, uExposure);
  color = toneMapACES(color);
  // Gamma encode.
  color = pow(color, vec3(1.0 / 2.2));

  outColor = vec4(color, baseColor.a);
}`;

/* avatar_skin.vert — GPU skinning (4 weights, uBones[128]).
 * Shares the fragment's varyings with the plain vertex shader. */
const SKIN_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;
layout(location = 4) in uvec4 aBoneIndices;
layout(location = 5) in vec4 aBoneWeights;
const int MAX_BONES = 128;
uniform mat4 uBones[MAX_BONES];
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vTexCoord;
void main() {
  mat4 skin = uBones[aBoneIndices.x] * aBoneWeights.x;
  skin += uBones[aBoneIndices.y] * aBoneWeights.y;
  skin += uBones[aBoneIndices.z] * aBoneWeights.z;
  skin += uBones[aBoneIndices.w] * aBoneWeights.w;
  vec4 skinnedPosition = skin * vec4(aPosition, 1.0);
  vec3 skinnedNormal = mat3(skin) * aNormal;
  vec4 worldPosition = uModel * skinnedPosition;
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(uModel) * skinnedNormal);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * uView * worldPosition;
}`;

type UniformCache = Record<string, WebGLUniformLocation | null>;

const UNIFORM_NAMES = [
  'uModel', 'uView', 'uProjection', 'uCameraPosition',
  'uLightPosition', 'uLightColor', 'uLightIntensity',
  'uBaseColorFactor', 'uMetallicFactor', 'uRoughnessFactor',
  'uBones', 'uBaseColorTexture', 'uRoughnessTexture', 'uNormalTexture',
  'uSkinThickness', 'uSkinSpecularMap', 'uSkinPore', 'uWrinkleMap',
  'uSubsurfaceStrength', 'uScatterRadius',
  'uEpidermalStrength', 'uOilStrength', 'uPoreStrength', 'uSkinSpecular',
  'uWrinkleStrength', 'uExpressionIntensity',
  'uShadowMap', 'uLightViewProjection', 'uShadowBias', 'uShadowStrength',
  'uIrradianceMap', 'uPrefilteredMap', 'uBrdfLut',
  'uIblIntensity', 'uEnvironmentRotation', 'uExposure', 'uEmissiveFactor'
];

function cacheUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[]
): UniformCache {
  const cache: UniformCache = {};
  for (const name of names) {
    cache[name] = gl.getUniformLocation(program, name);
  }
  return cache;
}

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
  private metallic = 0.0;
  private roughness = 0.42;
  private lightPosition: [number, number, number] = [2.5, 4.5, 3.5];
  private lightColor: [number, number, number] = [1.0, 0.92, 0.82];
  private lightIntensity = 25.0;
  private skeleton: Skeleton | null;
  private parameters: AvatarParameters;
  private material: AvatarMaterial;
  private skinTextures: ProceduralSkinTextures | null = null;
  private thicknessTexture: WebGLTexture | null = null;
  private subsurfaceStrength = DEFAULT_ADVANCED_SKIN_MATERIAL.subsurfaceStrength;
  private scatterRadius: [number, number, number] = [...DEFAULT_ADVANCED_SKIN_MATERIAL.scatterRadius] as [number, number, number];
  private epidermalStrength = DEFAULT_ADVANCED_SKIN_MATERIAL.epidermalStrength;
  private oilStrength = DEFAULT_ADVANCED_SKIN_MATERIAL.oilStrength;
  private poreStrength = DEFAULT_ADVANCED_SKIN_MATERIAL.poreStrength;
  private skinSpecular = DEFAULT_ADVANCED_SKIN_MATERIAL.specular;
  private wrinkleStrength = 0.3;
  private expressionIntensity = 0.0;
  private specularTexture: WebGLTexture | null = null;
  private poreTexture: WebGLTexture | null = null;
  private wrinkleTexture: WebGLTexture | null = null;
  // eye system (milestone 1)
  private eyeTextures: EyeTextures | null = null;
  private eyeShader: EyeShader | null = null;
  private eyeMeshes: AvatarMesh[] = [];
  private eyeOffsetX = 0.1;
  private eyeY = 0.8;
  private eyeZ = 0.62;
  private eyeRadius = 0.075;
  private irisColor: [number, number, number] = DEFAULT_IRIS_COLOR;
  private irisScale = DEFAULT_EYE_PARAMETERS.irisScale;
  private pupilRadius = DEFAULT_EYE_PARAMETERS.pupilRadius;
  private corneaIOR = DEFAULT_EYE_PARAMETERS.corneaIOR;
  private wetness = DEFAULT_EYE_PARAMETERS.wetness;
  private scleraRoughness = DEFAULT_EYE_PARAMETERS.scleraRoughness;
  private irisRoughness = DEFAULT_EYE_PARAMETERS.irisRoughness;
  // hair (milestone 2)
  private hairTextures: HairTextures | null = null;
  private hairShader: HairShader | null = null;
  private hairMesh: AvatarMesh | null = null;
  private hairBaseColor: [number, number, number] = DEFAULT_HAIR_PARAMETERS.baseColor;
  private hairRoughness = DEFAULT_HAIR_PARAMETERS.roughness;
  private hairAnisotropy = DEFAULT_HAIR_PARAMETERS.anisotropy;
  private hairPrimarySpecular = DEFAULT_HAIR_PARAMETERS.primarySpecular;
  private hairSecondarySpecular = DEFAULT_HAIR_PARAMETERS.secondarySpecular;
  private hairRootDarkening = DEFAULT_HAIR_PARAMETERS.rootDarkening;
  private hairAlphaCutoff = DEFAULT_HAIR_PARAMETERS.alphaCutoff;
  // shadow mapping (milestone 3)
  private shadowMap: ShadowMap | null = null;
  private shadowShader: ShadowShader | null = null;
  private lightViewProjection = new Float32Array(16);
  // HDR + IBL (milestone 4)
  private ibl: IblPipeline | null = null;
  private iblIntensity = DEFAULT_IBL_SETTINGS.intensity;
  private environmentRotation = DEFAULT_IBL_SETTINGS.rotation;
  private exposure = DEFAULT_IBL_SETTINGS.exposure;
  private uniforms = new Map<WebGLProgram, UniformCache>();
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

    // procedural skin textures (sRGB base color, roughness, normal, thickness)
    this.skinTextures = createProceduralSkinTextures(gl, 1024);
    this.thicknessTexture = createThicknessTexture(gl, 1024);

    // skin detail maps (milestone 5): specular, pore, wrinkle
    this.specularTexture = createSpecularTexture(gl, 512);
    this.poreTexture = createPoreTexture(gl, 512);
    this.wrinkleTexture = createWrinkleTexture(gl, 512);

    // eye system: procedural eye maps + dedicated eye program + eye pair
    this.eyeTextures = createEyeTextures(gl, 1024);
    this.eyeShader = new EyeShader(gl);
    this.eyeMeshes = [buildSphereMesh(32, 24), buildSphereMesh(32, 24)];
    for (const m of this.eyeMeshes) m.upload(gl);

    // hair: procedural strand maps + dedicated hair program + shell mesh
    this.hairTextures = createHairTextures(gl, 1024);
    this.hairShader = new HairShader(gl);
    this.hairMesh = buildSphereMesh(48, 32);
    this.hairMesh.upload(gl);

    // shadow mapping: depth FBO + pass program + light matrix
    this.shadowMap = createShadowMap(gl, 2048);
    this.shadowShader = new ShadowShader(gl);
    this.updateLightMatrix();

    // HDR + IBL: bootstrap studio environment (irradiance/prefiltered/BRDF)
    this.ibl = createIblPipeline(gl, 512);

    // uniform location cache (one entry set per program; both programs
    // share the same fragment uniforms)
    const names = UNIFORM_NAMES;
    this.uniforms.set(this.program, cacheUniforms(gl, this.program, names));
    this.uniforms.set(this.skinProgram, cacheUniforms(gl, this.skinProgram, names));

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
  /** Exposure in EV (applied as 2^exposure before ACES tone mapping). */
  setExposure(value: number): void {
    this.exposure = Math.min(8, Math.max(0, value));
  }

  /** Expression intensity drives the wrinkle response in the skin shader. */
  setExpressionIntensity(value: number): void {
    this.expressionIntensity = Math.min(1, Math.max(0, value));
  }

  /** Wrinkle mask strength in the skin shader. */
  setWrinkleStrength(value: number): void {
    this.wrinkleStrength = Math.min(1, Math.max(0, value));
  }
  setKeyLight(x: number, y: number, z: number): void {
    this.lightPosition = [x, y, z];
    this.updateLightMatrix();
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
    if (this.skinTextures) {
      destroyProceduralSkinTextures(this.gl, this.skinTextures);
      this.skinTextures = null;
    }
    if (this.thicknessTexture) {
      destroyThicknessTexture(this.gl, this.thicknessTexture);
      this.thicknessTexture = null;
    }
    if (this.specularTexture) {
      destroySpecularTexture(this.gl, this.specularTexture);
      this.specularTexture = null;
    }
    if (this.poreTexture) {
      destroyPoreTexture(this.gl, this.poreTexture);
      this.poreTexture = null;
    }
    if (this.wrinkleTexture) {
      destroyWrinkleTexture(this.gl, this.wrinkleTexture);
      this.wrinkleTexture = null;
    }
    if (this.eyeTextures) {
      destroyEyeTextures(this.gl, this.eyeTextures);
      this.eyeTextures = null;
    }
    this.eyeShader?.dispose();
    this.eyeShader = null;
    for (const m of this.eyeMeshes) m.destroy(this.gl);
    this.eyeMeshes = [];
    if (this.hairTextures) {
      destroyHairTextures(this.gl, this.hairTextures);
      this.hairTextures = null;
    }
    this.hairShader?.dispose();
    this.hairShader = null;
    this.hairMesh?.destroy(this.gl);
    this.hairMesh = null;
    if (this.shadowMap) {
      destroyShadowMap(this.gl, this.shadowMap);
      this.shadowMap = null;
    }
    this.shadowShader?.dispose();
    this.shadowShader = null;
    if (this.ibl) {
      destroyIblPipeline(this.gl, this.ibl);
      this.ibl = null;
    }
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

    // ---- 1. shadow depth pass (once per frame) ----
    this.renderShadowPass();

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
      const uBones = this.uniforms.get(this.skinProgram)?.uBones ?? null;
      if (uBones) gl.uniformMatrix4fv(uBones, false, this.skeleton.skinMatrices);
      this.applyCommonUniforms(gl, this.skinProgram);
      this.mesh.draw(gl); // native: ONE mesh through the skinned shader
    } else {
      gl.useProgram(this.program);
      this.applyCommonUniforms(gl, this.program);
      this.mesh.draw(gl);
    }

    this.drawEyes(gl);
    this.drawHair(gl);
  }

  /** HAIR — strand anisotropic material over the skull region. */
  private drawHair(gl: WebGL2RenderingContext) {
    const shader = this.hairShader;
    const textures = this.hairTextures;
    const mesh = this.hairMesh;
    if (!shader || !textures || !mesh) return;

    shader.use();
    shader.setMatrix4('uView', this.view);
    shader.setMatrix4('uProjection', this.projection);
    shader.set3f('uCameraPosition', this.camera[0], this.camera[1], this.camera[2]);
    shader.set3f('uLightPosition', this.lightPosition[0], this.lightPosition[1], this.lightPosition[2]);
    shader.set3f('uLightColor', this.lightColor[0], this.lightColor[1], this.lightColor[2]);
    shader.set1f('uLightIntensity', this.lightIntensity);
    shader.set3f('uBaseColor', this.hairBaseColor[0], this.hairBaseColor[1], this.hairBaseColor[2]);
    shader.set1f('uRoughness', this.hairRoughness);
    shader.set1f('uAnisotropy', this.hairAnisotropy);
    shader.set1f('uPrimarySpecular', this.hairPrimarySpecular);
    shader.set1f('uSecondarySpecular', this.hairSecondarySpecular);
    shader.set1f('uRootDarkening', this.hairRootDarkening);
    shader.set1f('uAlphaCutoff', this.hairAlphaCutoff);
    shader.bindTexture(0, 'uColorTexture', textures.color);
    shader.bindTexture(1, 'uRoughnessTexture', textures.roughness);
    shader.bindTexture(2, 'uDirectionTexture', textures.direction);
    shader.bindTexture(3, 'uDensityTexture', textures.density);

    // hair shell over the skull region (procedural placeholder cap)
    shader.setMatrix4('uModel', this.hairModelMatrix());
    mesh.draw(gl);
  }

  /** Hair placement (parented to the avatar model). */
  private hairModelMatrix(): Mat4 {
    const local = mat4Multiply(
      mat4Translation(0, 0.95, 0),
      mat4Scale(1.18, 0.72, 1.18)
    );
    return mat4Multiply(this.model, local);
  }

  /**
   * Light-space view-projection for the shadow pass: orthographic
   * projection of the scene from the light position toward the avatar.
   */
  private updateLightMatrix(): void {
    const target: [number, number, number] = [0, 1.2, 0];
    const up: [number, number, number] = [0, 1, 0];
    const view = mat4LookAt(this.lightPosition, target, up);
    const r = 3.5;
    const proj = mat4Ortho(-r, r, -r, r, 0.5, 20);
    const lvp = mat4Multiply(proj, view);
    this.lightViewProjection = new Float32Array(lvp);
  }

  /** 1. Shadow depth pass — avatar (+ eyes/hair) into the depth texture. */
  private renderShadowPass(): void {
    const gl = this.gl;
    const shadow = this.shadowMap;
    const shader = this.shadowShader;
    if (!shadow || !shader) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.framebuffer);
    gl.viewport(0, 0, shadow.size, shadow.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.colorMask(false, false, false, false);

    shader.use();
    shader.setLightViewProjection(this.lightViewProjection);
    this.drawAvatarDepth(shader);

    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Draws every opaque piece into the shadow depth attachment. */
  private drawAvatarDepth(shader: ShadowShader): void {
    shader.setModel(this.model);
    this.mesh.draw(this.gl);
    for (let i = 0; i < this.eyeMeshes.length; i++) {
      shader.setModel(this.eyeModelMatrix(i));
      this.eyeMeshes[i].draw(this.gl);
    }
    if (this.hairMesh) {
      shader.setModel(this.hairModelMatrix());
      this.hairMesh.draw(this.gl);
    }
  }

  /** EYE MESH pair — sclera/iris/pupil/cornea via the dedicated shader. */
  private drawEyes(gl: WebGL2RenderingContext) {
    const shader = this.eyeShader;
    const textures = this.eyeTextures;
    if (!shader || !textures || this.eyeMeshes.length < 2) return;

    shader.use();
    shader.setMatrix4('uView', this.view);
    shader.setMatrix4('uProjection', this.projection);
    shader.set3f('uCameraPosition', this.camera[0], this.camera[1], this.camera[2]);
    shader.set3f('uLightPosition', this.lightPosition[0], this.lightPosition[1], this.lightPosition[2]);
    shader.set3f('uLightColor', this.lightColor[0], this.lightColor[1], this.lightColor[2]);
    shader.set1f('uLightIntensity', this.lightIntensity);
    shader.set1f('uIrisScale', this.irisScale);
    shader.set1f('uPupilRadius', this.pupilRadius);
    shader.set1f('uCorneaIOR', this.corneaIOR);
    shader.set1f('uWetness', this.wetness);
    shader.set1f('uScleraRoughness', this.scleraRoughness);
    shader.set1f('uIrisRoughness', this.irisRoughness);
    shader.bindTexture(0, 'uIrisTexture', textures.iris);
    shader.bindTexture(1, 'uIrisNormalTexture', textures.irisNormal);
    shader.bindTexture(2, 'uScleraTexture', textures.sclera);

    const offsets = [-1, 1];
    for (let i = 0; i < 2; i++) {
      shader.setMatrix4('uModel', this.eyeModelMatrix(i));
      this.eyeMeshes[i].draw(gl);
    }
  }

  /** Eye placement (parented to the avatar model). */
  private eyeModelMatrix(i: number): Mat4 {
    const offsets = [-1, 1];
    // The iris (UV centre) sits at sphere -x; rotate +90° around Y so
    // it faces the avatar's forward (+z). Eyes parent to the avatar
    // model (rotate with it), positioned just proud of the head.
    const local = mat4Multiply(
      mat4Translation(offsets[i] * this.eyeOffsetX, this.eyeY, this.eyeZ),
      mat4Multiply(mat4RotationY(Math.PI / 2), mat4Scale(this.eyeRadius, this.eyeRadius, this.eyeRadius))
    );
    return mat4Multiply(this.model, local);
  }

  private applyCommonUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const u = this.uniforms.get(program) ?? {};
    gl.uniformMatrix4fv(u.uModel, false, this.model);
    gl.uniformMatrix4fv(u.uView, false, this.view);
    gl.uniformMatrix4fv(u.uProjection, false, this.projection);
    gl.uniform3fv(u.uCameraPosition, new Float32Array(this.camera));
    gl.uniform3fv(u.uLightPosition, new Float32Array(this.lightPosition));
    gl.uniform3fv(u.uLightColor, new Float32Array(this.lightColor));
    gl.uniform1f(u.uLightIntensity, this.lightIntensity);
    gl.uniform4f(u.uBaseColorFactor, this.material.baseColorR ?? 1, this.material.baseColorG ?? 1, this.material.baseColorB ?? 1, 1);
    gl.uniform1f(u.uMetallicFactor, this.metallic);
    gl.uniform1f(u.uRoughnessFactor, this.material.roughness ?? this.roughness);

    // procedural skin textures on units 0..2
    const textures = this.skinTextures;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures ? textures.baseColor : null);
    gl.uniform1i(u.uBaseColorTexture, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures ? textures.roughness : null);
    gl.uniform1i(u.uRoughnessTexture, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures ? textures.normal : null);
    gl.uniform1i(u.uNormalTexture, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.thicknessTexture);
    gl.uniform1i(u.uSkinThickness, 3);

    // skin detail maps on units 8/9/10 (milestone 5)
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, this.specularTexture);
    gl.uniform1i(u.uSkinSpecularMap, 8);
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, this.poreTexture);
    gl.uniform1i(u.uSkinPore, 9);
    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, this.wrinkleTexture);
    gl.uniform1i(u.uWrinkleMap, 10);

    // skin scattering + oil/pore/specular + expression controls
    gl.uniform1f(u.uSubsurfaceStrength, this.subsurfaceStrength);
    gl.uniform3f(u.uScatterRadius, this.scatterRadius[0], this.scatterRadius[1], this.scatterRadius[2]);
    gl.uniform1f(u.uEpidermalStrength, this.epidermalStrength);
    gl.uniform1f(u.uOilStrength, this.oilStrength);
    gl.uniform1f(u.uPoreStrength, this.poreStrength);
    gl.uniform1f(u.uSkinSpecular, this.skinSpecular);
    gl.uniform1f(u.uWrinkleStrength, this.wrinkleStrength);
    gl.uniform1f(u.uExpressionIntensity, this.expressionIntensity);

    // shadow map on unit 7 (skin PBR pass only)
    const shadow = this.shadowMap;
    if (shadow) {
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, shadow.depthTexture);
      gl.uniform1i(u.uShadowMap, 7);
      gl.uniformMatrix4fv(u.uLightViewProjection, false, this.lightViewProjection);
      gl.uniform1f(u.uShadowBias, 0.0015);
      gl.uniform1f(u.uShadowStrength, 0.92);
    }

    // IBL on units 4/5/6 (shadow on 7)
    const ibl = this.ibl;
    if (ibl) {
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, ibl.irradiance);
      gl.uniform1i(u.uIrradianceMap, 4);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, ibl.prefiltered);
      gl.uniform1i(u.uPrefilteredMap, 5);
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, ibl.brdfLut);
      gl.uniform1i(u.uBrdfLut, 6);
      gl.uniform1f(u.uIblIntensity, this.iblIntensity);
      gl.uniform1f(u.uEnvironmentRotation, this.environmentRotation);
    }
    gl.uniform1f(u.uExposure, this.exposure);
    gl.uniform3f(u.uEmissiveFactor, 0, 0, 0);
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
 *  sphere carries bone data so uBones can deform it. Vertex layout is
 *  the native one: pos3 normal3 uv2 tangent4(u,v + handedness w)
 *  boneIdx4(u8) boneW4 (17 floats). Tangents are the analytic sphere
 *  parameterization: T = dP/d(theta) (u direction), handedness w from
 *  cross(N,T) vs dP/d(phi) (v direction), so the procedural normal map
 *  (canvas +x = T, canvas +y = B) decodes correctly in the TBN basis. */
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
      // T = dP/d(theta), B = dP/d(phi), w = sign(dot(cross(N,T), B))
      let tx = -sinPhi * sinTheta;
      let tz = sinPhi * cosTheta;
      let tl = Math.hypot(tx, tz);
      if (tl < 1e-6) {
        tx = 1;
        tz = 0;
        tl = 1;
      }
      tx /= tl;
      tz /= tl;
      const bx = cosPhi * cosTheta;
      const by = -sinPhi;
      const bz = cosPhi * sinTheta;
      // cross(N, T) = (py*tz - pz*0, pz*tx - px*tz, px*0 - py*tx)
      const cx = py * tz;
      const cy = pz * tx - px * tz;
      const cz = -py * tx;
      let w = Math.sign(cx * bx + cy * by + cz * bz);
      if (w === 0) w = 1;
      // pos3 normal3 uv2 tangent4 boneIdx4(u8, zeroed) boneW4
      // (17 floats, all bone 0)
      verts.push(px, py, pz, px, py, pz, u, v, tx, 0, tz, w, 0, 1, 0, 0, 0);
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
