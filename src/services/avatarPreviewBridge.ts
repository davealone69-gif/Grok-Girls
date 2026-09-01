import { avatarSourceFromDiceBear } from './avatarLiveSession';
import {
  ADVENTURER_NEUTRAL,
  type DiceBearStyleDefinition,
  type DiceBearRenderOptions,
  diceBearUrl
} from './dicebearStyle';

export interface PlaygroundAvatarState {
  seed: string;
  styleId?: string;
  background?: string;
  scale?: number;
  radius?: number;
  flip?: boolean;
  size?: number;
}

export function toDiceBearDefinition(state: PlaygroundAvatarState): DiceBearStyleDefinition {
  // Currently only Adventurer Neutral is shipped; keep the mapping data-driven
  // so additional styles can be added without changing callers.
  return state.styleId && state.styleId !== ADVENTURER_NEUTRAL.id
    ? { ...ADVENTURER_NEUTRAL, id: state.styleId, name: state.styleId }
    : ADVENTURER_NEUTRAL;
}

export function toDiceBearRenderOptions(state: PlaygroundAvatarState): DiceBearRenderOptions {
  return {
    seed: state.seed,
    size: state.size,
    backgroundColor: state.background,
    scale: state.scale,
    flip: state.flip,
    radius: state.radius
  };
}

export function toAvatarSessionSource(state: PlaygroundAvatarState) {
  const definition = toDiceBearDefinition(state);
  // avatarSourceFromDiceBear expects a full definition; diceBearUrl is applied inside.
  return avatarSourceFromDiceBear(definition);
}

export function playgroundPreviewUrl(state: PlaygroundAvatarState): string {
  return diceBearUrl(toDiceBearDefinition(state), toDiceBearRenderOptions(state));
}
