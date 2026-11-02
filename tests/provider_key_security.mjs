import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETTINGS_KEY = 'grok-girls-settings-v1';
const LEGACY_KEY_PREFIX = 'grok-girls-key-';
const GEMINI_KEY = 'TEST_ONLY_GEMINI_KEY_SENTINEL_6C2A';
const OPENROUTER_KEY = 'TEST_ONLY_OPENROUTER_KEY_SENTINEL_85E1';
const CUSTOM_KEY = 'TEST_ONLY_CUSTOM_KEY_SENTINEL_B44F';
let failures = 0;

class MemoryStorage {
  #items = new Map();

  get length() {
    return this.#items.size;
  }

  key(index) {
    return [...this.#items.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#items.get(String(key)) ?? null;
  }

  setItem(key, value) {
    this.#items.set(String(key), String(value));
  }

  removeItem(key) {
    this.#items.delete(String(key));
  }

  entries() {
    return [...this.#items.entries()];
  }
}

function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`);
  } else {
    console.error(`FAIL ${name}`);
    failures += 1;
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
const originalFetch = globalThis.fetch;
const requests = [];
let vite;

try {
  storage.setItem(SETTINGS_KEY, JSON.stringify({
    version: 1,
    connections: {
      gemini: { apiKey: GEMINI_KEY, endpoints: {}, models: {} },
      openrouter: { apiKey: OPENROUTER_KEY, endpoints: {}, models: {} }
    }
  }));
  storage.setItem(`${LEGACY_KEY_PREFIX}gemini`, GEMINI_KEY);
  storage.setItem(`${LEGACY_KEY_PREFIX}openrouter`, OPENROUTER_KEY);
  storage.setItem(`${LEGACY_KEY_PREFIX}custom`, CUSTOM_KEY);

  vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });

  const settings = await vite.ssrLoadModule('/src/services/settingsState.ts');
  const loaded = settings.loadSettings();
  const canonical = storage.getItem(SETTINGS_KEY) ?? '';
  const legacyKeyNamesRemain = storage.entries().some(([key]) => key.startsWith(LEGACY_KEY_PREFIX));
  check('legacy and canonical stored keys are discarded during migration',
    Object.values(loaded.connections).every(connection => !connection.apiKey)
      && !legacyKeyNamesRemain
      && !canonical.includes(GEMINI_KEY)
      && !canonical.includes(OPENROUTER_KEY));
  check('a key is unavailable after reload until re-entered',
    settings.getConnectionApiKey('gemini') === '');

  const providers = await vite.ssrLoadModule('/src/services/providers.ts');
  providers.saveApiKey('gemini', GEMINI_KEY);
  providers.saveApiKey('openrouter', OPENROUTER_KEY);
  providers.saveApiKey('custom', CUSTOM_KEY);
  providers.saveEndpoint('custom', 'https://custom.invalid/v1/chat/completions', 'chat');
  providers.saveEndpoint('custom', 'https://gen.pollinations.ai/image', 'image');

  const persistedAfterSave = storage.entries().map(([, value]) => value).join('\n');
  check('newly saved keys remain runtime-only',
    !persistedAfterSave.includes(GEMINI_KEY)
      && !persistedAfterSave.includes(OPENROUTER_KEY)
      && !persistedAfterSave.includes(CUSTOM_KEY)
      && !storage.entries().some(([key]) => key.startsWith(LEGACY_KEY_PREFIX)));
  check('provider code can use the current session key',
    providers.getSavedApiKey('gemini') === GEMINI_KEY);

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, headers: new Headers(init.headers ?? {}) });
    if (url.startsWith('https://gen.pollinations.ai/')) {
      return new Response('test-only response', { status: 401 });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'test response' }, { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] } }],
      choices: [{ message: { content: 'test response' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const messages = [{ role: 'user', content: 'offline regression fixture' }];
  await providers.chatWithProvider(messages, 'gemini');
  await providers.chatWithProvider(messages, 'openrouter');
  await providers.chatWithProvider(messages, 'custom');

  const gemini = providers.providers().find(provider => provider.name === 'gemini');
  await gemini.generate({ prompt: 'offline fixture', mode: 'image', width: 256, height: 256 });

  const custom = providers.providers().find(provider => provider.name === 'custom');
  try {
    await custom.generate({ prompt: 'offline fixture', mode: 'image', width: 256, height: 256 });
  } catch {
    // The mock deliberately returns 401; the request itself is what this gate checks.
  }

  const noKeyInUrls = requests.length === 5 && requests.every(({ url }) =>
    !url.includes(GEMINI_KEY)
      && !url.includes(OPENROUTER_KEY)
      && !url.includes(CUSTOM_KEY)
      && !/[?&]key=/i.test(url));
  check('provider requests never put credentials in URLs', noKeyInUrls);

  const geminiRequests = requests.filter(({ url }) => url.includes('generativelanguage.googleapis.com'));
  const openrouterRequest = requests.find(({ url }) => url.includes('openrouter.ai'));
  const customChatRequest = requests.find(({ url }) => url.includes('custom.invalid'));
  const pollinationsRequest = requests.find(({ url }) => url.includes('gen.pollinations.ai'));
  check('Gemini chat and generation use x-goog-api-key headers',
    geminiRequests.length === 2
      && geminiRequests.every(({ headers }) => headers.get('x-goog-api-key') === GEMINI_KEY));
  check('OpenRouter and custom chat use bearer headers',
    openrouterRequest?.headers.get('authorization') === `Bearer ${OPENROUTER_KEY}`
      && customChatRequest?.headers.get('authorization') === `Bearer ${CUSTOM_KEY}`);
  check('Pollinations image generation uses a bearer header',
    pollinationsRequest?.headers.get('authorization') === `Bearer ${CUSTOM_KEY}`);

  const finalStorage = storage.entries().map(([, value]) => value).join('\n');
  check('provider keys remain absent from browser storage after provider requests',
    !finalStorage.includes(GEMINI_KEY)
      && !finalStorage.includes(OPENROUTER_KEY)
      && !finalStorage.includes(CUSTOM_KEY));
} catch {
  console.error('FAIL provider-key security gate could not complete');
  failures += 1;
} finally {
  globalThis.fetch = originalFetch;
  if (vite) await vite.close();
}

if (failures) {
  console.error(`Provider-key security gate failed: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log('PASS provider-key security gate (all requests intercepted; no provider calls made)');
}
