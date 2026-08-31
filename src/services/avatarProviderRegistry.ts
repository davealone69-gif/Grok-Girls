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
  if (selection.agentId && !capability.agentId) throw new Error(`${selection.provider} does not accept an agent ID`);
  if (selection.imageUrl && !capability.imageSource) throw new Error(`${selection.provider} does not accept an image URL`);
  if (selection.provider === 'lemonslice' && Number(Boolean(selection.agentId)) + Number(Boolean(selection.imageUrl)) !== 1) {
    throw new Error('LemonSlice requires exactly one avatar source: agent ID or image URL');
  }
  if (selection.idleTimeout != null && !Number.isFinite(selection.idleTimeout)) throw new Error('Invalid idle timeout');
}

export function selectRealtimeProvider(preferred: AvatarProviderId, hasAgentId: boolean): AvatarProviderId {
  const preferredCapability = getProvider(preferred);
  if (preferredCapability.realtime && (!hasAgentId || preferredCapability.agentId)) return preferred;
  const fallback = AVATAR_PROVIDERS.find((item) => item.realtime && (!hasAgentId || item.agentId));
  if (!fallback) throw new Error('No compatible realtime avatar provider is configured');
  return fallback.id;
}
