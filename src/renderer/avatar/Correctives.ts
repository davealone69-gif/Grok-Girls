/* ------------------------------------------------------------------ */
/* Correctives — corrective shapes that fire when overlapping          */
/* expressions would otherwise produce unnatural intersections         */
/* (e.g. smile + squint + cheek raise over the eyelid) (milestone 6).  */
/* ------------------------------------------------------------------ */

export interface CorrectiveRule {
  output: string;

  inputs: Array<{
    morph: string;
    multiplier: number;
  }>;

  threshold: number;
}

export const correctiveRules: CorrectiveRule[] = [
  {
    output: 'smile_squint_corrective',
    inputs: [
      { morph: 'smile_L', multiplier: 1 },
      { morph: 'squint_L', multiplier: 1 }
    ],
    threshold: 0.15
  },
  {
    output: 'smile_squint_corrective_R',
    inputs: [
      { morph: 'smile_R', multiplier: 1 },
      { morph: 'squint_R', multiplier: 1 }
    ],
    threshold: 0.15
  }
];

/** Evaluate corrective rules in place over the morph weight map. */
export function evaluateCorrectives(weights: Map<string, number>): void {
  for (const rule of correctiveRules) {
    let value = 1;

    for (const input of rule.inputs) {
      value *= Math.max(weights.get(input.morph) ?? 0, 0) * input.multiplier;
    }

    value = Math.max(0, Math.min(1, value));

    if (value >= rule.threshold) {
      weights.set(rule.output, value);
    }
  }
}
