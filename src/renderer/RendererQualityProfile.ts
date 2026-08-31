export type RendererQuality = 'preview' | 'high' | 'ultra';
export interface RendererQualityProfile { quality: RendererQuality; scale: number; shadowMap: number; samples: number; bloom: boolean; dof: boolean; taa: boolean; hdr: boolean; }
export const RENDERER_QUALITY_PROFILES: Record<RendererQuality, RendererQualityProfile> = {
  preview: { quality:'preview', scale:.5, shadowMap:1024, samples:1, bloom:false, dof:false, taa:false, hdr:false },
  high: { quality:'high', scale:1, shadowMap:2048, samples:2, bloom:true, dof:true, taa:true, hdr:true },
  ultra: { quality:'ultra', scale:1, shadowMap:4096, samples:4, bloom:true, dof:true, taa:true, hdr:true }
};
export function getRendererQualityProfile(q: RendererQuality='high'): RendererQualityProfile { return RENDERER_QUALITY_PROFILES[q] ?? RENDERER_QUALITY_PROFILES.high; }
