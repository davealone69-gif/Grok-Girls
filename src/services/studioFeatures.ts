export type AspectRatio = 'square' | 'portrait' | 'landscape' | 'wide';
export type QualityPreset = 'HD' | 'QHD' | '4K';

export interface RenderPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  quality: QualityPreset;
  steps: number;
  cfg: number;
}

export const RENDER_PRESETS: RenderPreset[] = [
  { id: 'hd-square', name: 'HD Square', width: 1024, height: 1024, quality: 'HD', steps: 28, cfg: 7 },
  { id: 'hd-portrait', name: 'HD Portrait', width: 1024, height: 1536, quality: 'HD', steps: 30, cfg: 7 },
  { id: 'hd-landscape', name: 'HD Landscape', width: 1536, height: 1024, quality: 'HD', steps: 30, cfg: 7 },
  { id: 'qhd-square', name: 'QHD Square', width: 1440, height: 1440, quality: 'QHD', steps: 32, cfg: 7 },
  { id: '4k-portrait', name: '4K Portrait', width: 2160, height: 3840, quality: '4K', steps: 36, cfg: 7.5 },
  { id: '4k-landscape', name: '4K Landscape', width: 3840, height: 2160, quality: '4K', steps: 36, cfg: 7.5 },
];

export interface ScenePreset { id: string; name: string; prompt: string; negative: string; }
export const SCENE_PRESETS: ScenePreset[] = [
  { id: 'studio', name: 'Studio', prompt: 'professional studio portrait, controlled three-point lighting, realistic skin and fabric detail', negative: 'low quality, blur, bad anatomy, duplicate person' },
  { id: 'cinematic', name: 'Cinematic', prompt: 'cinematic composition, volumetric lighting, dramatic depth, filmic contrast, detailed environment', negative: 'flat lighting, oversharpening, text, watermark' },
  { id: 'neon', name: 'Neon', prompt: 'futuristic neon city atmosphere, cyan and magenta rim lighting, reflective surfaces', negative: 'muddy colors, low detail, artifacts, watermark' },
  { id: 'gothic', name: 'Gothic', prompt: 'dark gothic interior, velvet textures, moody rim light, elegant editorial photography', negative: 'cartoon, low detail, malformed hands, text' },
  { id: 'fantasy', name: 'Fantasy', prompt: 'high-detail fantasy environment, atmospheric depth, polished character concept art', negative: 'flat composition, noisy background, distorted anatomy' },
];

export function aspectSize(aspect: AspectRatio, quality: QualityPreset = 'HD'): { width: number; height: number } {
  const base = quality === '4K' ? 2160 : quality === 'QHD' ? 1440 : 1024;
  switch (aspect) {
    case 'portrait': return { width: base, height: Math.round(base * 1.5) };
    case 'landscape': return { width: Math.round(base * 1.5), height: base };
    case 'wide': return { width: Math.round(base * 1.7778), height: base };
    default: return { width: base, height: base };
  }
}

export function buildGenerationPrompt(base: string, scene?: ScenePreset, negative = '') {
  const positive = [base.trim(), scene?.prompt].filter(Boolean).join(', ');
  const negativePrompt = [scene?.negative, negative].filter(Boolean).join(', ');
  return { prompt: positive, negative: negativePrompt };
}

export function makeVariationPrompts(prompt: string, count = 4): string[] {
  const variants = ['cinematic close-up', 'three-quarter composition', 'full-body editorial composition', 'environmental portrait'];
  return Array.from({ length: Math.max(1, Math.min(count, 8)) }, (_, i) => `${prompt.trim()}, ${variants[i % variants.length]}, variation ${i + 1}`);
}

export interface GalleryItem { id: string; url: string; prompt?: string; createdAt: number; provider?: string; width?: number; height?: number; }
const GALLERY_KEY = 'grok-girls-gallery-v2';

export function loadGallery(): GalleryItem[] {
  try { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]') as GalleryItem[]; } catch { return []; }
}
export function saveGalleryItem(item: GalleryItem): GalleryItem[] {
  const items = [item, ...loadGallery()].slice(0, 500);
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(items)); } catch {}
  return items;
}
export function deleteGalleryItem(id: string): GalleryItem[] {
  const items = loadGallery().filter(x => x.id !== id);
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(items)); } catch {}
  return items;
}

export function exportGalleryJson(): string {
  return JSON.stringify({ app: 'Grok-Girls', version: 2, exportedAt: new Date().toISOString(), items: loadGallery() }, null, 2);
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadAsset(url: string, filename = `grok-girls-${Date.now()}.png`) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}

export function makeId(prefix = 'asset') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
