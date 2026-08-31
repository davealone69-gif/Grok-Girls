export type AvatarProviderId = 'lemonslice' | 'did' | 'liveavatar' | 'runway';

export interface AvatarProviderCapability {
  id: AvatarProviderId;
  realtime: boolean;
  imageSource: boolean;
  agentId: boolean;
  liveMedia: boolean;
}

export const AVATAR_PROVIDERS: readonly AvatarProviderCapability[] = [
  { id: 'lemonslice', realtime: true, imageSource: true, agentId: true, liveMedia: true },
  { id: 'did', realtime: true, imageSource: true, agentId: false, liveMedia: true },
  { id: 'liveavatar', realtime: true, imageSource: false, agentId: true, liveMedia: true },
  { id: 'runway', realtime: false, imageSource: true, agentId: false, liveMedia: false },
];

export interface AvatarProviderSelection {
  provider: AvatarProviderId;
  agentId?: string;
  imageUrl?: string;
  prompt?: string;
  idlePrompt?: string;
  idleTimeout?: number;
}

export function getProvider(id: AvatarProviderId): AvatarProviderCapability {
  const provider = AVATAR_PROVIDERS.find((item) => item.id === id);
  if (!provider) throw new Error(`Unsupported avatar provider: ${id}`);
  return provider;
}

export function validateProviderSelection(selection: AvatarProviderSelection): void {
  const capability = getProvider(selection.provider);
  const hasAgentId = Boolean(selection.agentId?.trim());
  const hasImageUrl = Boolean(selection.imageUrl?.trim());

  if (hasAgentId && hasImageUrl) {
    throw new Error('Choose exactly one avatar source: agent ID or image URL');
  }
  if (!hasAgentId && !hasImageUrl) {
    throw new Error('An avatar source is required');
  }
  if (hasAgentId && !capability.agentId) {
    throw new Error(`${selection.provider} does not accept an agent ID`);
  }
  if (hasImageUrl && !capability.imageSource) {
    throw new Error(`${selection.provider} does not accept an image URL`);
  }
  if (hasImageUrl) {
    const url = new URL(selection.imageUrl!);
    if (url.protocol !== 'https:') throw new Error('Avatar image URL must use HTTPS');
  }
  if (selection.idleTimeout != null && (!Number.isFinite(selection.idleTimeout) || selection.idleTimeout < 0)) {
    throw new Error('Invalid idle timeout');
  }
}

export function selectRealtimeProvider(
  preferred: AvatarProviderId,
  hasAgentId: boolean,
  hasImageSource = !hasAgentId,
): AvatarProviderId {
  const supportsSource = (capability: AvatarProviderCapability) =>
    (hasAgentId && capability.agentId) || (!hasAgentId && hasImageSource && capability.imageSource);

  const preferredCapability = getProvider(preferred);
  if (preferredCapability.realtime && supportsSource(preferredCapability)) return preferred;

  const fallback = AVATAR_PROVIDERS.find(
    (item) => item.realtime && supportsSource(item),
  );
  if (!fallback) throw new Error('No compatible realtime avatar provider is configured for the selected source');
  return fallback.id;
}
