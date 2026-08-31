import { Room, RoomEvent, ConnectionState, Track } from 'livekit-client';

export type AvatarMediaState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'degraded' | 'disconnected' | 'error';
export interface AvatarQualitySnapshot { state: AvatarMediaState; participants: number; video: boolean; audio: boolean; speaking: boolean; roomName?: string; identity?: string; error?: string; }
export interface AvatarQualityHooks { onChange?: (snapshot: AvatarQualitySnapshot) => void; onVideo?: (el: HTMLVideoElement) => void; onAudio?: (el: HTMLAudioElement) => void; }

export class LiveKitAvatarQualityMonitor {
  private state: AvatarMediaState = 'idle';
  private video = false;
  private audio = false;
  private speaking = false;
  private error?: string;
  private hooks: AvatarQualityHooks;
  constructor(private room: Room, hooks: AvatarQualityHooks = {}) { this.hooks = hooks; this.bind(); this.emit(); }
  private bind() {
    this.room.on(RoomEvent.ConnectionStateChanged, s => { this.state = s === ConnectionState.Connected ? 'connected' : s === ConnectionState.Reconnecting ? 'reconnecting' : s === ConnectionState.Disconnected ? 'disconnected' : 'connecting'; this.emit(); });
    this.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => { if (track.kind === Track.Kind.Video) { this.video = true; const el = track.attach(); this.hooks.onVideo?.(el as HTMLVideoElement); } if (track.kind === Track.Kind.Audio) { this.audio = true; const el = track.attach(); this.hooks.onAudio?.(el as HTMLAudioElement); } this.emit(participant.identity); });
    this.room.on(RoomEvent.TrackUnsubscribed, track => { track.detach(); if (track.kind === Track.Kind.Video) this.video = false; if (track.kind === Track.Kind.Audio) this.audio = false; this.emit(); });
    this.room.on(RoomEvent.ActiveSpeakersChanged, speakers => { this.speaking = speakers.length > 0; this.emit(); });
    this.room.on(RoomEvent.TrackSubscriptionFailed, (sid, participant) => { this.state = 'degraded'; this.error = `Track subscription failed: ${sid} (${participant.identity})`; this.emit(); });
    this.room.on(RoomEvent.Disconnected, () => { this.state = 'disconnected'; this.emit(); });
  }
  private emit(identity?: string) { this.hooks.onChange?.({ state: this.state, participants: this.room.numParticipants, video: this.video, audio: this.audio, speaking: this.speaking, roomName: this.room.name, identity, error: this.error }); }
  clearError() { this.error = undefined; this.emit(); }
  dispose() { this.room.removeAllListeners(); this.video = false; this.audio = false; this.state = 'idle'; this.emit(); }
}
