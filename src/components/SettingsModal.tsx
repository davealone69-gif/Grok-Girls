import React, { useState } from 'react';
import {
  getSavedApiKey,
  saveApiKey,
  getSavedEndpoint,
  saveEndpoint,
  getSavedModel,
  saveModel
} from '../services/providers';

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

  if (!isOpen) return null;

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
          Configure API credentials, endpoints and models for neural rendering & chat. Keys are
          stored only in your browser's local storage. Local engine works without any of this.
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
            <div className="settings-section-title">⚡ CUSTOM PROVIDER (A1111 / ComfyUI / Replicate…)</div>
            <Field
              label="API Key (optional)"
              value={customKey}
              onChange={setCustomKey}
              placeholder="Bearer token or API secret"
              type="password"
              hint="Some local endpoints need no key."
            />
            <Field
              label="Chat Endpoint"
              value={customChatEndpoint}
              onChange={setCustomChatEndpoint}
              placeholder="https://your-llm.example.com/v1/chat/completions"
              hint="OpenAI-compatible chat API."
            />
            <Field
              label="Image Endpoint"
              value={customImageEndpoint}
              onChange={setCustomImageEndpoint}
              placeholder="https://your-sd.example.com/sdapi/v1/txt2img"
              hint="A1111/ComfyUI/Replicate style — any response shape the parser understands."
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
