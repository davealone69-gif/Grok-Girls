import { startLemonSliceSession, type LemonSliceBackendConfig, type LemonSliceSessionConfig, type LiveKitSessionInfo } from './lemonslice';

export type LemonSliceControllerState = 'idle' | 'starting' | 'connected' | 'stopping' | 'error';

export interface LemonSliceControllerCallbacks {
  onState?: (state: LemonSliceControllerState) => void;
  onSession?: (session: LiveKitSessionInfo) => void;
  onError?: (error: Error) => void;
}

/** Provider-agnostic browser controller. LiveKit media attachment belongs to the
 * app's chosen LiveKit client adapter, so this class deliberately does not leak
 * provider secrets or invent a browser-side LemonSlice API call.
 */
export class LemonSliceAvatarController {
  private state: LemonSliceControllerState = 'idle';
  private abort?: AbortController;
  private session?: LiveKitSessionInfo;

  constructor(private readonly backend: LemonSliceBackendConfig, private readonly callbacks: LemonSliceControllerCallbacks = {}) {}

  getState() { return this.state; }
  getSession() { return this.session; }

  private setState(state: LemonSliceControllerState) {
    this.state = state;
    this.callbacks.onState?.(state);
  }

  async start(config: LemonSliceSessionConfig): Promise<LiveKitSessionInfo> {
    this.stop();
    this.abort = new AbortController();
    this.setState('starting');
    try {
      const session = await startLemonSliceSession(this.backend, config, this.abort.signal);
      this.session = session;
      this.setState('connected');
      this.callbacks.onSession?.(session);
      return session;
    } catch (e) {
      if (this.abort?.signal.aborted) {
        this.setState('idle');
        throw e;
      }
      const error = e instanceof Error ? e : new Error(String(e));
      this.setState('error');
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  stop() {
    if (this.abort) this.abort.abort();
    this.abort = undefined;
    if (this.state !== 'idle') this.setState('stopping');
    this.session = undefined;
    this.setState('idle');
  }
}
