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
/*                                                                     */
/* Every mapping between the rich draft and the canonical vocabulary   */
/* is delegated to the master catalog (models/avatarCatalog.ts) — no   */
/* option tables live here.                                            */
/* ------------------------------------------------------------------ */
import type { AvatarDraft } from '../services/avatarCreator';
import {
  AVATAR_CATEGORY_SPECS,
  applyCategoryOption,
  canonicalValueOf,
  CanonicalCategoryId
} from './avatarCatalog';

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

export const AVATAR_DEFINITION_FIELDS: CanonicalCategoryId[] = [
  'gender', 'skin', 'head', 'age', 'hair', 'eyes',
  'face', 'body', 'tattoos', 'augmentations', 'outfit'
];

/** Exactly the Kotlin data-class defaults (from the master catalog). */
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

export function defaultDefinitionValue(field: CanonicalCategoryId): string {
  return AVATAR_CATEGORY_SPECS.find(s => s.id === field)?.defaultValue ?? '';
}

/** Map the rich UI draft onto the canonical AvatarDefinition. */
export function toAvatarDefinition(d: AvatarDraft): AvatarDefinition {
  return {
    gender: canonicalValueOf('gender', d),
    skin: canonicalValueOf('skin', d),
    head: canonicalValueOf('head', d),
    age: canonicalValueOf('age', d),
    hair: canonicalValueOf('hair', d),
    eyes: canonicalValueOf('eyes', d),
    face: canonicalValueOf('face', d),
    body: canonicalValueOf('body', d),
    tattoos: canonicalValueOf('tattoos', d),
    augmentations: canonicalValueOf('augmentations', d),
    outfit: canonicalValueOf('outfit', d)
  };
}

/** Apply a canonical AvatarDefinition onto a draft (recognized values only). */
export function applyAvatarDefinition(d: AvatarDraft, def: AvatarDefinition): AvatarDraft {
  let out: AvatarDraft = { ...d };
  for (const field of AVATAR_DEFINITION_FIELDS) {
    const value = def[field];
    if (typeof value !== 'string') continue;
    const known = AVATAR_CATEGORY_SPECS.some(
      s => s.id === field && s.options.some(o => o.value === value)
    );
    if (!known) continue; // unknown value: no-op (mirrors the Kotlin `when`)
    out = applyCategoryOption(out, field, value);
  }
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
