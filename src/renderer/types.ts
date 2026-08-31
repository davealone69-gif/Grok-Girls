/* Types mirroring the native renderer package (renderer/*.kt). */

export interface RenderConfig {
  width?: number; // explicit size (legacy path)
  height?: number;
  /* ---- native RenderConfig v2 (com.example.hdrenderer) ---- */
  resolution?: RenderResolution; // default FULL_HD
  renderScale?: number; // default 1.0
  enableDepth?: boolean; // default true
  enableMsaa?: boolean; // default true (web: canvas antialias)
  msaaSamples?: number; // default 4
  /* enableHdr/enableBloom are the native names for hdr/bloom */
  enableHdr?: boolean; // default false
  enableBloom?: boolean; // default false
  hdr?: boolean;
  bloom?: boolean;
  shadows?: boolean;
  samples?: number;
  background?: [number, number, number];
  seed?: number;
}

/** width/height getters of the native RenderConfig:
 *  (resolution.width * renderScale).toInt().coerceAtLeast(1) */
export function configSize(cfg: RenderConfig): { width: number; height: number } {
  if (cfg.resolution) {
    const base = RENDER_RESOLUTIONS[cfg.resolution];
    const scale = cfg.renderScale ?? 1;
    return {
      width: Math.max(1, Math.trunc(base.width * scale)),
      height: Math.max(1, Math.trunc(base.height * scale))
    };
  }
  return { width: cfg.width ?? 1920, height: cfg.height ?? 1920 };
}

export interface Material {
  baseColor?: [number, number, number];
  metallic?: number;
  roughness?: number;
  emissive?: [number, number, number];
  emissiveIntensity?: number;
  opacity?: number;
  bloom?: boolean;
}

export interface Light {
  kind: 'directional' | 'point';
  direction?: [number, number, number];
  position?: [number, number, number];
  color?: [number, number, number];
  intensity?: number;
}

export interface Camera {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
  fovDeg?: number;
}

export interface Mesh {
  /** packed [x,y,z, nx,ny,nz, u,v] */
  data: Float32Array;
  /** triangle indices */
  indices: Uint32Array;
  indexCount: number;
  material?: Material;
}

import { RenderResolution, RENDER_RESOLUTIONS } from './RenderResolution';

export interface Scene {
  meshes: Mesh[];
  lights?: Light[];
  camera: Camera;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  pngDataUrl: string;
  width: number;
  height: number;
  ms: number;
}

export function hex(c: [number, number, number]): [number, number, number] {
  return c;
}
