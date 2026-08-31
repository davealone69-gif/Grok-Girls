/* ------------------------------------------------------------------ */
/* EyeShader — dedicated eye program: sclera + iris + pupil + limbal   */
/* ring + cornea/wet Fresnel layer + PBR specular, procedural textures */
/* on units 0..2. The eye mesh carries the native attribute layout      */
/* (0 pos, 1 normal, 2 uv, 3 tangent), so it reuses the avatar mesh.    */
/* ------------------------------------------------------------------ */

import { Mat4 } from './math';

const EYE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;
layout(location = 3) in vec4 aTangent;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vTexCoord;
out vec4 vWorldTangent;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  mat3 normalMatrix = mat3(transpose(inverse(uModel)));
  vWorldNormal = normalize(normalMatrix * aNormal);
  vWorldTangent = vec4(normalize(normalMatrix * aTangent.xyz), aTangent.w);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * uView * world;
}`;

const EYE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vTexCoord;
in vec4 vWorldTangent;
out vec4 outColor;
uniform sampler2D uIrisTexture;
uniform sampler2D uIrisNormalTexture;
uniform sampler2D uScleraTexture;
uniform vec3 uCameraPosition;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uIrisScale;
uniform float uPupilRadius;
uniform float uCorneaIOR;
uniform float uWetness;
uniform float uScleraRoughness;
uniform float uIrisRoughness;
const float PI = 3.14159265359;

vec3 fresnel(vec3 F0, float cosTheta) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float ggx(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NoH = max(dot(N, H), 0.0);
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 0.00001);
}

float geometry(vec3 N, vec3 V, vec3 L, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;
  float nv = max(dot(N, V), 0.0);
  float nl = max(dot(N, L), 0.0);
  float g1 = nv / max(nv * (1.0 - k) + k, 0.00001);
  float g2 = nl / max(nl * (1.0 - k) + k, 0.00001);
  return g1 * g2;
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uLightPosition - vWorldPosition);
  vec3 H = normalize(V + L);
  vec2 uv = vTexCoord;

  // Iris occupies the centre of the eye UV.
  vec2 irisUv = (uv - 0.5) * uIrisScale + 0.5;
  vec4 iris = texture(uIrisTexture, irisUv);
  vec3 sclera = texture(uScleraTexture, uv).rgb;

  // Approximate iris region.
  float irisDistance = distance(uv, vec2(0.5));
  float irisMask = 1.0 - smoothstep(0.36, 0.45, irisDistance);

  // Pupil region.
  float pupil = 1.0 - smoothstep(uPupilRadius * 0.85, uPupilRadius, irisDistance);
  iris.rgb *= 1.0 - pupil;

  vec3 surfaceColor = mix(sclera, iris.rgb, irisMask);

  // Iris normal.
  vec3 tangentNormal = texture(uIrisNormalTexture, irisUv).xyz * 2.0 - 1.0;
  vec3 T = normalize(vWorldTangent.xyz);
  vec3 B = normalize(cross(N, T) * vWorldTangent.w);
  vec3 irisNormal = normalize(mat3(T, B, N) * tangentNormal);
  N = normalize(mix(N, irisNormal, irisMask));

  float roughness = mix(uScleraRoughness, uIrisRoughness, irisMask);

  // Cornea reflection — water/tear-like surface has a strong Fresnel
  // response.
  float cosTheta = max(dot(N, V), 0.0);
  float F0 = pow((uCorneaIOR - 1.0) / (uCorneaIOR + 1.0), 2.0);
  float fresnelTerm = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
  vec3 reflectionColor = vec3(1.0) * fresnelTerm * uWetness;

  // PBR eye lighting.
  float distanceToLight = length(uLightPosition - vWorldPosition);
  float attenuation = 1.0 / max(distanceToLight * distanceToLight, 0.01);
  vec3 radiance = uLightColor * uLightIntensity * attenuation;

  vec3 F = fresnel(vec3(F0), max(dot(H, V), 0.0));
  float D = ggx(N, H, roughness);
  float G = geometry(N, V, L, roughness);
  vec3 specular = (D * G * F) / max(4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0), 0.001);

  float NoL = max(dot(N, L), 0.0);
  vec3 diffuse = surfaceColor * (1.0 - F) / PI;
  vec3 color = diffuse * radiance * NoL;
  color += specular * radiance * NoL;

  // Corneal wet layer.
  color += reflectionColor;

  // Tiny ambient contribution.
  color += surfaceColor * 0.035;

  // HDR display transform.
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / 2.2));

  outColor = vec4(color, 1.0);
}`;

const EYE_UNIFORM_NAMES = [
  'uModel', 'uView', 'uProjection', 'uCameraPosition',
  'uLightPosition', 'uLightColor', 'uLightIntensity',
  'uIrisTexture', 'uIrisNormalTexture', 'uScleraTexture',
  'uIrisScale', 'uPupilRadius', 'uCorneaIOR', 'uWetness',
  'uScleraRoughness', 'uIrisRoughness'
];

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('EyeShader: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('EyeShader compile failed:\n' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('EyeShader: createProgram failed');
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
    throw new Error('EyeShader link failed:\n' + log);
  }
  return p;
}

export class EyeShader {
  private gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = linkProgram(gl, EYE_VERTEX_SHADER, EYE_FRAGMENT_SHADER);
    this.uniforms = {};
    for (const name of EYE_UNIFORM_NAMES) {
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
