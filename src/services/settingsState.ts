/* ------------------------------------------------------------------ */
/* settingsState — ONE typed canonical settings record.               */
/*                                                                     */
/* All app settings live under a single localStorage key:              */
/*   'grok-girls-settings-v1'                                          */
/*                                                                     */
/* Safety properties:                                                  */
/*  - Migration: on first read (no canonical record yet) the ~12      */
/*    legacy keys are folded in, preserving every saved value.         */
/*  - Write-through: every save also mirrors the legacy keys, so      */
/*    older code paths (or a rolled-back build) never see stale       */
/*    settings. Legacy keys are never removed by this module.         */
/*  - Corrupt/missing canonical record falls back to legacy fold,     */
/*    then to typed defaults. No reader ever throws.                  */
/*                                                                     */
/* The existing provider/self-host/content-gate facades delegate here */
/* (providers.ts, selfHosted.ts, ageGate.ts, App.tsx) — their public  */
/* signatures are unchanged.                                          */
/* ------------------------------------------------------------------ */

import type { LoraSlot } from './selfHosted';
import type { ProviderName } from './providers';

export const SETTINGS_KEY = 'grok-girls-settings-v1';

/* ------------------------------------------------------------- types */

export interface ContentGateSettings {
  ageConfirmed: boolean;
  /** the app's adult-content flag (legacy 'grok-girls-adult-v1' = '1') */
  adult: boolean;
}

export interface GenerationSettings {
  negative: string;
  seed: string;
  steps: number;
  cfg: number;
  size: number;
}

export interface ProviderPrefs {
  /** generation engine (legacy grok-girls-provider-v1) */
  image: ProviderName;
  /** chat engine (legacy grok-girls-chat-provider-v1) */
  chat: ProviderName;
}

export type ApiMode = 'image' | 'video' | 'chat';

/** per-provider connection profile (openrouter / gemini / custom / …) */
export interface ProviderConnection {
  apiKey: string;
  endpoints: Partial<Record<ApiMode | 'generic', string>>;
  models: Partial<Record<ApiMode | 'generic', string>>;
}

export interface SelfHostSettings {
  base: string;
  type: string; // 'a1111' | 'comfy' | 'unknown' (validated by the facade)
  checkpoint: string;
  sampler: string;
  upscaler: string;
  hiresFix: boolean;
  loras: LoraSlot[];
}

export interface HermesCapabilities {
  /** OpenAI-compatible chat completions */
  chat: boolean;
  /** /v1/models discovery */
  models: boolean;
  /** SSE token streaming */
  streaming: boolean;
  /** image generation (reserved; false) */
  image: boolean;
  /** video generation (reserved; false) */
  video: boolean;
}

export interface HermesSettings {
  url: string;
  model: string;
  enabled: boolean;
  /** free-form extra configuration (future-proof; no UI yet) */
  config: Record<string, string>;
  /** advertised capabilities of the canonical Hermes provider */
  capabilities: HermesCapabilities;
  /** last connection test outcome (models list on success) */
  lastTest: { at: number; ok: boolean; models?: string[]; error?: string } | null;
}

export interface SettingsState {
  version: 1;
  contentGate: ContentGateSettings;
  generation: GenerationSettings;
  provider: ProviderPrefs;
  connections: Record<string, ProviderConnection>;
  selfHost: SelfHostSettings;
  hermes: HermesSettings;
}

/* ------------------------------------------------------------ legacy */

