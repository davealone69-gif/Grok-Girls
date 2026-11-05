/* ------------------------------------------------------------------ */
/* GltfMesh — WebGL mesh creation from a glTF primitive (milestone 8). */
/* Attribute locations match the HD renderer layout (POSITION=0 ..     */
/* WEIGHTS_0=5), so GLB primitives draw through the existing skin      */
/* program + skin fragment.                                            */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor, toFloat32 } from './GltfAccessor';
import { buildMorphBuffers, MorphBuffers } from './GltfMorphs';

export interface GpuPrimitive {
  vao: WebGLVertexArrayObject;
  vertexBuffers: WebGLBuffer[];
  positionBuffer: WebGLBuffer | null;
  normalBuffer: WebGLBuffer | null;
  basePositions: Float32Array;
  baseNormals: Float32Array;

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
  const positionAccessorIndex = primitive.attributes.POSITION;
  if (positionAccessorIndex === undefined) throw new Error('GLB primitive has no POSITION');
  const sourceVertexCount = asset.json.accessors?.[positionAccessorIndex]?.count ?? 0;
  if (sourceVertexCount <= 0) throw new Error('GLB POSITION accessor is empty');

  // All material primitives in this export index into a shared full-body
  // vertex stream. Compact each submesh to its referenced vertices.
  const sourceIndices = primitive.indices === undefined
    ? null
    : readAccessor(asset, primitive.indices) as Uint8Array | Uint16Array | Uint32Array;
  const sourceVertices: number[] = [];
  const sourceToCompact = new Map<number, number>();
  const indexCountSource = sourceIndices?.length ?? sourceVertexCount;
  const IndexCtor = sourceIndices?.constructor as (new (length: number) => Uint8Array | Uint16Array | Uint32Array) | undefined;
  const compactIndices = sourceIndices && IndexCtor ? new IndexCtor(sourceIndices.length) : null;

  for (let i = 0; i < indexCountSource; i++) {
    const sourceIndex = sourceIndices ? sourceIndices[i] : i;
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sourceVertexCount) {
      throw new Error(`GLB index ${sourceIndex} exceeds POSITION count ${sourceVertexCount}`);
    }
    let compactIndex = sourceToCompact.get(sourceIndex);
    if (compactIndex === undefined) {
      compactIndex = sourceVertices.length;
      sourceToCompact.set(sourceIndex, compactIndex);
      sourceVertices.push(sourceIndex);
    }
    if (compactIndices) compactIndices[i] = compactIndex;
  }
  if (sourceIndices && sourceIndices.length % 3 !== 0) {
    throw new Error('TRIANGLES index count is not divisible by three');
  }

  const compactArray = (data: ArrayBufferView, components: number): ArrayBufferView => {
    const source = data as unknown as { length: number; subarray(start: number, end?: number): ArrayLike<number> };
    if (source.length !== sourceVertexCount * components) {
      throw new Error(`GLB attribute size mismatch: expected ${sourceVertexCount * components}, got ${source.length}`);
    }
    const Ctor = data.constructor as new (length: number) => { set(values: ArrayLike<number>, offset?: number): void };
    const output = new Ctor(sourceVertices.length * components);
    for (let i = 0; i < sourceVertices.length; i++) {
      const from = sourceVertices[i] * components;
      output.set(source.subarray(from, from + components), i * components);
    }
    return output as unknown as ArrayBufferView;
  };

  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Unable to create VAO');
  gl.bindVertexArray(vao);
  const vertexBuffers: WebGLBuffer[] = [];
  let positionBuffer: WebGLBuffer | null = null;
  let normalBuffer: WebGLBuffer | null = null;
  let basePositions = new Float32Array(0);
  let baseNormals = new Float32Array(0);

  for (const attribute of ATTRIBUTES) {
    const accessorIndex = primitive.attributes[attribute.name];
    if (accessorIndex === undefined) continue;
    const accessor = asset.json.accessors?.[accessorIndex];
    if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
    const data = compactArray(readAccessor(asset, accessorIndex), attribute.size);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to create vertex buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    vertexBuffers.push(buffer);
    if (attribute.name === 'POSITION') { positionBuffer = buffer; basePositions = toFloat32(data); }
    if (attribute.name === 'NORMAL') { normalBuffer = buffer; baseNormals = toFloat32(data); }
    gl.enableVertexAttribArray(attribute.location);
    if (attribute.integer) {
      gl.vertexAttribIPointer(attribute.location, attribute.size, accessor.componentType, 0, 0);
    } else {
      gl.vertexAttribPointer(attribute.location, attribute.size, accessor.componentType, accessor.normalized ?? false, 0, 0);
    }
  }

  if (!positionBuffer) throw new Error('Unable to upload POSITION buffer');
  const indexBuffer = compactIndices ? gl.createBuffer() : null;
  if (compactIndices && !indexBuffer) throw new Error('Unable to create index buffer');
  if (indexBuffer && compactIndices) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, compactIndices, gl.STATIC_DRAW);
  }
  gl.bindVertexArray(null);

  return {
    vao,
    vertexBuffers,
    positionBuffer,
    normalBuffer,
    basePositions,
    baseNormals,
    indexBuffer,
    indexCount: compactIndices?.length ?? sourceVertices.length,
    indexType: sourceIndices
      ? (asset.json.accessors?.[primitive.indices!]?.componentType ?? gl.UNSIGNED_SHORT)
      : gl.UNSIGNED_SHORT,
    materialIndex: primitive.material ?? 0,
    meshIndex,
    vertexCount: sourceVertices.length,
    skinned: primitive.attributes.JOINTS_0 !== undefined,
    morphs: buildMorphBuffers(asset, primitive, sourceVertices)
  };
}
