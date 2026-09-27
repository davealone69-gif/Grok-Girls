import { registerPlugin } from '@capacitor/core';

interface VknnPlugin {
  status(): Promise<{
    nativeLoaded?: boolean;
    nativeError?: string;
    modelPresent?: boolean;
    modelBytes?: number;
    modelFile?: string;
    modelUrl?: string;
    message?: string;
  }>;
  downloadModel(): Promise<{ ok?: boolean; file?: string; bytes?: number; error?: string }>;
  probeModel(): Promise<{ ok?: boolean; error?: string; message?: string; gaussians?: number; views?: number; width?: number; height?: number }>;
  addListener(
    event: 'downloadProgress',
    cb: (data: { done: number; total: number; fraction: number }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const Vknn3D = registerPlugin<VknnPlugin>('Vknn3D');

export async function vknn3dStatus() {
  return Vknn3D.status();
}

export async function downloadVknn3DModel(
  onProgress?: (fraction: number, done: number, total: number) => void
): Promise<{ file: string; bytes: number }> {
  const listener = onProgress
    ? await Vknn3D.addListener('downloadProgress', p => onProgress(p.fraction, p.done, p.total))
    : null;
  try {
    const result = await Vknn3D.downloadModel();
    if (!result.ok || !result.file) throw new Error(result.error || 'VKNN model download failed.');
    return { file: result.file, bytes: result.bytes ?? 0 };
  } finally {
    await listener?.remove().catch(() => undefined);
  }
}

export async function probeVknn3DModel() {
  const result = await Vknn3D.probeModel();
  if (!result.ok) throw new Error(result.error || result.message || 'VKNN YoNoSplat probe failed.');
  return result;
}
