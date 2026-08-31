import { diceBearUrl, type DiceBearStyleConfig } from './dicebearStyle';

export type AvatarSource =
  | { agentId: string }
  | { agentImageUrl: string }
  | { agentImage: Blob | ArrayBuffer };

export interface AvatarSessionRequest {
  source: AvatarSource;
  prompt?: string;
  idlePrompt?: string;
  idleTimeout?: number;
  participantName?: string;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AvatarSessionResponse {
  livekitUrl: string;
  token: string;
  roomName?: string;
  participantIdentity?: string;
  expiresAt?: number;
}

export interface AvatarSessionClientOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export function avatarSourceFromDiceBear(config: DiceBearStyleConfig): AvatarSource {
  return { agentImageUrl: diceBearUrl(config) };
}

function assertSource(source: AvatarSource) {
  const keys = ['agentId', 'agentImageUrl', 'agentImage'] as const;
  const count = keys.reduce((n, key) => n + (key in source ? 1 : 0), 0);
  if (count !== 1) throw new Error('Avatar session requires exactly one source: agentId, agentImageUrl, or agentImage.');
}

export async function createAvatarSession(
  request: AvatarSessionRequest,
  options: AvatarSessionClientOptions,
): Promise<AvatarSessionResponse> {
  assertSource(request.source);
  if (!options.endpoint) throw new Error('Avatar session endpoint is not configured.');

  const body = new FormData();
  if ('agentId' in request.source) body.set('agentId', request.source.agentId);
  if ('agentImageUrl' in request.source) body.set('agentImageUrl', request.source.agentImageUrl);
  if ('agentImage' in request.source) {
    const value = request.source.agentImage instanceof Blob
      ? request.source.agentImage
      : new Blob([request.source.agentImage], { type: 'image/png' });
    body.set('agentImage', value, 'avatar.png');
  }
  if (request.prompt) body.set('prompt', request.prompt);
  if (request.idlePrompt) body.set('idlePrompt', request.idlePrompt);
  if (request.idleTimeout != null) body.set('idleTimeout', String(request.idleTimeout));
  if (request.participantName) body.set('participantName', request.participantName);
  if (request.metadata) body.set('metadata', JSON.stringify(request.metadata));

  const response = await (options.fetchImpl ?? fetch)(options.endpoint, {
    method: 'POST',
    body,
    signal: request.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Avatar session failed (${response.status}): ${text || response.statusText}`);
  }
  const data = await response.json() as Partial<AvatarSessionResponse>;
  if (!data.livekitUrl || !data.token) throw new Error('Avatar session response is missing LiveKit credentials.');
  return data as AvatarSessionResponse;
}
