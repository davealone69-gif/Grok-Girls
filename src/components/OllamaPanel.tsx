import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  OLLAMA_DEFAULT_BASE,
  OLLAMA_DEFAULT_MODEL,
  activeTransport,
  ensureOllamaRunning,
  formatModelSize,
  getOllamaConfig,
  isNativeShell,
  ollamaStatus,
  pullOllamaModel,
  saveOllamaConfig,
  type OllamaModel,
  type OllamaStatus,
  type OllamaServerState
} from '../services/ollama';
import { saveProviderPref } from '../services/settingsState';

/** Suggested phone-friendly models (CPU-only Android). */
const SUGGESTED = [
  { tag: 'llama3.2:1b', note: '~1.3 GB · fastest on phone CPU' },
  { tag: 'llama3.2:3b', note: '~2.0 GB · better quality, slower' },
  { tag: 'qwen2.5:1.5b', note: '~1.0 GB · strong small model' },
  { tag: 'gemma2:2b', note: '~1.6 GB · balanced' }
];

const dot = (state: OllamaServerState): { color: string; label: string } => {
  switch (state) {
    case 'running':
      return { color: '#7ff0bd', label: 'RUNNING' };
    case 'starting':
      return { color: '#ffd166', label: 'STARTING…' };
    case 'stopped':
      return { color: '#ff6b8a', label: 'STOPPED' };
    case 'blocked':
      return { color: '#ff6b8a', label: 'BLOCKED' };
    case 'unreachable':
      return { color: '#ff6b8a', label: 'UNREACHABLE' };
    default:
      return { color: '#8a8aa8', label: 'UNKNOWN' };
  }
};

export interface OllamaPanelProps {
  /** notify the host modal so it can surface a toast */
  onNotice?: (msg: string) => void;
}

