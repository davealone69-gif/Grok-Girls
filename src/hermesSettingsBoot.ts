import { getHermesApiKey, getHermesModel, getHermesUrl, saveHermesConfig, testHermesConnection } from './services/hermes';
import { saveProviderPref } from './services/settingsState';

const SECTION_ID = 'grok-hermes-settings-section';

function esc(value: string): string {
  return value.replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function mount() {
  if (document.getElementById(SECTION_ID)) return;
  const host = document.querySelector('.settings-sections');
  if (!host) return;

  const section = document.createElement('div');
  section.id = SECTION_ID;
  section.className = 'settings-section';
  section.innerHTML = `
    <div class="settings-section-title">🧠 NOUS HERMES LOCAL LLM</div>
    <p class="settings-note">Connect Grok-Girls to your OpenAI-compatible Hermes server. The URL and model stay on this device.</p>
    <label class="settings-field">
      <span>Hermes Endpoint</span>
      <input id="grok-hermes-url" type="url" placeholder="http://127.0.0.1:8081/v1" />
      <em>Enter the Hermes API base, for example http://127.0.0.1:8081/v1. The app adds /chat/completions automatically.</em>
    </label>
    <label class="settings-field">
      <span>Hermes Model</span>
      <input id="grok-hermes-model" type="text" placeholder="NousResearch/Hermes-3-Llama-3.1-8B" />
      <em>Use the exact model ID exposed by your Hermes server.</em>
    </label>
    <label class="settings-field">
      <span>API Key (optional)</span>
      <input id="grok-hermes-key" type="password" placeholder="Leave empty for local servers" />
    </label>
    <label class="selfhosted-toggle">
      <input id="grok-hermes-enabled" type="checkbox" />
      <span>Enable Hermes for chat</span>
    </label>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
      <button id="grok-hermes-test" type="button" class="btn-test-server">🔌 TEST HERMES</button>
      <button id="grok-hermes-use" type="button" class="prompt-mini-btn">USE HERMES FOR CHAT</button>
      <span id="grok-hermes-status" style="font-size:12px"></span>
    </div>
  `;
  host.prepend(section);

  const url = section.querySelector<HTMLInputElement>('#grok-hermes-url')!;
  const model = section.querySelector<HTMLInputElement>('#grok-hermes-model')!;
  const key = section.querySelector<HTMLInputElement>('#grok-hermes-key')!;
  const enabled = section.querySelector<HTMLInputElement>('#grok-hermes-enabled')!;
  const status = section.querySelector<HTMLElement>('#grok-hermes-status')!;
  {
    const last = (() => {
      try {
        const rec = JSON.parse(localStorage.getItem('grok-girls-settings-v1') || 'null');
        return rec?.hermes?.lastTest ?? null;
      } catch { return null; }
    })();
    if (last) status.textContent = last.ok
      ? `✓ Last test: connected · ${(last.models || []).length} model(s)`
      : `✕ Last test: ${String(last.error || 'failed').slice(0, 90)}`;
  }
  url.value = getHermesUrl();
  model.value = getHermesModel();
  key.value = getHermesApiKey();
  enabled.checked = (() => {
    try { return localStorage.getItem('grok-girls-hermes-enabled-v1') === '1'; } catch { return false; }
  })();

  const persist = () => {
    // Canonical SettingsState is the single source; it mirrors legacy keys.
    saveHermesConfig(url.value, model.value, key.value, enabled.checked);
    // Once configured + enabled, Hermes becomes the active chat engine.
    if (enabled.checked) saveProviderPref('chat', 'hermes');
  };

  section.querySelector<HTMLButtonElement>('#grok-hermes-test')!.onclick = async () => {
    status.textContent = 'Testing…';
    try {
      const result = await testHermesConnection(url.value, key.value);
      status.textContent = result.models.length
        ? `✓ Connected · ${result.models.length} model(s)`
        : '✓ Connected';
      if (!model.value && result.models[0]) model.value = result.models[0];
    } catch (error) {
      status.textContent = `✕ ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  section.querySelector<HTMLButtonElement>('#grok-hermes-use')!.onclick = () => {
    if (!url.value.trim()) {
      status.textContent = 'Enter the Hermes endpoint first.';
      return;
    }
    enabled.checked = true;
    persist();
    const select = document.querySelector<HTMLSelectElement>('.mini-provider-select');
    if (select) {
      select.value = 'hermes';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    status.textContent = '✓ Hermes enabled and selected as the chat engine';
  };

  url.addEventListener('change', persist);
  model.addEventListener('change', persist);
  key.addEventListener('change', persist);
  enabled.addEventListener('change', persist);
}

const observer = new MutationObserver(mount);
observer.observe(document.documentElement, { childList: true, subtree: true });
mount();
