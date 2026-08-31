/* MorphTarget + MorphController — mirror of MorphTarget.kt.
 * setWeight clamps to 0..1 like the native coerceIn; unknown names no-op. */

export interface MorphTarget {
  name: string;
  positionDeltas: Float32Array;
  normalDeltas?: Float32Array;
}

export class MorphController {
  private targets: MorphTarget[];
  private weights: Float32Array;

  constructor(targets: MorphTarget[]) {
    this.targets = targets;
    this.weights = new Float32Array(targets.length);
  }

  /** mirrors setWeight(target, value.coerceIn(0f, 1f)) */
  setWeight(target: string, value: number): void {
    const index = this.targets.findIndex(t => t.name === target);
    if (index >= 0) {
      this.weights[index] = Math.min(1, Math.max(0, value));
    }
  }

  /** mirrors getWeights(): weights.copyOf() */
  getWeights(): Float32Array {
    return new Float32Array(this.weights);
  }
}
