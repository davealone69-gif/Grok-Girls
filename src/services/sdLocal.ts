/* ------------------------------------------------------------------ */
/* sdLocal — phone-local Stable Diffusion image engine.                */
/*                                                                     */
/* Target: an sd-server running on the SAME Android phone              */
/*   base:    http://127.0.0.1:1234                                    */
/*   txt2img: http://127.0.0.1:1234/sdapi/v1/txt2img                   */
/*                                                                     */
/* This is the IMAGE half of the local stack. It is deliberately kept  */
/* separate from Ollama (the TEXT half, :11434) — two servers, two     */
/* ports, two lifecycles:                                              */
/*                                                                     */
/*   App -> Local Server Manager -> Termux -> sd-server :1234          */
/*   App -> Local LLM Client     -> Ollama            :11434           */
/*                                                                     */
/* Transports mirror ollama.ts:                                        */
/*                                                                     */
/*  1. NATIVE bridge (Capacitor plugin `SdLocal`) — used inside the    */
/*     Android shell. Kotlin does the HTTP, which sidesteps the two    */
/*     things that break loopback access from a WebView: CORS (the     */
/*     sd-server sends no ACAO header) and cleartext/mixed-content     */
/*     blocking of http://127.0.0.1 from an https://localhost page.    */
/*     It can also START the server via Termux RUN_COMMAND and poll    */
/*     127.0.0.1:1234/ until it answers.                               */
/*                                                                     */
/*  2. FETCH transport — desktop browsers / PWA / dev server, which    */
/*     requires the server to be started by hand with CORS allowed.    */
/*                                                                     */
/* The A1111 response shape is { images: ["<base64 png>", ...] }. The  */
/* native bridge returns the same base64 so both transports converge   */
/* on one decode path -> a data: URL the <img>/canvas can render       */
/* (the Android side decodes to a Bitmap for its own validation).      */
/*                                                                     */
/* This module never imports providers.ts (no cycles).                 */
/* ------------------------------------------------------------------ */

import {
  getSdLocalSettings,
  saveSdLocalSettings,
  type SdLocalSettings
} from './settingsState';

export const SD_DEFAULT_BASE = 'http://127.0.0.1:1234';
export const SD_TXT2IMG_PATH = '/sdapi/v1/txt2img';

export type SdServerState =
  | 'unknown'
  | 'running'
  | 'stopped'
  | 'starting'
  | 'unreachable'
  | 'blocked';

export interface SdStatus {
  ok: boolean;
  state: SdServerState;
  base: string;
  /** reported model/checkpoint when the server exposes one */
  model?: string;
  message: string;
  transport: 'native' | 'fetch';
}

/* ------------------------------------------------------------ config */

export function getSdConfig(): SdLocalSettings {
  return getSdLocalSettings();
}

export function getSdBase(): string {
  const b = getSdConfig().base.trim();
  return (b || SD_DEFAULT_BASE).replace(/\/+$/, '');
}

export function isSdEnabled(): boolean {
  return getSdConfig().enabled;
}

export function isSdAutoStart(): boolean {
  return getSdConfig().autoStart;
}

export function setSdEnabled(enabled: boolean): void {
  saveSdLocalSettings({ enabled });
}

export function setSdAutoStart(autoStart: boolean): void {
  saveSdLocalSettings({ autoStart });
}

export function saveSdConfig(p: Partial<SdLocalSettings>): void {
  if (typeof p.base === 'string') p = { ...p, base: p.base.trim().replace(/\/+$/, '') };
  saveSdLocalSettings(p);
}

/** Root URL used for the liveness poll — "polls 127.0.0.1:1234/ until it responds". */
export function rootUrl(base = getSdBase()): string {
  return base ? `${base}/` : '';
}

export function txt2imgUrl(base = getSdBase()): string {
  return base ? `${base}${SD_TXT2IMG_PATH}` : '';
}

export function optionsUrl(base = getSdBase()): string {
  return base ? `${base}/sdapi/v1/options` : '';
}

export function progressUrl(base = getSdBase()): string {
  return base ? `${base}/sdapi/v1/progress` : '';
}

/* ------------------------------------------------------ native bridge */

interface NativePluginResult {
  [k: string]: unknown;
}

