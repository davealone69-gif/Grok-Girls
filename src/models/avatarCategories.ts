/* ------------------------------------------------------------------ */
/* AvatarCategories — canonical category catalog (Kotlin mirror).      */
/*                                                                     */
/* Source of truth (native model):                                     */
/*   data class AvatarCategory(val id: String, val title: String,      */
/*                             val options: List<String>)              */
/*   object AvatarCategories { val all = listOf(...) }                 */
/*                                                                     */
/* Deviation (standing product rule): the Kotlin gender options        */
/* "Female / Male / Androgynous" are rendered here as                  */
/* "Female / Non-binary / Android" — male avatars are not part of      */
/* this product. Every other category mirrors the Kotlin exactly.      */
/*                                                                     */
/* The CATEGORIES dock tab renders this catalog; picking an option     */
/* applies it to the draft (see applyCategoryOption).                  */
/* ------------------------------------------------------------------ */
import type { AvatarDraft } from '../services/avatarCreator';

export interface AvatarCategory {
  id: string;
  title: string;
  options: string[];
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { id: 'gender', title: 'Gender', options: ['Female', 'Non-binary', 'Android'] },
  { id: 'skin', title: 'Skin', options: ['Tone 01', 'Tone 02', 'Tone 03', 'Tone 04', 'Tone 05', 'Tone 06'] },
  { id: 'head', title: 'Head', options: ['Head 01', 'Head 02', 'Head 03', 'Head 04'] },
  { id: 'age', title: 'Age', options: ['Young Adult', 'Adult', 'Mature'] },
  { id: 'hair', title: 'Hair', options: ['Short', 'Long', 'Ponytail', 'Braids', 'Mohawk', 'Bald'] },
  { id: 'eyes', title: 'Eyes', options: ['Natural', 'Cyber', 'Glowing', 'Heterochromia'] },
  { id: 'face', title: 'Face', options: ['Soft', 'Angular', 'Sharp', 'Custom'] },
  { id: 'body', title: 'Body', options: ['Slim', 'Athletic', 'Average', 'Heavy', 'Custom'] },
  { id: 'tattoos', title: 'Tattoos', options: ['None', 'Face', 'Arms', 'Torso', 'Full'] },
  { id: 'augmentations', title: 'Augmentations', options: ['None', 'Eyes', 'Arms', 'Face', 'Full'] },
  { id: 'outfit', title: 'Outfit', options: ['Casual', 'Street', 'Tech', 'Formal', 'Armoured'] }
];

const GENDER_APPLY: Record<string, AvatarDraft['gender']> = {
  Female: 'female',
  'Non-binary': 'nonbinary',
  Android: 'android'
};

const HAIR_APPLY: Record<string, string> = {
  Short: 'sleek straight bob',
  Long: 'long glamorous waves',
  Ponytail: 'high ponytail',
  Braids: 'twin braids with ribbon ties',
  Mohawk: 'shaved sides with mohawk crest',
  Bald: 'bald, shaved head'
};

const EYES_APPLY: Record<string, string> = {
  Natural: 'hazel',
  Cyber: 'violet neon',
  Glowing: 'ice blue',
  Heterochromia: 'heterochromatic amber and violet'
};

const FACE_APPLY: Record<string, string> = {
  Soft: 'oval',
  Angular: 'diamond',
  Sharp: 'sharp'
  // Custom: keep the current faceShape
};

const BODY_APPLY: Record<string, string> = {
  Slim: 'slim',
  Athletic: 'athletic',
  Average: 'petite',
  Heavy: 'curvy'
  // Custom: keep the current bodyType
};

const TATTOO_APPLY: Record<string, { style?: string; count: number }> = {
  None: { style: 'none', count: 0 },
  Face: { style: 'delicate face tattoo, fine line art', count: 3 },
  Arms: { style: 'cyber-line geometric arm tattoo', count: 4 },
  Torso: { style: 'ornamental sternum mandala tattoo', count: 4 },
  Full: { style: 'blackwork full-sleeve and torso tattoo art', count: 12 }
};

const AUGMENT_APPLY: Record<string, string | undefined> = {
  None: undefined,
  Eyes: 'cybernetic glowing eye implants',
  Arms: 'cybernetic arm plating',
  Face: 'facial LED seam lines',
  Full: 'full cybernetic integration'
};

