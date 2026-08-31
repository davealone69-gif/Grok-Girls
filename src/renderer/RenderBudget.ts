import {RENDER_RESOLUTIONS,RenderResolution} from './RenderResolution';
export interface RenderBudget { width:number;height:number;pixels:number;estimatedSamples:number; }
export function getRenderBudget(resolution:RenderResolution,samples:number):RenderBudget { const r=RENDER_RESOLUTIONS[resolution]; return {width:r.width,height:r.height,pixels:r.width*r.height,estimatedSamples:Math.max(1,Math.floor(samples))*r.width*r.height}; }
