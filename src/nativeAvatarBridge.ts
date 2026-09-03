import { Capacitor, registerPlugin } from '@capacitor/core';

interface AvatarStudioPlugin {
  openViewport(options?: { avatar?: string }): Promise<void>;
}

const AvatarStudio = registerPlugin<AvatarStudioPlugin>('AvatarStudio');

/**
 * On the Capacitor Android build, route the existing 3D viewport control to
 * the native GLES3 HD renderer. Browser/PWA builds keep the existing WebGL
 * renderer and are untouched.
 *
 * This is intentionally installed outside App.tsx so the large studio
 * component does not need a second platform-specific rendering branch.
 */
export function installNativeAvatarViewportBridge(): void {
  if (!Capacitor.isNativePlatform()) return;

  window.addEventListener(
    'click',
    event => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(
        'button.hud-btn[title="Interactive 3D avatar viewport"]'
      );
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void AvatarStudio.openViewport().catch(error => {
        console.error('[AvatarStudio] native HD viewport failed', error);
      });
    },
    true
  );
}
