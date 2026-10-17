import React, { useState } from 'react';
import OllamaPanel from './OllamaPanel';
import SdLocalPanel from './SdLocalPanel';
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
  testConnection,
  generateSelfHosted,
  startSelfHostedServer
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
  const [shStarting, setShStarting] = useState(false);
  const [shStartStatus, setShStartStatus] = useState('');
  const [shRenderTesting, setShRenderTesting] = useState(false);
  const [shRenderStatus, setShRenderStatus] = useState('');
  const [shTestImage, setShTestImage] = useState('');
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

  const handleStartComfyUI = async () => {
    setShStarting(true);
    setShStartStatus('Requesting phone-local ComfyUI start through Termux…');
    saveServerBase(shBase);
    try {
      const result = await startSelfHostedServer(shBase);
      setShStartStatus(result.message);
      if (result.ok) {
        const st = await testConnection();
        setShStatus(st);
        if (st.ok) {
          const models = await fetchModels();
          setShModels(models);
          if (models.length && (!shModel || !models.includes(shModel))) {
            setShModel(models[0]);
            saveCheckpoint(models[0]);
          }
        }
      }
    } catch (err) {
      setShStartStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setShStarting(false);
    }
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

  // This is intentionally separate from TEST CONNECTION. It runs an actual
  // tiny generation through the selected A1111/ComfyUI server and only reports
  // success when the server returns image data.
  const handleTestRender = async () => {
    if (!shBase.trim()) {
      setShRenderStatus('Enter a server URL first.');
      return;
    }
    setShRenderTesting(true);
    setShRenderStatus('Running a real 256×256 test render…');
    setShTestImage('');
    saveServerBase(shBase);
    saveSampler(shSampler);
    saveUpscaler(shUpscaler);
    saveHiresFix(shHires);
    saveLoraSlots(shLoraSlots);
    try {
      const connection = await testConnection();
      if (!connection.ok) throw new Error(connection.message);
      const models = await fetchModels();
      setShModels(models);
      let checkpoint = shModel;
      if (checkpoint && models.length && !models.includes(checkpoint)) {
        throw new Error('The saved checkpoint is not available on this server. Select a model from FETCH MODELS first.');
      }
      if (connection.serverType === 'comfy' && !checkpoint) {
        if (models.length === 1) {
          checkpoint = models[0];
          setShModel(checkpoint);
        } else {
          throw new Error('ComfyUI needs a checkpoint selected. Fetch models and choose one before testing generation.');
        }
      }
      saveCheckpoint(checkpoint);
      const out = await generateSelfHosted({
        prompt: 'a red apple on a white table, studio lighting, photorealistic',
        width: 256,
        height: 256,
        steps: 8,
        cfg: 5,
        seed: 42
      });
      if (out.status !== 'ready' || !out.assetUrl) {
        throw new Error(out.warning || 'The server did not return a completed image.');
      }
      setShTestImage(out.assetUrl);
      setShRenderStatus('✓ Real test image generated successfully by ' + connection.serverType.toUpperCase() + '.');
    } catch (err) {
      setShRenderStatus('✕ ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setShRenderTesting(false);
    }
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
    setSavedStatus('Cloud credentials, custom endpoints, and self-hosted server settings cleared. SD LOCAL and Ollama settings were preserved.');
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
          Configure the phone-local engines, cloud credentials, or your own render server. Keys are stored only in
          this app's browser storage. LOCAL is a procedural SVG preview; SD LOCAL is the real phone-local diffusion route.
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
          {/* OLLAMA — phone-local on-device LLM (first-class) */}
          <OllamaPanel onNotice={msg => { setSavedStatus(msg); window.setTimeout(() => setSavedStatus(''), 4000); }} />

          {/* STABLE DIFFUSION — phone-local A1111-compatible image engine (:1234) */}
          <SdLocalPanel onNotice={msg => { setSavedStatus(msg); window.setTimeout(() => setSavedStatus(''), 4000); }} />

          {/* SELF-HOSTED */}
          <div className="settings-section selfhosted-section">
            <div className="settings-section-title">🖥️ SELF-HOSTED IMAGE SERVER — A1111 / COMFYUI</div>
            <p className="settings-note">
              Use this section for ComfyUI (normally port 8188) or AUTOMATIC1111 (normally port 7860). This is separate from SD LOCAL, which expects the phone-local A1111-compatible API on port 1234. Do not enter a ComfyUI URL in SD LOCAL.
            </p>
            <Field
              label="Server URL"
              value={shBase}
              onChange={value => {
                if (value !== shBase) {
                  setShModels([]);
                  setShModel('');
                  setShStatus(null);
                  setShStartStatus('');
                  setShRenderStatus('');
                  setShTestImage('');
                }
                setShBase(value);
              }}
              placeholder="http://127.0.0.1:8188 (phone-local ComfyUI) or a server URL"
              hint="ComfyUI: usually 8188. AUTOMATIC1111: usually 7860. Use 127.0.0.1 for a server on this phone, or a LAN IP for another machine."
            />
            <div className="selfhosted-actions">
              <button className="btn-test-server" disabled={shTesting || shRenderTesting} onClick={handleTest}>
                {shTesting ? 'TESTING…' : '🔌 TEST CONNECTION'}
              </button>
              <button className="prompt-mini-btn" disabled={shTesting || shRenderTesting || shStarting} onClick={handleFetchModels}>
                🔄 FETCH MODELS
              </button>
              <button className="prompt-mini-btn" disabled={shTesting || shRenderTesting || shStarting} onClick={handleStartComfyUI}>
                {shStarting ? 'STARTING COMFYUI…' : '▶ START COMFYUI (TERMUX)'}
              </button>
              <button className="prompt-mini-btn" disabled={shTesting || shRenderTesting || shStarting} onClick={handleTestRender}>
                {shRenderTesting ? 'RENDERING TEST…' : '🖼️ TEST REAL RENDER'}
              </button>
            </div>
            {shStartStatus && (
              <div className={`selfhosted-status ${shStartStatus.startsWith('ComfyUI API is responding') || shStartStatus.startsWith('ComfyUI API is already responding') ? 'ok' : 'fail'}`}>
                {shStartStatus}
              </div>
            )}
            {shRenderStatus && (
              <div className={`selfhosted-status ${shRenderStatus.startsWith('✓') ? 'ok' : shRenderStatus.startsWith('✕') ? 'fail' : ''}`}>
                {shRenderStatus}
              </div>
            )}
            {shTestImage && (
              <div style={{ marginTop: 10 }}>
                <strong>REAL SERVER TEST OUTPUT</strong>
                <img src={shTestImage} alt="Actual image returned by the configured self-hosted server" style={{ display: 'block', width: 192, height: 192, objectFit: 'contain', marginTop: 8, borderRadius: 8 }} />
              </div>
            )}
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
              hint="Optional only for providers that allow unauthenticated requests. Some providers, including your current Pollinations route, may require a key."
            />
            <Field
              label="Chat Endpoint"
              value={customChatEndpoint}
              onChange={setCustomChatEndpoint}
              placeholder="https://your-llm.example.com/v1/chat/completions"
              hint="OpenAI-compatible chat API for the CUSTOM chat provider. Image SELF-HOSTED routing uses the server configured above."
            />
            <Field
              label="Image Endpoint"
              value={customImageEndpoint}
              onChange={setCustomImageEndpoint}
              placeholder="https://your-sd.example.com/sdapi/v1/txt2img"
              hint="CUSTOM provider only. For ComfyUI, configure the SELF-HOSTED server above instead."
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
            Clear Cloud / Self-Hosted
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
