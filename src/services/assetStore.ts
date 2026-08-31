/* ------------------------------------------------------------------ */
/* IndexedDB-backed image store.                                       */
/* Renders and persona photos are too big for localStorage's ~5MB      */
/* quota (one 1024px PNG is 1.5-2.5MB of base64) — a handful of        */
/* renders used to silently stop persisting. IndexedDB gives us        */
/* hundreds of MB and stores binary Blobs without base64 overhead.     */
/* If IndexedDB is unavailable the callers fall back to keeping the    */
/* data URL in localStorage (old behaviour).                           */
/* ------------------------------------------------------------------ */

const DB_NAME = 'grok-girls-assets';
const DB_VERSION = 1;
const STORE = 'images';

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** assetKey -> object URL cache so the UI can reuse <img src>s */
const urlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** True for base64 raster images (the ones that blow the localStorage quota). */
export function isRasterDataUrl(u: string | undefined | null): u is string {
  return !!u && /^data:image\/(png|jpe?g|webp|gif)/i.test(u);
}

/** Record shape: { blob, meta } since the M3 sweep. Records written by the
 *  original R1 store hold a bare Blob — readers unwrap both shapes. */
interface StoredRecord {
  blob: Blob;
  meta?: Record<string, unknown>;
}

/** Store an image (with optional metadata such as its prompt) and return its
 *  key. Null when IndexedDB is unavailable. */
export async function putImage(dataUrl: string, meta?: Record<string, unknown>): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const key = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob, meta }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return key;
  } catch {
    return null;
  }
}

async function getStored(key: string): Promise<StoredRecord | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    });
    if (!raw) return null;
    if (raw instanceof Blob) return { blob: raw }; // legacy R1 record
    const rec = raw as StoredRecord;
    return rec.blob instanceof Blob ? rec : null;
  } catch {
    return null;
  }
}

/** Resolve an assetKey to a usable object URL (cached per session). */
export async function getImageUrl(key: string | undefined): Promise<string | null> {
  if (!key) return null;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const rec = await getStored(key);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(key, url);
  return url;
}

/** Resolve an assetKey back to a data URL (for JSON exports). */
export async function getImageDataUrl(key: string | undefined): Promise<string | null> {
  if (!key) return null;
  const rec = await getStored(key);
  if (!rec) return null;
  return await new Promise<string | null>(resolve => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(rec.blob);
  });
}

export async function deleteImage(key: string | undefined): Promise<void> {
  if (!key) return;
  const cached = urlCache.get(key);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(key);
  }
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* orphaned blobs are harmless */
  }
}


/** Metadata stored alongside an image (e.g. the generation prompt). */
export async function getImageMeta(key: string | undefined): Promise<Record<string, unknown> | null> {
  if (!key) return null;
  const rec = await getStored(key);
  return rec?.meta ?? null;
}
