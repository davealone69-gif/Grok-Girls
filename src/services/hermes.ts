import { getSavedApiKey, getSavedEndpoint, getSavedModel, saveApiKey, saveEndpoint, saveModel } from './providers';

const HERMES_URL_KEY = 'grok-girls-hermes-url-v1';
const HERMES_ENABLED_KEY = 'grok-girls-hermes-enabled-v1';
const DEFAULT_MODEL = 'NousResearch/Hermes-3-Llama-3.1-8B';

function storageGet(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function getHermesUrl(): string {
  return storageGet(HERMES_URL_KEY) || getSavedEndpoint('custom', 'chat');
}

export function getHermesModel(): string {
  return getSavedModel('custom', 'chat') || storageGet('grok-girls-hermes-model-v1') || DEFAULT_MODEL;
}

export function isHermesEnabled(): boolean {
  return storageGet(HERMES_ENABLED_KEY) === '1';
}

export function saveHermesConfig(url: string, model: string, apiKey = '', enabled = true) {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanModel = model.trim() || DEFAULT_MODEL;
  storageSet(HERMES_URL_KEY, cleanUrl);
  storageSet('grok-girls-hermes-model-v1', cleanModel);
  storageSet(HERMES_ENABLED_KEY, enabled ? '1' : '0');
  saveEndpoint('custom', cleanUrl, 'chat');
  saveModel('custom', cleanModel, 'chat');
  saveApiKey('custom', apiKey);
  saveModel('custom', cleanModel);
}

export function setHermesEnabled(enabled: boolean) {
  storageSet(HERMES_ENABLED_KEY, enabled ? '1' : '0');
}

export function hermesChatEndpoint(url = getHermesUrl()): string {
  const base = url.trim().replace(/\/$/, '');
  if (!base) return '';
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export function hermesModelsEndpoint(url = getHermesUrl()): string {
  const base = url.trim().replace(/\/$/, '');
  if (!base) return '';
  if (/\/models$/i.test(base)) return base;
  if (/\/chat\/completions$/i.test(base)) return base.replace(/\/chat\/completions$/i, '/models');
  if (/\/v1$/i.test(base)) return `${base}/models`;
  return `${base}/v1/models`;
}

export async function testHermesConnection(url = getHermesUrl(), apiKey = getSavedApiKey('custom')) {
  const endpoint = hermesModelsEndpoint(url);
  if (!endpoint) throw new Error('Enter the Hermes endpoint first.');
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : undefined
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Hermes HTTP ${response.status}${text ? ` — ${text.slice(0, 180)}` : ''}`);
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const models = Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
  return { ok: true, endpoint, models };
}
