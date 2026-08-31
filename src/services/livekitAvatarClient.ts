import { Room, RoomEvent, Track, RemoteTrack } from 'livekit-client';
import { startLemonSliceSession, LemonSliceBackendConfig, LemonSliceSessionConfig, LiveKitSessionInfo } from './lemonslice';

export type AvatarConnectionState = 'idle'|'starting'|'connected'|'disconnected'|'error';
export interface AvatarMediaHandlers { onVideo?: (element: HTMLVideoElement, participantIdentity: string) => void; onAudio?: (element: HTMLAudioElement, participantIdentity: string) => void; onState?: (state: AvatarConnectionState, error?: Error) => void; }

export class LiveKitAvatarClient {
  private room: Room | null = null;
  private handlers: AvatarMediaHandlers;
  private videoElements = new Set<HTMLVideoElement>();
  private audioElements = new Set<HTMLAudioElement>();
  constructor(handlers: AvatarMediaHandlers = {}) { this.handlers = handlers; }

  async connect(backend: LemonSliceBackendConfig, config: LemonSliceSessionConfig, signal?: AbortSignal): Promise<LiveKitSessionInfo> {
    if (this.room) await this.disconnect();
    this.handlers.onState?.('starting');
    try {
      const session = await startLemonSliceSession(backend, config, signal);
      if (signal?.aborted) throw new DOMException('Aborted','AbortError');
      const room = new Room({ adaptiveStream: true, dynacast: false });
      this.room = room;
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => this.attachTrack(track, participant.identity));
      room.on(RoomEvent.TrackUnsubscribed, track => this.detachTrack(track));
      room.on(RoomEvent.Disconnected, () => this.handlers.onState?.('disconnected'));
      await room.prepareConnection(session.livekitUrl, session.token);
      await room.connect(session.livekitUrl, session.token, { autoSubscribe: true });
      this.handlers.onState?.('connected');
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.isSubscribed && publication.track) this.attachTrack(publication.track, participant.identity);
        }
      }
      return session;
    } catch (e) {
      this.handlers.onState?.('error', e instanceof Error ? e : new Error(String(e)));
      await this.disconnect();
      throw e;
    }
  }

  private attachTrack(track: RemoteTrack, identity: string) {
    if (track.kind === Track.Kind.Video) {
      const el = track.attach() as HTMLVideoElement;
      el.autoplay = true; el.playsInline = true; el.muted = true;
      this.videoElements.add(el); this.handlers.onVideo?.(el, identity);
    } else if (track.kind === Track.Kind.Audio) {
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true; this.audioElements.add(el); this.handlers.onAudio?.(el, identity);
    }
  }

  private detachTrack(track: RemoteTrack) {
    const elements = track.detach();
    elements.forEach(el => { if (el instanceof HTMLVideoElement) this.videoElements.delete(el); if (el instanceof HTMLAudioElement) this.audioElements.delete(el); el.remove(); });
  }

  async disconnect() {
    if (!this.room) return;
    const room = this.room; this.room = null;
    room.removeAllListeners();
    await room.disconnect();
    this.videoElements.clear(); this.audioElements.clear();
    this.handlers.onState?.('disconnected');
  }

  get connected() { return this.room?.state === 'connected'; }
  get currentRoomName() { return this.room?.name ?? null; }
}
