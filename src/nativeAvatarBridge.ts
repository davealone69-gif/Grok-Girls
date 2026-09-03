import { Capacitor, registerPlugin } from '@capacitor/core';
import { loadAvatarDefinition, toAvatarDefinition, DEFAULT_AVATAR_DEFINITION, type AvatarDefinition } from './models/avatarDefinition';
import type { AvatarDraft } from './services/avatarCreator';

interface AvatarStudioPlugin {
  openViewport(options?: { avatar?: string; definition?: string }): Promise<void>;
}

const AvatarStudio = registerPlugin<AvatarStudioPlugin>('AvatarStudio');

/** Send the canonical editor definition to the native GLES3 HD renderer. */
export async function openNativeHdAvatar(definition: AvatarDefinition = DEFAULT_AVATAR_DEFINITION): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AvatarStudio.openViewport({ definition: JSON.stringify(definition) });
}

export function definitionForNativeAvatar(draft: AvatarDraft): AvatarDefinition {
  return toAvatarDefinition(draft);
}

export function savedDefinitionForNativeAvatar(id: string): AvatarDefinition {
  return loadAvatarDefinition(id) ?? DEFAULT_AVATAR_DEFINITION;
}

/** Route the existing 3D viewport control to the native GLES3 HD renderer. */
export function installNativeAvatarViewportBridge(): void {
  if (!Capacitor.isNativePlatform()) return;

  window.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('button.hud-btn[title="Interactive 3D avatar viewport"]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // The native activity can start immediately; the current canonical
    // definition is supplied through the event payload when available.
    void openNativeHdAvatar().catch(error => {
      console.error('[AvatarStudio] native HD viewport failed', error);
    });
  }, true);
}
