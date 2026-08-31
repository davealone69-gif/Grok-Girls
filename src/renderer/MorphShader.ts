/* ------------------------------------------------------------------ */
/* MorphShader — GPU morph-target program (milestone 6).               */
/*                                                                     */
/* Uniform-array morphs (MAX_MORPHS = 64 deltas) blended in the        */
/* vertex stage; pairs with the skin fragment in production. For       */
/* larger meshes move the morph data to vertex textures / transform    */
/* feedback — 64 uniform targets get expensive.                        */
/*                                                                     */
/* Buffers are DELTAS: convert absolute GLB target positions to        */
/* deltas at load time. Pass zero-filled arrays for unused slots.      */
/* ------------------------------------------------------------------ */

import { Mat4 } from './math';
import { uploadMorphWeights } from './avatar/MorphTargets';

const MORPH_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;
const int MAX_MORPHS = 64;
uniform vec3 uMorphPosition[MAX_MORPHS];
uniform vec3 uMorphNormal[MAX_MORPHS];
uniform float uMorphWeight[MAX_MORPHS];
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vTexCoord;
void main() {
  vec3 position = aPosition;
  vec3 normal = aNormal;
  for (int i = 0; i < MAX_MORPHS; i++) {
    float weight = uMorphWeight[i];
    position += uMorphPosition[i] * weight;
    normal += uMorphNormal[i] * weight;
  }
  normal = normalize(normal);
  vec4 world = uModel * vec4(position, 1.0);
  mat3 normalMatrix = mat3(transpose(inverse(uModel)));
  vWorldPosition = world.xyz;
  vWorldNormal = normalize(normalMatrix * normal);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * uView * world;
}`;

const MORPH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vTexCoord;
layout(location = 0) out vec4 outColor;
void main() {
  // Placeholder — pair this program with the skin fragment in production.
  outColor = vec4(1.0);
}`;

const MAX_MORPHS = 64;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('MorphShader: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('MorphShader compile failed:\n' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('MorphShader: createProgram failed');
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
    throw new Error('MorphShader link failed:\n' + log);
  }
  return p;
}

export class MorphShader {
  private gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  private uModel: WebGLUniformLocation | null;
  private uView: WebGLUniformLocation | null;
  private uProjection: WebGLUniformLocation | null;
  private uMorphPosition: WebGLUniformLocation | null;
  private uMorphNormal: WebGLUniformLocation | null;
  private uMorphWeight: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = linkProgram(gl, MORPH_VERTEX_SHADER, MORPH_FRAGMENT_SHADER);
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uProjection = gl.getUniformLocation(this.program, 'uProjection');
    this.uMorphPosition = gl.getUniformLocation(this.program, 'uMorphPosition');
    this.uMorphNormal = gl.getUniformLocation(this.program, 'uMorphNormal');
    this.uMorphWeight = gl.getUniformLocation(this.program, 'uMorphWeight');
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  setMatrices(model: Mat4, view: Mat4, projection: Mat4): void {
    if (this.uModel) this.gl.uniformMatrix4fv(this.uModel, false, model);
    if (this.uView) this.gl.uniformMatrix4fv(this.uView, false, view);
    if (this.uProjection) this.gl.uniformMatrix4fv(this.uProjection, false, projection);
  }

  /**
   * Upload morph deltas. positionDeltas/normalDeltas must be
   * MAX_MORPHS * 3 floats; weights MAX_MORPHS floats. Zero-fill unused
   * slots — uniform array members must always be uploaded in full.
   */
  setMorphs(
    positionDeltas: Float32Array,
    normalDeltas: Float32Array,
    weights: Float32Array
  ): void {
    if (this.uMorphPosition) this.gl.uniform3fv(this.uMorphPosition, positionDeltas);
    if (this.uMorphNormal) this.gl.uniform3fv(this.uMorphNormal, normalDeltas);
    if (this.uMorphWeight) uploadMorphWeights(this.gl, this.program, weights);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
