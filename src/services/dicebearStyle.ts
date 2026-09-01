/* DiceBear style bridge.
 *
 * Keeps the avatar-style catalog data-driven so the 2D avatar can be used as
 * a fast preview while the HD renderer remains the final 3D output.
 * Adventurer Neutral is licensed by its original author; preserve the
 * attribution when shipping the style assets.
 */

export interface DiceBearStyleDefinition {
  id: string;
  name: string;
  packageName: string;
  styleVersion: '10.x';
  attribution: string;
  totalCombinations: number;
  options: Record<string, number>;
  defaults: {
    seed: string;
    background: string;
  };
}

/** Backwards-compatible runtime style shape used by avatar session services. */
export type DiceBearStyleConfig = DiceBearStyleDefinition;

export const ADVENTURER_NEUTRAL: DiceBearStyleDefinition = {
  id: 'adventurer-neutral',
  name: 'Adventurer Neutral',
  packageName: '@dicebear/adventurer-neutral',
  styleVersion: '10.x',
  attribution: 'Adventurer Neutral by Lisa Wischofsky, CC BY 4.0',
  totalCombinations: 280800,
  options: {
    eyebrows: 15,
    eyes: 26,
    glasses: 5,
    mouth: 30,
    background: 4,
    eyeColor: 1,
    glassesColor: 1,
    ink: 1,
    lips: 1,
    sclera: 1,
    teeth: 1,
    throat: 1,
    tongue: 1,
    uvula: 1
  },
  defaults: {
    seed: 'Felix',
    background: 'transparent'
  }
};

export interface DiceBearRenderOptions {
  seed?: string;
  size?: number;
  backgroundColor?: string;
  scale?: number;
  flip?: boolean;
  radius?: number;
}

/**
 * Builds a deterministic DiceBear HTTP API URL without embedding user data
 * anywhere except the explicit seed query parameter.
 */
export function diceBearUrl(
  definition: DiceBearStyleDefinition = ADVENTURER_NEUTRAL,
  options: DiceBearRenderOptions = {}
): string {
  const seed = options.seed?.trim() || definition.defaults.seed;
  const size = Math.max(64, Math.min(2048, Math.round(options.size ?? 512)));
  const params = new URLSearchParams();
  params.set('seed', seed);
  params.set('size', String(size));
  if (options.backgroundColor) params.set('backgroundColor', options.backgroundColor.replace(/^#/, ''));
  if (options.scale !== undefined) params.set('scale', String(Math.max(1, Math.min(200, Math.round(options.scale)))));
  if (options.flip) params.set('flip', 'true');
  if (options.radius !== undefined) params.set('radius', String(Math.max(0, Math.min(50, Math.round(options.radius)))));
  return `https://api.dicebear.com/10.x/${definition.id}/svg?${params.toString()}`;
}

export function avatarCombinationCount(
  definition: DiceBearStyleDefinition = ADVENTURER_NEUTRAL,
  restricted: Partial<Record<keyof DiceBearStyleDefinition['options'], number>> = {}
): number {
  return Object.entries(definition.options).reduce((total, [key, count]) => {
    const selected = restricted[key as keyof typeof restricted];
    return total * Math.max(1, selected ?? count);
  }, 1);
}

export function sanitizeAvatarSeed(seed: string): string {
  const value = seed.trim();
  return value.length > 0 ? value : ADVENTURER_NEUTRAL.defaults.seed;
}