const OUTFIT_APPLY: Record<string, string> = {
  Casual: 'luxury silk robe with delicate lace bralette',
  Street: 'leather crop biker jacket with lace bralette and high-waist leather pants',
  Tech: 'cyberpunk high-collar leather jacket with neon purple piping over techwear top',
  Formal: 'plunging crimson velvet evening gown',
  Armoured: 'black tactical armoured bodysuit with carbon fibre plating'
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Apply one canonical category option onto the draft. */
export function applyCategoryOption(d: AvatarDraft, categoryId: string, option: string): AvatarDraft {
  const out: AvatarDraft = { ...d };
  switch (categoryId) {
    case 'gender': {
      const g = GENDER_APPLY[option];
      if (g) out.gender = g;
      break;
    }
    case 'skin': {
      const idx = parseInt((option.match(/\d+/)?.[0] ?? '1'), 10) - 1;
      if (idx >= 0 && idx <= 5) out.skinTone = ['fair porcelain', 'pale ivory', 'light warm', 'olive', 'golden tan', 'deep bronze'][idx];
      break;
    }
    case 'head': {
      const idx = parseInt((option.match(/\d+/)?.[0] ?? '1'), 10) - 1;
      if (idx >= 0 && idx <= 3) out.headShapeIndex = idx;
      break;
    }
    case 'age':
      if (option === 'Young Adult') out.age = 24;
      else if (option === 'Adult') out.age = 30;
      else if (option === 'Mature') out.age = 40;
      break;
    case 'hair':
      if (HAIR_APPLY[option]) out.hairStyle = HAIR_APPLY[option];
      break;
    case 'eyes':
      if (EYES_APPLY[option]) out.eyeColor = EYES_APPLY[option];
      break;
    case 'face':
      if (FACE_APPLY[option]) out.faceShape = FACE_APPLY[option];
      break;
    case 'body':
      if (BODY_APPLY[option]) out.bodyType = BODY_APPLY[option];
      break;
    case 'tattoos': {
      const t = TATTOO_APPLY[option] ?? TATTOO_APPLY.None;
      out.tattooStyle = t.style;
      out.tattoosCount = t.count;
      break;
    }
    case 'augmentations':
      out.augmentStyle = AUGMENT_APPLY[option] ?? undefined;
      break;
    case 'outfit':
      out.outfit = OUTFIT_APPLY[option] ?? out.outfit;
      break;
  }
  return out;
}

/** Best-effort reverse: which canonical option is currently active. */
export function activeCategoryOption(d: AvatarDraft, categoryId: string): string {
  switch (categoryId) {
    case 'gender':
      return d.gender === 'nonbinary' ? 'Non-binary' : d.gender === 'android' ? 'Android' : 'Female';
    case 'skin': {
      const list = ['fair porcelain', 'pale ivory', 'light warm', 'olive', 'golden tan', 'deep bronze'];
      const idx = list.indexOf(d.skinTone);
      return idx >= 0 ? `Tone ${pad2(idx + 1)}` : 'Tone 01';
    }
    case 'head':
      return `Head ${pad2(Math.max(0, Math.min(3, d.headShapeIndex ?? 0)) + 1)}`;
    case 'age':
      return d.age < 25 ? 'Young Adult' : d.age < 35 ? 'Adult' : 'Mature';
    case 'hair': {
      const h = d.hairStyle.toLowerCase();
      if (h.includes('braid')) return 'Braids';
      if (h.includes('mohawk') || h.includes('undercut')) return 'Mohawk';
      if (h.includes('bald') || h.includes('shaved')) return 'Bald';
      if (h.includes('ponytail') || h.includes('bun')) return 'Ponytail';
      if (h.includes('long') || h.includes('waves') || h.includes('wet-look')) return 'Long';
      return 'Short';
    }
    case 'eyes': {
      const e = d.eyeColor.toLowerCase();
      if (e.includes('hetero')) return 'Heterochromia';
      if (e.includes('violet') || e.includes('neon') || e.includes('cybernetic')) return 'Cyber';
      if (e.includes('ice') || e.includes('glow')) return 'Glowing';
      return 'Natural';
    }
    case 'face': {
      const f = d.faceShape.toLowerCase();
      if (f === 'diamond') return 'Angular';
      if (f === 'sharp' || f === 'square') return 'Sharp';
      return 'Soft';
    }
    case 'body': {
      const b = d.bodyType.toLowerCase();
      if (b === 'athletic') return 'Athletic';
      if (b === 'slim' || b === 'petite') return 'Slim';
      if (b === 'curvy') return 'Heavy';
      return 'Average';
    }
    case 'tattoos': {
      const t = (d.tattooStyle || '').toLowerCase();
      if (!t || t === 'none') return 'None';
      if (t.includes('face')) return 'Face';
      if (t.includes('arm')) return 'Arms';
      if (t.includes('sternum') || t.includes('torso')) return 'Torso';
      return 'Full';
    }
    case 'augmentations': {
      const a = (d.augmentStyle || '').toLowerCase();
      if (!a) return 'None';
      if (a.includes('eye')) return 'Eyes';
      if (a.includes('arm')) return 'Arms';
      if (a.includes('face') || a.includes('facial')) return 'Face';
      return 'Full';
    }
    case 'outfit': {
      const o = d.outfit.toLowerCase();
      if (o.includes('armoured') || o.includes('armored')) return 'Armoured';
      if (o.includes('gown') || o.includes('dress')) return 'Formal';
      if (o.includes('cyberpunk') || o.includes('techwear')) return 'Tech';
      if (o.includes('biker') || o.includes('leather')) return 'Street';
      return 'Casual';
    }
    default:
      return '';
  }
}
