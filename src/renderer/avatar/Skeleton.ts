/* Skeleton + Bone — mirror of com.example.hdrenderer.avatar.Skeleton.kt.
 * local/world/skin matrices per bone; update() walks parents and computes
 * skinMatrix = world * inverseBind for the whole skinMatrices array. */

import { Mat4, mat4Identity, mat4Multiply } from '../math';

export class Bone {
  name: string;
  parentIndex: number;
  inverseBindMatrix: Mat4;
  localTransform: Mat4;
  worldTransform: Mat4;
  skinMatrix: Mat4;

  constructor(name: string, parentIndex: number, inverseBindMatrix?: Mat4) {
    this.name = name;
    this.parentIndex = parentIndex;
    this.inverseBindMatrix = inverseBindMatrix ? new Float32Array(inverseBindMatrix) : mat4Identity();
    this.localTransform = mat4Identity();
    this.worldTransform = mat4Identity();
    this.skinMatrix = mat4Identity();
  }
}

export class Skeleton {
  bones: Bone[];
  skinMatrices: Float32Array;

  constructor(bones: Bone[]) {
    this.bones = bones;
    this.skinMatrices = new Float32Array(bones.length * 16);
  }

  update(): void {
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      if (bone.parentIndex >= 0) {
        bone.worldTransform = mat4Multiply(this.bones[bone.parentIndex].worldTransform, bone.localTransform);
      } else {
        bone.worldTransform = new Float32Array(bone.localTransform);
      }
      bone.skinMatrix = mat4Multiply(bone.worldTransform, bone.inverseBindMatrix);
      this.skinMatrices.set(bone.skinMatrix, i * 16);
    }
  }
}
