import { registerPlugin, Capacitor } from '@capacitor/core';

interface TripoSRPlugin {
  startServer(opts?: { timeoutMs?: number }): Promise<{ started?: boolean; method?: string; message?: string }>;
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
