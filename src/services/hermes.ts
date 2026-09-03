/* ------------------------------------------------------------------ */
/* hermes — first-class local/offline AI provider adapter.            */
/*                                                                     */
/* Hermes is its own provider identity ('hermes'), NOT a clever alias */
/* for 'custom'. Its config lives in the canonical SettingsState       */
/* record (url / model / api key / enabled / lastTest / capabilities); */
/* the old standalone keys remain only as mirrored legacy facades.     */
/*                                                                     */
/* Endpoints are OpenAI-compatible, e.g.:                              */
/*   http://127.0.0.1:8081/v1   (local Hermes server)                  */
/*   http://127.0.0.1:1234/v1   (LM Studio / llama.cpp style)          */
/*                                                                     */
/* This module never imports providers.ts (no cycles): it talks to     */
/* settingsState directly.                                             */
/* ------------------------------------------------------------------ */

import {
  getConnectionApiKey,
  getConnectionEndpoint,
  getConnectionModel,
  loadSettings,
  saveConnectionApiKey,
  saveConnectionEndpoint,
  saveConnectionModel,
  saveHermesSettings
} from './settingsState';
import type { ChatMessage } from './providers';

const DEFAULT_MODEL = 'NousResearch/Hermes-3-Llama-3.1-8B';

const env = () => (import.meta.env || {}) as Record<string, string | undefined>;

/* ---------------------------------------------------------- settings */

/** Canonical Hermes base URL (e.g. http://127.0.0.1:8081/v1). Falls back
 *  to the hermes connection slot, then the legacy 'custom' chat endpoint
 *  written by pre-provider builds. */
export function getHermesUrl(): string {
  const s = loadSettings();
  if (s.hermes.url.trim()) return s.hermes.url.trim();
  const conn = getConnectionEndpoint('hermes', 'chat') || getConnectionEndpoint('hermes');
  if (conn) return conn.trim();
  const legacyCustom = getConnectionEndpoint('custom', 'chat');
  if (legacyCustom && legacyCustom.includes('chat/completions')) return legacyCustom.trim();
  return '';
}

/** Model id. Canonical record wins; falls back to the hermes/custom chat
 *  slots, then the published default. */
export function getHermesModel(): string {
  const s = loadSettings();
  if (s.hermes.model.trim()) return s.hermes.model.trim();
  const conn =
    getConnectionModel('hermes', 'chat') ||
    getConnectionModel('hermes') ||
    getConnectionModel('custom', 'chat') ||
    getConnectionModel('custom');
  return conn || DEFAULT_MODEL;
}

/** API key. Historical builds stored the Hermes key under the 'custom'
 *  connection; new builds use the 'hermes' slot. Empty for local servers. */
export function getHermesApiKey(): string {
  const direct = getConnectionApiKey('hermes');
  if (direct) return direct;
  const legacyCustom = getConnectionApiKey('custom');
  if (legacyCustom) return legacyCustom;
  return env()['VITE_HERMES_API_KEY'] ?? '';
}

export function isHermesEnabled(): boolean {
  return loadSettings().hermes.enabled;
}

export function isHermesChatReady(): boolean {
  const s = loadSettings();
  return s.hermes.enabled && s.hermes.url.trim().length > 0;
}

/** Persist everything the canonical record + connection slots need.
 *  saveHermesSettings() mirrors the legacy keys for older readers. */
export function saveHermesConfig(url: string, model: string, apiKey = '', enabled = true) {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanModel = model.trim() || DEFAULT_MODEL;
  const chatEndpoint = hermesChatEndpoint(cleanUrl);
  saveHermesSettings({ url: cleanUrl, model: cleanModel, enabled });
  saveConnectionApiKey('hermes', apiKey.trim());
  if (chatEndpoint) saveConnectionEndpoint('hermes', chatEndpoint, 'chat');
  saveConnectionModel('hermes', cleanModel, 'chat');
  saveConnectionModel('hermes', cleanModel);
}

