/* ------------------------------------------------------------------ */
/* ollama — first-class on-device LLM provider.                        */
/*                                                                     */
/* Target: an Ollama server running on the SAME Android phone          */
/*   base:   http://127.0.0.1:11434                                    */
/*   OpenAI: http://127.0.0.1:11434/v1                                 */
/*   model:  llama3.2:1b (default)                                     */
/*                                                                     */
/* Two transports, chosen at runtime:                                  */
/*                                                                     */
/*  1. NATIVE bridge (Capacitor plugin `OllamaLocal`) — used whenever  */
/*     the app runs inside the Android shell. The HTTP call is made    */
/*     by Kotlin, so it is immune to the two things that otherwise     */
/*     break phone-local LLM access from a WebView:                    */
/*        - CORS      (Ollama only allows OLLAMA_ORIGINS)              */
/*        - mixed content / cleartext blocking (https://localhost →    */
/*          http://127.0.0.1 is blocked by default on Android)         */
/*     It can also START the server (Termux RUN_COMMAND) and wait for  */
/*     readiness — the "app checks 127.0.0.1:11434 → not running →     */
/*     launch it" layer.                                               */
/*                                                                     */
/*  2. FETCH transport — desktop browsers / PWA / dev server. Requires */
/*     the server to allow the origin (OLLAMA_ORIGINS=*).              */
/*                                                                     */
/* This module never imports providers.ts (no cycles).                 */
/* ------------------------------------------------------------------ */

import {
  getOllamaSettings,
  saveOllamaSettings,
  type OllamaSettings
} from './settingsState';
import type { ChatMessage } from './providers';

export const OLLAMA_DEFAULT_BASE = 'http://127.0.0.1:11434';
export const OLLAMA_DEFAULT_MODEL = 'llama3.2:1b';
/** Ollama accepts any key; "ollama" is the conventional placeholder. */
export const OLLAMA_PLACEHOLDER_KEY = 'ollama';

export interface OllamaModel {
  name: string;
  /** bytes, when the server reports it */
  size?: number;
  parameterSize?: string;
  quantization?: string;
  modifiedAt?: string;
}

export type OllamaServerState =
  | 'unknown'
  | 'running'
  | 'stopped'
  | 'starting'
  | 'unreachable'
  | 'blocked';

export interface OllamaStatus {
  ok: boolean;
  state: OllamaServerState;
  base: string;
  /** which transport produced this answer */
  transport: 'native' | 'fetch';
  version?: string;
  models: OllamaModel[];
  message: string;
  /** round-trip time of the probe in ms */
  latencyMs?: number;
}

/* ------------------------------------------------------------ config */

export function getOllamaConfig(): OllamaSettings {
  return getOllamaSettings();
}

export function getOllamaBase(): string {
  const s = getOllamaSettings();
  return (s.base || OLLAMA_DEFAULT_BASE).trim().replace(/\/+$/, '');
}

export function getOllamaModel(): string {
  const s = getOllamaSettings();
  return (s.model || OLLAMA_DEFAULT_MODEL).trim();
}

export function isOllamaEnabled(): boolean {
  return getOllamaSettings().enabled;
}

export function isOllamaAutoStart(): boolean {
  return getOllamaSettings().autoStart;
}

export function setOllamaEnabled(enabled: boolean): void {
  saveOllamaSettings({ enabled });
}

export function setOllamaAutoStart(autoStart: boolean): void {
  saveOllamaSettings({ autoStart });
}

export function saveOllamaConfig(p: Partial<OllamaSettings>): void {
  const patch: Partial<OllamaSettings> = { ...p };
  if (typeof patch.base === 'string') patch.base = patch.base.trim().replace(/\/+$/, '');
  if (typeof patch.model === 'string') patch.model = patch.model.trim();
  saveOllamaSettings(patch);
}

export function isOllamaChatReady(): boolean {
  const s = getOllamaSettings();
  return s.enabled && Boolean((s.base || OLLAMA_DEFAULT_BASE).trim());
}

/* ---------------------------------------------------------- endpoints */

/** OpenAI-compatible root, e.g. http://127.0.0.1:11434/v1 */
export function openAiBase(base = getOllamaBase()): string {
  const b = base.trim().replace(/\/+$/, '');
  if (!b) return '';
  return /\/v1$/i.test(b) ? b : `${b}/v1`;
}

/** Native Ollama root (no /v1), e.g. http://127.0.0.1:11434 */
export function nativeBase(base = getOllamaBase()): string {
  return base.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}

