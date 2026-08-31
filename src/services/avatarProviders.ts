export type AvatarProviderId = 'lemonslice' | 'did' | 'liveavatar' | 'runway';

export type AvatarSource =
  | { kind: 'agentId'; agentId: string }
  | { kind: 'imageUrl'; imageUrl: string }
  | { kind: 'imageBuffer'; image: ArrayBuffer; mimeType: string };

export interface AvatarProviderConfig {
  provider: AvatarProviderId;
  source: AvatarSource;
  prompt?: string;
  idlePrompt?: string;
  idleTimeout?: number;
  participantIdentity?: string;
  participantName?: string;
  extraPayload?: Record<string, unknown>;
}

export interface AvatarProviderCapabilities {
  realtime: boolean;
  imageSource: boolean;
  agentId: boolean;
  audioVideo: boolean;
  liveConversation: boolean;
}

export const AVATAR_PROVIDER_CAPABILITIES: Record<AvatarProviderId, AvatarProviderCapabilities> = {
  lemonslice: { realtime: true, imageSource: true, agentId: true, audioVideo: true, liveConversation: true },
  did: { realtime: true, imageSource: true, agentId: true, audioVideo: true, liveConversation: true },
  liveavatar: { realtime: true, imageSource: false, agentId: true, audioVideo: true, liveConversation: true },
  runway: { realtime: false, imageSource: true, agentId: false, audioVideo: true, liveConversation: false }
};

export function validateAvatarProviderConfig(config: AvatarProviderConfig): void {
  if (!config.provider) throw new Error('Avatar provider is required');
  const source = config.source;
  if (!source) throw new Error('Exactly one avatar source is required');
  if (source.kind === 'agentId' && !source.agentId.trim()) throw new Error('Avatar agent ID cannot be empty');
  if (source.kind === 'imageUrl') {
    const url = new URL(source.imageUrl);
    if (url.protocol !== 'https:') throw new Error('Avatar image URL must use HTTPS');
  }
  if (source.kind === 'imageBuffer' && source.image.byteLength === 0) throw new Error('Avatar image is empty');
  if (config.idleTimeout != null && !Number.isFinite(config.idleTimeout)) throw new Error('Invalid idle timeout');
  const caps = AVATAR_PROVIDER_CAPABILITIES[config.provider];
  if (source.kind === 'agentId' && !caps.agentId) throw new Error(`${config.provider} does not support agent IDs`);
  if (source.kind !== 'agentId' && !caps.imageSource) throw new Error(`${config.provider} does not support custom image sources`);
}

export function toLemonSliceOptions(config: AvatarProviderConfig): Record<string, unknown> {
  if (config.provider !== 'lemonslice') throw new Error('Not a LemonSlice configuration');
  validateAvatarProviderConfig(config);
  const source = config.source;
  const options: Record<string, unknown> = {};
  if (source.kind === 'agentId') options.agentId = source.agentId;
  if (source.kind === 'imageUrl') options.agentImageUrl = source.imageUrl;
  if (source.kind === 'imageBuffer') options.agentImage = source.image;
  if (source.kind === 'imageBuffer') options.agentImageMimeType = source.mimeType;
  if (config.prompt) options.agentPrompt = config.prompt;
  if (config.idlePrompt) options.agentIdlePrompt = config.idlePrompt;
  if (config.idleTimeout != null) options.idleTimeout = config.idleTimeout;
  if (config.participantIdentity) options.avatarParticipantIdentity = config.participantIdentity;
  if (config.participantName) options.avatarParticipantName = config.participantName;
  if (config.extraPayload) options.extraPayload = config.extraPayload;
  return options;
}
