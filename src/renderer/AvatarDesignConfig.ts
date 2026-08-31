export type AvatarStyle = 'realistic' | 'anime' | 'stylized' | 'cinematic';
export type BodyType = 'slim' | 'standard' | 'athletic' | 'curvy' | 'custom';
export type HairStyle = 'short' | 'long' | 'curly' | 'bob' | 'ponytail' | 'buzz' | 'mohawk' | 'bald';
export type EyeColor = 'blue' | 'green' | 'brown' | 'hazel' | 'grey' | 'custom';
export type RenderQuality = 'preview' | 'high' | 'ultra';

export interface AvatarMorphs {
  headWidth: number;
  faceLength: number;
  jawWidth: number;
  cheekWidth: number;
  eyeSize: number;
  eyeSpacing: number;
  noseWidth: number;
  noseLength: number;
  mouthWidth: number;
  lipFullness: number;
  neckWidth: number;
  shoulderWidth: number;
  torsoLength: number;
  waist: number;
  hipWidth: number;
  armLength: number;
  legLength: number;
  height: number;
}

export interface AvatarMaterials {
  skinBaseColor: string;
  skinRoughness: number;
  skinSubsurface: number;
  skinSpecular: number;
  hairColor: string;
  hairRoughness: number;
  eyeColor: string;
  clothingColor: string;
  clothingRoughness: number;
  metallic: number;
}

export interface AvatarDesignConfig {
  version: 1;
  id: string;
  name: string;
  style: AvatarStyle;
  bodyType: BodyType;
  hairStyle: HairStyle;
  eyeColor: EyeColor;
  morphs: AvatarMorphs;
  materials: AvatarMaterials;
  expression: string;
  quality: RenderQuality;
  seed: number;
}

export const DEFAULT_AVATAR_DESIGN: AvatarDesignConfig = {
  version: 1,
  id: 'avatar-default',
  name: 'New Avatar',
  style: 'cinematic',
  bodyType: 'standard',
  hairStyle: 'long',
  eyeColor: 'brown',
  morphs: {
    headWidth: 0,
    faceLength: 0,
    jawWidth: 0,
    cheekWidth: 0,
    eyeSize: 0,
    eyeSpacing: 0,
    noseWidth: 0,
    noseLength: 0,
    mouthWidth: 0,
    lipFullness: 0,
    neckWidth: 0,
    shoulderWidth: 0,
    torsoLength: 0,
    waist: 0,
    hipWidth: 0,
    armLength: 0,
    legLength: 0,
    height: 0
  },
  materials: {
    skinBaseColor: '#D4A574',
    skinRoughness: 0.46,
    skinSubsurface: 0.16,
    skinSpecular: 0.35,
    hairColor: '#24170F',
    hairRoughness: 0.38,
    eyeColor: '#5A3824',
    clothingColor: '#252A38',
    clothingRoughness: 0.58,
    metallic: 0
  },
  expression: 'neutral',
  quality: 'high',
  seed: 1
};

export function cloneAvatarDesign(source: AvatarDesignConfig = DEFAULT_AVATAR_DESIGN): AvatarDesignConfig {
  return JSON.parse(JSON.stringify(source)) as AvatarDesignConfig;
}

export function sanitizeAvatarDesign(input: Partial<AvatarDesignConfig>): AvatarDesignConfig {
  const base = cloneAvatarDesign();
  const merged: AvatarDesignConfig = {
    ...base,
    ...input,
    morphs: { ...base.morphs, ...(input.morphs ?? {}) },
    materials: { ...base.materials, ...(input.materials ?? {}) }
  };

  for (const key of Object.keys(merged.morphs) as (keyof AvatarMorphs)[]) {
    merged.morphs[key] = clamp(Number(merged.morphs[key]), -1, 1);
  }
  merged.materials.skinRoughness = clamp(Number(merged.materials.skinRoughness), 0, 1);
  merged.materials.skinSubsurface = clamp(Number(merged.materials.skinSubsurface), 0, 1);
  merged.materials.skinSpecular = clamp(Number(merged.materials.skinSpecular), 0, 1);
  merged.materials.hairRoughness = clamp(Number(merged.materials.hairRoughness), 0, 1);
  merged.materials.clothingRoughness = clamp(Number(merged.materials.clothingRoughness), 0, 1);
  merged.materials.metallic = clamp(Number(merged.materials.metallic), 0, 1);
  merged.seed = Number.isFinite(Number(merged.seed)) ? Math.floor(Number(merged.seed)) : 1;
  return merged;
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;
}