export function chatCompletionsUrl(base = getOllamaBase()): string {
  const b = openAiBase(base);
  return b ? `${b}/chat/completions` : '';
}

export function modelsUrl(base = getOllamaBase()): string {
  const b = openAiBase(base);
  return b ? `${b}/models` : '';
}

export function tagsUrl(base = getOllamaBase()): string {
  const b = nativeBase(base);
  return b ? `${b}/api/tags` : '';
}

export function versionUrl(base = getOllamaBase()): string {
  const b = nativeBase(base);
  return b ? `${b}/api/version` : '';
}

export function pullUrl(base = getOllamaBase()): string {
  const b = nativeBase(base);
  return b ? `${b}/api/pull` : '';
}

/* ------------------------------------------------------ native bridge */

interface NativePluginResult {
  [k: string]: unknown;
}

interface NativeOllamaPlugin {
  status(opts: { base: string; timeoutMs?: number }): Promise<NativePluginResult>;
  listModels(opts: { base: string }): Promise<NativePluginResult>;
  chat(opts: {
    base: string;
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    requestId?: string;
    timeoutMs?: number;
    temperature?: number;
  }): Promise<NativePluginResult>;
  pull(opts: { base: string; model: string; requestId?: string }): Promise<NativePluginResult>;
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
  const c = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return c ?? null;
}

/** True when running inside the Capacitor Android/iOS shell. */
export function isNativeShell(): boolean {
  const c = capacitor();
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') return c.isNativePlatform();
  return typeof c.getPlatform === 'function' && c.getPlatform() !== 'web';
}

function nativePlugin(): NativeOllamaPlugin | null {
  const c = capacitor();
  const p = c?.Plugins?.['OllamaLocal'] as NativeOllamaPlugin | undefined;
  if (!p || typeof p.status !== 'function') return null;
  return p;
}

/** Which transport will be used for the next call. */
export function activeTransport(): 'native' | 'fetch' {
  return nativePlugin() ? 'native' : 'fetch';
}

/* ------------------------------------------------------------ helpers */

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, external?: AbortSignal): Promise<Response> {
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
  return `ollama-${Date.now().toString(36)}-${requestCounter}`;
}

