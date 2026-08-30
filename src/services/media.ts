import { GalleryItem, saveGallery } from './gallery';
import { getImageDataUrl } from './assetStore';

/** Export the gallery as JSON with real image data embedded (IndexedDB
 *  entries are resolved back to data URLs so the archive is portable). */
export async function exportGallery(items: GalleryItem[]) {
  const out: GalleryItem[] = [];
  for (const it of items) {
    const o = { ...it };
    if (it.assetKey && !o.assetUrl) {
      const dataUrl = await getImageDataUrl(it.assetKey);
      if (dataUrl) o.assetUrl = dataUrl;
    }
    delete o.assetKey;
    out.push(o);
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grok-girls-gallery-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Imported archives carry data URLs; the next loadGallery() migrates them
 *  into IndexedDB automatically. Stale assetKeys from other devices are
 *  dropped so hydration falls back gracefully. */
export function importGallery(file: File): Promise<GalleryItem[]> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        if (!Array.isArray(data)) throw new Error('Gallery file must contain an array');
        const cleaned = data.map((it: GalleryItem) => {
          const o = { ...it };
          delete o.assetKey;
          return o;
        });
        saveGallery(cleaned);
        resolve(cleaned);
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export async function downloadMedia(url: string, filename: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download HTTP ${r.status}`);
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
