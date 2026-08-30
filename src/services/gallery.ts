export interface GalleryItem {
  id: string;
  avatarId: string;
  mode: 'image' | 'video';
  prompt: string;
  assetUrl?: string;
  provider: string;
  createdAt: number;
  favorite: boolean;
}

const KEY = 'grok-girls-gallery-v1';

export function loadGallery(): GalleryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? (raw as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveGallery(items: GalleryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 500)));
  } catch (e) {
    console.warn('[gallery] Could not persist gallery (storage full?)', e);
  }
}

export function addGalleryItem(item: Omit<GalleryItem, 'id' | 'createdAt' | 'favorite'>): GalleryItem[] {
  const next = { ...item, id: crypto.randomUUID?.() ?? String(Date.now()), createdAt: Date.now(), favorite: false };
  const all = [next, ...loadGallery()];
  saveGallery(all);
  return all;
}

export function toggleFavorite(id: string): GalleryItem[] {
  const all = loadGallery().map(x => (x.id === id ? { ...x, favorite: !x.favorite } : x));
  saveGallery(all);
  return all;
}

export function removeGalleryItem(id: string) {
  saveGallery(loadGallery().filter(x => x.id !== id));
}
