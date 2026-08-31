import type { AvatarDesign } from './AvatarDesign';
import type { HdAvatarRenderer } from './HdAvatarRenderer';

/** Connects the canonical avatar design state to the HD renderer without coupling UI state to GL. */
export interface AvatarDesignHost {
  design: AvatarDesign;
  renderer: HdAvatarRenderer;
}

export function applyAvatarDesign(host: AvatarDesignHost): void {
  const { design, renderer } = host;
  const anyRenderer = renderer as unknown as {
    setAvatarDesign?: (value: AvatarDesign) => void;
    setSeed?: (value: number) => void;
    setQuality?: (value: AvatarDesign['quality']) => void;
  };

  anyRenderer.setAvatarDesign?.(design);
  anyRenderer.setSeed?.(design.seed);
  anyRenderer.setQuality?.(design.quality);
}
