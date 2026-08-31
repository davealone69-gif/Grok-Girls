import { avatarSourceFromDiceBear } from './avatarLiveSession';
import type { DiceBearStyleConfig } from './dicebearStyle';

export interface PlaygroundAvatarState {
  seed: string;
  style?: DiceBearStyleConfig['style'];
  eyebrows?: number;
  eyes?: number;
  glasses?: number;
  mouth?: number;
  background?: string;
  scale?: number;
  radius?: number;
  flip?: boolean;
  size?: number;
}

export function toDiceBearConfig(state: PlaygroundAvatarState): DiceBearStyleConfig {
  return {
    style: state.style ?? 'adventurer-neutral',
    seed: state.seed,
    eyebrows: state.eyebrows,
    eyes: state.eyes,
    glasses: state.glasses,
    mouth: state.mouth,
    background: state.background,
    scale: state.scale,
    radius: state.radius,
    flip: state.flip,
    size: state.size,
  };
}

export function toAvatarSessionSource(state: PlaygroundAvatarState) {
  return avatarSourceFromDiceBear(toDiceBearConfig(state));
}