function humanBytes(n?: number): string {
  if (!n || !Number.isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
export { humanBytes as formatModelSize };

/** Human-useful failure text for the common phone-local problems. */
export function ollamaErrorMessage(status: number | 'network' | 'cors' | 'timeout', base: string, snippet = ''): string {
  const root = nativeBase(base) || OLLAMA_DEFAULT_BASE;
  if (status === 'network') {
    return `Cannot reach Ollama at ${root} — the server is not running. Start it with "ollama serve" in Termux, or tap START SERVER.`;
  }
  if (status === 'cors') {
    return `Ollama refused the browser origin (CORS). Restart it with OLLAMA_ORIGINS=* (e.g. "OLLAMA_ORIGINS=* ollama serve") — inside the Android app the native bridge avoids this entirely.`;
  }
  if (status === 'timeout') {
    return `Ollama timed out at ${root}. A small model still needs a few seconds on phone CPU; try again or use a smaller model such as ${OLLAMA_DEFAULT_MODEL}.`;
  }
  if (status === 404) {
    return `Not found (404) at ${root}. Check the base URL — it should be ${OLLAMA_DEFAULT_BASE} (the app appends /v1 itself).`;
  }
  if (status === 401 || status === 403) {
    return `Ollama rejected the request (HTTP ${status}). Local Ollama needs no real API key — leave it empty or use "ollama".`;
  }
  if (status === 400 && /model/i.test(snippet)) {
    return `Ollama rejected the model (HTTP 400) — pull it first: "ollama pull ${getOllamaModel()}". ${snippet}`.trim();
  }
  return `Ollama HTTP ${status}${snippet ? ` — ${snippet}` : ''}`;
}

function recordTest(outcome: { ok: boolean; models?: string[]; error?: string }): void {
  saveOllamaSettings({ lastTest: { at: Date.now(), ...outcome } });
}

function parseTags(json: unknown): OllamaModel[] {
  const list = (json as { models?: unknown })?.models;
  if (!Array.isArray(list)) return [];
  return list
    .map(raw => {
      const m = raw as {
        name?: string;
        model?: string;
        size?: number;
        modified_at?: string;
        details?: { parameter_size?: string; quantization_level?: string };
      };
      const name = m.name || m.model;
      if (!name) return null;
      return {
        name,
        size: typeof m.size === 'number' ? m.size : undefined,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
        modifiedAt: m.modified_at
      } as OllamaModel;
    })
    .filter((m): m is OllamaModel => m !== null);
}

/* ------------------------------------------------------------- status */

/** Probe the server: is it running, which models are installed? Never throws. */
export async function ollamaStatus(base = getOllamaBase(), timeoutMs = 4000): Promise<OllamaStatus> {
  const started = Date.now();
  const plugin = nativePlugin();
  if (plugin) {
    try {
      const raw = (await plugin.status({ base: nativeBase(base), timeoutMs })) as {
        running?: boolean;
        version?: string;
        models?: unknown;
        message?: string;
      };
      const models = parseTags({ models: raw.models });
      const ok = Boolean(raw.running);
      const status: OllamaStatus = {
        ok,
        state: ok ? 'running' : 'stopped',
        base: nativeBase(base),
        transport: 'native',
        version: raw.version,
        models,
        message: ok
          ? `✓ Ollama running${raw.version ? ` · v${raw.version}` : ''} · ${models.length} model(s)`
          : raw.message || ollamaErrorMessage('network', base),
        latencyMs: Date.now() - started
      };
      recordTest({ ok, models: models.map(m => m.name), error: ok ? undefined : status.message });
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recordTest({ ok: false, error: message });
      return { ok: false, state: 'unreachable', base: nativeBase(base), transport: 'native', models: [], message, latencyMs: Date.now() - started };
    }
  }

  // fetch transport
  try {
    const res = await fetchWithTimeout(tagsUrl(base), { method: 'GET' }, timeoutMs);
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 160);
      const message = ollamaErrorMessage(res.status, base, snippet);
      recordTest({ ok: false, error: message });
      return { ok: false, state: 'unreachable', base: nativeBase(base), transport: 'fetch', models: [], message, latencyMs: Date.now() - started };
    }
    const json = await res.json().catch(() => null);
    const models = parseTags(json);
    let version: string | undefined;
    try {
      const vr = await fetchWithTimeout(versionUrl(base), { method: 'GET' }, 2500);
      if (vr.ok) version = ((await vr.json().catch(() => null)) as { version?: string } | null)?.version;
    } catch {
      /* version is optional */
    }
    const message = `✓ Ollama running${version ? ` · v${version}` : ''} · ${models.length} model(s)`;
    recordTest({ ok: true, models: models.map(m => m.name) });
    return { ok: true, state: 'running', base: nativeBase(base), transport: 'fetch', version, models, message, latencyMs: Date.now() - started };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    const message = aborted ? ollamaErrorMessage('timeout', base) : ollamaErrorMessage('network', base);
    recordTest({ ok: false, error: message });
    return {
      ok: false,
      state: aborted ? 'unreachable' : 'stopped',
      base: nativeBase(base),
      transport: 'fetch',
      models: [],
      message,
      latencyMs: Date.now() - started
    };
  }
}

/** Installed models (empty list when the server is down). */
export async function listOllamaModels(base = getOllamaBase()): Promise<OllamaModel[]> {
  const st = await ollamaStatus(base);
  return st.models;
}

/** Is a given model installed on the server? */
export async function hasModel(model = getOllamaModel(), base = getOllamaBase()): Promise<boolean> {
  const models = await listOllamaModels(base);
  const want = model.trim().toLowerCase();
  return models.some(m => {
    const n = m.name.toLowerCase();
    return n === want || n === `${want}:latest` || `${n}:latest` === want;
  });
}

/* ------------------------------------------------- server auto-start */

export interface StartServerResult {
  ok: boolean;
  state: OllamaServerState;
  message: string;
  /** how the start was attempted */
  method?: 'already-running' | 'termux' | 'service' | 'none';
}

/**
 * "App checks 127.0.0.1:11434 → not running → start it → connect".
 *
 * Native: asks the Kotlin plugin to launch `ollama serve` (Termux
 * RUN_COMMAND) and polls until the port answers.
 * Web: cannot start a process — returns an actionable instruction.
 */
