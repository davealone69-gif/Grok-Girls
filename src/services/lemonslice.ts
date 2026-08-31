/** LemonSlice realtime avatar adapter.
 * API keys stay server-side. The browser receives only a LiveKit token/room
 * from the application's own backend.
 *
 * LemonSlice supports exactly one avatar source per session: agentId,
 * agentImageUrl, or an in-memory image. See LiveKit's LemonSlice integration.
 */
export type LemonSliceSource =
  | { kind: 'agent'; agentId: string }
  | { kind: 'imageUrl'; imageUrl: string }
  | { kind: 'image'; image: Blob; mimeType?: string };

export interface LemonSliceSessionConfig {
  source: LemonSliceSource;
  prompt?: string;
  idlePrompt?: string;
  idleTimeout?: number;
  avatarParticipantName?: string;
  extraPayload?: Record<string, unknown>;
}

export interface LemonSliceBackendConfig {
  apiBaseUrl: string;
  livekitUrl: string;
}

export function validateLemonSliceConfig(config: LemonSliceSessionConfig): void {
  if (!config.source) throw new Error('LemonSlice requires an avatar source');
  if (config.source.kind === 'agent' && !config.source.agentId.trim()) throw new Error('LemonSlice agent ID is empty');
  if (config.source.kind === 'imageUrl') {
    try { new URL(config.source.imageUrl); } catch { throw new Error('LemonSlice image URL is invalid'); }
  }
  if (config.idleTimeout !== undefined && !Number.isFinite(config.idleTimeout)) throw new Error('Invalid LemonSlice idle timeout');
}

/** Build the provider-neutral request sent to our backend.
 * Never put LEMONSLICE_API_KEY in this object or in client-side storage.
 */
export function createLemonSliceRequest(config: LemonSliceSessionConfig) {
  validateLemonSliceConfig(config);
  return {
    provider: 'lemonslice' as const,
    source: config.source.kind === 'agent'
      ? { agentId: config.source.agentId }
      : config.source.kind === 'imageUrl'
        ? { imageUrl: config.source.imageUrl }
        : { image: config.source.image, mimeType: config.source.mimeType ?? 'image/png' },
    agentPrompt: config.prompt,
    agentIdlePrompt: config.idlePrompt,
    idleTimeout: config.idleTimeout,
    avatarParticipantName: config.avatarParticipantName,
    extraPayload: config.extraPayload,
  };
}

export interface LiveKitSessionInfo {
  roomName: string;
  livekitUrl: string;
  token: string;
}

export async function startLemonSliceSession(
  backend: LemonSliceBackendConfig,
  config: LemonSliceSessionConfig,
  signal?: AbortSignal,
): Promise<LiveKitSessionInfo> {
  const request = createLemonSliceRequest(config);
  const response = await fetch(`${backend.apiBaseUrl.replace(/\/$/, '')}/api/avatar/lemonslice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`LemonSlice session request failed (${response.status})`);
  const data = await response.json() as Partial<LiveKitSessionInfo>;
  if (!data.roomName || !data.livekitUrl || !data.token) throw new Error('Backend returned an incomplete LiveKit session');
  return { roomName: data.roomName, livekitUrl: data.livekitUrl, token: data.token };
}

export function buildAgentSource(agentId: string): LemonSliceSource {
  if (!agentId.trim()) throw new Error('Agent ID is required');
  return { kind: 'agent', agentId: agentId.trim() };
}

export function buildImageSource(imageUrl: string): LemonSliceSource {
  new URL(imageUrl);
  return { kind: 'imageUrl', imageUrl };
}