export default function OllamaPanel({ onNotice }: OllamaPanelProps) {
  const cfg = getOllamaConfig();
  const [base, setBase] = useState(cfg.base || OLLAMA_DEFAULT_BASE);
  const [model, setModel] = useState(cfg.model || OLLAMA_DEFAULT_MODEL);
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [autoStart, setAutoStart] = useState(cfg.autoStart);
  const [streaming, setStreaming] = useState(cfg.streaming);
  const [temperature, setTemperature] = useState(cfg.temperature);

  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [state, setState] = useState<OllamaServerState>('unknown');
  const [busy, setBusy] = useState<'' | 'probe' | 'start' | 'pull'>('');
  const [note, setNote] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [pullTag, setPullTag] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const [pullMsg, setPullMsg] = useState('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const persist = useCallback(
    (patch: Partial<ReturnType<typeof getOllamaConfig>>) => {
      saveOllamaConfig(patch);
    },
    []
  );

  const probe = useCallback(
    async (quiet = false) => {
      if (!quiet) setBusy('probe');
      saveOllamaConfig({ base });
      const st = await ollamaStatus(base, 6000);
      if (!mounted.current) return st;
      setStatus(st);
      setState(st.state);
      setModels(st.models);
      setNote(st.message);
      if (!quiet) setBusy('');
      return st;
    },
    [base]
  );

  // Probe once on mount so the panel opens with a truthful status.
  useEffect(() => {
    void probe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async () => {
    setBusy('start');
    setState('starting');
    setNote('Checking 127.0.0.1:11434 …');
    const res = await ensureOllamaRunning(base, {
      onState: (s, msg) => {
        if (!mounted.current) return;
        setState(s);
        setNote(msg);
      }
    });
    if (!mounted.current) return;
    setNote(res.message);
    onNotice?.(res.message);
    await probe(true);
    setBusy('');
  };

  const handlePull = async (tag: string) => {
    const want = tag.trim();
    if (!want) return;
    setBusy('pull');
    setPullPct(0);
    setPullMsg(`Pulling ${want} …`);
    try {
      await pullOllamaModel(want, base, p => {
        if (!mounted.current) return;
        setPullPct(p.percent ?? null);
        setPullMsg(
          p.percent !== undefined
            ? `${p.status} · ${p.percent}%`
            : p.status || `Pulling ${want} …`
        );
      });
      if (!mounted.current) return;
      setPullMsg(`✓ ${want} installed`);
      onNotice?.(`✓ Model ${want} installed`);
      setModel(want);
      persist({ model: want });
      await probe(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (mounted.current) setPullMsg(`✕ ${msg}`);
      onNotice?.(msg);
    } finally {
      if (mounted.current) {
        setBusy('');
        setPullPct(null);
      }
    }
  };

  const useForChat = () => {
    setEnabled(true);
    persist({ enabled: true, base, model });
    saveProviderPref('chat', 'ollama');
    const select = document.querySelector<HTMLSelectElement>('.mini-provider-select');
    if (select) {
      select.value = 'ollama';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setNote('✓ Ollama is now the chat engine — fully on-device.');
    onNotice?.('✓ Ollama selected as the chat engine');
  };

  const d = dot(state);
  const installed = models.some(m => {
    const n = m.name.toLowerCase();
    const w = model.trim().toLowerCase();
    return n === w || n === `${w}:latest` || `${n}:latest` === w;
  });
  const native = isNativeShell();

  return (
    <div className="settings-section selfhosted-section">
      <div className="settings-section-title">🦙 OLLAMA — ON-DEVICE LLM (PHONE-LOCAL)</div>
      <p className="settings-note">
        Runs entirely on this phone at <code>{OLLAMA_DEFAULT_BASE}</code> — no Wi-Fi, no LAN IP, no
        internet, no API key. The OpenAI-compatible API lives at <code>{base}/v1</code>.
      </p>

      {/* live status line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.08)',
          marginBottom: 10
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: d.color,
            boxShadow: `0 0 10px ${d.color}`,
            flex: '0 0 auto'
          }}
        />
        <strong style={{ color: d.color, fontSize: 12, letterSpacing: 1 }}>{d.label}</strong>
        <span style={{ fontSize: 11, color: '#9a9ab8' }}>
          {status?.version ? `v${status.version} · ` : ''}
          {models.length} model(s)
          {status?.latencyMs !== undefined ? ` · ${status.latencyMs}ms` : ''}
          {` · ${native ? 'native bridge' : activeTransport() === 'native' ? 'native bridge' : 'browser fetch'}`}
        </span>
      </div>

      {note && (
        <div className={`selfhosted-status ${state === 'running' ? 'ok' : 'fail'}`} style={{ marginBottom: 10 }}>
          {note}
        </div>
      )}

      <label className="settings-field">
        <span>Server URL</span>
        <input
          type="url"
          value={base}
          onChange={e => setBase(e.target.value)}
          onBlur={() => persist({ base })}
          placeholder={OLLAMA_DEFAULT_BASE}
        />
        <em>Phone-local default is {OLLAMA_DEFAULT_BASE}. The app appends /v1 itself.</em>
      </label>

      <label className="settings-field">
        <span>Model</span>
        <input
          type="text"
          list="ollama-installed-models"
          value={model}
          onChange={e => setModel(e.target.value)}
          onBlur={() => persist({ model })}
          placeholder={OLLAMA_DEFAULT_MODEL}
        />
        <em>
          {installed
            ? '✓ Installed on this server.'
            : models.length
              ? 'Not installed yet — use PULL below to download it.'
              : 'Start the server to see installed models.'}
        </em>
      </label>
      <datalist id="ollama-installed-models">
        {models.map(m => (
          <option key={m.name} value={m.name} />
        ))}
      </datalist>

      <div className="selfhosted-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn-test-server" disabled={busy !== ''} onClick={() => void probe()}>
          {busy === 'probe' ? 'CHECKING…' : '🔌 CHECK SERVER'}
        </button>
        <button className="prompt-mini-btn" disabled={busy !== ''} onClick={() => void handleStart()}>
          {busy === 'start' ? 'STARTING…' : '▶ START SERVER'}
        </button>
        <button className="prompt-mini-btn" disabled={busy !== ''} onClick={useForChat}>
          USE OLLAMA FOR CHAT
        </button>
      </div>

      {/* installed models */}
      {models.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="dock-section-title">INSTALLED MODELS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {models.map(m => (
              <button
                key={m.name}
                type="button"
                className="prompt-mini-btn"
                title={[m.parameterSize, m.quantization, formatModelSize(m.size)].filter(Boolean).join(' · ')}
                style={
                  m.name === model
                    ? { borderColor: '#7ff0bd', color: '#7ff0bd' }
                    : undefined
                }
                onClick={() => {
                  setModel(m.name);
                  persist({ model: m.name });
                }}
              >
                {m.name}
                {m.size ? ` · ${formatModelSize(m.size)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* pull */}
      <div style={{ marginTop: 12 }}>
        <div className="dock-section-title">DOWNLOAD A MODEL (ollama pull)</div>
        <div className="lora-row" style={{ marginTop: 6 }}>
          <input
            type="text"
            value={pullTag}
            placeholder="llama3.2:1b"
            onChange={e => setPullTag(e.target.value)}
          />
          <button
            className="prompt-mini-btn"
            disabled={busy !== '' || !pullTag.trim()}
            onClick={() => void handlePull(pullTag)}
          >
            {busy === 'pull' ? 'PULLING…' : 'PULL'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {SUGGESTED.map(s => (
            <button
              key={s.tag}
              type="button"
              className="prompt-mini-btn"
              title={s.note}
              disabled={busy !== ''}
              onClick={() => setPullTag(s.tag)}
            >
              {s.tag}
            </button>
          ))}
        </div>
        {pullMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: pullMsg.startsWith('✕') ? '#ff6b8a' : '#9a9ab8' }}>
            {pullMsg}
            {pullPct !== null && (
              <div
                style={{
                  marginTop: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,.08)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${pullPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg,#7ff0bd,#5ad1ff)',
                    transition: 'width .25s'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* behaviour toggles */}
      <label className="selfhosted-toggle" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            setEnabled(e.target.checked);
            persist({ enabled: e.target.checked });
          }}
        />
        <span>Enable Ollama as an engine</span>
      </label>
      <label className="selfhosted-toggle">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={e => {
            setAutoStart(e.target.checked);
            persist({ autoStart: e.target.checked });
          }}
        />
        <span>Auto-start the server when a chat needs it</span>
      </label>
      <label className="selfhosted-toggle">
        <input
          type="checkbox"
          checked={streaming}
          onChange={e => {
            setStreaming(e.target.checked);
            persist({ streaming: e.target.checked });
          }}
        />
        <span>Stream tokens live into the chat bubble</span>
      </label>
      <label className="settings-field" style={{ marginTop: 8 }}>
        <span>Temperature · {temperature.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={temperature}
          onChange={e => {
            const v = Number(e.target.value);
            setTemperature(v);
            persist({ temperature: v });
          }}
        />
        <em>Lower = focused and consistent, higher = more playful and varied.</em>
      </label>

      {!native && (
        <p className="settings-note" style={{ marginTop: 10 }}>
          <strong>Browser note:</strong> Ollama must allow this page's origin —
          start it as <code>OLLAMA_ORIGINS=* ollama serve</code>. Inside the Android app the native
          bridge bypasses CORS and mixed-content blocking entirely.
        </p>
      )}
    </div>
  );
}
