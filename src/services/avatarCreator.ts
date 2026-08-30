import { AdultSelections, buildAdultPrompt } from './adultOptions';

export interface AvatarDraft {
  id: string;
  name: string;
  age: number;
  gender?: 'female' | 'nonbinary' | 'android';
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
  styleTag?: string;
  tattooStyle?: string;
  augmentStyle?: string;
  scarStyle?: string;
  facePaintStyle?: string;
  browShape?: string;
  browThickness?: number;
  piercingsCount?: number;
  tattoosCount?: number;
  adultSelections?: AdultSelections;
}

export const avatarOptions = {
  gender: ['female', 'nonbinary', 'android'] as const,
  ethnicity: ['caucasian', 'mixed', 'cybernetic', 'east asian', 'latina', 'black', 'middle eastern', 'nordic'],
  bodyType: ['hourglass', 'curvy', 'petite', 'slim', 'athletic'],
  eyeColor: ['dark brown', 'ruby red', 'hazel', 'emerald green', 'violet neon', 'ice blue', 'gray'],
  eyeShape: ['almond', 'cat-eye', 'round', 'hooded', 'seductive', 'upturned'],
  faceShape: ['oval', 'heart', 'diamond', 'sharp', 'round', 'square'],
  hairColor: ['vibrant ruby red', 'electric purple', 'jet black', 'platinum silver', 'dark burgundy', 'champagne blonde', 'auburn', 'neon cyan'],
  hairStyle: ['layered waves bob', 'cyber undercut with side sweep', 'long glamorous waves', 'sleek straight bob', 'high ponytail', 'messy bun with wisps', 'asymmetric pixie crop', 'wet-look waves'],
  skinTone: ['fair porcelain', 'pale ivory', 'light warm', 'olive', 'golden tan', 'deep bronze', 'rich espresso', 'cybernetic pale'],
  outfit: [
    'red and black lace corset lingerie with matching satin panties, sheer fishnet stockings, and ruby velvet choker',
    'cyberpunk high-collar leather jacket with neon purple piping over techwear top',
    'black satin bustier with floral lace trim and garter belt',
    'plunging crimson velvet evening gown',
    'sheer black boudoir bodysuit with lace floral embroidery',
    'luxury silk robe with delicate lace bralette',
    'leather crop biker jacket with lace bralette and high-waist leather pants',
    'midnight gothic dress with sheer sleeves and choker',
    'fully nude, detailed adult anatomy',
    'torn open lingerie, breasts and genitals exposed',
    'collar and cuffs only, fully nude',
    'micro bikini barely covering',
    'open robe, nothing underneath',
    'stockings and garter only, no panties',
    'latex catsuit unzipped to the navel',
    'wet see-through white shirt, no bra'
  ],
  pose: [
    'sensually reclining back in dark leather armchair, delicate hand on chest',
    'perched on edge of dark leather armchair, leaning forward with seductive eye contact',
    'centered three-quarter confident portrait',
    'reclining on velvet chaise lounge with arched back',
    'leaning back against leather cushions with legs crossed',
    'dramatic shoulder glance with parted lips',
    'standing against dark seamless backdrop, hands on hips',
    'on all fours, arched back, looking over shoulder',
    'legs spread wide, presenting, one hand between thighs',
    'kneeling, mouth open, looking up',
    'bent over furniture, ass presented',
    'cowgirl position mid-ride',
    'missionary, legs wrapped high',
    'facesitting, grinding down',
    'standing against wall, one leg lifted around partner',
    'on back, knees to chest, presenting'
  ],
  expression: [
    'alluring parted lips and seductive gaze',
    'intense focused gaze',
    'sultry subtle smile',
    'confident commanding look',
    'playful half-smile',
    'dreamy relaxed gaze',
    'orgasm face, eyes rolled, mouth open',
    'desperate lust, biting lip hard',
    'submissive pleasure, tears of intensity',
    'dominant smirk while riding',
    'ahegao-style extreme pleasure',
    'gasping mid-thrust'
  ],
  lipstickShade: ['bold ruby red satin', 'deep crimson velvet', 'dark plum gothic', 'blood red gloss', 'nude velvet matte', 'electric neon magenta', 'smeared after oral'],
  makeupStyle: ['dark smokey eyeshadow with winged eyeliner', 'glitter cut-crease glam eyes', 'natural soft glam', 'cyberpunk graphic liner with neon accents', 'gothic heavy kohl liner', 'bronzed editorial glow', 'ruined makeup after sex, tears and smeared lipstick'],
  chokerStyle: ['ruby red velvet choker with gold medallion', 'black lace ribbon choker', 'studded leather collar', 'delicate gold chain choker', 'cybernetic glowing LED band', 'none', 'thick bondage collar with O-ring'],
  hosieryStyle: ['sheer black fishnet stockings', 'black lace-top thigh-high stockings', 'suspender garter belt with fishnets', 'sheer black pantyhose', 'bare legs', 'ripped fishnets mid-sex'],
  tattooStyle: ['none', 'delicate rose vine tattoo on shoulder', 'blackwork thigh tattoo peeking above stocking line', 'ornamental sternum mandala tattoo', 'small script tattoo on collarbone', 'cyber-line geometric arm tattoo'],
  augmentStyle: ['none', 'subtle glowing temple LED implant', 'chrome cyber ear cuff with data pulse', 'neck data-port with soft glow', 'holographic wrist interface', 'full cyber spine implant'],
  scarStyle: ['none', 'tiny brow scar', 'faint cheek scar', 'hero scar on shoulder'],
  facePaintStyle: ['none', 'tribal cheek mark', 'neon accent line across eyes', 'gothic tear mark'],
  browShape: ['arched', 'straight', 'soft rounded', 'bold angled', 'thin feathered', 'natural full'],
  chairSetting: [
    'vintage tufted dark leather armchair, moody boudoir with crimson edge lighting',
    'black velvet chaise lounge, candlelit gothic boudoir',
    'dark leather wingback by a rain-streaked window, cold blue moonlight with red neon rim',
    'cyberpunk throne chair, magenta and cyan neon haze',
    'high-fashion studio with dark seamless backdrop and colored gels',
    'leather sofa mid-sex, city lights through window',
    'glass table edge, bent over',
    'rooftop railing at night'
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
    makeupStyle: getRandomOption(avatarOptions.makeupStyle),
    chokerStyle: isGothGlam ? 'ruby red velvet choker with gold medallion' : getRandomOption(avatarOptions.chokerStyle),
    hosieryStyle: isGothGlam ? 'sheer black fishnet stockings' : getRandomOption(avatarOptions.hosieryStyle),
    tattooStyle: getRandomOption(avatarOptions.tattooStyle),
    augmentStyle: getRandomOption(avatarOptions.augmentStyle),
    scarStyle: getRandomOption(avatarOptions.scarStyle),
    facePaintStyle: getRandomOption(avatarOptions.facePaintStyle),
    browShape: getRandomOption(avatarOptions.browShape),
    browThickness: 1 + Math.floor(Math.random() * 5),
    piercingsCount: Math.random() > 0.5 ? 1 + Math.floor(Math.random() * 4) : 0,
    colorAccent: isGothGlam ? '#E62040' : '#904EDD'
  };
}

