/* ------------------------------------------------------------------ */
/* avatarSpec — structured avatar/scene command vocabulary.            */
/*                                                                     */
/* Converts plain-language spec values produced by an LLM (Hermes)     */
/* into validated edits:                                               */
/*   hair=… hairColor=… body=… eyes=… makeup=… outfit=…                */
/*   scene=… lighting=… pose=…                                         */
/*                                                                     */
/* Two validated lanes, both backed by the canonical catalog:          */
/*   • canonical categories (gender/skin/head/age/hair/eyes/face/      */
/*     body/tattoos/augmentations/outfit) — value must resolve to a    */
/*     canonical option value via the catalog (exact option, rich      */
/*     token, or canonicalizer keyword); applied through the VM's      */
/*     setOption dispatcher.                                           */
/*   • rich draft fields (hairColor, makeupStyle, lipstickShade, …) —  */
/*     value must resolve to a member of the single-home vocab in      */
/*     avatarOptions (exact or a unique catalog-token match).          */
/*   • lighting — validated against the viewport lighting modes.       */
/* Anything that fails validation is rejected with its reason; it      */
/* never touches the avatar.                                           */
/* ------------------------------------------------------------------ */

import type { AvatarDraft } from './avatarCreator';
import { avatarOptions } from './avatarCreator';
import { categorySpec, canonicalValueOf } from '../models/avatarCatalog';

export type LightingMode = 'noir' | 'studio' | 'full' | 'bust' | 'wireframe';

export interface CanonicalSpecEdit {
  category: string;
  value: string;
}
export interface DraftSpecEdit {
  draftKey: keyof AvatarDraft;
  value: string;
}
export interface AvatarSpecResult {
  canonical: CanonicalSpecEdit[];
  draft: DraftSpecEdit[];
  lighting: LightingMode | null;
  applied: string[];
  rejected: { field: string; value: string; reason: string }[];
}

type Lane = { kind: 'canonical'; category: string; draftKey?: keyof AvatarDraft } | { kind: 'draft'; draftKey: keyof AvatarDraft } | { kind: 'lighting' };

/* Every field an LLM may emit, with accepted aliases. */
const FIELD_ALIASES: Record<string, Lane> = {
  // canonical category lanes (outfit additionally accepts the full rich
  // outfit vocabulary used by the accordion panels, see below)
  gender: { kind: 'canonical', category: 'gender' },
  skin: { kind: 'canonical', category: 'skin' },
  skinTone: { kind: 'canonical', category: 'skin' },
  head: { kind: 'canonical', category: 'head' },
  age: { kind: 'canonical', category: 'age' },
  hair: { kind: 'canonical', category: 'hair' },
  hairStyle: { kind: 'canonical', category: 'hair' },
  eyes: { kind: 'canonical', category: 'eyes' },
  eyeColor: { kind: 'canonical', category: 'eyes' },
  face: { kind: 'canonical', category: 'face' },
  faceShape: { kind: 'canonical', category: 'face' },
  body: { kind: 'canonical', category: 'body' },
  bodyType: { kind: 'canonical', category: 'body' },
  tattoos: { kind: 'canonical', category: 'tattoos' },
  augments: { kind: 'canonical', category: 'augmentations' },
  outfit: { kind: 'canonical', category: 'outfit', draftKey: 'outfit' },
  // rich draft lanes
  hairColor: { kind: 'draft', draftKey: 'hairColor' },
  makeup: { kind: 'draft', draftKey: 'makeupStyle' },
  makeupStyle: { kind: 'draft', draftKey: 'makeupStyle' },
  lipstick: { kind: 'draft', draftKey: 'lipstickShade' },
  brows: { kind: 'draft', draftKey: 'browShape' },
  eyeShape: { kind: 'draft', draftKey: 'eyeShape' },
  pose: { kind: 'draft', draftKey: 'pose' },
  expression: { kind: 'draft', draftKey: 'expression' },
  scene: { kind: 'draft', draftKey: 'chairSetting' },
  choker: { kind: 'draft', draftKey: 'chokerStyle' },
  hosiery: { kind: 'draft', draftKey: 'hosieryStyle' },
  // lighting (viewport render pass)
  lighting: { kind: 'lighting' }
};

const LIGHTING_MODES: LightingMode[] = ['noir', 'studio', 'full', 'bust', 'wireframe'];

/** Draft vocab arrays that contain a 'none'/off sentinel (skip it when the
 *  value itself is a real choice). */
const DRAFT_VOCAB = new Map<keyof AvatarDraft, readonly string[]>([
  ['hairColor', avatarOptions.hairColor],
  ['makeupStyle', avatarOptions.makeupStyle],
  ['lipstickShade', avatarOptions.lipstickShade],
  ['browShape', avatarOptions.browShape],
  ['eyeShape', avatarOptions.eyeShape],
  ['pose', avatarOptions.pose],
  ['expression', avatarOptions.expression],
  ['chairSetting', avatarOptions.chairSetting],
  ['chokerStyle', avatarOptions.chokerStyle],
  ['hosieryStyle', avatarOptions.hosieryStyle],
  ['outfit', avatarOptions.outfit]
]);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Match a raw value to a vocab member: exact (case-insensitive) first,
 *  then a unique token-overlap match (every significant raw token must
 *  appear in the member, longest member wins). */
