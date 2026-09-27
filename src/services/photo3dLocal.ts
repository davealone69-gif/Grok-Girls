import { registerPlugin } from '@capacitor/core';

interface Photo3DPlugin {
  build(opts: { image: string; name?: string; depth?: number }): Promise<{
    ok?: boolean;
    file?: string;
    bytes?: number;
    triangles?: number;
    vertices?: number;
    usedSilhouette?: boolean;
    error?: string;
  }>;
}

const Photo3DLocal = registerPlugin<Photo3DPlugin>('Photo3DLocal');

export interface Photo3DResult {
  ok: boolean;
  file: string;
  bytes: number;
  triangles: number;
  vertices: number;
  usedSilhouette: boolean;
}

export async function buildPhoto3D(
  image: string,
  name = 'grok-girls-avatar',
  depth = 0.22
): Promise<Photo3DResult> {
  if (!image || !image.startsWith('data:image/')) {
    throw new Error('3D photo generation requires a real image data URL.');
  }
  const raw = await Photo3DLocal.build({ image, name, depth });
  if (!raw.ok || !raw.file) {
    throw new Error(raw.error || 'The native 3D mesh pipeline returned no GLB.');
  }
  return {
    ok: true,
    file: raw.file,
    bytes: raw.bytes ?? 0,
    triangles: raw.triangles ?? 0,
    vertices: raw.vertices ?? 0,
    usedSilhouette: Boolean(raw.usedSilhouette)
  };
}
