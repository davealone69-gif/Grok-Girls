import React, { useState } from 'react';
import {
  getSavedApiKey,
  saveApiKey,
  getSavedEndpoint,
  saveEndpoint,
  getSavedModel,
  saveModel
} from '../services/providers';
import {
  A1111_SAMPLERS,
  A1111_UPSCALERS,
  SelfHostServerType,
  SelfHostStatus,
  fetchLoras,
  fetchModels,
  getCheckpoint,
  getHiresFix,
  getSampler,
  getServerBase,
  getUpscaler,
  loadLoraSlots,
  saveCheckpoint,
  saveHiresFix,
  saveLoraSlots,
  saveSampler,
  saveServerBase,
  saveUpscaler,
  testConnection
} from '../services/selfHosted';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <em>{hint}</em>}
    </label>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  /* cloud providers */
  const [openRouterKey, setOpenRouterKey] = useState(() => getSavedApiKey('openrouter'));
  const [openRouterImageModel, setOpenRouterImageModel] = useState(() => getSavedModel('openrouter', 'image'));
  const [openRouterChatModel, setOpenRouterChatModel] = useState(() => getSavedModel('openrouter', 'chat'));
  const [geminiKey, setGeminiKey] = useState(() => getSavedApiKey('gemini'));
  const [geminiImageModel, setGeminiImageModel] = useState(() => getSavedModel('gemini', 'image'));
  const [geminiChatModel, setGeminiChatModel] = useState(() => getSavedModel('gemini', 'chat'));
  const [customKey, setCustomKey] = useState(() => getSavedApiKey('custom'));
  const [customChatEndpoint, setCustomChatEndpoint] = useState(() => getSavedEndpoint('custom', 'chat'));
  const [customImageEndpoint, setCustomImageEndpoint] = useState(() => getSavedEndpoint('custom', 'image'));
  const [customVideoEndpoint, setCustomVideoEndpoint] = useState(() => getSavedEndpoint('custom', 'video'));
  const [customModel, setCustomModel] = useState(() => getSavedModel('custom'));
  const [savedStatus, setSavedStatus] = useState('');

  /* self-hosted server */
  const [shBase, setShBase] = useState(() => getServerBase());
  const [shStatus, setShStatus] = useState<SelfHostStatus | null>(null);
  const [shTesting, setShTesting] = useState(false);
  const [shModels, setShModels] = useState<string[]>([]);
  const [shModel, setShModel] = useState(() => getCheckpoint());
  const [shLoras, setShLoras] = useState<string[]>([]);
  const [shLoraSlots, setShLoraSlots] = useState(() => {
    const s = loadLoraSlots();
    while (s.length < 3) s.push({ name: '', weight: 1 });
    return s.slice(0, 3);
  });
  const [shSampler, setShSampler] = useState(() => getSampler() || 'DPM++ 2M Karras');
  const [shUpscaler, setShUpscaler] = useState(() => getUpscaler() || 'Latent');
  const [shHires, setShHires] = useState(() => getHiresFix());

  if (!isOpen) return null;

  const persistSelfHosted = () => {
    saveServerBase(shBase);
    saveCheckpoint(shModel);
    saveSampler(shSampler);
    saveUpscaler(shUpscaler);
    saveHiresFix(shHires);
    saveLoraSlots(shLoraSlots);
  };

  const handleTest = async () => {
    if (!shBase.trim()) {
      setShStatus({ ok: false, serverType: 'unknown', message: 'Enter a server URL first.' });
      return;
    }
    setShTesting(true);
    setShStatus(null);
    saveServerBase(shBase);
    const st = await testConnection();
    setShStatus(st);
    setShTesting(false);
    if (st.ok) {
      const models = await fetchModels();
      setShModels(models);
      if (models.length && !shModel) setShModel(models[0]);
      const loras = await fetchLoras();
      setShLoras(loras);
    }
  };

  const handleFetchModels = async () => {
    if (!shBase.trim()) return;
    saveServerBase(shBase);
    const models = await fetchModels();
    setShModels(models);
    if (models.length && !shModel) setShModel(models[0]);
  };

  const handleSave = () => {
    saveApiKey('openrouter', openRouterKey);
    saveModel('openrouter', openRouterImageModel, 'image');
    saveModel('openrouter', openRouterChatModel, 'chat');
    saveApiKey('gemini', geminiKey);
    saveModel('gemini', geminiImageModel, 'image');
    saveModel('gemini', geminiChatModel, 'chat');
    saveApiKey('custom', customKey);
    saveEndpoint('custom', customChatEndpoint, 'chat');
    saveEndpoint('custom', customImageEndpoint, 'image');
    saveEndpoint('custom', customVideoEndpoint, 'video');
    saveModel('custom', customModel);
    persistSelfHosted();
    setSavedStatus('Configuration saved in browser storage!');
    setTimeout(() => {
      setSavedStatus('');
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    saveApiKey('openrouter', '');
    saveModel('openrouter', '', 'image');
    saveModel('openrouter', '', 'chat');
    saveApiKey('gemini', '');
    saveModel('gemini', '', 'image');
    saveModel('gemini', '', 'chat');
    saveApiKey('custom', '');
    saveEndpoint('custom', '', 'chat');
    saveEndpoint('custom', '', 'image');
    saveEndpoint('custom', '', 'video');
    saveModel('custom', '');
    saveServerBase('');
    saveCheckpoint('');
    saveLoraSlots([{ name: '', weight: 1 }, { name: '', weight: 1 }, { name: '', weight: 1 }]);
    setOpenRouterKey('');
    setOpenRouterImageModel('');
    setOpenRouterChatModel('');
    setGeminiKey('');
    setGeminiImageModel('');
    setGeminiChatModel('');
    setCustomKey('');
    setCustomChatEndpoint('');
    setCustomImageEndpoint('');
    setCustomVideoEndpoint('');
    setCustomModel('');
    setShBase('');
    setShModel('');
    setShStatus(null);
    setShModels([]);
    setShLoras([]);
    setShLoraSlots([{ name: '', weight: 1 }, { name: '', weight: 1 }, { name: '', weight: 1 }]);
    setSavedStatus('All keys and models cleared.');
    setTimeout(() => setSavedStatus(''), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card settings-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙ AI Provider Settings</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p style={{ color: '#aaa', fontSize: 13, marginTop: 0 }}>
          Configure cloud credentials or your own self-hosted render server. Keys are stored only in
          your browser's local storage. The local engine works without any of this.
        </p>

        {savedStatus && (
          <div
            style={{
              background: '#193325',
              border: '1px solid #7ff0bd',
              color: '#7ff0bd',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 12
            }}
          >
            {savedStatus}
          </div>
        )}

        <div className="settings-sections">
          {/* SELF-HOSTED */}
          <div className="settings-section selfhosted-section">
            <div className="settings-section-title">🖥️ SELF-HOSTED SERVER — A1111 / ComfyUI</div>
            <p className="settings-note">
              Your own machine, your own model, your rules. Point the app at a running AUTOMATIC1111
              SD-WebUI (<code>--api</code> flag) or ComfyUI instance and render directly to it.
            </p>
            <Field
              label="Server URL"
              value={shBase}
              onChange={setShBase}
              placeholder="http://127.0.0.1:7860  or  http://192.168.1.50:8188"
              hint="A1111 port is usually 7860, ComfyUI 8188. LAN works from your phone's browser."
            />
            <div className="selfhosted-actions">
              <button className="btn-test-server" disabled={shTesting} onClick={handleTest}>
                {shTesting ? 'TESTING…' : '🔌 TEST CONNECTION'}
              </button>
              <button className="prompt-mini-btn" onClick={handleFetchModels}>
                🔄 FETCH MODELS
              </button>
            </div>
            {shStatus && (
              <div className={`selfhosted-status ${shStatus.ok ? 'ok' : 'fail'}`}>
                {shStatus.ok ? '✓' : '✕'} {shStatus.message}
                {shStatus.ok && shStatus.modelCount ? ` · ${shStatus.modelCount} models` : ''}
                {shStatus.ok && shStatus.loraCount ? ` · ${shStatus.loraCount} loras` : ''}
              </div>
            )}

            <label className="settings-field">
              <span>Checkpoint / Model</span>
              <select value={shModel} onChange={e => setShModel(e.target.value)}>
                <option value="">— select checkpoint —</option>
                {shModels.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <em>Switches the active checkpoint via override_settings (A1111) or the ComfyUI loader node.</em>
            </label>

            <div className="selfhosted-grid2">
              <label className="settings-field">
                <span>Sampler</span>
                <select value={shSampler} onChange={e => setShSampler(e.target.value)}>
                  {A1111_SAMPLERS.map(sp => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Hires-Fix Upscaler</span>
                <select value={shUpscaler} onChange={e => setShUpscaler(e.target.value)}>
                  {A1111_UPSCALERS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="selfhosted-toggle">
              <input type="checkbox" checked={shHires} onChange={e => setShHires(e.target.checked)} />
              <span>Enable Hires-Fix second pass (sharper HD detail)</span>
            </label>

            <div className="dock-section-title" style={{ marginTop: 4 }}>
              LORA SLOTS (added to the prompt as &lt;lora:name:weight&gt;)
            </div>
            {shLoras.length > 0 && (
              <div className="lora-hint">
                Available on server: {shLoras.slice(0, 12).join(', ')}
                {shLoras.length > 12 ? ` +${shLoras.length - 12} more` : ''}
              </div>
            )}
            {shLoraSlots.map((slot, i) => (
              <div key={i} className="lora-row">
                <input
                  type="text"
                  list="lora-names"
                  value={slot.name}
                  placeholder={`LORA ${i + 1} name`}
                  onChange={e =>
                    setShLoraSlots(slots => slots.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                  }
                />
                <input
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={slot.weight}
                  onChange={e =>
                    setShLoraSlots(slots =>
                      slots.map((s, j) => (j === i ? { ...s, weight: Number(e.target.value) || 1 } : s))
                    )
                  }
                  title="Weight"
                />
              </div>
            ))}
            <datalist id="lora-names">
              {shLoras.map(l => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {/* OPENROUTER */}
          <div className="settings-section">
            <div className="settings-section-title">🔮 OPENROUTER</div>
            <Field
              label="API Key"
              value={openRouterKey}
              onChange={setOpenRouterKey}
              placeholder="sk-or-v1-..."
              type="password"
              hint="Required for cloud rendering & chat."
            />
            <Field
              label="Image Model"
              value={openRouterImageModel}
              onChange={setOpenRouterImageModel}
              placeholder="google/gemini-2.5-flash-image-preview (default)"
              hint="Leave empty for the built-in default."
            />
            <Field
              label="Chat Model"
              value={openRouterChatModel}
              onChange={setOpenRouterChatModel}
              placeholder="openai/gpt-4o-mini (default)"
              hint="Any OpenRouter chat model ID."
            />
          </div>

          {/* GEMINI */}
          <div className="settings-section">
            <div className="settings-section-title">🟣 GOOGLE GEMINI</div>
            <Field
              label="API Key"
              value={geminiKey}
              onChange={setGeminiKey}
              placeholder="AIzaSy..."
              type="password"
              hint="Required for Gemini rendering & chat."
            />
            <Field
              label="Image Model"
              value={geminiImageModel}
              onChange={setGeminiImageModel}
              placeholder="gemini-2.5-flash-image (default)"
              hint="Leave empty for the built-in default."
            />
            <Field
              label="Chat Model"
              value={geminiChatModel}
              onChange={setGeminiChatModel}
              placeholder="gemini-2.5-flash (default)"
              hint="Any Gemini model ID."
            />
          </div>

          {/* CUSTOM */}
          <div className="settings-section">
            <div className="settings-section-title">⚡ CUSTOM PROVIDER (OpenAI-compatible / Replicate…)</div>
            <Field
              label="API Key (optional)"
              value={customKey}
              onChange={setCustomKey}
              placeholder="Bearer token or API secret"
              type="password"
              hint="Some endpoints need no key."
            />
            <Field
              label="Chat Endpoint"
              value={customChatEndpoint}
              onChange={setCustomChatEndpoint}
              placeholder="https://your-llm.example.com/v1/chat/completions"
              hint="OpenAI-compatible chat API. Also used for chat when the SELF-HOSTED engine is selected."
            />
            <Field
              label="Image Endpoint"
              value={customImageEndpoint}
              onChange={setCustomImageEndpoint}
              placeholder="https://your-sd.example.com/sdapi/v1/txt2img"
              hint="Any response shape the parser understands."
            />
            <Field
              label="Video Endpoint"
              value={customVideoEndpoint}
              onChange={setCustomVideoEndpoint}
              placeholder="https://your-video.example.com/v1/generate"
              hint="Optional — video diffusion provider."
            />
            <Field
              label="Model"
              value={customModel}
              onChange={setCustomModel}
              placeholder="e.g. sd_xl_base_1.0"
              hint="Model name passed in the payload."
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClear} style={{ color: '#ff6b8a' }}>
            Clear All
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="generate" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
