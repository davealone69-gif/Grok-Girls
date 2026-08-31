import { deleteImage, getImageDataUrl, getImageMeta, getImageUrl, isRasterDataUrl, putImage } from './assetStore';

export interface GalleryItem {
  id: string;
  avatarId: string;
  mode: 'image' | 'video';
  prompt: string;
  assetUrl?: string;
  /** IndexedDB key for raster renders (localStorage stores metadata only) */
  assetKey?: string;
  provider: string;
  createdAt: number;
  favorite: boolean;
}

const KEY = 'grok-girls-gallery-v1';

function read(): GalleryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? (raw as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

/** Persist metadata only: image bytes live in IndexedDB under assetKey. */
export function saveGallery(items: GalleryItem[]): boolean {
  const slim = items.slice(0, 500).map(it => ({
    ...it,
    assetUrl: it.assetKey ? undefined : it.assetUrl,
    prompt: it.assetKey ? undefined : it.prompt
  }));
  try {
    localStorage.setItem(KEY, JSON.stringify(slim));
    return true;
  } catch (e) {
    console.warn('[gallery] Could not persist gallery (storage full?)', e);
    return false;
  }
}

/** True when the gallery metadata really hit localStorage. */
export function isGalleryPersisted(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/**
 * Load the gallery and hydrate every image: assetKey -> object URL, and
 * legacy base64 data URLs -> IndexedDB (one-time migration that shrinks
 * localStorage). Callers get items whose assetUrl is directly renderable.
 */
export async function loadGallery(): Promise<GalleryItem[]> {
  const items = read();
  let changed = false;
  const hydrated: GalleryItem[] = [];
  for (const it of items) {
    const out = { ...it };
    if (it.assetKey) {
      const url = await getImageUrl(it.assetKey);
      if (url) out.assetUrl = url;
      // M3: the prompt lives in the IDB record; hydrate it back and strip
      // the redundant localStorage copy once it is safely stored.
      const meta = await getImageMeta(it.assetKey);
      if (meta?.prompt != null) {
        out.prompt = String(meta.prompt);
        if (it.prompt) changed = true;
      }
    } else if (isRasterDataUrl(it.assetUrl)) {
      const key = await putImage(it.assetUrl, { prompt: it.prompt });
      if (key) {
        out.assetKey = key;
        out.assetUrl = (await getImageUrl(key)) ?? it.assetUrl;
        changed = true;
      }
    }
    hydrated.push(out);
  }
  if (changed) saveGallery(hydrated);
  return hydrated;
}

export async function addGalleryItem(
  item: Omit<GalleryItem, 'id' | 'createdAt' | 'favorite'>
): Promise<{ items: GalleryItem[]; persisted: boolean }> {
  const next: GalleryItem = {
    ...item,
    id: crypto.randomUUID?.() ?? String(Date.now()),
    createdAt: Date.now(),
    favorite: false
  };
  let out = next;
  if (isRasterDataUrl(next.assetUrl)) {
    const key = await putImage(next.assetUrl, { prompt: next.prompt });
    if (key) {
      out = { ...next, assetKey: key, assetUrl: (await getImageUrl(key)) ?? next.assetUrl };
    }
  }
  const all = [out, ...read()];
  const persisted = saveGallery(all);
  return { items: all, persisted };
}

export function toggleFavorite(id: string): GalleryItem[] {
  const all = read().map(x => (x.id === id ? { ...x, favorite: !x.favorite } : x));
  saveGallery(all);
  return all;
}

export function removeGalleryItem(id: string) {
  const cur = read();
  const victim = cur.find(x => x.id === id);
  saveGallery(cur.filter(x => x.id !== id));
  if (victim?.assetKey) void deleteImage(victim.assetKey);
}