export async function ensureOllamaRunning(
  base = getOllamaBase(),
  opts: { timeoutMs?: number; onState?: (s: OllamaServerState, msg: string) => void } = {}
): Promise<StartServerResult> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const first = await ollamaStatus(base, 3000);
  if (first.ok) {
    opts.onState?.('running', first.message);
    return { ok: true, state: 'running', message: first.message, method: 'already-running' };
  }

  const plugin = nativePlugin();
  if (!plugin) {
    const message =
      'Ollama is not running. Open Termux and run "ollama serve" (add OLLAMA_ORIGINS=* when using a browser), then press RETRY.';
    opts.onState?.('stopped', message);
    return { ok: false, state: 'stopped', message, method: 'none' };
  }

  opts.onState?.('starting', 'Starting the local Ollama server…');
  try {
    const raw = (await plugin.startServer({ base: nativeBase(base), timeoutMs })) as {
      started?: boolean;
      method?: string;
      message?: string;
    };
    const ok = Boolean(raw.started);
    const message = raw.message || (ok ? '✓ Ollama server started' : 'Could not start the Ollama server.');
    opts.onState?.(ok ? 'running' : 'stopped', message);
    return { ok, state: ok ? 'running' : 'stopped', message, method: (raw.method as StartServerResult['method']) ?? 'termux' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    opts.onState?.('stopped', message);
    return { ok: false, state: 'stopped', message };
  }
}

/* --------------------------------------------------------- model pull */

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
  percent?: number;
}

/** Pull (download) a model, streaming progress. Works on both transports. */
export async function pullOllamaModel(
  model = getOllamaModel(),
  base = getOllamaBase(),
  onProgress?: (p: PullProgress) => void
): Promise<void> {
  const plugin = nativePlugin();
  if (plugin) {
    const requestId = newRequestId();
    let remove: (() => void) | null = null;
    if (onProgress && typeof plugin.addListener === 'function') {
      const handle = await plugin.addListener('ollamaPullProgress', (data: Record<string, unknown>) => {
        if (data.requestId !== requestId) return;
        const completed = typeof data.completed === 'number' ? data.completed : undefined;
        const total = typeof data.total === 'number' ? data.total : undefined;
        onProgress({
          status: String(data.status ?? ''),
          completed,
          total,
          percent: completed && total ? Math.round((completed / total) * 100) : undefined
        });
      });
      remove = () => void (handle as { remove: () => void }).remove();
    }
    try {
      const res = (await plugin.pull({ base: nativeBase(base), model, requestId })) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(res.message || `Could not pull ${model}`);
    } finally {
      remove?.();
    }
    return;
  }

  const res = await fetchWithTimeout(
    pullUrl(base),
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }) },
    30 * 60 * 1000
  ).catch(() => {
    throw new Error(ollamaErrorMessage('network', base));
  });
  if (!res.ok) throw new Error(ollamaErrorMessage(res.status, base, (await res.text().catch(() => '')).slice(0, 160)));
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const evt = JSON.parse(t) as { status?: string; completed?: number; total?: number; error?: string };
        if (evt.error) throw new Error(evt.error);
        onProgress?.({
          status: evt.status ?? '',
          completed: evt.completed,
          total: evt.total,
          percent: evt.completed && evt.total ? Math.round((evt.completed / evt.total) * 100) : undefined
        });
      } catch (err) {
        if (err instanceof Error && !(err instanceof SyntaxError)) throw err;
      }
    }
  }
}

/* ------------------------------------------------------------ chat */

export interface OllamaChatOpts {
  base?: string;
  model?: string;
  stream?: boolean;
  onToken?: (delta: string) => void;
  timeoutMs?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** auto-start the server when it is not running (default: setting) */
  autoStart?: boolean;
}

/** Parse an OpenAI-style SSE body, invoking onToken per delta. */
async function readSse(body: ReadableStream<Uint8Array>, onToken: (t: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
        };
        const delta = evt.choices?.[0]?.delta?.content ?? evt.choices?.[0]?.message?.content ?? '';
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        /* keep-alive or split JSON line */
      }
    }
  }
  return full;
}

/**
 * One OpenAI-compatible chat completion against the phone-local server.
 * Streams by default; falls back to a single JSON response otherwise.
 */