const LEGACY = {
  adult: 'grok-girls-adult-v1',
  ageConfirmed: 'grok-girls-age-confirmed-v1',
  neg: 'grok-girls-neg-v1',
  seed: 'grok-girls-seed-v1',
  steps: 'grok-girls-steps-v1',
  cfg: 'grok-girls-cfg-v1',
  size: 'grok-girls-size-v1',
  provider: 'grok-girls-provider-v1',
  chatProvider: 'grok-girls-chat-provider-v1',
  key: 'grok-girls-key-',
  endpoint: 'grok-girls-endpoint-',
  model: 'grok-girls-model-',
  shBase: 'grok-girls-selfhosted-base',
  shType: 'grok-girls-selfhosted-type',
  shCkpt: 'grok-girls-selfhosted-ckpt',
  shSampler: 'grok-girls-selfhosted-sampler',
  shUpscaler: 'grok-girls-selfhosted-upscaler',
  shHires: 'grok-girls-selfhosted-hires',
  shLoras: 'grok-girls-selfhosted-loras',
  hermesUrl: 'grok-girls-hermes-url-v1',
  hermesModel: 'grok-girls-hermes-model-v1',
  hermesEnabled: 'grok-girls-hermes-enabled-v1'
} as const;

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string): boolean {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: SettingsState = {
  version: 1,
  contentGate: { ageConfirmed: false, adult: false },
  generation: { negative: '', seed: '', steps: 28, cfg: 7, size: 1024 },
  provider: { image: 'local', chat: 'local' },
  connections: {},
  selfHost: {
    base: '', type: 'unknown', checkpoint: '', sampler: '', upscaler: '',
    hiresFix: false, loras: []
  },
  hermes: {
    url: '',
    model: '',
    enabled: false,
    config: {},
    capabilities: { chat: true, models: true, streaming: true, image: false, video: false },
    lastTest: null
  }
};

/* --------------------------------------------------------- migration */

function readJson<T>(k: string): T | null {
  const raw = lsGet(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function foldLegacy(): SettingsState {
  const s: SettingsState = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsState;

  const adultRaw = lsGet(LEGACY.adult);
  // historical boot semantics: storage error -> default true; absent -> false
  if (adultRaw !== null) s.contentGate.adult = adultRaw === '1';
  s.contentGate.ageConfirmed = lsGet(LEGACY.ageConfirmed) === '18+';

  s.generation.negative = lsGet(LEGACY.neg) ?? '';
  s.generation.seed = lsGet(LEGACY.seed) ?? '';
  const num = (k: string, d: number): number => {
    const v = Number(lsGet(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  s.generation.steps = num(LEGACY.steps, 28);
  s.generation.cfg = num(LEGACY.cfg, 7);
  s.generation.size = num(LEGACY.size, 1024);

  const validProvider = (v: string | null): ProviderName =>
    v === 'openrouter' || v === 'gemini' || v === 'custom' || v === 'selfhosted' || v === 'hermes'
      ? v
      : 'local';
  s.provider.image = validProvider(lsGet(LEGACY.provider));
  s.provider.chat = validProvider(lsGet(LEGACY.chatProvider));

  for (const p of ['openrouter', 'gemini', 'custom', 'hermes']) {
    const conn: ProviderConnection = { apiKey: '', endpoints: {}, models: {} };
    conn.apiKey = lsGet(`${LEGACY.key}${p}`) ?? '';
    for (const m of ['generic', 'image', 'video', 'chat'] as const) {
      const ep = m === 'generic' ? lsGet(`${LEGACY.endpoint}${p}`) : lsGet(`${LEGACY.endpoint}${p}-${m}`);
      if (ep) conn.endpoints[m] = ep;
    }
    for (const m of ['generic', 'image', 'chat'] as const) {
      const md = m === 'generic' ? lsGet(`${LEGACY.model}${p}`) : lsGet(`${LEGACY.model}${p}-${m}`);
      if (md) conn.models[m] = md;
    }
    s.connections[p] = conn;
  }

  s.selfHost.base = lsGet(LEGACY.shBase) ?? '';
  s.selfHost.type = lsGet(LEGACY.shType) ?? 'unknown';
  s.selfHost.checkpoint = lsGet(LEGACY.shCkpt) ?? '';
  s.selfHost.sampler = lsGet(LEGACY.shSampler) ?? '';
  s.selfHost.upscaler = lsGet(LEGACY.shUpscaler) ?? '';
  s.selfHost.hiresFix = lsGet(LEGACY.shHires) === '1';
  try {
    const raw = lsGet(LEGACY.shLoras);
    const parsed = raw ? (JSON.parse(raw) as LoraSlot[]) : [];
    s.selfHost.loras = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    s.selfHost.loras = [];
  }

  // Hermes (local LLM) was written to its own keys before the canonical
  // record existed; fold them when present (enabled honours an explicit '0').
  s.hermes.url = lsGet(LEGACY.hermesUrl) ?? '';
  s.hermes.model = lsGet(LEGACY.hermesModel) ?? '';
  s.hermes.enabled = lsGet(LEGACY.hermesEnabled) === '1';

  return s;
}

/** Deep-merge any legacy values that are missing from an existing record
 *  (e.g. a record written before a field existed) — legacy never wins over
 *  an explicit canonical value. */
function overlayLegacyGaps(s: SettingsState): SettingsState {
  const legacy = foldLegacy();
  const out = { ...s, contentGate: { ...s.contentGate }, generation: { ...s.generation },
    provider: { ...s.provider }, connections: { ...s.connections },
    selfHost: { ...s.selfHost, loras: [...s.selfHost.loras] },
    hermes: { ...s.hermes, config: { ...s.hermes.config } } };
  // only touch fields still at their default
  const d = DEFAULT_SETTINGS;
  if (out.contentGate.ageConfirmed === d.contentGate.ageConfirmed) out.contentGate.ageConfirmed = legacy.contentGate.ageConfirmed;
  if (out.generation.negative === d.generation.negative) out.generation.negative = legacy.generation.negative;
  if (out.generation.seed === d.generation.seed) out.generation.seed = legacy.generation.seed;
  if (out.generation.steps === d.generation.steps) out.generation.steps = legacy.generation.steps;
  if (out.generation.cfg === d.generation.cfg) out.generation.cfg = legacy.generation.cfg;
  if (out.generation.size === d.generation.size) out.generation.size = legacy.generation.size;
  if (out.provider.image === d.provider.image) out.provider.image = legacy.provider.image;
  if (out.provider.chat === d.provider.chat) out.provider.chat = legacy.provider.chat;
  if (out.selfHost.base === '' ) out.selfHost.base = legacy.selfHost.base;
  if (out.selfHost.type === 'unknown') out.selfHost.type = legacy.selfHost.type;
  if (out.selfHost.checkpoint === '') out.selfHost.checkpoint = legacy.selfHost.checkpoint;
  if (out.selfHost.sampler === '') out.selfHost.sampler = legacy.selfHost.sampler;
  if (out.selfHost.upscaler === '') out.selfHost.upscaler = legacy.selfHost.upscaler;
  if (out.selfHost.hiresFix === false) out.selfHost.hiresFix = legacy.selfHost.hiresFix;
  if (out.selfHost.loras.length === 0) out.selfHost.loras = legacy.selfHost.loras;
  if (out.hermes.url === d.hermes.url) out.hermes.url = legacy.hermes.url;
  if (out.hermes.model === d.hermes.model) out.hermes.model = legacy.hermes.model;
  if (out.hermes.enabled === d.hermes.enabled) out.hermes.enabled = legacy.hermes.enabled;
  for (const p of Object.keys(legacy.connections)) {
    const conn = out.connections[p];
    const lconn = legacy.connections[p];
    if (!conn) out.connections[p] = lconn;
    else {
      if (conn.apiKey === '' ) conn.apiKey = lconn.apiKey;
      for (const m of Object.keys(lconn.endpoints)) if (!conn.endpoints[m as ApiMode]) conn.endpoints[m as ApiMode] = lconn.endpoints[m as ApiMode];
      for (const m of Object.keys(lconn.models)) if (!conn.models[m as ApiMode]) conn.models[m as ApiMode] = lconn.models[m as ApiMode];
    }
  }
  return out;
}

/* ------------------------------------------------------ cache/store */

let cache: SettingsState | null = null;

/** Deep-default a parsed (possibly partial / older-version) record. */
function sanitize(raw: Record<string, unknown>): SettingsState {
  const g = (raw.generation ?? {}) as Partial<GenerationSettings>;
  const cg = (raw.contentGate ?? {}) as Partial<ContentGateSettings>;
  const pv = (raw.provider ?? {}) as Partial<ProviderPrefs>;
  const sh = (raw.selfHost ?? {}) as Partial<SelfHostSettings>;
  const hm = (raw.hermes ?? {}) as Partial<HermesSettings>;
  const s: SettingsState = {
    version: 1,
    contentGate: { ...DEFAULT_SETTINGS.contentGate, ...cg },
    generation: { ...DEFAULT_SETTINGS.generation, ...g },
    provider: { ...DEFAULT_SETTINGS.provider, ...pv },
    connections: { ...((raw.connections ?? {}) as Record<string, ProviderConnection>) },
    selfHost: { ...DEFAULT_SETTINGS.selfHost, ...sh, loras: Array.isArray(sh.loras) ? sh.loras.slice(0, 3) : [] },
    hermes: {
      ...DEFAULT_SETTINGS.hermes,
      ...hm,
      config: { ...(hm.config ?? {}) },
      capabilities: { ...DEFAULT_SETTINGS.hermes.capabilities, ...((hm.capabilities ?? {}) as Partial<HermesCapabilities>) },
      lastTest: hm.lastTest ?? null
    }
  };
  return overlayLegacyGaps(s);
}

/** Canonical record: parse existing, else fold legacy, else defaults. */
export function loadSettings(): SettingsState {
  if (cache) return cache;
  const existing = readJson<Record<string, unknown>>(SETTINGS_KEY);
  let s: SettingsState;
  if (existing && typeof existing === 'object') {
    s = sanitize(existing);
  } else {
    s = foldLegacy();
  }
  saveSettings(s); // converge: canonical written (or refreshed) + legacy mirrored
  return s;
}

/** Persist the canonical record and mirror every value to its legacy key. */
export function saveSettings(next: SettingsState): void {
  cache = next;
  const ok = lsSet(SETTINGS_KEY, JSON.stringify(next));
  if (!ok) return; // storage full/unavailable — keep in-memory, no mirror
  // write-through mirror (keeps older readers / rollbacks correct)
  const g = next.contentGate;
  lsSet(LEGACY.adult, g.adult ? '1' : '0');
  lsSet(LEGACY.ageConfirmed, g.ageConfirmed ? '18+' : '');
  lsSet(LEGACY.neg, next.generation.negative);
  lsSet(LEGACY.seed, next.generation.seed);
  lsSet(LEGACY.steps, String(next.generation.steps));
  lsSet(LEGACY.cfg, String(next.generation.cfg));
  lsSet(LEGACY.size, String(next.generation.size));
  lsSet(LEGACY.provider, next.provider.image);
  lsSet(LEGACY.chatProvider, next.provider.chat);
  for (const p of Object.keys(next.connections)) {
    const c = next.connections[p];
    lsSet(`${LEGACY.key}${p}`, c.apiKey);
    const ep = (m: ApiMode | 'generic') =>
      c.endpoints[m] !== undefined ? lsSet(m === 'generic' ? `${LEGACY.endpoint}${p}` : `${LEGACY.endpoint}${p}-${m}`, c.endpoints[m] as string) : null;
    ep('generic'); ep('image'); ep('video'); ep('chat');
    const md = (m: ApiMode | 'generic') =>
      c.models[m] !== undefined ? lsSet(m === 'generic' ? `${LEGACY.model}${p}` : `${LEGACY.model}${p}-${m}`, c.models[m] as string) : null;
    md('generic'); md('image'); md('chat');
  }
  lsSet(LEGACY.shBase, next.selfHost.base);
  lsSet(LEGACY.shType, next.selfHost.type);
  lsSet(LEGACY.shCkpt, next.selfHost.checkpoint);
  lsSet(LEGACY.shSampler, next.selfHost.sampler);
  lsSet(LEGACY.shUpscaler, next.selfHost.upscaler);
  lsSet(LEGACY.shHires, next.selfHost.hiresFix ? '1' : '0');
  lsSet(LEGACY.shLoras, JSON.stringify(next.selfHost.loras.slice(0, 3)));
  lsSet(LEGACY.hermesUrl, next.hermes.url);
  lsSet(LEGACY.hermesModel, next.hermes.model);
  lsSet(LEGACY.hermesEnabled, next.hermes.enabled ? '1' : '0');
}

/** Mutate + persist in one step (invalidate cache first). */
function update(fn: (s: SettingsState) => SettingsState): SettingsState {
  const s = fn(loadSettings());
  saveSettings(s);
  return s;
}

/* ------------------------------------------------------ content gate */

export function isAgeConfirmed(): boolean {
  return loadSettings().contentGate.ageConfirmed;
}
export function confirmAdultAge(): void {
  update(s => ({ ...s, contentGate: { ...s.contentGate, ageConfirmed: true } }));
}
export function getAdultFlag(): boolean {
  return loadSettings().contentGate.adult;
}
export function setAdultFlag(v: boolean): void {
  update(s => ({ ...s, contentGate: { ...s.contentGate, adult: v } }));
}

/* ------------------------------------------------------ generation */

export function getGenerationSettings(): GenerationSettings {
  return { ...loadSettings().generation };
}
export function saveGenerationSettings(p: Partial<GenerationSettings>): void {
  update(s => ({ ...s, generation: { ...s.generation, ...p } }));
}

/* ------------------------------------------------- provider prefs */

export function getProviderPref(kind: 'image' | 'chat'): ProviderName {
  return kind === 'image' ? loadSettings().provider.image : loadSettings().provider.chat;
}
export function saveProviderPref(kind: 'image' | 'chat', p: ProviderName): void {
  update(s => ({ ...s, provider: { ...s.provider, [kind]: p } }));
}

/* ---------------------------------------------------- connections */

function connOf(s: SettingsState, p: string): ProviderConnection {
  const existing = s.connections[p];
  if (existing) return existing;
  const created: ProviderConnection = { apiKey: '', endpoints: {}, models: {} };
  s.connections[p] = created;
  return created;
}

export function getConnectionApiKey(p: string): string {
  return loadSettings().connections[p]?.apiKey ?? '';
}
export function saveConnectionApiKey(p: string, key: string): void {
  update(s => { connOf(s, p).apiKey = key.trim(); return s; });
}
/** Slot-exact read: mode-specific slot, else generic slot (no other fallback). */
export function getConnectionEndpoint(p: string, m?: ApiMode): string {
  const c = loadSettings().connections[p];
  if (!c) return '';
  if (m) return c.endpoints[m] ?? '';
  return c.endpoints.generic ?? '';
}
export function saveConnectionEndpoint(p: string, url: string, m?: ApiMode): void {
  update(s => {
    const c = connOf(s, p);
    (m ? (c.endpoints[m] = url.trim()) : (c.endpoints.generic = url.trim()));
    return s;
  });
}
/** Slot-exact read: mode-specific slot only when m given (models had no
 *  generic fallback historically), generic slot otherwise. */
export function getConnectionModel(p: string, m?: ApiMode): string {
  const c = loadSettings().connections[p];
  if (!c) return '';
  if (m) return c.models[m] ?? '';
  return c.models.generic ?? '';
}
export function saveConnectionModel(p: string, model: string, m?: ApiMode): void {
  update(s => {
    const c = connOf(s, p);
    (m ? (c.models[m] = model.trim()) : (c.models.generic = model.trim()));
    return s;
  });
}

/* ------------------------------------------------------- self-host */

export function getSelfHostBase(): string {
  return loadSettings().selfHost.base;
}
export function saveSelfHostBase(url: string): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, base: url.trim().replace(/\/+$/, '') } }));
}
export function getSelfHostType(): string {
  return loadSettings().selfHost.type;
}
export function saveSelfHostType(t: string): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, type: t } }));
}
export function getSelfHostCheckpoint(): string {
  return loadSettings().selfHost.checkpoint;
}
export function saveSelfHostCheckpoint(name: string): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, checkpoint: name } }));
}
export function getSelfHostSampler(): string {
  return loadSettings().selfHost.sampler;
}
export function saveSelfHostSampler(name: string): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, sampler: name } }));
}
export function getSelfHostUpscaler(): string {
  return loadSettings().selfHost.upscaler;
}
export function saveSelfHostUpscaler(name: string): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, upscaler: name } }));
}
export function getSelfHostHiresFix(): boolean {
  return loadSettings().selfHost.hiresFix;
}
export function saveSelfHostHiresFix(v: boolean): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, hiresFix: v } }));
}
export function getSelfHostLoras(): LoraSlot[] {
  return [...loadSettings().selfHost.loras];
}
export function saveSelfHostLoras(slots: LoraSlot[]): void {
  update(s => ({ ...s, selfHost: { ...s.selfHost, loras: slots.slice(0, 3) } }));
}

/* --------------------------------------------------------- hermes */

export function getHermesSettings(): HermesSettings {
  const h = loadSettings().hermes;
  return { ...h, config: { ...h.config } };
}
export function saveHermesSettings(p: Partial<HermesSettings>): void {
  update(s => ({
    ...s,
    hermes: { ...s.hermes, ...p, config: { ...s.hermes.config, ...(p.config ?? {}) } }
  }));
}
