export interface RenderExportOptions { width: number; height: number; mime?: 'image/png' | 'image/jpeg' | 'image/webp'; quality?: number; scale?: number; }

export async function canvasToBlob(canvas: HTMLCanvasElement, options: RenderExportOptions): Promise<Blob> {
  const scale = Math.max(0.1, Math.min(4, options.scale ?? 1));
  const w = Math.max(1, Math.round(options.width * scale));
  const h = Math.max(1, Math.round(options.height * scale));
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d'); if (!ctx) throw new Error('2D export context unavailable');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => out.toBlob(b => b ? resolve(b) : reject(new Error('Image encoding failed')), options.mime ?? 'image/png', options.quality ?? .95));
}

export async function canvasToDataUrl(canvas: HTMLCanvasElement, options: RenderExportOptions): Promise<string> {
  const blob = await canvasToBlob(canvas, options);
  return `data:${blob.type};base64,${await blobToBase64(blob)}`;
}

async function blobToBase64(blob: Blob): Promise<string> { const buffer = await blob.arrayBuffer(); let binary = ''; const bytes = new Uint8Array(buffer); const chunk = 0x8000; for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+chunk, bytes.length))); return btoa(binary); }