export function setHermesEnabled(enabled: boolean) {
  saveHermesSettings({ enabled });
}

/* ----------------------------------------------------------- helpers */

function recordTest(outcome: { ok: boolean; models?: string[]; error?: string }) {
  saveHermesSettings({ lastTest: { at: Date.now(), ...outcome } });
}

/** OpenAI-compatible /v1/chat/completions endpoint for a base URL. */
export function hermesChatEndpoint(url = getHermesUrl()): string {
  const base = url.trim().replace(/\/+$/, '');
  if (!base) return '';
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/** OpenAI-compatible /v1/models discovery endpoint. */
export function hermesModelsEndpoint(url = getHermesUrl()): string {
  const base = url.trim().replace(/\/+$/, '');
  if (!base) return '';
  if (/\/models$/i.test(base)) return base;
  if (/\/chat\/completions$/i.test(base)) return base.replace(/\/chat\/completions$/i, '/models');
  if (/\/v1$/i.test(base)) return `${base}/models`;
  return `${base}/v1/models`;
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, stream = false): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const signal = stream ? init.signal || ctrl.signal : ctrl.signal;
  return fetch(url, { ...init, signal }).finally(() => clearTimeout(t));
}

/** Human-useful failure text for common local-server problems. */
export function hermesErrorMessage(status: number | 'network', url: string, snippet: string): string {
  if (status === 'network') {
    const base = /https?:\/\/[^/]+/i.exec(url)?.[0] ?? url;
    return `Cannot reach Hermes at ${base} — is the local server running? (network error)`;
  }
  if (status === 401 || status === 403) {
    return `Hermes rejected the API key (HTTP ${status}) — for local servers leave the key empty.`;
  }
  if (status === 404) {
    return `Hermes endpoint not found (404) at ${url}. Check the base URL — it should end in /v1, e.g. http://127.0.0.1:8081/v1 or http://127.0.0.1:1234/v1`;
  }
  if (status === 422) {
    return `Hermes rejected the request (HTTP 422) — the model may not exist or the payload is unsupported: ${snippet}`;
  }
  return `Hermes HTTP ${status}${snippet ? ` — ${snippet}` : ''}`;
}

async function httpError(res: Response, url: string): Promise<Error> {
  const text = await res.text().catch(() => '');
  const snippet = (text || '').slice(0, 200).replace(/\s+/g, ' ').trim();
  return new Error(hermesErrorMessage(res.status, url, snippet));
}

/* ---------------------------------------------------- models discovery */

export async function listHermesModels(url = getHermesUrl(), apiKey = getHermesApiKey()) {
  const endpoint = hermesModelsEndpoint(url);
  if (!endpoint) throw new Error('Enter the Hermes endpoint first.');
  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      { method: 'GET', headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : undefined },
      10000
    );
  } catch {
    throw new Error(hermesErrorMessage('network', url, ''));
  }
  if (!res.ok) throw await httpError(res, url);
  const text = await res.text().catch(() => '');
  let json: { data?: { id?: string }[] } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Hermes /models did not return JSON at ${endpoint} — is this an OpenAI-compatible server?`);
  }
  const models = Array.isArray(json?.data)
    ? json.data.map((m: { id?: string }) => m?.id).filter((x): x is string => typeof x === 'string' && Boolean(x))
    : [];
  return { ok: true as const, endpoint, models };
}

/** Connection test with useful failures; records the outcome in the
 *  canonical settings record (lastTest) for status UI + suites. */
export async function testHermesConnection(url = getHermesUrl(), apiKey = getHermesApiKey()) {
  try {
    const out = await listHermesModels(url, apiKey);
    recordTest({ ok: true, models: out.models });
    return { ...out, message: `✓ Connected${out.models.length ? ` · ${out.models.length} model(s) discoverable` : ''}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordTest({ ok: false, error: message });
    throw new Error(message);
  }
}

