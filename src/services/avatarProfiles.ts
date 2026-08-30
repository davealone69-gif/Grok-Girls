export interface AvatarProfile { id: string; name: string; description: string; appearance: Record<string, string>; tags: string[]; createdAt: number; updatedAt: number; }
const KEY = 'grok-girls-avatars-v2';
export function createAvatar(name = 'New Avatar'): AvatarProfile { const now = Date.now(); return { id: `avatar-${now}-${Math.random().toString(36).slice(2, 7)}`, name, description: '', appearance: {}, tags: [], createdAt: now, updatedAt: now }; }
export function saveAvatar(avatar: AvatarProfile): void { let all = loadAvatars().filter(a => a.id !== avatar.id); all.unshift({ ...avatar, updatedAt: Date.now() }); localStorage.setItem(KEY, JSON.stringify(all.slice(0, 250))); }
export function loadAvatars(): AvatarProfile[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
export function deleteAvatar(id: string): void { localStorage.setItem(KEY, JSON.stringify(loadAvatars().filter(a => a.id !== id))); }
export function duplicateAvatar(id: string): AvatarProfile | undefined { const source = loadAvatars().find(a => a.id === id); if (!source) return; const copy = { ...source, id: `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `${source.name} Copy`, createdAt: Date.now(), updatedAt: Date.now(), appearance: { ...source.appearance }, tags: [...source.tags] }; saveAvatar(copy); return copy; }
export function avatarPrompt(a: AvatarProfile): string { return [a.description, ...Object.entries(a.appearance).map(([k,v]) => `${k}: ${v}`), a.tags.join(', ')].filter(Boolean).join(', '); }
