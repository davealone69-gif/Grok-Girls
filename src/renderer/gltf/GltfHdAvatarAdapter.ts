import { AvatarMesh } from '../avatar/AvatarMesh';
import { Bone, Skeleton } from '../avatar/Skeleton';
import { HdAvatarRenderer } from '../HdAvatarRenderer';
import { mat4Identity, Mat4 } from '../math';
import { GltfAvatar, GltfAvatarPrimitive, gltfLocalMatrix } from './GltfAvatar';
import { readAccessor } from './GlbLoader';

interface AdapterMesh extends AvatarMesh { source: GltfAvatarPrimitive; }

function makeMesh(gl: WebGL2RenderingContext, avatar: GltfAvatar, source: GltfAvatarPrimitive): AdapterMesh {
  const primitive = avatar.asset.json.meshes?.[source.meshIndex]?.primitives[source.primitiveIndex];
  if (!primitive) throw new Error('GLB source primitive missing');
  const positionIndex = primitive.attributes.POSITION;
  if (positionIndex === undefined) throw new Error('GLB primitive has no POSITION');
  const positions = readAccessor(avatar.asset, positionIndex) as Float32Array;
  const normalIndex = primitive.attributes.NORMAL;
  const uvIndex = primitive.attributes.TEXCOORD_0;
  const normals = normalIndex === undefined ? new Float32Array(positions.length) : readAccessor(avatar.asset, normalIndex) as Float32Array;
  const uvs = uvIndex === undefined ? new Float32Array((positions.length / 3) * 2) : readAccessor(avatar.asset, uvIndex) as Float32Array;
  const jointsIndex = primitive.attributes.JOINTS_0;
  const weightsIndex = primitive.attributes.WEIGHTS_0;
  const skinned = source.skinIndex !== null && jointsIndex !== undefined && weightsIndex !== undefined;
  const vertexCount = positions.length / 3;
  if (normals.length < vertexCount * 3 || uvs.length < vertexCount * 2) throw new Error('GLB vertex attribute count mismatch');

  const vao = gl.createVertexArray();
  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const jointBuffer = skinned ? gl.createBuffer() : null;
  const weightBuffer = skinned ? gl.createBuffer() : null;
  if (!vao || !positionBuffer || !normalBuffer || !uvBuffer || (skinned && (!jointBuffer || !weightBuffer))) throw new Error('Unable to allocate GLB avatar mesh');

  let indexBuffer: WebGLBuffer | null = null;
  let indexCount = 0;
  let indexType = gl.UNSIGNED_SHORT;
  if (primitive.indices !== undefined) {
    const accessor = avatar.asset.json.accessors?.[primitive.indices];
    if (!accessor) throw new Error('Missing GLB index accessor');
    const raw = readAccessor(avatar.asset, primitive.indices);
    if (accessor.componentType === 5125) {
      const values = raw as Uint32Array;
      const converted = new Uint16Array(values.length);
      for (let i = 0; i < values.length; i++) { if (values[i] > 65535) throw new Error('GLB index exceeds HD avatar uint16 path'); converted[i] = values[i]; }
      indexType = gl.UNSIGNED_SHORT;
      indexCount = converted.length;
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, converted, gl.STATIC_DRAW);
    } else {
      indexType = accessor.componentType;
      indexCount = accessor.count;
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, raw, gl.STATIC_DRAW);
    }
  } else {
    const generated = new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) generated[i] = i;
    indexCount = generated.length;
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, generated, gl.STATIC_DRAW);
  }

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  if (skinned) {
    const joints = readAccessor(avatar.asset, jointsIndex!) as Uint8Array | Uint16Array | Uint32Array;
    const weights = readAccessor(avatar.asset, weightsIndex!) as Float32Array;
    const packed = new Uint8Array(vertexCount * 4);
    for (let i = 0; i < vertexCount * 4; i++) {
      const value = joints[i];
      if (value > 127) throw new Error(`GLB joint ${value} exceeds HdAvatarRenderer's 128-bone shader`);
      packed[i] = value;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, jointBuffer); gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_BYTE, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, weightBuffer); gl.bufferData(gl.ARRAY_BUFFER, weights, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 0, 0);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bindVertexArray(null);

  return {
    source,
    vao,
    vbo: positionBuffer,
    ebo: indexBuffer,
    indexCount,
    upload() {},
    draw(ctx) {
      if (!vao) return;
      ctx.bindVertexArray(vao);
      ctx.drawElements(gl.TRIANGLES, indexCount, indexType, 0);
      ctx.bindVertexArray(null);
    },
    destroy(ctx) {
      ctx.deleteVertexArray(vao);
      ctx.deleteBuffer(positionBuffer); ctx.deleteBuffer(normalBuffer); ctx.deleteBuffer(uvBuffer);
      if (jointBuffer) ctx.deleteBuffer(jointBuffer); if (weightBuffer) ctx.deleteBuffer(weightBuffer);
      if (indexBuffer) ctx.deleteBuffer(indexBuffer);
    },
  };
}

function buildSkeleton(avatar: GltfAvatar, skinIndex: number): Skeleton {
  const skin = avatar.skins[skinIndex];
  if (!skin) throw new Error(`Missing GLB skin ${skinIndex}`);
  const ibm = skin.inverseBindMatrices === undefined ? null : readAccessor(avatar.asset, skin.inverseBindMatrices) as Float32Array;
  const jointToBone = new Map<number, number>();
  skin.joints.forEach((nodeIndex, boneIndex) => jointToBone.set(nodeIndex, boneIndex));
  const bones = skin.joints.map((nodeIndex, boneIndex) => {
    const node = avatar.nodes[nodeIndex];
    if (!node) throw new Error(`Missing skin joint node ${nodeIndex}`);
    const parentNode = avatar.nodes.findIndex(n => n.children?.includes(nodeIndex));
    const parentBone = jointToBone.get(parentNode) ?? -1;
    const inverseBind = ibm ? ibm.subarray(boneIndex * 16, boneIndex * 16 + 16) as Mat4 : mat4Identity();
    const bone = new Bone(node.name ?? `joint_${boneIndex}`, parentBone, inverseBind);
    bone.localTransform = gltfLocalMatrix(node) as Mat4;
    return bone;
  });
  const skeleton = new Skeleton(bones);
  skeleton.update();
  return skeleton;
}

/**
 * Uses the existing HdAvatarRenderer draw/shader path rather than creating a
 * second renderer. The adapter only translates GLB vertex/joint layout into
 * the renderer's existing GPU contract.
 */
export function bindGltfAvatarToHdRenderer(renderer: HdAvatarRenderer, avatar: GltfAvatar, primitiveIndex = 0): void {
  const source = avatar.primitives[primitiveIndex];
  if (!source) throw new Error(`GLB primitive ${primitiveIndex} does not exist`);
  const mesh = makeMesh((renderer as unknown as { gl: WebGL2RenderingContext }).gl, avatar, source);
  const internal = renderer as unknown as { mesh: AvatarMesh; skeleton: Skeleton | null };
  internal.mesh?.destroy((renderer as unknown as { gl: WebGL2RenderingContext }).gl);
  internal.mesh = mesh;
  if (source.skinIndex !== null) internal.skeleton = buildSkeleton(avatar, source.skinIndex);
}
