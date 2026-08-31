import type { RenderResolution } from './RenderResolution';
import type { RendererQuality } from './RendererQualityProfile';
export interface AvatarRenderSnapshot { seed:string; resolution:RenderResolution; quality:RendererQuality; rotation:number; exposure:number; timestamp:number; }
export function createAvatarRenderSnapshot(input: Omit<AvatarRenderSnapshot,'timestamp'>): AvatarRenderSnapshot { return {...input,timestamp:Date.now()}; }
export function serialiseAvatarRenderSnapshot(s:AvatarRenderSnapshot): string { return JSON.stringify(s); }
export function parseAvatarRenderSnapshot(raw:string): AvatarRenderSnapshot { const v=JSON.parse(raw) as AvatarRenderSnapshot; if(!v || typeof v.seed!=='string') throw new Error('Invalid avatar render snapshot'); return v; }
