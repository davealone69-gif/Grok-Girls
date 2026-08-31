/** Server contract for /api/avatar/lemonslice/session.
 * This file intentionally contains no provider secret or API-key handling.
 */
export interface LemonSliceBackendEnvironment {
  LEMONSLICE_API_KEY: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
}

export interface LemonSliceProviderRequest {
  provider: 'lemonslice';
  source:
    | { agentId: string }
    | { imageUrl: string }
    | { image: Blob; mimeType: string };
  agentPrompt?: string;
  agentIdlePrompt?: string;
  idleTimeout?: number;
  avatarParticipantName?: string;
  extraPayload?: Record<string, unknown>;
}

export interface LemonSliceProviderSession {
  sessionId: string;
  roomName: string;
  livekitUrl: string;
  livekitToken: string;
}

/**
 * Provider-side mapping:
 * agentId -> AvatarSession({ agentId })
 * imageUrl -> AvatarSession({ agentImageUrl })
 * image -> AvatarSession({ agentImage, agentImageMimeType })
 *
 * The actual LemonSlice API key belongs only in the backend worker.
 */
export const LEMONSLICE_ENDPOINT = 'https://lemonslice.com/api/liveai/sessions';
