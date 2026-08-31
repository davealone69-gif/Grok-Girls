import type { AvatarProviderSelection } from './avatarProviderRegistry';
import { validateProviderSelection } from './avatarProviderRegistry';

export interface LemonSliceSessionPolicy {
  maxIdleSeconds: number;
  maxPromptLength: number;
  allowedImageProtocols: readonly string[];
}

export const DEFAULT_LEMONSLICE_POLICY: LemonSliceSessionPolicy = {
  maxIdleSeconds: 3600,
  maxPromptLength: 2000,
  allowedImageProtocols: ['https:'],
};

export function validateLemonSliceSession(
  selection: AvatarProviderSelection,
  policy: LemonSliceSessionPolicy = DEFAULT_LEMONSLICE_POLICY,
): void {
  validateProviderSelection(selection);
  if (selection.provider !== 'lemonslice') throw new Error('LemonSlice policy received a different provider');
  if (selection.agentId && selection.agentId.length > 256) throw new Error('Agent ID is too long');
  for (const prompt of [selection.prompt, selection.idlePrompt]) {
    if (prompt && prompt.length > policy.maxPromptLength) throw new Error('Avatar prompt is too long');
  }
  if (selection.idleTimeout != null && (selection.idleTimeout < -1 || selection.idleTimeout > policy.maxIdleSeconds)) {
    throw new Error('Idle timeout is outside the permitted range');
  }
  if (selection.imageUrl) {
    const url = new URL(selection.imageUrl);
    if (!policy.allowedImageProtocols.includes(url.protocol)) throw new Error('Avatar image URL must use HTTPS');
  }
}
