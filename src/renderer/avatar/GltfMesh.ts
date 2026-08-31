/* ------------------------------------------------------------------ */
/* GltfMesh — WebGL mesh creation from a glTF primitive (milestone 8). */
/* Attribute locations match the HD renderer layout (POSITION=0 ..     */
/* WEIGHTS_0=5), so GLB primitives draw through the existing skin      */
/* program + skin fragment.                                            */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor } from './GltfAccessor';
import { buildMorphBuffers, MorphBuffers } from './GltfMorphs';

export interface GpuPrimitive {
  vao: WebGLVertexArrayObject;

  indexBuffer: WebGLBuffer | null;

  indexCount: number;

  indexType: number;

  materialIndex: number;

  /** Additional fields for renderer integration. */
  meshIndex: number;
  vertexCount: number;
  skinned: boolean;
  morphs: MorphBuffers | null;
}

const ATTRIBUTES: Array<{
  name: string;
  location: number;
  size: number;
  integer?: boolean;
}> = [
  { name: 'POSITION', location: 0, size: 3 },
  { name: 'NORMAL', location: 1, size: 3 },
  { name: 'TEXCOORD_0', location: 2, size: 2 },
  { name: 'TANGENT', location: 3, size: 4 },
  { name: 'JOINTS_0', location: 4, size: 4, integer: true },
  { name: 'WEIGHTS_0', location: 5, size: 4 }
];

export function uploadPrimitive(
  gl: WebGL2RenderingContext,
  asset: GltfAsset,
  primitive: GltfPrimitive,
  meshIndex = 0
): GpuPrimitive {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Unable to create VAO');
  }
  gl.bindVertexArray(vao);

  for (const attribute of ATTRIBUTES) {
    const accessorIndex = primitive.attributes[attribute.name];
    if (accessorIndex === undefined) {
      continue;
    }

    const data = readAccessor(asset, accessorIndex);
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Unable to create vertex buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const accessor = asset.json.accessors![accessorIndex];
    gl.enableVertexAttribArray(attribute.location);

    if (attribute.integer) {
      gl.vertexAttribIPointer(attribute.location, attribute.size, accessor.componentType, 0, 0);
    } else {
      gl.vertexAttribPointer(
        attribute.location,
        attribute.size,
        accessor.componentType,
        accessor.normalized ?? false,
        0,
        0
      );
    }
  }

  let indexBuffer: WebGLBuffer | null = null;
  let indexCount = 0;
  let indexType = gl.UNSIGNED_SHORT;

  if (primitive.indices !== undefined) {
    const accessor = asset.json.accessors![primitive.indices];
    const indices = readAccessor(asset, primitive.indices);

    indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
      throw new Error('Unable to create index buffer');
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    indexCount = accessor.count;
    indexType = accessor.componentType;
  }

  const posAccessor = primitive.attributes.POSITION !== undefined
    ? asset.json.accessors![primitive.attributes.POSITION]
    : undefined;

  gl.bindVertexArray(null);

  return {
    vao,
    indexBuffer,
    indexCount,
    indexType,
    materialIndex: primitive.material ?? 0,
    meshIndex,
    vertexCount: posAccessor?.count ?? 0,
    skinned: primitive.attributes.JOINTS_0 !== undefined,
    morphs: buildMorphBuffers(asset, primitive)
  };
}
