import React, { useState } from 'react';
import { getSavedApiKey, saveApiKey, getSavedEndpoint, saveEndpoint } from '../services/providers';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [openRouterKey, setOpenRouterKey] = useState(() => getSavedApiKey('openrouter'));
  const [geminiKey, setGeminiKey] = useState(() => getSavedApiKey('gemini'));
  const [customKey, setCustomKey] = useState(() => getSavedApiKey('custom'));
  const [customEndpoint, setCustomEndpoint] = useState(() => getSavedEndpoint('custom'));
  const [savedStatus, setSavedStatus] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiKey('openrouter', openRouterKey);
    saveApiKey('gemini', geminiKey);
    saveApiKey('custom', customKey);
    saveEndpoint('custom', customEndpoint);
    setSavedStatus('Keys saved successfully in browser storage!');
    setTimeout(() => {
      setSavedStatus('');
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    saveApiKey('openrouter', '');
    saveApiKey('gemini', '');
    saveApiKey('custom', '');
    saveEndpoint('custom', '');
    setOpenRouterKey('');
    setGeminiKey('');
    setCustomKey('');
    setCustomEndpoint('');
    setSavedStatus('Keys cleared.');
    setTimeout(() => setSavedStatus(''), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙ AI Provider Settings</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p style={{ color: '#aaa', fontSize: 13, marginTop: 0 }}>
          Configure API credentials to enable real-time neural companion chat and image/video synthesis. Keys are stored safely in your local browser storage.
        </p>

        {savedStatus && (
          <div style={{ background: '#193325', border: '1px solid #7ff0bd', color: '#7ff0bd', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            {savedStatus}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            OpenRouter API Key (Supports Claude, GPT-4o, Llama, FLUX)
            <input
              type="password"
              value={openRouterKey}
              onChange={e => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-v1-..."
            />
          </label>

          <label>
            Google Gemini API Key (Gemini Flash & Imagen)
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
            />
          </label>

          <label>
            Custom AI Provider Endpoint
            <input
              type="text"
              value={customEndpoint}
              onChange={e => setCustomEndpoint(e.target.value)}
              placeholder="https://your-custom-llm.example.com/v1/chat/completions"
            />
          </label>

          <label>
            Custom Provider Key (Optional)
            <input
              type="password"
              value={customKey}
              onChange={e => setCustomKey(e.target.value)}
              placeholder="Bearer token or API secret"
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClear} style={{ color: '#ff6b8a' }}>
            Clear Keys
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
