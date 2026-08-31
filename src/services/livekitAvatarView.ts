import { Room, RoomEvent, Track } from 'livekit-client';

export type AvatarMediaState = 'idle' | 'connecting' | 'connected' | 'streaming' | 'disconnected' | 'error';

export interface AvatarMediaCallbacks {
  onState?: (state: AvatarMediaState) => void;
  onParticipant?: (identity: string) => void;
  onError?: (error: Error) => void;
}

/** Attaches LemonSlice's LiveKit media to stable DOM elements. */
export class LiveKitAvatarView {
  private room: Room | null = null;
  private video: HTMLVideoElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private callbacks: AvatarMediaCallbacks;
  private attached = new Set<object>();

  constructor(callbacks: AvatarMediaCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async connect(url: string, token: string, video: HTMLVideoElement, audio: HTMLAudioElement) {
    await this.disconnect();
    this.video = video;
    this.audio = audio;
    this.callbacks.onState?.('connecting');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: true,
    });
    this.room = room;

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      this.attach(track);
      this.callbacks.onParticipant?.(participant.identity);
      this.callbacks.onState?.('streaming');
    });
    room.on(RoomEvent.TrackUnsubscribed, track => this.detach(track));
    room.on(RoomEvent.Disconnected, () => this.callbacks.onState?.('disconnected'));
    room.on(RoomEvent.TrackSubscriptionFailed, (_, participant) => {
      this.callbacks.onError?.(new Error(`Avatar track subscription failed: ${participant.identity}`));
    });

    try {
      room.prepareConnection(url, token);
      await room.connect(url, token);
      this.callbacks.onState?.('connected');
      for (const participant of room.remoteParticipants.values()) {
        this.callbacks.onParticipant?.(participant.identity);
        for (const publication of participant.trackPublications.values()) {
          if (publication.isSubscribed && publication.track) this.attach(publication.track);
        }
      }
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onState?.('error');
      this.callbacks.onError?.(e);
      await this.disconnect();
      throw e;
    }
  }

  private attach(track: any) {
    if (this.attached.has(track)) return;
    const target = track.kind === Track.Kind.Video ? this.video : this.audio;
    if (!target) return;
    const element = track.attach(target);
    element.autoplay = true;
    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
      element.muted = false;
    }
    this.attached.add(track);
  }

  private detach(track: any) {
    track.detach();
    this.attached.delete(track);
  }

  async disconnect() {
    for (const track of this.attached) {
      try { (track as any).detach(); } catch { /* already detached */ }
    }
    this.attached.clear();
    const room = this.room;
    this.room = null;
    if (room) await room.disconnect();
    if (this.video) this.video.srcObject = null;
    if (this.audio) this.audio.srcObject = null;
    this.video = null;
    this.audio = null;
  }

  get connected() { return this.room?.state === 'connected'; }
}
