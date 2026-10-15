import { registerPlugin, Capacitor } from '@capacitor/core';

export const HUNYUAN3D_DEFAULT_BASE = 'http://127.0.0.1:8081';

interface HunyuanPlugin {
  status(opts: { base: string; timeoutMs?: number }): Promise<{ ok?: boolean; message?: string; generationStatus?: string; generationVerified?: boolean }>;
  generate(opts: {
    base: string;
    image: string;
    texture?: boolean;
    seed?: number;
    octreeResolution?: number;
    steps?: number;
    timeoutMs?: number;
  }): Promise<{ ok?: boolean; file?: string; bytes?: number; format?: string; error?: string }>;
}

const Hunyuan3DLocal = registerPlugin<HunyuanPlugin>('Hunyuan3DLocal');

export interface HunyuanStatus {
  ok: boolean;
  base: string;
  message: string;
  generationStatus: 'not_tested' | 'verified' | 'failed' | 'unknown';
  generationVerified: boolean;
}

function native(): boolean {
  return Capacitor.isNativePlatform();
}

export async function hunyuan3dStatus(base = HUNYUAN3D_DEFAULT_BASE): Promise<HunyuanStatus> {
  if (!native()) {
    return {
      ok: false,
      base,
      message: '3D worker status is unavailable in the browser. Android worker connectivity and real generation remain unverified.',
      generationStatus: 'not_tested',
      generationVerified: false
    };
  }
  try {
    const r = await Hunyuan3DLocal.status({ base });
    const generationStatus = r.generationStatus === 'verified' || r.generationStatus === 'failed'
      ? r.generationStatus
      : r.generationStatus === 'not_tested' ? 'not_tested' : 'unknown';
    return {
      ok: !!r.ok,
      base,
      message: r.message || (r.ok
        ? '3D worker responds; generation is not verified until a real job returns a valid GLB.'
        : '3D worker unavailable.'),
      generationStatus,
      generationVerified: r.generationVerified === true && generationStatus === 'verified'
    };
  } catch (e) {
    return {
      ok: false,
      base,
      message: e instanceof Error ? e.message : String(e),
      generationStatus: 'unknown',
      generationVerified: false
    };
  }
}

export async function generateHunyuan3D(
  image: string,
  opts: {
    base?: string;
    texture?: boolean;
    seed?: number;
    octreeResolution?: number;
    steps?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ file: string; bytes: number }> {
  if (!native()) throw new Error('Hunyuan3D GLB generation is Android-native only.');
  const base = opts.base || HUNYUAN3D_DEFAULT_BASE;
  const r = await Hunyuan3DLocal.generate({
    base,
    image,
    texture: opts.texture ?? true,
    seed: opts.seed ?? 1234,
    octreeResolution: opts.octreeResolution ?? 256,
    steps: opts.steps ?? 5,
    timeoutMs: opts.timeoutMs ?? 1800000
  });
  if (!r.ok || !r.file) throw new Error(r.error || 'Hunyuan3D worker returned no GLB.');
  return { file: r.file, bytes: r.bytes || 0 };
}
