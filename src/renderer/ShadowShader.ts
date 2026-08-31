/* ------------------------------------------------------------------ */
/* ShadowShader — depth-only pass program: position transformed into   */
/* light space; depth is written automatically to the depth attachment */
/* (color writes are masked off by the renderer during the pass).      */
/* ------------------------------------------------------------------ */

import { Mat4 } from './math';

const SHADOW_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uLightViewProjection;
void main() {
  gl_Position = uLightViewProjection * uModel * vec4(aPosition, 1.0);
}`;

const SHADOW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
void main() {
  // Depth is automatically written into the depth attachment.
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('ShadowShader: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('ShadowShader compile failed:\n' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('ShadowShader: createProgram failed');
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
    throw new Error('ShadowShader link failed:\n' + log);
  }
  return p;
}

export class ShadowShader {
  private gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  private uModel: WebGLUniformLocation | null;
  private uLightViewProjection: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = linkProgram(gl, SHADOW_VERTEX_SHADER, SHADOW_FRAGMENT_SHADER);
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uLightViewProjection = gl.getUniformLocation(this.program, 'uLightViewProjection');
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  setModel(value: Mat4): void {
    if (this.uModel) this.gl.uniformMatrix4fv(this.uModel, false, value);
  }

  setLightViewProjection(value: Float32Array): void {
    if (this.uLightViewProjection) this.gl.uniformMatrix4fv(this.uLightViewProjection, false, value);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
