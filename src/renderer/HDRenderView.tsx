/* ------------------------------------------------------------------ */
/* HDRenderView — mirror of the native GLSurfaceView demo.             */
/*                                                                     */
/*   class HDRenderView : GLSurfaceView {                              */
/*     private val renderer = HDRenderer(context)                      */
/*     init { setEGLContextClientVersion(3); ...                       */
/*            setRenderer(renderer); renderMode = CONTINUOUSLY }       */
/*     onDetachedFromWindow -> release()                               */
/*   }                                                                 */
/*   MainActivity: onResume/onPause -> renderView.onResume/onPause     */
/*                                                                     */
/* This is the HDRenderer.kt spinning-cube demo, pixel-faithful: the   */
/* same 24-vertex cube (position + normal), the same 36 short indices, */
/* the same shaders (uMVP/uModel/uLightDirection/uCameraPosition), the */
/* same constants — clear color (0.02, 0.025, 0.04), camera (0,1.5,6)  */
/* -> origin, 60° fov, light (-0.5,-1,-0.4), baseColor (0.12,0.42,     */
/* 0.95), ambient 0.12, specular 0.35, shininess 64 — and the same     */
/* continuous rotation: angle += 0.5° per frame around (0.4,1,0.2).    */
/*                                                                     */
/* Lifecycle mirrors the native pair: rAF loop = RENDERMODE_CONTINUOUSLY,*/
/* onResume()/onPause() gate it, release() deletes GL resources, and   */
/* unmount (= onDetachedFromWindow) releases.                          */
/* ------------------------------------------------------------------ */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  mat4Identity,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  mat4RotationAxisDeg,
  Mat4
} from './math';

export interface HDRenderViewHandle {
  /** MainActivity.onResume() mirror — start the continuous loop. */
  onResume(): void;
  /** MainActivity.onPause() mirror — stop the continuous loop. */
  onPause(): void;
  /** HDRenderer.release() mirror — delete buffers/program/VAO. */
  release(): void;
  /** diagnostics: current rotation angle in degrees. */
  getAngle(): number;
  /** diagnostics: read the center pixel (proves the draw). */
  readCenterPixel(): [number, number, number, number];
}

/* ---- HDRenderer.kt constants ---- */
const VERTICES = new Float32Array([
  // position          // normal
  -1, -1, 1, 0, 0, 1,
  1, -1, 1, 0, 0, 1,
  1, 1, 1, 0, 0, 1,
  -1, 1, 1, 0, 0, 1,

  -1, -1, -1, 0, 0, -1,
  -1, 1, -1, 0, 0, -1,
  1, 1, -1, 0, 0, -1,
  1, -1, -1, 0, 0, -1,

  -1, 1, -1, 0, 1, 0,
  -1, 1, 1, 0, 1, 0,
  1, 1, 1, 0, 1, 0,
  1, 1, -1, 0, 1, 0,

  -1, -1, -1, 0, -1, 0,
  1, -1, -1, 0, -1, 0,
  1, -1, 1, 0, -1, 0,
  -1, -1, 1, 0, -1, 0,

  1, -1, -1, 1, 0, 0,
  1, 1, -1, 1, 0, 0,
  1, 1, 1, 1, 0, 0,
  1, -1, 1, 1, 0, 0,

  -1, -1, -1, -1, 0, 0,
  -1, -1, 1, -1, 0, 0,
  -1, 1, 1, -1, 0, 0,
  -1, 1, -1, -1, 0, 0
]);

const INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23
]);

