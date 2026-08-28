export interface AvatarDraft {
  id: string;
  name: string;
  age: number;
  ethnicity: string;
  bodyType: string;
  eyeColor: string;
  eyeShape: string;
  faceShape: string;
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  outfit: string;
  pose: string;
  expression: string;
  extra: string;
}

export const avatarOptions = {
  ethnicity: ['mixed', 'caucasian', 'east asian', 'south asian', 'latina', 'black', 'middle eastern', 'nordic'],
  bodyType: ['petite', 'slim', 'athletic', 'curvy', 'hourglass'],
  eyeColor: ['blue', 'green', 'brown', 'hazel', 'gray', 'amber', 'violet'],
  eyeShape: ['almond', 'round', 'hooded', 'upturned', 'downturned'],
  faceShape: ['oval', 'heart', 'round', 'square', 'diamond'],
  hairColor: ['black', 'dark brown', 'blonde', 'auburn', 'platinum', 'red', 'pastel pink', 'silver'],
  hairStyle: ['short bob', 'long waves', 'sleek straight', 'ponytail', 'braids', 'messy bun', 'curls', 'high ponytail'],
  skinTone: ['fair', 'light', 'medium', 'tan', 'dark', 'deep', 'olive', 'warm'],
  outfit: [
    'casual streetwear',
    'luxury evening wear',
    'midnight fashion',
    'pastel street fashion',
    'crimson evening fashion',
    'studio fashion',
    'athleisure',
    'silk loungewear',
    'cyberpunk leather jacket',
    'boho chic sundress'
  ],
  pose: [
    'confident standing',
    'casual seated',
    'three-quarter',
    'relaxed lounge',
    'dynamic standing',
    'seated on sofa',
    'leaning against railing'
  ],
  expression: [
    'confident',
    'thoughtful',
    'cheerful',
    'calm',
    'playful',
    'alluring',
    'happy',
    'excited',
    'subtle smile'
  ]
};

export function getRandomOption<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomizeAvatar(current: AvatarDraft): AvatarDraft {
  return {
    ...current,
    ethnicity: getRandomOption(avatarOptions.ethnicity),
    bodyType: getRandomOption(avatarOptions.bodyType),
    eyeColor: getRandomOption(avatarOptions.eyeColor),
    eyeShape: getRandomOption(avatarOptions.eyeShape),
    faceShape: getRandomOption(avatarOptions.faceShape),
    hairColor: getRandomOption(avatarOptions.hairColor),
    hairStyle: getRandomOption(avatarOptions.hairStyle),
    skinTone: getRandomOption(avatarOptions.skinTone),
    outfit: getRandomOption(avatarOptions.outfit),
    pose: getRandomOption(avatarOptions.pose),
    expression: getRandomOption(avatarOptions.expression)
  };
}

export function buildDraftPrompt(draft: AvatarDraft, adult = false): string {
  const adultBit = adult
    ? 'Adult content allowed. Mature portrait as requested. All characters 18+.'
    : 'non-explicit, tasteful portrait.';
  return `${draft.name}, adult fictional character (18+), ${draft.ethnicity}, ${draft.bodyType} build, ${draft.eyeColor} ${draft.eyeShape} eyes, ${draft.faceShape} face, ${draft.hairColor} ${draft.hairStyle} hair, ${draft.skinTone} skin, wearing ${draft.outfit}, ${draft.pose}, ${draft.expression}. ${draft.extra}. High quality character portrait, coherent identity. ${adultBit}`;
}
