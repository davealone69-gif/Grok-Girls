import type { Girl } from '../models/studio';

const KEY = 'grok-girls-avatar-editor-v1';

export const avatarOptions = {
  bodyType: ['petite', 'slim', 'athletic', 'curvy', 'hourglass'],
  eyeColor: ['blue', 'green', 'brown', 'hazel', 'gray'],
  eyeShape: ['almond', 'round', 'hooded', 'upturned'],
  faceShape: ['oval', 'heart', 'round', 'square', 'diamond'],
  hairColor: ['black', 'brown', 'blonde', 'auburn', 'red', 'white'],
  hairStyle: ['short', 'bob', 'long straight', 'long waves', 'ponytail', 'braids'],
  skinTone: ['fair', 'light', 'medium', 'tan', 'dark', 'deep', 'olive'],
  pose: ['standing', 'sitting', 'three-quarter', 'walking', 'casual'],
  expression: ['calm', 'happy', 'curious', 'thoughtful', 'confident'],
  outfit: ['casual streetwear', 'evening fashion', 'studio fashion', 'athleisure', 'formal wear']
};

export function saveAvatar(g: Girl): boolean {
  try {
    localStorage.setItem(`${KEY}:${g.id}`, JSON.stringify(g));
    return true;
  } catch (e) {
    console.warn('[avatar] could not persist avatar (storage full?)', e);
    return false;
  }
}

export function loadAvatar(id: string): Girl | null {
  try {
    const raw = localStorage.getItem(`${KEY}:${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Girl;
  } catch {
    return null;
  }
}

export function listSavedAvatarIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${KEY}:`)) ids.push(k.slice(KEY.length + 1));
    }
  } catch {}
  return ids;
}

export function deleteAvatar(id: string): void {
  try {
    localStorage.removeItem(`${KEY}:${id}`);
  } catch {}
}