/* GLSL 320 es -> 300 es (identical logic) */
const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorldPosition;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPosition;
uniform vec3 uLightDirection;
uniform vec3 uCameraPosition;
layout(location = 0) out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(-uLightDirection);
  float diffuse = max(dot(normal, light), 0.0);
  vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
  vec3 halfVector = normalize(light + viewDirection);
  float specular = pow(max(dot(normal, halfVector), 0.0), 64.0);
  vec3 baseColor = vec3(0.12, 0.42, 0.95);
  vec3 ambient = baseColor * 0.12;
  vec3 lighting = ambient + baseColor * diffuse + vec3(1.0) * specular * 0.35;
  outColor = vec4(lighting, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('cube shader compile failed: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

interface HDRenderViewProps {
  className?: string;
  style?: CSSProperties;
}

export const HDRenderView = forwardRef<HDRenderViewHandle, HDRenderViewProps>(function HDRenderView(
  { className, style },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const glRef = useRef<{ gl: WebGL2RenderingContext; program: WebGLProgram; vao: WebGLVertexArrayObject; vbo: WebGLBuffer; ibo: WebGLBuffer } | null>(null);

  const ensureGl = (): NonNullable<typeof glRef.current> | null => {
    if (glRef.current) return glRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, depth: true });
    if (!gl) return null;

    // ---- HDRenderer.onSurfaceCreated ----
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.02, 0.025, 0.04, 1);

    // ---- createShaders ----
    const program = gl.createProgram()!;
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('cube program link failed: ' + gl.getProgramInfoLog(program));
    }

    // ---- createMesh ----
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);
    const stride = 6 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, INDICES, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    glRef.current = { gl, program, vao, vbo, ibo };
    return glRef.current;
  };

  const drawFrame = () => {
    const state = ensureGl();
    if (!state) return;
    const { gl, program, vao } = state;
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // ---- onSurfaceChanged: viewport + projection + view ----
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const projection = mat4Perspective((60 * Math.PI) / 180, aspect, 0.1, 100);
    const view = mat4LookAt([0, 1.5, 6], [0, 0, 0], [0, 1, 0]);

    // ---- onDrawFrame ----
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    angleRef.current += 0.5;
    const model = mat4RotationAxisDeg([0.4, 1, 0.2], angleRef.current);
    const mvp = mat4Multiply(projection, mat4Multiply(view, model));

    gl.useProgram(program);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uMVP'), false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, model);
    gl.uniform3f(gl.getUniformLocation(program, 'uLightDirection'), -0.5, -1.0, -0.4);
    gl.uniform3f(gl.getUniformLocation(program, 'uCameraPosition'), 0, 1.5, 6);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, INDICES.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    // RENDERMODE_CONTINUOUSLY
    if (!pausedRef.current) rafRef.current = requestAnimationFrame(drawFrame);
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  useEffect(() => {
    drawFrame(); // mount = MainActivity.onCreate + onResume
    return () => {
      // unmount = onDetachedFromWindow -> queueEvent { renderer.release() }
      stop();
      const state = glRef.current;
      if (state) {
        state.gl.deleteVertexArray(state.vao);
        state.gl.deleteBuffer(state.vbo);
        state.gl.deleteBuffer(state.ibo);
        state.gl.deleteProgram(state.program);
        glRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    onResume: () => {
      if (pausedRef.current) {
        pausedRef.current = false;
        drawFrame();
      }
    },
    onPause: () => {
      pausedRef.current = true;
      stop();
    },
    release: () => {
      stop();
      const state = glRef.current;
      if (state) {
        state.gl.deleteVertexArray(state.vao);
        state.gl.deleteBuffer(state.vbo);
        state.gl.deleteBuffer(state.ibo);
        state.gl.deleteProgram(state.program);
        glRef.current = null;
      }
    },
    getAngle: () => angleRef.current,
    readCenterPixel: () => {
      const state = glRef.current;
      if (!state || !canvasRef.current) return [0, 0, 0, 0];
      const px = new Uint8Array(4);
      state.gl.readPixels(
        Math.floor(canvasRef.current.width / 2),
        Math.floor(canvasRef.current.height / 2),
        1,
        1,
        state.gl.RGBA,
        state.gl.UNSIGNED_BYTE,
        px
      );
      return [px[0], px[1], px[2], px[3]];
    }
  }));

  return <canvas ref={canvasRef} className={className ?? 'hd3d-canvas'} style={style} aria-label="Interactive 3D cube viewport" />;
});
