/* Types mirroring the native renderer package (renderer/*.kt). */

export interface RenderConfig {
  width?: number; // default 1920
  height?: number; // default 1920
  hdr?: boolean; // float framebuffer (default true)
  shadows?: boolean; // 2-cascade shadow map (default true)
  bloom?: boolean; // post bloom pass (default true)
  samples?: number; // render pass count, blended (default 3)
  background?: [number, number, number];
  seed?: number;
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
