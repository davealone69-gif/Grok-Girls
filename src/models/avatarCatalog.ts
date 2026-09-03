/* ------------------------------------------------------------------ */
/* AvatarCatalog — the ONE master avatar option catalog.              */
/*                                                                     */
/* Canonical categories mirror the Kotlin data model. Every canonical  */
/* value, rich draft representative, exact rich->canonical mapping and */
/* keyword fallback rule lives HERE — nowhere else. Consumers:         */
/*                                                                     */
/*   models/avatarCategories.ts  -> AVATAR_CATEGORIES + apply/active   */
/*   models/avatarDefinition.ts  -> to/applyAvatarDefinition + default */
/*   services/avatarCreator.ts   -> avatarOptions (rich vocab for the  */
/*                                   six canonical-tied lists)         */
/*                                                                     */
/* Drift eliminated by construction: a canonical option's rich         */
/* representative IS the string that applyAvatarDefinition writes and  */
/* that canonicalValueOf() reads back — a single table per category.   */
/* ------------------------------------------------------------------ */

import type { AvatarDraft } from '../services/avatarCreator';

/* ---------------------------------------------------------- rich lists
 * The rich (AI-prompt) vocabularies for the canonical-tied categories.
 * avatarOptions.* in avatarCreator re-exports these — one home. */

export const GENDER_RICH = ['female', 'nonbinary', 'android'] as const;

export const BODY_RICH = [
  'hourglass', 'curvy', 'petite', 'slim', 'athletic'
];

export const EYE_RICH = [
  'dark brown', 'ruby red', 'hazel', 'emerald green', 'violet neon', 'ice blue', 'gray'
];

export const FACE_RICH = ['oval', 'heart', 'diamond', 'sharp', 'round', 'square'];

export const HAIR_RICH = [
  'layered waves bob',
  'cyber undercut with side sweep',
  'long glamorous waves',
  'sleek straight bob',
  'high ponytail',
  'messy bun with wisps',
  'asymmetric pixie crop',
  'wet-look waves'
];

export const SKIN_RICH = [
  'fair porcelain', 'pale ivory', 'light warm', 'olive',
  'golden tan', 'deep bronze', 'rich espresso', 'cybernetic pale'
];

/* --------------------------------------------------- canonical option
 * Per-category spec: display order/default, the canonical option list,
 * apply() (canonical value -> rich draft side effects) and
 * canonicalValueOf() (rich draft field -> canonical value).
 * Options whose representative is not part of the rich list above
 * (e.g. 'twin braids with ribbon ties') are canonical-only literals —
 * they exist in exactly one copy: here. */

export type CanonicalCategoryId =
  | 'gender' | 'skin' | 'head' | 'age' | 'hair' | 'eyes'
  | 'face' | 'body' | 'tattoos' | 'augmentations' | 'outfit';

export interface CanonicalOption {
  value: string;
  /** rich representative / draft side-effect payload */
  rich?: string | number | { style?: string; count: number } | undefined;
}

