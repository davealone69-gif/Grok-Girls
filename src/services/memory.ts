import { Girl, Memory, Mode, Room, seedGirls, buildAvatarPrompt, relationshipModifier, ADULT_OVERLAY, SAFE_OVERLAY } from '../models/studio';
import { AvatarState, statePrompt } from './avatarState';
import { StoryState, storyPrompt } from '../models/story';

const KEY = 'grok-girls-state-v2';
const DELETED_KEY = 'grok-girls-deleted-v1';

/* Only these URLs are "poison": procedural local SVG renders and blob: URLs
   (which are dead after a page reload). Real image data URLs
   (data:image/png|jpeg|webp — cloud/self-hosted renders, imported photos)
   are legitimate and must survive reloads. */
const isPoisonUrl = (u?: string) =>
  !u || u.startsWith('blob:') || u.startsWith('data:image/svg+xml');

function sanitizeGirl(g: Girl): Girl {
  const seed = seedGirls.find(s => s.id === g.id);
  const out = { ...g };
  if (isPoisonUrl(out.previewUrl)) out.previewUrl = seed?.previewUrl || undefined;
  if (isPoisonUrl(out.thumbnailUrl)) out.thumbnailUrl = seed?.thumbnailUrl || undefined;
  return out;
}

export function markPersonaDeleted(id: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]') as string[];
    const next = Array.isArray(cur) ? Array.from(new Set([...cur, id])) : [id];
    localStorage.setItem(DELETED_KEY, JSON.stringify(next));
  } catch {}
}

function loadDeleted(): Set<string> {
  try {
    const cur = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
    return new Set(Array.isArray(cur) ? cur : []);
  } catch {
    return new Set();
  }
}

export function loadGirls(fallback: Girl[]): Girl[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Girl[];
    if (!Array.isArray(parsed) || !parsed.length) return fallback;
    const cleaned = parsed.map(sanitizeGirl);
    const changed = cleaned.some(
      (g, i) => g.previewUrl !== parsed[i].previewUrl || g.thumbnailUrl !== parsed[i].thumbnailUrl
    );
    if (changed) saveGirls(cleaned);
    // Merge in seed presets the user hasn't seen yet — but never resurrect
    // personas the user deliberately deleted.
    const deleted = loadDeleted();
    const have = new Set(cleaned.map(g => g.id));
    const missing = fallback.filter(g => !have.has(g.id) && !deleted.has(g.id));
    return missing.length ? [...missing, ...cleaned] : cleaned;
  } catch {
    return fallback;
  }
}

export function saveGirls(girls: Girl[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(girls));
  } catch (e) {
    console.warn('[memory] Could not persist personas (storage full?)', e);
  }
}

export function addMemory(girls: Girl[], id: string, summary: string, detail: string, roomId?: string): Girl[] {
  const memory: Memory = { id: crypto.randomUUID?.() ?? String(Date.now()), summary, detail, roomId, importance: .45, createdAt: Date.now() };
  return girls.map(g => g.id === id ? { ...g, memories: [memory, ...g.memories].slice(0, 100), affinity: Math.min(100, g.affinity + 1), trust: Math.min(100, g.trust + .5) } : g);
}

export function contextMemories(girl: Girl, roomId?: string, limit = 6): Memory[] {
  return [...girl.memories].map(m => ({ ...m, score: m.importance + (m.roomId === roomId ? .2 : 0) + (1 / (1 + (Date.now() - m.createdAt) / 86400000)) * .3 })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
}

export function buildGenerationPrompt(girl: Girl, room: Room, prompt: string, mode: Mode, enhanced: boolean, interaction?: string, state?: AvatarState, story?: StoryState, adult = false) {
  const memories = contextMemories(girl, room.id).map(m => m.summary).join('; ');
  const dynamic = state ? ` ${statePrompt(state)}.` : '';
  const narrative = story ? ` ${storyPrompt(story)}` : '';
  const overlay = adult ? ADULT_OVERLAY : SAFE_OVERLAY;
  return `${buildAvatarPrompt(girl, room, interaction, mode, enhanced, adult)} Relationship: ${relationshipModifier(girl)}.${dynamic}${narrative} ${memories ? `Relevant memory: ${memories}.` : ''} User direction: ${prompt.trim() || 'Create a polished showcase scene'}. Content policy: ${overlay}`;
}