export function matchVocab(vocab: readonly string[], raw: string): string | null {
  const value = norm(raw);
  if (!value) return null;
  const exact = vocab.find(v => norm(v) === value);
  if (exact) return exact;
  const tokens = value.split(/\W+/).filter(t => t.length >= 3);
  if (!tokens.length) return null;
  const hits = vocab.filter(v => {
    const words = new Set(norm(v).split(/\W+/).filter(Boolean));
    return tokens.every(t => [...words].some(w => w.includes(t) || t.includes(w)));
  });
  if (hits.length === 1) return hits[0];
  // tolerate partial for very distinctive values: choose the longest member
  // matching at least half the tokens, only when unambiguous.
  const partial = vocab
    .map(v => {
      const words = new Set(norm(v).split(/\W+/).filter(Boolean));
      const matched = tokens.filter(t => [...words].some(w => w.includes(t) || t.includes(w))).length;
      return { v, score: matched / tokens.length };
    })
    .filter(x => x.score >= 0.5 && x.score < 1)
    .sort((a, b) => b.score - a.score);
  if (partial.length === 1 && partial[0].score >= 0.5) return partial[0].v;
  return null;
}

/** Canonical category lanes: resolve a plain value to a canonical option
 *  value using the catalog (exact canonical, exact rich token, numeric
 *  rich, or the canonicalizer's keyword fallback for hair). */
export function canonicalOptionFor(category: string, raw: string): { canonical: string } | { error: string } {
  const spec = categorySpec(category);
  if (!spec) return { error: `unknown category "${category}"` };
  const value = norm(raw);
  if (!value) return { error: 'empty value' };

  // 1) exact canonical value
  const exact = spec.options.find(o => norm(o.value) === value || String(o.value).toLowerCase() === value);
  if (exact) return { canonical: exact.value };

  // 2) exact rich token (string or numeric)
  for (const o of spec.options) {
    const rich = o.rich;
    if (typeof rich === 'string' && norm(rich) === value) return { canonical: o.value };
    if (typeof rich === 'number' && String(rich) === value) return { canonical: o.value };
  }

  // 3) hair keyword fallback through the canonicalizer (long/ponytail/
  //    braids/mohawk/bald/waves…) — only when the value contains a known
  //    hair keyword so an unknown phrase can never silently become "Short".
  if (category === 'hair') {
    const kws = /braid|mohawk|shaved|bald|ponytail|bun|long|short|pixie|bob|waves|undercut|wet/;
    if (kws.test(value)) {
      const probe = { hairStyle: raw } as unknown as AvatarDraft;
      const canonical = canonicalValueOf('hair', probe);
      const rich = spec.options.find(o => o.value === canonical)?.rich;
      if (canonical && rich) return { canonical };
    }
    return { error: `no catalog hair style matches "${raw}"` };
  }
  return { error: `no catalog ${category} option matches "${raw}"` };
}

function resolveLighting(raw: string): LightingMode | null {
  const value = norm(raw);
  const direct = LIGHTING_MODES.find(m => m === value);
  if (direct) return direct;
  if (/noir|moody|dark|dramatic/.test(value)) return 'noir';
  if (/studio|clean|bright/.test(value)) return 'studio';
  if (/full|bright|white/i.test(value) && !/studio/.test(value)) return 'full';
  if (/bust/.test(value)) return 'bust';
  if (/wire/.test(value)) return 'wireframe';
  return null;
}

/** Validate + normalize one spec object into lane edits. */
export function normalizeAvatarSpec(spec: Record<string, unknown>): AvatarSpecResult {
  const canonical: CanonicalSpecEdit[] = [];
  const draft: DraftSpecEdit[] = [];
  const rejected: AvatarSpecResult['rejected'] = [];
  const applied: string[] = [];
  let lighting: LightingMode | null = null;

  for (const [alias, rawValue] of Object.entries(spec)) {
    const lane = FIELD_ALIASES[alias];
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!lane) {
      if (value) rejected.push({ field: alias, value, reason: 'unknown field' });
      continue;
    }
    if (!value) {
      rejected.push({ field: alias, value: '', reason: 'empty value' });
      continue;
    }
    if (lane.kind === 'canonical') {
      const res = canonicalOptionFor(lane.category, value);
      if ('canonical' in res) {
        canonical.push({ category: lane.category, value: res.canonical });
        applied.push(`${alias}=${res.canonical}`);
      } else if (lane.category === 'outfit' && lane.draftKey) {
        // Canonical casual set has no match — fall back to the full rich
        // outfit vocabulary (the single home the accordion panels use).
        const vocab = DRAFT_VOCAB.get(lane.draftKey);
        const match = vocab ? matchVocab(vocab, value) : null;
        if (match) {
          draft.push({ draftKey: lane.draftKey, value: match });
          applied.push(`${alias}=${match}`);
        } else {
          rejected.push({ field: alias, value, reason: res.error });
        }
      } else {
        rejected.push({ field: alias, value, reason: res.error });
      }
    } else if (lane.kind === 'draft') {
      const vocab = DRAFT_VOCAB.get(lane.draftKey);
      if (!vocab) {
        rejected.push({ field: alias, value, reason: 'no vocabulary' });
        continue;
      }
      const match = matchVocab(vocab, value);
      if (match) {
        draft.push({ draftKey: lane.draftKey, value: match });
        applied.push(`${alias}=${match}`);
      } else {
        rejected.push({ field: alias, value, reason: `not in ${String(lane.draftKey)} catalog` });
      }
    } else {
      const mode = resolveLighting(value);
      if (mode) {
        lighting = mode;
        applied.push(`lighting=${mode}`);
      } else {
        rejected.push({ field: alias, value, reason: 'unknown lighting mode' });
      }
    }
  }
  return { canonical, draft, lighting, applied, rejected };
}

/** Parse a raw JSON spec (or a JSON object found after the 🧬 marker). */
export function parseAvatarSpecJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
