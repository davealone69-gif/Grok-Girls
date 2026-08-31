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
  hourglass: 'Curvy',
  curvy: 'Curvy',
  petite: 'Slim',
  slim: 'Slim',
  athletic: 'Average'
};
const DEF_TO_BODY: Record<string, string> = {
  Slim: 'slim',
  Average: 'athletic',
  Curvy: 'hourglass'
};

const FACE_TO_DEF: Record<string, string> = {
  oval: 'Soft',
  heart: 'Soft',
  round: 'Soft',
  diamond: 'Sharp',
  sharp: 'Sharp',
  square: 'Sharp'
};
const DEF_TO_FACE: Record<string, string> = { Soft: 'oval', Sharp: 'sharp' };

const HAIR_TO_DEF: Record<string, string> = {
  'layered waves bob': 'Short',
  'cyber undercut with side sweep': 'Short',
  'long glamorous waves': 'Long',
  'sleek straight bob': 'Short',
  'high ponytail': 'Updo',
  'messy bun with wisps': 'Updo',
  'asymmetric pixie crop': 'Short',
  'wet-look waves': 'Long'
};
const DEF_TO_HAIR: Record<string, string> = {
  Short: 'sleek straight bob',
  Long: 'long glamorous waves',
  Updo: 'high ponytail'
};

const EYES_TO_DEF: Record<string, string> = {
  'dark brown': 'Natural',
  hazel: 'Natural',
  gray: 'Natural',
  'ruby red': 'Vivid',
  'emerald green': 'Vivid',
  'ice blue': 'Vivid',
  'violet neon': 'Cyber',
  'cybernetic pale': 'Cyber'
};
const DEF_TO_EYES: Record<string, string> = {
  Natural: 'hazel',
  Vivid: 'ruby red',
  Cyber: 'violet neon'
};

function outfitToDef(outfit: string): string {
  const o = outfit.toLowerCase();
  if (o.includes('nude') || o.includes('torn')) return 'Nude';
  if (o.includes('corset') || o.includes('lingerie') || o.includes('bustier') || o.includes('bodysuit')) return 'Lingerie';
  if (o.includes('cyber') || o.includes('techwear') || o.includes('leather')) return 'Cyber';
  if (o.includes('gothic')) return 'Gothic';
  return 'Casual';
}
function defToOutfit(def: string): string {
  switch (def) {
    case 'Lingerie': return avatarOptions.outfit[0];
    case 'Cyber': return avatarOptions.outfit[1];
    case 'Gothic': return avatarOptions.outfit[7];
    case 'Nude': return avatarOptions.outfit[8];
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
    tattoos: !d.tattooStyle || d.tattooStyle === 'none'
      ? 'None'
      : (d.tattoosCount ?? 0) > 0 ? cap(d.tattooStyle) : 'None',
    augmentations: d.augmentStyle ? cap(d.augmentStyle) : 'None',
    outfit: outfitToDef(d.outfit)
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  if (def.tattoos === 'None') {
    out.tattooStyle = undefined;
    out.tattoosCount = 0;
  } else if (def.tattoos !== 'Ink') {
    out.tattooStyle = def.tattoos.toLowerCase();
    out.tattoosCount = Math.max(1, out.tattoosCount ?? 3);
  }
  if (def.augmentations === 'None') out.augmentStyle = undefined;
  else out.augmentStyle = def.augmentations.toLowerCase();
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
