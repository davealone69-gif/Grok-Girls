export interface AvatarDraft {
  id: string;
  name: string;
  age: number;
  gender?: 'female' | 'male' | 'nonbinary' | 'android';
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
  headShapeIndex?: number;
  colorAccent?: string;
  makeupStyle?: string;
  lipstickShade?: string;
  chokerStyle?: string;
  hosieryStyle?: string;
  lingerieLace?: string;
  chairSetting?: string;
  piercingsCount?: number;
  tattoosCount?: number;
}

export const avatarOptions = {
  gender: ['female', 'male', 'nonbinary', 'android'] as const,
  ethnicity: [
    'caucasian',
    'mixed',
    'cybernetic',
    'east asian',
    'latina',
    'black',
    'middle eastern',
    'nordic'
  ],
  bodyType: ['hourglass', 'curvy', 'petite', 'slim', 'athletic'],
  eyeColor: ['dark brown', 'ruby red', 'hazel', 'emerald green', 'violet neon', 'ice blue', 'gray'],
  eyeShape: ['almond', 'cat-eye', 'round', 'hooded', 'seductive', 'upturned'],
  faceShape: ['oval', 'heart', 'diamond', 'sharp', 'round', 'square'],
  hairColor: [
    'vibrant ruby red',
    'electric purple',
    'jet black',
    'platinum silver',
    'dark burgundy',
    'champagne blonde',
    'auburn',
    'neon cyan'
  ],
  hairStyle: [
    'layered waves bob',
    'cyber undercut with side sweep',
    'long glamorous waves',
    'sleek straight bob',
    'high ponytail',
    'messy bun with wisps',
    'asymmetric pixie crop',
    'wet-look waves'
  ],
  skinTone: [
    'fair porcelain',
    'pale ivory',
    'light warm',
    'olive',
    'golden tan',
    'deep bronze',
    'rich espresso',
    'cybernetic pale'
  ],
  outfit: [
    'red and black lace corset lingerie with matching satin panties, sheer fishnet stockings, and ruby velvet choker',
    'cyberpunk high-collar leather jacket with neon purple piping over techwear top',
    'black satin bustier with floral lace trim and garter belt',
    'plunging crimson velvet evening gown',
    'sheer black boudoir bodysuit with lace floral embroidery',
    'luxury silk robe with delicate lace bralette',
    'leather crop biker jacket with lace bralette and high-waist leather pants',
    'midnight gothic dress with sheer sleeves and choker'
  ],
  pose: [
    'sensually reclining back in dark leather armchair, delicate hand on chest',
    'perched on edge of dark leather armchair, leaning forward with seductive eye contact',
    'centered three-quarter confident portrait',
    'reclining on velvet chaise lounge with arched back',
    'leaning back against leather cushions with legs crossed',
    'dramatic shoulder glance with parted lips',
    'standing against dark seamless backdrop, hands on hips'
  ],
  expression: [
    'alluring parted lips and seductive gaze',
    'intense focused gaze',
    'sultry subtle smile',
    'confident commanding look',
    'playful half-smile',
    'dreamy relaxed gaze'
  ],
  lipstickShade: [
    'bold ruby red satin',
    'deep crimson velvet',
    'dark plum gothic',
    'blood red gloss',
    'nude velvet matte',
    'electric neon magenta'
  ],
  chokerStyle: [
    'ruby red velvet choker with gold medallion',
    'black lace ribbon choker',
    'studded leather collar',
    'delicate gold chain choker',
    'cybernetic glowing LED band',
    'none'
  ],
  hosieryStyle: [
    'sheer black fishnet stockings',
    'black lace-top thigh-high stockings',
    'suspender garter belt with fishnets',
    'sheer black pantyhose',
    'bare legs'
  ]
};

export function getRandomOption<T>(list: readonly T[] | T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomizeAvatar(current: AvatarDraft): AvatarDraft {
  const isGothGlam = Math.random() > 0.4;
  return {
    ...current,
    ethnicity: getRandomOption(avatarOptions.ethnicity),
    bodyType: isGothGlam ? 'hourglass' : getRandomOption(avatarOptions.bodyType),
    eyeColor: getRandomOption(avatarOptions.eyeColor),
    eyeShape: getRandomOption(avatarOptions.eyeShape),
    faceShape: getRandomOption(avatarOptions.faceShape),
    hairColor: isGothGlam ? 'vibrant ruby red' : getRandomOption(avatarOptions.hairColor),
    hairStyle: isGothGlam ? 'layered waves bob' : getRandomOption(avatarOptions.hairStyle),
    skinTone: isGothGlam ? 'fair porcelain' : getRandomOption(avatarOptions.skinTone),
    outfit: isGothGlam ? avatarOptions.outfit[0] : getRandomOption(avatarOptions.outfit),
    pose: isGothGlam ? avatarOptions.pose[0] : getRandomOption(avatarOptions.pose),
    expression: isGothGlam ? avatarOptions.expression[0] : getRandomOption(avatarOptions.expression),
    lipstickShade: isGothGlam ? 'bold ruby red satin' : getRandomOption(avatarOptions.lipstickShade),
    chokerStyle: isGothGlam ? 'ruby red velvet choker with gold medallion' : getRandomOption(avatarOptions.chokerStyle),
    hosieryStyle: isGothGlam ? 'sheer black fishnet stockings' : getRandomOption(avatarOptions.hosieryStyle),
    colorAccent: isGothGlam ? '#E62040' : '#904EDD'
  };
}

export function buildDraftPrompt(draft: AvatarDraft, adult = true): string {
  const adultBit = adult
    ? 'Adult content allowed. Mature boudoir, sensual lingerie photography. Consenting adult 18+.'
    : 'Tasteful high-fashion portrait.';

  const makeup = draft.lipstickShade ? `Lipstick: ${draft.lipstickShade}, dark smokey eyeshadow with winged eyeliner.` : '';
  const choker = draft.chokerStyle && draft.chokerStyle !== 'none' ? `Wearing ${draft.chokerStyle}.` : '';
  const hosiery = draft.hosieryStyle && draft.hosieryStyle !== 'bare legs' ? `Wearing ${draft.hosieryStyle}.` : '';
  const setting = 'Setting: seated/reclining in a vintage tufted dark leather armchair, dark moody atmosphere with crimson edge lighting.';

  return `${draft.name}, adult fictional character (18+), ${draft.ethnicity}, ${draft.bodyType} build, ${draft.eyeColor} ${draft.eyeShape} eyes, ${draft.faceShape} face, ${draft.hairColor} ${draft.hairStyle} hair, ${draft.skinTone} skin. Wearing ${draft.outfit}. ${choker} ${hosiery} ${makeup} Pose: ${draft.pose}, ${draft.expression}. ${setting} ${draft.extra || ''}. Highly detailed 8k photography, realistic fabric textures, lace detail, cinematic lighting, masterpiece. ${adultBit}`;
}