/* ---------------------------------------------------------- chat core */

interface HermesChatOpts {
  model?: string;
  url?: string;
  apiKey?: string;
  stream?: boolean;
  onToken?: (delta: string) => void;
  timeoutMs?: number;
}

/** Stream-parse an SSE body and invoke onToken per content delta. */
async function readSseStream(body: ReadableStream<Uint8Array>, onToken: (t: string) => void): Promise<string> {
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
        const evt = JSON.parse(payload) as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] };
        const delta = evt.choices?.[0]?.delta?.content ?? evt.choices?.[0]?.message?.content ?? '';
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        // keep-alive or partial JSON line: ignore
      }
    }
  }
  return full;
}

/** Single OpenAI-compatible chat completion call (streaming optional). */
export async function hermesChatCompletion(messages: ChatMessage[], opts: HermesChatOpts = {}): Promise<string> {
  const url = opts.url || getHermesUrl();
  const endpoint = hermesChatEndpoint(url);
  if (!endpoint) throw new Error('Hermes endpoint is not configured — set it in AI Settings.');
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : getHermesApiKey();
  const model = opts.model || getHermesModel();
  const stream = opts.stream === true;
  const timeoutMs = opts.timeoutMs ?? (stream ? 120000 : 45000);
  const payload: Record<string, unknown> = { model, messages: messages.slice(-40), stream };

  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}) },
        body: JSON.stringify(payload)
      },
      timeoutMs,
      stream
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Hermes request timed out after ${Math.round(timeoutMs / 1000)}s at ${endpoint}.`);
    }
    throw new Error(hermesErrorMessage('network', url, ''));
  }
  if (!res.ok) throw await httpError(res, url);

  if (stream && res.body) {
    let text: string;
    try {
      text = await readSseStream(res.body, opts.onToken ?? (() => undefined));
    } catch (err) {
      throw new Error(`Hermes stream interrupted: ${err instanceof Error ? err.message : String(err)}`);
    }
    return text;
  }
  const d = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    text?: string;
  } | null;
  const text = d?.choices?.[0]?.message?.content ?? d?.text ?? '';
  if (!text) throw new Error('Hermes returned an empty response.');
  return text;
}

/* -------------------------------------------- structured avatar spec */

/** Trailing single-line structured block used for avatar/scene edits.
 *  Kept on one line so SSE streaming and display stripping are trivial. */
export const HERMES_SPEC_MARKER = '🧬';

export const HERMES_CHAT_SYSTEM_TAIL = `\nIf the user asks you to create, change or design the avatar (appearance, hair, hair color, skin, body, eyes, makeup, outfit, pose, expression, scene/room or lighting), also end your reply with exactly one final line starting with 🧬 followed by a single-line JSON object. Use only these keys when you have a value: hair, hairColor, skinTone, bodyType, eyes, eyeShape, faceShape, makeup, lipstick, brows, outfit, pose, expression, scene, lighting, choker, hosiery, tattoos, augments, gender, age. Values: prefer the exact wording you were given in the user's message; never invent values the user did not ask for, and never emit the 🧬 line for ordinary conversation. Example of the final line: 🧬{"hairColor":"vibrant ruby red","hair":"long glamorous waves","makeup":"dark smokey eyeshadow with winged eyeliner","scene":"vintage tufted dark leather armchair, moody boudoir with crimson edge lighting"}`;

/** Split the 🧬 structured line out of a full reply. */
export function extractHermesSpecBlock(text: string): { text: string; raw: string | null } {
  const lines = text.split('\n');
  const last = lines[lines.length - 1] ?? '';
  const idx = last.indexOf(HERMES_SPEC_MARKER);
  if (idx === -1) return { text, raw: null };
  const raw = last.slice(idx + HERMES_SPEC_MARKER.length).trim();
  const cleaned = lines.slice(0, lines.length - 1).join('\n').replace(/\s+$/, '');
  return { text: cleaned, raw: raw || null };
}