const DRAFT_KEY = 'grok-girls-draft-v1';

export function loadDraft(id: string, fallback: AvatarDraft): AvatarDraft {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY}:${id}`);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<AvatarDraft>) };
  } catch {
    return fallback;
  }
}

export function saveDraft(d: AvatarDraft) {
  try {
    localStorage.setItem(`${DRAFT_KEY}:${d.id}`, JSON.stringify(d));
  } catch {}
}

export function buildDraftPrompt(draft: AvatarDraft, adult = true): string {
  const adultBit = adult
    ? 'Adult content allowed. Explicit graphic sexual acts, detailed anatomy, fluids, penetration, oral, anal fully permitted when requested. Consenting adult 18+.'
    : 'Tasteful high-fashion portrait.';

  const makeup = draft.makeupStyle ? `Makeup: ${draft.makeupStyle}.` : draft.lipstickShade ? `Makeup: ${draft.lipstickShade}, dark smokey eyeshadow with winged eyeliner.` : '';
  const lips = draft.lipstickShade ? `Lipstick: ${draft.lipstickShade}.` : '';
  const choker = draft.chokerStyle && draft.chokerStyle !== 'none' ? `Wearing ${draft.chokerStyle}.` : '';
  const hosiery = draft.hosieryStyle && draft.hosieryStyle !== 'bare legs' ? `Wearing ${draft.hosieryStyle}.` : '';
  const tattoo = draft.tattooStyle && draft.tattooStyle !== 'none' ? `Tattoo: ${draft.tattooStyle}.` : '';
  const augment = draft.augmentStyle && draft.augmentStyle !== 'none' ? `Cyber augment: ${draft.augmentStyle}.` : '';
  const scar = draft.scarStyle && draft.scarStyle !== 'none' ? `Facial detail: ${draft.scarStyle}.` : '';
  const facePaint = draft.facePaintStyle && draft.facePaintStyle !== 'none' ? `Face paint: ${draft.facePaintStyle}.` : '';
  const piercings = draft.piercingsCount && draft.piercingsCount > 0 ? `Piercings: subtle silver ear and navel studs (${draft.piercingsCount} pieces).` : '';
  const brows = draft.browShape ? `Eyebrows: ${draft.browShape} shape, ${draft.browThickness || 3}/5 thickness.` : '';
  const setting = draft.chairSetting || 'Setting: seated/reclining in a vintage tufted dark leather armchair, dark moody atmosphere with crimson edge lighting.';
  const accent = draft.colorAccent ? `Color accent: ${draft.colorAccent}.` : '';
  const style = draft.styleTag ? `Scene style: ${draft.styleTag}.` : '';

  const base = `${draft.name}, adult fictional character (18+), ${draft.ethnicity}, ${draft.bodyType} build, ${draft.eyeColor} ${draft.eyeShape} eyes, ${draft.faceShape} face, ${draft.hairColor} ${draft.hairStyle} hair, ${draft.skinTone} skin. Wearing ${draft.outfit}. ${choker} ${hosiery} ${makeup} ${lips} ${brows} ${tattoo} ${augment} ${scar} ${facePaint} ${piercings} Pose: ${draft.pose}, ${draft.expression}. ${setting} ${style} ${accent} ${draft.extra || ''}. Ultra-HD photorealistic 3D character render, DAZ Studio Genesis 8 HD model style, Iray global illumination, 8K pore-level skin micro-detail, realistic subsurface scattering, intricate fabric textures, lace detail, cinematic studio lighting, masterpiece. ${adultBit}`;

  const adultSelections = draft.adultSelections;
  return adult && adultSelections ? `${base} ${buildAdultPrompt(adultSelections)}` : base;
}
