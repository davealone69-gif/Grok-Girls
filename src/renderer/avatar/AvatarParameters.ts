/* AvatarParameters — mirror of AvatarParameters.kt (defaults all 1f).
 * These feed bone scaling / morph weights in the avatar renderer. */

export interface AvatarParameters {
  height: number;
  bodyWidth: number;
  shoulderWidth: number;
  chest: number;
  waist: number;
  hipWidth: number;
  armLength: number;
  legLength: number;
  headScale: number;
  eyeSize: number;
  noseWidth: number;
  jawWidth: number;
  cheekWidth: number;
}

export const DEFAULT_AVATAR_PARAMETERS: AvatarParameters = {
  height: 1,
  bodyWidth: 1,
  shoulderWidth: 1,
  chest: 1,
  waist: 1,
  hipWidth: 1,
  armLength: 1,
  legLength: 1,
  headScale: 1,
  eyeSize: 1,
  noseWidth: 1,
  jawWidth: 1,
  cheekWidth: 1
};

/** Body/torso lathe profile modulated by the parameters, returning a
 *  [chest, waist, hip] multiplier triple (approximately the native
 *  proportions sliders). */
export function bodyShapeFromParameters(p: AvatarParameters): [number, number, number] {
  return [p.chest, Math.min(p.chest, p.waist), p.hipWidth];
}
