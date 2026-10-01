import { registerPlugin, Capacitor } from '@capacitor/core';

interface TripoSRPlugin {
  startServer(opts?: { timeoutMs?: number }): Promise<{ started?: boolean; method?: string; message?: string }>;
  generate(opts: {
    image: string;
    removeBackground?: boolean;
    texture?: boolean;
    mcResolution?: number;
    timeoutMs?: number;
  }): Promise<{
    ok?: boolean;
    glbBase64?: string;
    bytes?: number;
    engine?: string;
    seconds?: string;
    error?: string;
  }>;
}

const TripoSRLocal = registerPlugin<TripoSRPlugin>('TripoSRLocal');

export async function ensureTripoSRRunning(): Promise<{ ok: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'TripoSR worker requires the Android app.' };
  try {
    const r = await TripoSRLocal.startServer({ timeoutMs: 12000 });
    return { ok: !!r.started, message: r.message || (r.started ? 'TripoSR worker ready.' : 'TripoSR worker unavailable.') };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export interface TripoSRResult {
  ok: true;
  glbDataUrl: string;
  bytes: number;
  engine: string;
  seconds?: number;
}

/**
 * Real image -> GLB generation through the local TripoSR worker.
 * The returned GLB is the actual binary emitted by TripoSR, not a placeholder mesh.
 */
export async function generateTripoSR(
  image: string,
  options: {
    removeBackground?: boolean;
    texture?: boolean;
    mcResolution?: number;
    timeoutMs?: number;
  } = {}
): Promise<TripoSRResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('TripoSR generation requires the Android app.');
  }
  if (!image.startsWith('data:image/')) {
    throw new Error('TripoSR generation requires a real image data URL.');
  }

  const ready = await ensureTripoSRRunning();
  if (!ready.ok) throw new Error(ready.message);

  const r = await TripoSRLocal.generate({
    image,
    removeBackground: options.removeBackground ?? true,
    texture: options.texture ?? false,
    mcResolution: options.mcResolution ?? 192,
    timeoutMs: options.timeoutMs ?? 1800000
  });

  if (!r.ok || !r.glbBase64) {
    throw new Error(r.error || 'TripoSR completed without returning a GLB.');
  }

  return {
    ok: true,
    glbDataUrl: `data:model/gltf-binary;base64,${r.glbBase64}`,
    bytes: r.bytes ?? 0,
    engine: r.engine ?? 'triposr',
    seconds: r.seconds ? Number(r.seconds) : undefined
  };
}
