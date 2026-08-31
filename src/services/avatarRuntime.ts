import { diceBearUrl, type DiceBearStyleConfig } from './dicebearStyle';

export type AvatarRuntimeState = 'idle' | 'starting' | 'connecting' | 'connected' | 'error' | 'stopped';

export interface AvatarRuntimeOptions {
  endpoint: string;
  style: DiceBearStyleConfig;
  agentId?: string;
  prompt?: string;
  idlePrompt?: string;
  idleTimeout?: number;
  signal?: AbortSignal;
}

export interface AvatarSessionTicket {
  roomUrl: string;
  token: string;
  roomName?: string;
  participantName?: string;
}

export interface AvatarRuntimeEvents {
  state?: (state: AvatarRuntimeState) => void;
  error?: (error: Error) => void;
  ticket?: (ticket: AvatarSessionTicket) => void;
}

export class AvatarRuntime {
  private state: AvatarRuntimeState = 'idle';
  private abort?: AbortController;
  private readonly events: AvatarRuntimeEvents;

  constructor(events: AvatarRuntimeEvents = {}) {
    this.events = events;
  }

  getState() { return this.state; }

  private setState(state: AvatarRuntimeState) {
    this.state = state;
    this.events.state?.(state);
  }

  async start(options: AvatarRuntimeOptions): Promise<AvatarSessionTicket> {
    this.stop();
    this.abort = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, this.abort.signal])
      : this.abort.signal;
    this.setState('starting');
    try {
      const sourceUrl = diceBearUrl(options.style);
      const response = await fetch(options.endpoint.replace(/\/$/, '') + '/avatar/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: options.agentId,
          agentImageUrl: sourceUrl,
          prompt: options.prompt,
          idlePrompt: options.idlePrompt,
          idleTimeout: options.idleTimeout
        }),
        signal
      });
      if (!response.ok) throw new Error(`Avatar session request failed (${response.status})`);
      const ticket = await response.json() as AvatarSessionTicket;
      if (!ticket.roomUrl || !ticket.token) throw new Error('Avatar session response is missing roomUrl or token');
      this.setState('connecting');
      this.events.ticket?.(ticket);
      return ticket;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.setState('stopped');
        throw error;
      }
      this.setState('error');
      const e = error instanceof Error ? error : new Error(String(error));
      this.events.error?.(e);
      throw e;
    }
  }

  connected() { this.setState('connected'); }

  stop() {
    this.abort?.abort();
    this.abort = undefined;
    if (this.state !== 'idle') this.setState('stopped');
  }
}
