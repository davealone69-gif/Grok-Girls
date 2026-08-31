/* ------------------------------------------------------------------ */
/* AvatarDefinition — canonical avatar schema (Kotlin data-class mirror)*/
/*                                                                     */
/* Source of truth (native model):                                     */
/*   data class AvatarDefinition(                                      */
/*     val gender: String = "Female",                                  */
/*     val skin: String = "Tone 01",                                   */
/*     val head: String = "Head 01",                                   */
/*     val age: String = "Adult",                                      */
/*     val hair: String = "Short",                                     */
/*     val eyes: String = "Natural",                                   */
/*     val face: String = "Soft",                                      */
/*     val body: String = "Average",                                   */
/*     val tattoos: String = "None",                                   */
/*     val augmentations: String = "None",                             */
/*     val outfit: String = "Casual"                                   */
/*   )                                                                 */
/*                                                                     */
/* The UI's rich AvatarDraft maps onto (and back from) this canonical  */
/* shape; the options panel in menu.xml (Avatar ID / Load Outfit /     */
/* SAVE / toggles) operates on it.                                     */
/* ------------------------------------------------------------------ */
import type { AvatarDraft } from '../services/avatarCreator';
import { avatarOptions } from '../services/avatarCreator';

export interface AvatarDefinition {
  gender: string;
  skin: string;
  head: string;
  age: string;
  hair: string;
  eyes: string;
  face: string;
  body: string;
  tattoos: string;
  augmentations: string;
  outfit: string;
}

/** Exactly the Kotlin data-class defaults. */
export const DEFAULT_AVATAR_DEFINITION: AvatarDefinition = {
  gender: 'Female',
  skin: 'Tone 01',
  head: 'Head 01',
  age: 'Adult',
  hair: 'Short',
  eyes: 'Natural',
  face: 'Soft',
  body: 'Average',
  tattoos: 'None',
  augmentations: 'None',
  outfit: 'Casual'
};

const GENDER_TO_DEF: Record<string, string> = {
  female: 'Female',
  nonbinary: 'Non-binary',
  android: 'Android'
};
const DEF_TO_GENDER: Record<string, AvatarDraft['gender']> = {
  Female: 'female',
  'Non-binary': 'nonbinary',
  Android: 'android'
};

const BODY_TO_DEF: Record<string, string> = {
  hourglass: 'Average',
  petite: 'Slim',
  slim: 'Slim',
  athletic: 'Athletic',
  curvy: 'Heavy'
};
const DEF_TO_BODY: Record<string, string> = {
  Slim: 'slim',
  Athletic: 'athletic',
  Average: 'petite',
  Heavy: 'curvy'
  // Custom: keep the current bodyType
};

const FACE_TO_DEF: Record<string, string> = {
  oval: 'Soft',
  heart: 'Soft',
  round: 'Soft',
  diamond: 'Angular',
  sharp: 'Sharp',
  square: 'Sharp'
};
const DEF_TO_FACE: Record<string, string> = {
  Soft: 'oval',
  Angular: 'diamond',
  Sharp: 'sharp'
  // Custom: keep the current faceShape
};

const HAIR_TO_DEF: Record<string, string> = {
  'layered waves bob': 'Short',
  'cyber undercut with side sweep': 'Mohawk',
  'long glamorous waves': 'Long',
  'sleek straight bob': 'Short',
  'high ponytail': 'Ponytail',
  'messy bun with wisps': 'Ponytail',
  'asymmetric pixie crop': 'Short',
  'wet-look waves': 'Long'
};
const DEF_TO_HAIR: Record<string, string> = {
  Short: 'sleek straight bob',
  Long: 'long glamorous waves',
  Ponytail: 'high ponytail',
  Braids: 'twin braids with ribbon ties',
  Mohawk: 'shaved sides with mohawk crest',
  Bald: 'bald, shaved head'
};

const EYES_TO_DEF: Record<string, string> = {
  'dark brown': 'Natural',
  hazel: 'Natural',
  gray: 'Natural',
  'ruby red': 'Glowing',
  'emerald green': 'Glowing',
  'ice blue': 'Glowing',
  'violet neon': 'Cyber',
  'cybernetic pale': 'Cyber'
};
const DEF_TO_EYES: Record<string, string> = {
  Natural: 'hazel',
  Cyber: 'violet neon',
  Glowing: 'ice blue',
  Heterochromia: 'heterochromatic amber and violet'
};

