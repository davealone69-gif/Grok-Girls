import type { AvatarDesignConfig } from './AvatarDesignConfig';
import type { HdAvatarRenderer } from './HdAvatarRenderer';

/** Connects the canonical avatar design state to the HD renderer without coupling UI state to GL. */
export interface AvatarDesignHost {
  design: AvatarDesignConfig;
  renderer: HdAvatarRenderer;
}

export function applyAvatarDesign(host: AvatarDesignHost): void {
  const { design, renderer } = host;
  const anyRenderer = renderer as unknown as {
    setAvatarDesign?: (value: AvatarDesignConfig) => void;
    setSeed?: (value: number) => void;
    setQuality?: (value: AvatarDesignConfig['quality']) => void;
  };

  anyRenderer.setAvatarDesign?.(design);
  anyRenderer.setSeed?.(design.seed);
  anyRenderer.setQuality?.(design.quality);
}