export interface CategorySpec {
  id: CanonicalCategoryId;
  title: string;
  options: CanonicalOption[];
  /** first option is not always the default (age default = Adult) */
  defaultValue: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const genderOptions: CanonicalOption[] = GENDER_RICH.map(g => ({
  value: g === 'female' ? 'Female' : g === 'nonbinary' ? 'Non-binary' : 'Android',
  rich: g
}));

const skinOptions: CanonicalOption[] = SKIN_RICH.map((tone, i) => ({
  value: `Tone ${pad2(i + 1)}`,
  rich: tone
}));

const headOptions: CanonicalOption[] = Array.from({ length: 8 }, (_, i) => ({
  value: `Head ${pad2(i + 1)}`,
  rich: i
}));

const ageOptions: CanonicalOption[] = [
  { value: 'Young Adult', rich: 24 },
  { value: 'Adult', rich: 30 },
  { value: 'Mature', rich: 40 }
];

const hairOptions: CanonicalOption[] = [
  { value: 'Short', rich: 'sleek straight bob' },
  { value: 'Long', rich: 'long glamorous waves' },
  { value: 'Ponytail', rich: 'high ponytail' },
  { value: 'Braids', rich: 'twin braids with ribbon ties' },
  { value: 'Mohawk', rich: 'shaved sides with mohawk crest' },
  { value: 'Bald', rich: 'bald, shaved head' }
];

const eyesOptions: CanonicalOption[] = [
  { value: 'Natural', rich: 'hazel' },
  { value: 'Cyber', rich: 'violet neon' },
  { value: 'Glowing', rich: 'ice blue' },
  { value: 'Heterochromia', rich: 'heterochromatic amber and violet' }
];

const faceOptions: CanonicalOption[] = [
  { value: 'Soft', rich: 'oval' },
  { value: 'Angular', rich: 'diamond' },
  { value: 'Sharp', rich: 'sharp' },
  { value: 'Custom' } // keep current faceShape
];

const bodyOptions: CanonicalOption[] = [
  { value: 'Slim', rich: 'slim' },
  { value: 'Athletic', rich: 'athletic' },
  { value: 'Average', rich: 'petite' },
  { value: 'Heavy', rich: 'curvy' },
  { value: 'Custom' } // keep current bodyType
];

const tattoosOptions: CanonicalOption[] = [
  { value: 'None', rich: { style: 'none', count: 0 } },
  { value: 'Face', rich: { style: 'delicate face tattoo, fine line art', count: 3 } },
  { value: 'Arms', rich: { style: 'cyber-line geometric arm tattoo', count: 4 } },
  { value: 'Torso', rich: { style: 'ornamental sternum mandala tattoo', count: 4 } },
  { value: 'Full', rich: { style: 'blackwork full-sleeve and torso tattoo art', count: 12 } }
];

const augmentOptions: CanonicalOption[] = [
  { value: 'None', rich: undefined },
  { value: 'Eyes', rich: 'cybernetic glowing eye implants' },
  { value: 'Arms', rich: 'cybernetic arm plating' },
  { value: 'Face', rich: 'facial LED seam lines' },
  { value: 'Full', rich: 'full cybernetic integration' }
];

const outfitOptions: CanonicalOption[] = [
  { value: 'Casual', rich: 'luxury silk robe with delicate lace bralette' },
  { value: 'Street', rich: 'leather crop biker jacket with lace bralette and high-waist leather pants' },
  { value: 'Tech', rich: 'cyberpunk high-collar leather jacket with neon purple piping over techwear top' },
  { value: 'Formal', rich: 'plunging crimson velvet evening gown' },
  { value: 'Armoured', rich: 'black tactical armoured bodysuit with carbon fibre plating' }
];

export const AVATAR_CATEGORY_SPECS: CategorySpec[] = [
  { id: 'gender', title: 'Gender', options: genderOptions, defaultValue: 'Female' },
  { id: 'skin', title: 'Skin', options: skinOptions, defaultValue: 'Tone 01' },
  { id: 'head', title: 'Head', options: headOptions, defaultValue: 'Head 01' },
  { id: 'age', title: 'Age', options: ageOptions, defaultValue: 'Adult' },
  { id: 'hair', title: 'Hair', options: hairOptions, defaultValue: 'Short' },
  { id: 'eyes', title: 'Eyes', options: eyesOptions, defaultValue: 'Natural' },
  { id: 'face', title: 'Face', options: faceOptions, defaultValue: 'Soft' },
  { id: 'body', title: 'Body', options: bodyOptions, defaultValue: 'Average' },
  { id: 'tattoos', title: 'Tattoos', options: tattoosOptions, defaultValue: 'None' },
  { id: 'augmentations', title: 'Augmentations', options: augmentOptions, defaultValue: 'None' },
  { id: 'outfit', title: 'Outfit', options: outfitOptions, defaultValue: 'Casual' }
];

export interface AvatarCategory {
  id: string;
  title: string;
  options: string[];
}

/** Display catalog for the dock CATEGORIES panel (value-only lists). */
export const AVATAR_CATEGORIES: AvatarCategory[] = AVATAR_CATEGORY_SPECS.map(s => ({
  id: s.id,
  title: s.title,
  options: s.options.map(o => o.value)
}));

export function categorySpec(id: string): CategorySpec | undefined {
  return AVATAR_CATEGORY_SPECS.find(s => s.id === id);
}

/* ------------------------------------------------------------- apply
 * Canonical option -> rich draft side effects (used by the categories
 * panel AND by applyAvatarDefinition — one implementation). */

export function applyCategoryOption(d: AvatarDraft, categoryId: string, option: string): AvatarDraft {
  const spec = categorySpec(categoryId);
  if (!spec) return d;
  const opt = spec.options.find(o => o.value === option);
  if (!opt || !('rich' in opt)) return d; // unknown / Custom (no representative)

  const out: AvatarDraft = { ...d };
  switch (categoryId) {
    case 'gender': out.gender = opt.rich as AvatarDraft['gender']; break;
    case 'skin': out.skinTone = opt.rich as string; break;
    case 'head': out.headShapeIndex = opt.rich as number; break;
    case 'age': out.age = opt.rich as number; break;
    case 'hair': out.hairStyle = opt.rich as string; break;
    case 'eyes': out.eyeColor = opt.rich as string; break;
    case 'face': out.faceShape = opt.rich as string; break;
    case 'body': out.bodyType = opt.rich as string; break;
    case 'tattoos': {
      const t = opt.rich as { style?: string; count: number };
      out.tattooStyle = t.style;
      out.tattoosCount = t.count;
      break;
    }
    case 'augmentations': out.augmentStyle = opt.rich as string | undefined; break;
    case 'outfit': out.outfit = opt.rich as string; break;
  }
  return out;
}

/* ------------------------------------------------- canonicalValueOf
 * Rich draft field -> canonical value. Representative-first (so a
 * canonical apply always round-trips to itself), then exact rich table,
 * then keyword fallback for freeform values. */

function hairToCanonical(rich: string | undefined): string {
  const r = (rich || '').trim().toLowerCase();
  if (!r) return 'Short';
  // exact rich vocabulary + canonical representatives
  const exact: Record<string, string> = {
    'layered waves bob': 'Short',
    'cyber undercut with side sweep': 'Mohawk',
    'long glamorous waves': 'Long',
    'sleek straight bob': 'Short',
    'high ponytail': 'Ponytail',
    'messy bun with wisps': 'Ponytail',
    'asymmetric pixie crop': 'Short',
    'wet-look waves': 'Long',
    'twin braids with ribbon ties': 'Braids',
    'shaved sides with mohawk crest': 'Mohawk',
    'bald, shaved head': 'Bald'
  };
  const hit = exact[r];
  if (hit) return hit;
  if (r.includes('braid')) return 'Braids';
  if (r.includes('mohawk') || r.includes('undercut')) return 'Mohawk';
  if (r.includes('bald') || r.includes('shaved')) return 'Bald';
  if (r.includes('ponytail') || r.includes('bun')) return 'Ponytail';
  if (r.includes('long') || r.includes('waves') || r.includes('wet-look')) return 'Long';
  return 'Short';
}

function bodyToCanonical(rich: string | undefined): string {
  const r = (rich || '').trim().toLowerCase();
  // representative-first so canonical reps round-trip
  if (r === 'slim') return 'Slim';
  if (r === 'athletic') return 'Athletic';
  if (r === 'petite') return 'Average'; // rep of Average (was mis-mapped to Slim)
  if (r === 'curvy') return 'Heavy';
  if (r === 'hourglass') return 'Average';
  return 'Average';
}

function faceToCanonical(rich: string | undefined): string {
  const r = (rich || '').trim().toLowerCase();
  if (r === 'oval' || r === 'heart' || r === 'round') return 'Soft';
  if (r === 'diamond') return 'Angular';
  if (r === 'sharp' || r === 'square') return 'Sharp';
  return 'Soft';
}

function eyesToCanonical(rich: string | undefined): string {
  const r = (rich || '').trim().toLowerCase();
  // representative-first
  if (r === 'hazel') return 'Natural';
  if (r === 'violet neon' || r === 'cybernetic pale') return 'Cyber';
  if (r === 'ice blue') return 'Glowing';
  if (r === 'heterochromatic amber and violet' || r.includes('hetero')) return 'Heterochromia';
  if (r === 'dark brown' || r === 'gray') return 'Natural';
  if (r === 'ruby red' || r === 'emerald green') return 'Glowing';
  return 'Natural';
}

const skinToCanonical = (rich: string | undefined): string => {
  const idx = SKIN_RICH.indexOf((rich || '').trim().toLowerCase());
  return `Tone ${pad2(Math.max(0, idx) + 1)}`; // unknown -> Tone 01
};

const headToCanonical = (idx: number | undefined): string => {
  const i = Math.max(0, Math.min(7, Math.round(idx ?? 0)));
  return `Head ${pad2(i + 1)}`;
};

const ageToCanonical = (age: number | undefined): string => {
  if (age !== undefined && age < 25) return 'Young Adult';
  if (age !== undefined && age < 35) return 'Adult';
  return 'Mature';
};

const genderToCanonical = (g: AvatarDraft['gender'] | undefined): string =>
  g === 'nonbinary' ? 'Non-binary' : g === 'android' ? 'Android' : 'Female';

const tattoosToCanonical = (style: string | undefined): string => {
  const t = (style || '').trim().toLowerCase();
  if (!t || t === 'none') return 'None';
  // representative-first so canonical applies round-trip (Full's rep string
  // contains "torso" and must not be re-read as Torso)
  const reps: Record<string, string> = {
    'delicate face tattoo, fine line art': 'Face',
    'cyber-line geometric arm tattoo': 'Arms',
    'ornamental sternum mandala tattoo': 'Torso',
    'blackwork full-sleeve and torso tattoo art': 'Full'
  };
  const hit = reps[t];
  if (hit) return hit;
  if (t.includes('face')) return 'Face';
  if (t.includes('arm')) return 'Arms';
  if (t.includes('sternum') || t.includes('torso')) return 'Torso';
  return 'Full';
};

const augmentToCanonical = (style: string | undefined): string => {
  const a = (style || '').trim().toLowerCase();
  if (!a || a === 'none') return 'None';
  const reps: Record<string, string> = {
    'cybernetic glowing eye implants': 'Eyes',
    'cybernetic arm plating': 'Arms',
    'facial led seam lines': 'Face',
    'full cybernetic integration': 'Full'
  };
  const hit = reps[a];
  if (hit) return hit;
  if (a.includes('eye')) return 'Eyes';
  if (a.includes('arm')) return 'Arms';
  if (a.includes('face') || a.includes('facial')) return 'Face';
  return 'Full';
};

const outfitToCanonical = (outfit: string | undefined): string => {
  const o = (outfit || '').trim().toLowerCase();
  const reps: Record<string, string> = {
    'luxury silk robe with delicate lace bralette': 'Casual',
    'leather crop biker jacket with lace bralette and high-waist leather pants': 'Street',
    'cyberpunk high-collar leather jacket with neon purple piping over techwear top': 'Tech',
    'plunging crimson velvet evening gown': 'Formal',
    'black tactical armoured bodysuit with carbon fibre plating': 'Armoured'
  };
  const hit = reps[o];
  if (hit) return hit;
  if (o.includes('armoured') || o.includes('armored')) return 'Armoured';
  if (o.includes('gown') || o.includes('dress')) return 'Formal';
  if (o.includes('cyberpunk') || o.includes('techwear')) return 'Tech';
  if (o.includes('biker') || o.includes('leather')) return 'Street';
  return 'Casual';
};

/** Rich draft -> canonical value for one category. */
export function canonicalValueOf(categoryId: string, d: AvatarDraft): string {
  switch (categoryId) {
    case 'gender': return genderToCanonical(d.gender);
    case 'skin': return skinToCanonical(d.skinTone);
    case 'head': return headToCanonical(d.headShapeIndex);
    case 'age': return ageToCanonical(d.age);
    case 'hair': return hairToCanonical(d.hairStyle);
    case 'eyes': return eyesToCanonical(d.eyeColor);
    case 'face': return faceToCanonical(d.faceShape);
    case 'body': return bodyToCanonical(d.bodyType);
    case 'tattoos': return tattoosToCanonical(d.tattooStyle);
    case 'augmentations': return augmentToCanonical(d.augmentStyle);
    case 'outfit': return outfitToCanonical(d.outfit);
    default: return '';
  }
}

/** Which canonical option is currently active for a category (dock UI). */
export function activeCategoryOption(d: AvatarDraft, categoryId: string): string {
  return canonicalValueOf(categoryId, d);
}