function outfitToDef(outfit: string): string {
  const o = outfit.toLowerCase();
  if (o.includes('armoured') || o.includes('armored')) return 'Armoured';
  if (o.includes('gown') || o.includes('dress')) return 'Formal';
  if (o.includes('cyberpunk') || o.includes('techwear')) return 'Tech';
  if (o.includes('biker') || o.includes('leather')) return 'Street';
  return 'Casual';
}
function defToOutfit(def: string): string {
  switch (def) {
    case 'Street': return avatarOptions.outfit[6];
    case 'Tech': return avatarOptions.outfit[1];
    case 'Formal': return avatarOptions.outfit[3];
    case 'Armoured': return 'black tactical armoured bodysuit with carbon fibre plating';
    default: return avatarOptions.outfit[5]; // silk robe — Casual
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Map the rich UI draft onto the canonical AvatarDefinition. */
export function toAvatarDefinition(d: AvatarDraft): AvatarDefinition {
  const skinIdx = Math.max(0, avatarOptions.skinTone.indexOf(d.skinTone));
  const headIdx = Math.max(0, Math.min(7, d.headShapeIndex ?? 0));
  return {
    gender: GENDER_TO_DEF[d.gender ?? 'female'] ?? 'Female',
    skin: `Tone ${pad2(skinIdx + 1)}`,
    head: `Head ${pad2(headIdx + 1)}`,
    age: d.age < 25 ? 'Young Adult' : d.age < 35 ? 'Adult' : 'Mature',
    hair: HAIR_TO_DEF[d.hairStyle] ?? 'Short',
    eyes: EYES_TO_DEF[d.eyeColor] ?? 'Natural',
    face: FACE_TO_DEF[d.faceShape] ?? 'Soft',
    body: BODY_TO_DEF[d.bodyType] ?? 'Average',
    tattoos: tattoosToDef(d.tattooStyle),
    augmentations: augmentsToDef(d.augmentStyle),
    outfit: outfitToDef(d.outfit)
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Placement-based canonical value (mirrors AvatarCategories). */
function tattoosToDef(style: string | undefined): string {
  const t = (style || '').toLowerCase();
  if (!t || t === 'none') return 'None';
  if (t.includes('face')) return 'Face';
  if (t.includes('arm')) return 'Arms';
  if (t.includes('sternum') || t.includes('torso')) return 'Torso';
  return 'Full';
}
function augmentsToDef(style: string | undefined): string {
  const a = (style || '').toLowerCase();
  if (!a) return 'None';
  if (a.includes('eye')) return 'Eyes';
  if (a.includes('arm')) return 'Arms';
  if (a.includes('face') || a.includes('facial')) return 'Face';
  return 'Full';
}

/** Apply a canonical AvatarDefinition onto a draft (recognized values only). */
export function applyAvatarDefinition(d: AvatarDraft, def: AvatarDefinition): AvatarDraft {
  const out: AvatarDraft = { ...d };
  const gender = DEF_TO_GENDER[def.gender];
  if (gender) out.gender = gender;
  const skinIdx = parseInt((def.skin.match(/\d+/)?.[0] ?? '1'), 10) - 1;
  if (avatarOptions.skinTone[skinIdx]) out.skinTone = avatarOptions.skinTone[skinIdx];
  const headIdx = parseInt((def.head.match(/\d+/)?.[0] ?? '1'), 10) - 1;
  if (headIdx >= 0 && headIdx <= 7) out.headShapeIndex = headIdx;
  if (def.age === 'Young Adult') out.age = 24;
  else if (def.age === 'Adult') out.age = 30;
  else if (def.age === 'Mature') out.age = 40;
  if (DEF_TO_HAIR[def.hair]) out.hairStyle = DEF_TO_HAIR[def.hair];
  if (DEF_TO_EYES[def.eyes]) out.eyeColor = DEF_TO_EYES[def.eyes];
  if (DEF_TO_FACE[def.face]) out.faceShape = DEF_TO_FACE[def.face];
  if (DEF_TO_BODY[def.body]) out.bodyType = DEF_TO_BODY[def.body];
  const tats: Record<string, { style: string; count: number }> = {
    None: { style: 'none', count: 0 },
    Face: { style: 'delicate face tattoo, fine line art', count: 3 },
    Arms: { style: 'cyber-line geometric arm tattoo', count: 4 },
    Torso: { style: 'ornamental sternum mandala tattoo', count: 4 },
    Full: { style: 'blackwork full-sleeve and torso tattoo art', count: 12 }
  };
  const t = tats[def.tattoos] ?? tats.None;
  out.tattooStyle = t.style;
  out.tattoosCount = t.count;
  const aug: Record<string, string | undefined> = {
    None: undefined,
    Eyes: 'cybernetic glowing eye implants',
    Arms: 'cybernetic arm plating',
    Face: 'facial LED seam lines',
    Full: 'full cybernetic integration'
  };
  out.augmentStyle = aug[def.augmentations] ?? undefined;
  out.outfit = defToOutfit(def.outfit);
  return out;
}

/* ------------------------------------------------------------------ */
/* Definition store (keyed by Avatar ID from the options panel).       */
/* ------------------------------------------------------------------ */
const STORE_KEY = 'grok-girls-avatar-defs-v1';

function readStore(): Record<string, AvatarDefinition> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AvatarDefinition>) : {};
  } catch {
    return {};
  }
}

export function saveAvatarDefinition(id: string, def: AvatarDefinition): void {
  const store = readStore();
  store[id] = def;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota — definitions are tiny; only fails in pathological cases */
  }
}

export function loadAvatarDefinition(id: string): AvatarDefinition | null {
  return readStore()[id] ?? null;
}
