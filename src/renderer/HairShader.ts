/* ------------------------------------------------------------------ */
/* HairShader — dedicated hair program: strand-style anisotropic       */
/* highlights (longitudinal + azimuthal lobes), texture-driven hair    */
/* flow, density alpha cutoff, root darkening, dual-lobe specular.     */
/* Procedural hair maps on units 0..3. The hair mesh reuses the        */
/* avatar mesh layout (0 pos, 1 normal, 2 uv, 3 tangent).              */
/* ------------------------------------------------------------------ */

import { Mat4 } from './math';

const HAIR_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;
layout(location = 3) in vec4 aTangent;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec3 vWorldTangent;
out vec2 vTexCoord;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  mat3 normalMatrix = mat3(transpose(inverse(uModel)));
  vWorldPosition = world.xyz;
  vWorldNormal = normalize(normalMatrix * aNormal);
  vWorldTangent = normalize(normalMatrix * aTangent.xyz);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * uView * world;
}`;

const HAIR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec3 vWorldTangent;
in vec2 vTexCoord;
out vec4 outColor;
uniform sampler2D uColorTexture;
uniform sampler2D uRoughnessTexture;
uniform sampler2D uDirectionTexture;
uniform sampler2D uDensityTexture;
uniform vec3 uCameraPosition;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uAnisotropy;
uniform float uPrimarySpecular;
uniform float uSecondarySpecular;
uniform float uRootDarkening;
uniform float uAlphaCutoff;
const float PI = 3.14159265359;

float longitudinal(float sinThetaH, float roughness) {
  float exponent = 1.0 / max(roughness * roughness, 0.001);
  return pow(max(1.0 - sinThetaH * sinThetaH, 0.0), exponent);
}

float azimuthal(float sinThetaD, float roughness) {
  float width = max(roughness, 0.02);
  return exp(-sinThetaD * sinThetaD / (width * width));
}

vec3 hairSpecular(vec3 T, vec3 V, vec3 L, float roughness, float shift, float strength) {
  vec3 H = normalize(V + L);
  float TdotH = dot(T, H);
  float TdotV = dot(T, V);
  float TdotL = dot(T, L);
  float sinThetaH = clamp(TdotH, -1.0, 1.0);
  float sinThetaD = (TdotL - TdotV) * 0.5;
  float longitudinalTerm = longitudinal(sinThetaH, roughness);
  float azimuthalTerm = azimuthal(sinThetaD, roughness);
  return vec3(longitudinalTerm * azimuthalTerm * strength);
}

void main() {
  float density = texture(uDensityTexture, vTexCoord).r;
  if (density < uAlphaCutoff) {
    discard;
  }

  vec3 color = texture(uColorTexture, vTexCoord).rgb;
  color *= uBaseColor;

  float roughness = texture(uRoughnessTexture, vTexCoord).r;
  roughness *= uRoughness;
  roughness = clamp(roughness, 0.04, 1.0);

  vec3 direction = texture(uDirectionTexture, vTexCoord).rgb * 2.0 - 1.0;

  vec3 N = normalize(vWorldNormal);
  vec3 T = normalize(vWorldTangent);

  // Texture-driven hair flow.
  T = normalize(T + direction.x * N + direction.y * 0.15);

  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uLightPosition - vWorldPosition);

  float distanceToLight = length(uLightPosition - vWorldPosition);
  float attenuation = 1.0 / max(distanceToLight * distanceToLight, 0.01);
  vec3 radiance = uLightColor * uLightIntensity * attenuation;

  // Shift tangent for the secondary hair lobe.
  vec3 TSecondary = normalize(T + N * uAnisotropy);

  vec3 primary = hairSpecular(T, V, L, roughness, 0.0, uPrimarySpecular);
  vec3 secondary = hairSpecular(TSecondary, V, L, roughness * 1.8, 0.0, uSecondarySpecular);

  float diffuse = max(dot(N, L), 0.0);
  vec3 lighting = color * diffuse * radiance;
  lighting += primary * radiance;
  lighting += secondary * radiance * 0.55;

  // Root darkening approximation.
  float root = smoothstep(0.0, 1.0, vTexCoord.y);
  lighting *= mix(1.0 - uRootDarkening, 1.0, root);

  // HDR output.
  lighting = lighting / (lighting + vec3(1.0));
  lighting = pow(lighting, vec3(1.0 / 2.2));

  outColor = vec4(lighting, density);
}`;

const HAIR_UNIFORM_NAMES = [
  'uModel', 'uView', 'uProjection', 'uCameraPosition',
  'uLightPosition', 'uLightColor', 'uLightIntensity',
  'uColorTexture', 'uRoughnessTexture', 'uDirectionTexture', 'uDensityTexture',
  'uBaseColor', 'uRoughness', 'uAnisotropy',
  'uPrimarySpecular', 'uSecondarySpecular', 'uRootDarkening', 'uAlphaCutoff'
];

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('HairShader: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('HairShader compile failed:\n' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('HairShader: createProgram failed');
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
    throw new Error('HairShader link failed:\n' + log);
  }
  return p;
}

export class HairShader {
  private gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = linkProgram(gl, HAIR_VERTEX_SHADER, HAIR_FRAGMENT_SHADER);
    this.uniforms = {};
    for (const name of HAIR_UNIFORM_NAMES) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  setMatrix4(name: string, value: Mat4): void {
    const loc = this.uniforms[name];
    if (loc) this.gl.uniformMatrix4fv(loc, false, value);
  }

  set3f(name: string, x: number, y: number, z: number): void {
    const loc = this.uniforms[name];
    if (loc) this.gl.uniform3f(loc, x, y, z);
  }

  set1f(name: string, v: number): void {
    const loc = this.uniforms[name];
    if (loc) this.gl.uniform1f(loc, v);
  }

  bindTexture(unit: number, name: string, texture: WebGLTexture): void {
    const loc = this.uniforms[name];
    if (!loc) return;
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(loc, unit);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
