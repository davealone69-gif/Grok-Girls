/* AvatarMesh — mirror of AvatarMesh.kt: packed 16-float vertex layout
 * [pos3, normal3, uv2, boneIndices4 (uint8), boneWeights4] with upload /
 * draw / destroy. Bone indices use UNSIGNED_BYTE integer attribs exactly
 * like the native glVertexAttribIPointer. */

export interface AvatarMesh {
  vao: WebGLVertexArrayObject | null;
  vbo: WebGLBuffer | null;
  ebo: WebGLBuffer | null;
  indexCount: number;
  upload(gl: WebGL2RenderingContext): void;
  draw(gl: WebGL2RenderingContext): void;
  destroy(gl: WebGL2RenderingContext): void;
}

const STRIDE_SKIN = 16 * 4; // pos3+normal3+uv2+boneIdx4+boneW4
const STRIDE_BASE = 8 * 4; // pos3+normal3+uv2 (no skinning attribs)

export function createAvatarMesh(vertices: Float32Array, indices: Uint16Array, skinned = true): AvatarMesh {
  const stride = skinned ? STRIDE_SKIN : STRIDE_BASE;
  let vao: WebGLVertexArrayObject | null = null;
  let vbo: WebGLBuffer | null = null;
  let ebo: WebGLBuffer | null = null;

  return {
    get vao() {
      return vao;
    },
    get vbo() {
      return vbo;
    },
    get ebo() {
      return ebo;
    },
    indexCount: indices.length,

    upload(gl: WebGL2RenderingContext) {
      vao = gl.createVertexArray();
      vbo = gl.createBuffer();
      ebo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      // position (3f)
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      // normal (3f)
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
      // uv (2f)
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
      if (skinned) {
        // bone indices (4 x uint8, integer attrib)
        gl.enableVertexAttribArray(3);
        gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_BYTE, stride, 8 * 4);
        // bone weights (4f)
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 12 * 4);
      }
      gl.bindVertexArray(null);
    },

    draw(gl: WebGL2RenderingContext) {
      if (!vao) return;
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
    },

    destroy(gl: WebGL2RenderingContext) {
      if (vao) {
        gl.deleteVertexArray(vao);
        vao = null;
      }
      if (vbo) {
        gl.deleteBuffer(vbo);
        vbo = null;
      }
      if (ebo) {
        gl.deleteBuffer(ebo);
        ebo = null;
      }
    }
  };
}

/** Build a packed skinned cube mesh — the avatar_skin.vert layout, all
 *  vertices weighted to bone 0. */
export function buildSkinnedCube(): { vertices: Float32Array; indices: Uint16Array } {
  // 24 verts, pos+normal+uv+4xboneIdx+4xweights
  const v: number[] = [];
  const faces: number[][][] = [
    // +z front, -z back, +y top, -y bottom, +x right, -x left
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]
  ];
  const normals: [number, number, number][] = [
    [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]
  ];
  const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  faces.forEach((face, f) => {
    face.forEach((p, i) => {
      v.push(p[0], p[1], p[2]);
      v.push(normals[f][0], normals[f][1], normals[f][2]);
      v.push(uvs[i][0], uvs[i][1]);
      v.push(0, 0, 0, 0); // bone indices
      v.push(1, 0, 0, 0); // bone weights
    });
  });
  const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23];
  return { vertices: new Float32Array(v), indices: new Uint16Array(idx) };
}
