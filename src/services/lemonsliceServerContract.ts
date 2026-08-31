/** Server-side contract for the LemonSlice + LiveKit bridge.
 * This module contains types/validation only. Secrets must remain on the server.
 */
import type { LemonSliceSessionConfig } from './lemonslice';

export interface LemonSliceServerEnv {
  lemonsliceApiKey: string;
  lemonsliceApiUrl?: string;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
}

export interface LemonSliceSessionResponse {
  roomName: string;
  livekitUrl: string;
  token: string;
  provider: 'lemonslice';
  sessionId?: string;
}

export function assertServerEnv(env: LemonSliceServerEnv): void {
  for (const [name, value] of Object.entries(env)) {
    if (name !== 'lemonsliceApiUrl' && !String(value ?? '').trim()) throw new Error(`Missing server secret/config: ${name}`);
  }
}

export function sourceForProvider(config: LemonSliceSessionConfig) {
  switch (config.source.kind) {
    case 'agent': return { agent_id: config.source.agentId };
    case 'imageUrl': return { agent_image_url: config.source.imageUrl };
    case 'image': return { agent_image: config.source.image, agent_image_mime_type: config.source.mimeType ?? 'image/png' };
  }
}

/** Shape expected by a server implementation using LiveKit Agents.
 * The server should instantiate lemonslice.AvatarSession with exactly one source,
 * then call avatar.start(agentSession, room). Never expose the API key to the client.
 */
export function buildLemonSliceProviderOptions(config: LemonSliceSessionConfig) {
  return {
    ...sourceForProvider(config),
    agent_prompt: config.prompt,
    agent_idle_prompt: config.idlePrompt,
    idle_timeout: config.idleTimeout,
    avatar_participant_name: config.avatarParticipantName,
    extra_payload: config.extraPayload,
  };
}
