import { Capacitor, registerPlugin } from '@capacitor/core';
import { addGalleryItem } from './services/gallery';

interface AvatarStudioPlugin {
  openViewport(options?: { avatar?: string; definition?: string }): Promise<void>;
  renderImage(options?: {
    avatar?: string;
    definition?: string;
    width?: number;
    height?: number;
  }): Promise<{ dataUrl: string; width: number; height: number }>;
}

const AvatarStudio = registerPlugin<AvatarStudioPlugin>('AvatarStudio');
const DEFAULT_AVATAR = 'avatars/my_avatar.glb';

type WindowWithGrokBridge = Window & {
  __grokGirlsVm?: { get?: () => Record<string, string> };
};

function currentDefinition(): Record<string, string> {
  try {
    const value = (window as WindowWithGrokBridge).__grokGirlsVm?.get?.();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export async function openNativeHdAvatar(definition = currentDefinition()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AvatarStudio.openViewport({
    avatar: DEFAULT_AVATAR,
    definition: JSON.stringify(definition)
  });
}

export async function renderNativeHdAvatar(
  definition = currentDefinition(),
  width = 1920,
  height = 1080
): Promise<{ url: string; width: number; height: number }> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native HD renderer is only available in the Android app');
  }
  const result = await AvatarStudio.renderImage({
    avatar: DEFAULT_AVATAR,
    definition: JSON.stringify(definition),
    width,
    height
  });
  return { url: result.dataUrl, width: result.width, height: result.height };
}

function installNativeActions(): void {
  if (!Capacitor.isNativePlatform()) return;

  window.addEventListener(
    'click',
    event => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button) return;
      const title = button.getAttribute('title') || '';
      const isNativeRender =
        title === 'On-device HD renderer' ||
        button.classList.contains('native-hd') ||
        button.classList.contains('native-generate');
      if (!isNativeRender) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.disabled) return;
      button.disabled = true;

      void (async () => {
        try {
          const definition = currentDefinition();
          const rendered = await renderNativeHdAvatar(definition, 1920, 1080);
          await addGalleryItem({
            avatarId: definition.gender || 'native-hd',
            mode: 'image',
            prompt: `NATIVE HD RENDER · ${definition.gender} · ${definition.skin} · ${definition.hair} · ${definition.outfit}`,
            assetUrl: rendered.url,
            provider: 'hdrenderer'
          });
          window.dispatchEvent(new CustomEvent('grok-native-hd-complete', { detail: rendered }));
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent('grok-native-hd-error', {
              detail: error instanceof Error ? error.message : String(error)
            })
          );
        } finally {
          button.disabled = false;
        }
      })();
    },
    true
  );
}

installNativeActions();