export async function ollamaChatCompletion(messages: ChatMessage[], opts: OllamaChatOpts = {}): Promise<string> {
  const base = opts.base || getOllamaBase();
  const model = opts.model || getOllamaModel();
  const stream = opts.stream !== false;
  const timeoutMs = opts.timeoutMs ?? (stream ? 180000 : 120000);
  const autoStart = opts.autoStart ?? isOllamaAutoStart();

  if (autoStart) {
    const ready = await ensureOllamaRunning(base, { timeoutMs: 30000 });
    if (!ready.ok) throw new Error(ready.message);
  }

  const plugin = nativePlugin();
  if (plugin) {
    const requestId = newRequestId();
    let remove: (() => void) | null = null;
    if (stream && opts.onToken && typeof plugin.addListener === 'function') {
      const handle = await plugin.addListener('ollamaToken', (data: Record<string, unknown>) => {
        if (data.requestId !== requestId) return;
        const token = typeof data.token === 'string' ? data.token : '';
        if (token) opts.onToken?.(token);
      });
      remove = () => void (handle as { remove: () => void }).remove();
    }
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => void plugin.cancel({ requestId }).catch(() => undefined), { once: true });
    }
    try {
      const res = (await plugin.chat({
        base: nativeBase(base),
        model,
        messages: messages.slice(-40).map(m => ({ role: m.role, content: m.content })),
        stream,
        requestId,
        timeoutMs,
        temperature: opts.temperature
      })) as { ok?: boolean; text?: string; message?: string };
      if (!res.ok) throw new Error(res.message || 'Ollama request failed.');
      const text = String(res.text ?? '');
      if (!text.trim()) throw new Error('Ollama returned an empty response.');
      return text;
    } finally {
      remove?.();
    }
  }

  const endpoint = chatCompletionsUrl(base);
  if (!endpoint) throw new Error('Ollama base URL is not configured.');
  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OLLAMA_PLACEHOLDER_KEY}` },
        body: JSON.stringify({
          model,
          messages: messages.slice(-40),
          stream,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {})
        })
      },
      timeoutMs,
      opts.signal
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (opts.signal?.aborted) throw new Error('Ollama request cancelled.');
      throw new Error(ollamaErrorMessage('timeout', base));
    }
    // A CORS rejection surfaces as an opaque TypeError, same as a dead port —
    // the status probe disambiguates the two for the caller's message.
    const probe = await ollamaStatus(base, 2500);
    throw new Error(probe.ok ? ollamaErrorMessage('cors', base) : ollamaErrorMessage('network', base));
  }
  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(ollamaErrorMessage(res.status, base, snippet));
  }
  if (stream && res.body) {
    const text = await readSse(res.body, opts.onToken ?? (() => undefined));
    if (!text.trim()) throw new Error('Ollama returned an empty response.');
    return text;
  }
  const d = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = d?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('Ollama returned an empty response.');
  return text;
}

/** Connection test used by the settings UI. Throws with a useful message. */
export async function testOllamaConnection(base = getOllamaBase()): Promise<OllamaStatus> {
  const st = await ollamaStatus(base, 6000);
  if (!st.ok) throw new Error(st.message);
  return st;
}

/* -------------------------------------------------- prompt enhancement */

/**
 * Rewrite a scene prompt into a richer, render-ready description using the
 * on-device model. This is a genuine text task an LLM can do well — it does
 * NOT generate pixels (Ollama serves text models only; image generation
 * still goes to the Local/cloud/self-hosted engines).
 *
 * Returns the enhanced prompt, or throws with an actionable message.
 */
export async function enhancePromptWithOllama(
  prompt: string,
  opts: { adult?: boolean; signal?: AbortSignal } = {}
): Promise<string> {
  const clean = prompt.trim();
  if (!clean) throw new Error('Nothing to enhance — the prompt is empty.');

  const guard = opts.adult
    ? 'The subject is a fictional adult (18+); keep any mature detail tasteful and non-explicit.'
    : 'Keep the description non-explicit.';

  const system =
    'You rewrite image-generation prompts for a photorealistic 3D character renderer. ' +
    'Return ONE improved prompt and nothing else: no preamble, no quotes, no markdown, no bullet points, no explanation. ' +
    'Preserve every concrete detail the user already specified (hair, outfit, pose, scene, lighting, camera). ' +
    'Add precise photographic and material detail — lens and focal length, lighting direction and quality, skin/fabric microdetail, colour grade. ' +
    `Keep it under 120 words. ${guard}`;

  const text = await ollamaChatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: clean }
    ],
    { stream: false, temperature: 0.7, signal: opts.signal, timeoutMs: 120000 }
  );

  // Models sometimes wrap the answer in quotes or a "Prompt:" label.
  let out = text.trim();
  out = out.replace(/^```[a-z]*\s*/i, '').replace(/```$/,'').trim();
  out = out.replace(/^(?:enhanced\s+|improved\s+)?prompt\s*[:-]\s*/i, '').trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }
  if (!out) throw new Error('The model returned an empty prompt.');
  return out;
}
