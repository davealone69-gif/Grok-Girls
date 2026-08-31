import { GltfAsset, GltfPrimitive } from './GltfTypes';
import { readAccessor, readScalarIndices } from './GlbLoader';

export interface GltfGpuPrimitive {
  vao: WebGLVertexArrayObject;
  vertexBuffers: WebGLBuffer[];
  indexBuffer: WebGLBuffer | null;
  indexCount: number;
  indexType: number;
  mode: number;
  materialIndex: number;
  morphTargets: GltfMorphTarget[];
}

export interface GltfMorphTarget {
  position: Float32Array | null;
  normal: Float32Array | null;
  tangent: Float32Array | null;
}

function componentCount(type: string): number {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    default: throw new Error(`Unsupported vertex accessor type ${type}`);
  }
}

function uploadAttribute(gl: WebGL2RenderingContext, asset: GltfAsset, accessorIndex: number, location: number, integer: boolean): WebGLBuffer {
  const accessor = asset.json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const data = readAccessor(asset, accessorIndex);
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Unable to create glTF vertex buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const count = componentCount(accessor.type);
  gl.enableVertexAttribArray(location);
  if (integer) gl.vertexAttribIPointer(location, count, accessor.componentType, 0, 0);
  else gl.vertexAttribPointer(location, count, accessor.componentType, accessor.normalized ?? false, 0, 0);
  return buffer;
}

function morphData(asset: GltfAsset, primitive: GltfPrimitive): GltfMorphTarget[] {
  return (primitive.targets ?? []).map(target => ({
    position: target.POSITION === undefined ? null : readAccessor(asset, target.POSITION) as Float32Array,
    normal: target.NORMAL === undefined ? null : readAccessor(asset, target.NORMAL) as Float32Array,
    tangent: target.TANGENT === undefined ? null : readAccessor(asset, target.TANGENT) as Float32Array,
  }));
}

export function uploadGltfPrimitive(gl: WebGL2RenderingContext, asset: GltfAsset, primitive: GltfPrimitive): GltfGpuPrimitive {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Unable to create glTF VAO');
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const attrs: Array<[string, number, boolean]> = [
    ['POSITION', 0, false],
    ['NORMAL', 1, false],
    ['TEXCOORD_0', 2, false],
    ['JOINTS_0', 3, true],
    ['WEIGHTS_0', 4, false],
  ];
  for (const [name, location, integer] of attrs) {
    const index = primitive.attributes[name];
    if (index !== undefined) buffers.push(uploadAttribute(gl, asset, index, location, integer));
  }
  let indexBuffer: WebGLBuffer | null = null;
  let indexCount = 0;
  let indexType = gl.UNSIGNED_SHORT;
  if (primitive.indices !== undefined) {
    const accessor = asset.json.accessors?.[primitive.indices];
    if (!accessor) throw new Error('Missing index accessor');
    const indices = readScalarIndices(asset, primitive.indices);
    indexBuffer = gl.createBuffer();
    if (!indexBuffer) throw new Error('Unable to create glTF index buffer');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    indexCount = accessor.count;
    indexType = accessor.componentType;
  }
  if (primitive.indices === undefined) {
    const positionAccessor = primitive.attributes.POSITION;
    if (positionAccessor === undefined) throw new Error('glTF primitive has no POSITION');
    indexCount = asset.json.accessors?.[positionAccessor]?.count ?? 0;
  }
  gl.bindVertexArray(null);
  return { vao, vertexBuffers: buffers, indexBuffer, indexCount, indexType, mode: primitive.mode ?? gl.TRIANGLES, materialIndex: primitive.material ?? 0, morphTargets: morphData(asset, primitive) };
}

export function destroyGltfPrimitive(gl: WebGL2RenderingContext, primitive: GltfGpuPrimitive): void {
  gl.deleteVertexArray(primitive.vao);
  for (const buffer of primitive.vertexBuffers) gl.deleteBuffer(buffer);
  if (primitive.indexBuffer) gl.deleteBuffer(primitive.indexBuffer);
}

export function drawGltfPrimitive(gl: WebGL2RenderingContext, primitive: GltfGpuPrimitive): void {
  gl.bindVertexArray(primitive.vao);
  if (primitive.indexBuffer) gl.drawElements(primitive.mode, primitive.indexCount, primitive.indexType, 0);
  else gl.drawArrays(primitive.mode, 0, primitive.indexCount);
  gl.bindVertexArray(null);
}