interface NativeSdPlugin {
  status(opts: { base: string; timeoutMs?: number }): Promise<NativePluginResult>;
  txt2img(opts: {
    base: string;
    prompt: string;
    negativePrompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    cfgScale?: number;
    seed?: number;
    requestId?: string;
    timeoutMs?: number;
  }): Promise<NativePluginResult>;
  startServer(opts: { base: string; timeoutMs?: number }): Promise<NativePluginResult>;
  cancel(opts: { requestId: string }): Promise<NativePluginResult>;
  addListener(
    event: string,
    cb: (data: Record<string, unknown>) => void
  ): Promise<{ remove: () => Promise<void> }> | { remove: () => void };
}

interface CapacitorGlobal {
  Plugins?: Record<string, unknown>;
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** True when running inside the Capacitor Android/iOS shell. */
export function isNativeShell(): boolean {
  const c = capacitor();
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') return c.isNativePlatform();
  return typeof c.getPlatform === 'function' && c.getPlatform() !== 'web';
}

function nativePlugin(): NativeSdPlugin | null {
  const c = capacitor();
  const p = c?.Plugins?.['SdLocal'] as NativeSdPlugin | undefined;
  if (!p || typeof p.txt2img !== 'function') return null;
  return p;
}

/** Which transport will be used for the next call. */
export function activeTransport(): 'native' | 'fetch' {
  return nativePlugin() ? 'native' : 'fetch';
}

/* ------------------------------------------------------------ helpers */

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external?: AbortSignal
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

let requestCounter = 0;
function newRequestId(): string {
  requestCounter += 1;
  return `sd-${Date.now().toString(36)}-${requestCounter}`;
}

/** Actionable message per failure class — never a bare status code. */
export function sdErrorMessage(
  status: number | 'network' | 'cors' | 'timeout',
  base: string,
  snippet = ''
): string {
  const tail = snippet ? ` — ${snippet.slice(0, 160)}` : '';
  if (status === 'timeout')
    return `The render timed out. Stable Diffusion on a phone can take minutes — lower the steps or the size, or raise the timeout.`;
  if (status === 'cors')
    return `${base} refused the browser request (CORS). Start the server with CORS enabled, or use the Android app where the native bridge bypasses CORS.`;
  if (status === 'network')
    return `Cannot reach the image server at ${base}. Start it in Termux (sd-server on port 1234), then press RETRY.`;
  if (status === 404)
    return `${base}${SD_TXT2IMG_PATH} returned 404. The server is running but does not expose the A1111 txt2img API.`;
  if (status === 422)
    return `The server rejected the render parameters (422)${tail}`;
  if (status === 500)
    return `The image server hit an internal error (500)${tail} — it usually means the model failed to load or the phone ran out of memory.`;
  if (status === 503)
    return `The image server is busy or still loading its model (503). Wait for it to finish and retry.`;
  return `Image server HTTP ${status}${tail}`;
}

function recordTest(outcome: { ok: boolean; error?: string }): void {
  saveSdLocalSettings({ lastTest: { at: Date.now(), ok: outcome.ok, error: outcome.error } });
}

/* ------------------------------------------------------------- status */

/**
 * Liveness probe. "Polls 127.0.0.1:1234/ until it responds" — any HTTP
 * answer from the root proves a server is listening, including a 404,
 * because sd-server builds vary in what they serve at "/".
 */
export async function sdStatus(base = getSdBase(), timeoutMs = 4000): Promise<SdStatus> {
  const transport = activeTransport();
  if (!base) {
    return { ok: false, state: 'unknown', base, message: 'No image server address configured.', transport };
  }

  const plugin = nativePlugin();
  if (plugin) {
    try {
      const raw = (await plugin.status({ base, timeoutMs })) as {
        running?: boolean;
        model?: string;
        message?: string;
      };
      const ok = Boolean(raw.running);
      return {
        ok,
        state: ok ? 'running' : 'stopped',
        base,
        model: raw.model || undefined,
        message: raw.message || (ok ? `✓ Image server is running at ${base}` : `No image server at ${base}`),
        transport
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, state: 'unreachable', base, message, transport };
    }
  }

  // fetch transport
  try {
    const res = await fetchWithTimeout(rootUrl(base), { method: 'GET' }, timeoutMs);
    // Any HTTP response means something is listening.
    let model: string | undefined;
    try {
      const opt = await fetchWithTimeout(optionsUrl(base), { method: 'GET' }, Math.min(timeoutMs, 3000));
      if (opt.ok) {
        const j = (await opt.json()) as Record<string, unknown>;
        const ckpt = j['sd_model_checkpoint'];
        if (typeof ckpt === 'string') model = ckpt;
      }
    } catch {
      /* options is optional — absence is not a failure */
    }
    return {
      ok: true,
      state: 'running',
      base,
      model,
      message: `✓ Image server is running at ${base}${model ? ` (${model})` : ''} [HTTP ${res.status}]`,
      transport
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const message = sdErrorMessage(aborted ? 'timeout' : 'network', base);
    return { ok: false, state: aborted ? 'unreachable' : 'stopped', base, message, transport };
  }
}

export async function testSdConnection(base = getSdBase()): Promise<SdStatus> {
  const st = await sdStatus(base, 6000);
  recordTest({ ok: st.ok, error: st.ok ? undefined : st.message });
  return st;
}

/* ------------------------------------------------------- start server */

export interface SdStartResult {
  ok: boolean;
  state: SdServerState;
  message: string;
  method?: 'already-running' | 'termux' | 'none';
}

/**
 * "App launches/requests the Termux Stable Diffusion server, then polls
 * 127.0.0.1:1234/ until it responds."
 *
 * Native: asks the Kotlin plugin to launch sd-server via Termux
 * RUN_COMMAND and polls the root until it answers.
 * Web: cannot start a process — returns an actionable instruction.
 */
export async function ensureSdRunning(
  base = getSdBase(),
  opts: { timeoutMs?: number; onState?: (s: SdServerState, msg: string) => void } = {}
): Promise<SdStartResult> {
  // Model load on a phone is slow; give it longer than the Ollama default.
  const timeoutMs = opts.timeoutMs ?? 90000;
  const first = await sdStatus(base, 3000);
  if (first.ok) {
    opts.onState?.('running', first.message);
    return { ok: true, state: 'running', message: first.message, method: 'already-running' };
  }

  const plugin = nativePlugin();
  if (!plugin) {
    const message =
      'The image server is not running. Open Termux and start sd-server on port 1234, then press RETRY.';
    opts.onState?.('stopped', message);
    return { ok: false, state: 'stopped', message, method: 'none' };
  }

  opts.onState?.('starting', 'Starting the local image server… (first launch loads the model, this can take a minute)');
  try {
    const raw = (await plugin.startServer({ base, timeoutMs })) as {
      started?: boolean;
      method?: string;
      message?: string;
    };
    const ok = Boolean(raw.started);
    const message = raw.message || (ok ? '✓ Image server started' : 'Could not start the image server.');
    opts.onState?.(ok ? 'running' : 'stopped', message);
    return {
      ok,
      state: ok ? 'running' : 'stopped',
      message,
      method: (raw.method as SdStartResult['method']) ?? 'termux'
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    opts.onState?.('stopped', message);
    return { ok: false, state: 'stopped', message };
  }
}

/* ------------------------------------------------------------ txt2img */

export interface SdTxt2ImgRequest {
  prompt: string;
  negativePrompt?: string;
  steps?: number;
  width?: number;
  height?: number;
  cfgScale?: number;
  seed?: number;
}

export interface SdTxt2ImgResult {
  /** data: URL ready for <img src> / canvas / gallery persistence */
  dataUrl: string;
  /** raw base64 payload (no data: prefix) */
  base64: string;
  width: number;
  height: number;
  seed?: number;
  /** milliseconds the render took */
  elapsedMs: number;
  transport: 'native' | 'fetch';
}

export interface SdTxt2ImgOpts {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** auto-start the server when it is not listening */
  autoStart?: boolean;
  onState?: (s: SdServerState, msg: string) => void;
}

/**
 * A1111 returns bare base64; some builds already prefix a data: URL.
 *
 * The payload is validated here rather than trusted. Without this, a
 * truncated or garbage response becomes a data: URL that silently renders
 * as a broken <img> with no error anywhere — the failure would surface as
 * "the app produced a blank image" instead of a real message. The native
 * path gets the equivalent check in Kotlin via BitmapFactory.
 */
function toDataUrl(b64: string): { dataUrl: string; base64: string } {
  let payload = b64.trim();
  if (payload.startsWith('data:')) {
    const comma = payload.indexOf(',');
    payload = comma >= 0 ? payload.slice(comma + 1) : '';
  }
  if (!payload) throw new Error('The image server returned an empty image payload.');

  // atob throws on anything that is not valid base64.
  let bytes: string;
  try {
    bytes = atob(payload);
  } catch {
    throw new Error('The image server returned data that is not valid Base64.');
  }

  // Check the magic bytes so a base64-clean but non-image body is caught too.
  const isPng =
    bytes.length > 8 &&
    bytes.charCodeAt(0) === 0x89 &&
    bytes.charCodeAt(1) === 0x50 &&
    bytes.charCodeAt(2) === 0x4e &&
    bytes.charCodeAt(3) === 0x47;
  const isJpeg =
    bytes.length > 3 && bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8;
  const isWebp =
    bytes.length > 12 && bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    throw new Error(
      `The image server returned ${bytes.length} bytes that are not a PNG, JPEG or WebP image.`
    );
  }

  const mime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/webp';
  return { dataUrl: `data:${mime};base64,${payload}`, base64: payload };
}

/** Pull the seed out of A1111's `info` field, which is a JSON *string*. */
function seedFromInfo(info: unknown): number | undefined {
  if (typeof info !== 'string' || !info) return undefined;
  try {
    const parsed = JSON.parse(info) as Record<string, unknown>;
    const s = parsed['seed'];
    if (typeof s === 'number' && Number.isFinite(s)) return s;
    if (Array.isArray(parsed['all_seeds']) && typeof parsed['all_seeds'][0] === 'number') {
      return parsed['all_seeds'][0] as number;
    }
  } catch {
    /* info is best-effort metadata */
  }
  return undefined;
}

/**
 * Render an image on the phone-local Stable Diffusion server.
 *
 * POSTs { prompt, negative_prompt, steps, width, height, cfg_scale } to
 * <base>/sdapi/v1/txt2img and decodes images[0] from Base64.
 */
export async function sdTxt2Img(
  req: SdTxt2ImgRequest,
  opts: SdTxt2ImgOpts = {}
): Promise<SdTxt2ImgResult> {
  const prompt = req.prompt?.trim();
  if (!prompt) throw new Error('Cannot render: the prompt is empty.');

  const cfg = getSdConfig();
  const base = getSdBase();
  if (!base) throw new Error('No image server address configured.');

  const width = req.width ?? cfg.size;
  const height = req.height ?? cfg.size;
  const steps = req.steps ?? cfg.steps;
  const cfgScale = req.cfgScale ?? cfg.cfgScale;
  const negative = req.negativePrompt ?? cfg.negative ?? '';
  const seed = req.seed;
  // A phone render is slow: default to 10 minutes rather than failing early.
  const timeoutMs = opts.timeoutMs ?? 600000;

  if (opts.autoStart ?? cfg.autoStart) {
    const probe = await sdStatus(base, 2500);
    if (!probe.ok) {
      const started = await ensureSdRunning(base, { onState: opts.onState });
      if (!started.ok) throw new Error(started.message);
    }
  }

  const started = Date.now();
  const plugin = nativePlugin();

  if (plugin) {
    const requestId = newRequestId();
    if (opts.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          void plugin.cancel({ requestId }).catch(() => undefined);
        },
        { once: true }
      );
    }
    const raw = (await plugin.txt2img({
      base,
      prompt,
      negativePrompt: negative,
      steps,
      width,
      height,
      cfgScale,
      seed,
      requestId,
      timeoutMs
    })) as { ok?: boolean; image?: string; seed?: number; width?: number; height?: number; error?: string };

    if (raw.error) throw new Error(raw.error);
    if (!raw.image) throw new Error('The image server returned no image.');
    const { dataUrl, base64 } = toDataUrl(raw.image);
    return {
      dataUrl,
      base64,
      width: raw.width ?? width,
      height: raw.height ?? height,
      seed: typeof raw.seed === 'number' ? raw.seed : seed,
      elapsedMs: Date.now() - started,
      transport: 'native'
    };
  }

  // ---- fetch transport -------------------------------------------------
  const body: Record<string, unknown> = {
    prompt,
    negative_prompt: negative,
    steps,
    width,
    height,
    cfg_scale: cfgScale
  };
  if (typeof seed === 'number' && Number.isFinite(seed)) body.seed = seed;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      txt2imgUrl(base),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      timeoutMs,
      opts.signal
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    if (aborted && opts.signal?.aborted) throw new Error('Render cancelled.');
    throw new Error(sdErrorMessage(aborted ? 'timeout' : 'network', base));
  }

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(sdErrorMessage(res.status, base, snippet));
  }

  const json = (await res.json()) as { images?: unknown; info?: unknown; detail?: unknown };
  const images = json.images;
  if (!Array.isArray(images) || typeof images[0] !== 'string' || !images[0]) {
    const detail = typeof json.detail === 'string' ? ` — ${json.detail.slice(0, 160)}` : '';
    throw new Error(`The image server returned no image${detail}`);
  }

  const { dataUrl, base64 } = toDataUrl(images[0]);
  return {
    dataUrl,
    base64,
    width,
    height,
    seed: seedFromInfo(json.info) ?? seed,
    elapsedMs: Date.now() - started,
    transport: 'fetch'
  };
}
