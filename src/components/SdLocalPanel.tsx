import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SD_DEFAULT_BASE,
  activeTransport,
  ensureSdRunning,
  getSdConfig,
  isNativeShell,
  saveSdConfig,
  sdStatus,
  sdTxt2Img,
  type SdServerState,
  type SdStatus
} from '../services/sdLocal';
import { saveProviderPref } from '../services/settingsState';

const dot = (state: SdServerState): { color: string; label: string } => {
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

/** Phone-friendly render presets: a 512 square is the realistic ceiling on CPU. */
const PRESETS = [
  { label: 'FAST', steps: 16, size: 384, note: 'quickest preview' },
  { label: 'BALANCED', steps: 24, size: 512, note: 'recommended on phone' },
  { label: 'QUALITY', steps: 36, size: 640, note: 'slow on CPU' }
];

export interface SdLocalPanelProps {
  /** notify the host modal so it can surface a toast */
  onNotice?: (msg: string) => void;
}

export default function SdLocalPanel({ onNotice }: SdLocalPanelProps) {
  const cfg = getSdConfig();
  const [base, setBase] = useState(cfg.base || SD_DEFAULT_BASE);
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [autoStart, setAutoStart] = useState(cfg.autoStart);
  const [steps, setSteps] = useState(cfg.steps);
  const [cfgScale, setCfgScale] = useState(cfg.cfgScale);
  const [size, setSize] = useState(cfg.size);
  const [negative, setNegative] = useState(cfg.negative);

  const [status, setStatus] = useState<SdStatus | null>(null);
  const [state, setState] = useState<SdServerState>('unknown');
  const [busy, setBusy] = useState<'' | 'probe' | 'start' | 'render'>('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ url: string; ms: number; w: number; h: number } | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const persist = useCallback(
    (p: Parameters<typeof saveSdConfig>[0]) => {
      saveSdConfig(p);
    },
    []
  );

  const probe = useCallback(async () => {
    setBusy('probe');
    setNote('');
    try {
      const st = await sdStatus(base, 6000);
      if (!alive.current) return;
      setStatus(st);
      setState(st.state);
      setNote(st.message);
    } finally {
      if (alive.current) setBusy('');
    }
  }, [base]);

  // Probe once on open so the dot is honest before the user touches anything.
  useEffect(() => {
    void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(async () => {
    setBusy('start');
    setNote('');
    const res = await ensureSdRunning(base, {
      onState: (s, msg) => {
        if (!alive.current) return;
        setState(s);
        setNote(msg);
      }
    });
    if (!alive.current) return;
    setNote(res.message);
    setBusy('');
    if (res.ok) void probe();
    onNotice?.(res.message);
  }, [base, probe, onNotice]);

  /**
   * Render a tiny real image. This is a genuine round trip to the server —
   * it proves the whole path (HTTP, txt2img, Base64 decode) rather than
   * just that a port is open.
   */
  const testRender = useCallback(async () => {
    setBusy('render');
    setNote('Rendering a small test image… this can take a while on a phone.');
    setPreview(null);
    try {
      const out = await sdTxt2Img(
        { prompt: 'a red apple on a white table, studio light', steps: 8, width: 256, height: 256 },
        { autoStart: false }
      );
      if (!alive.current) return;
      setPreview({ url: out.dataUrl, ms: out.elapsedMs, w: out.width, h: out.height });
      const msg = `✓ Rendered ${out.width}x${out.height} in ${(out.elapsedMs / 1000).toFixed(1)}s via ${out.transport}.`;
      setNote(msg);
      setState('running');
      onNotice?.(msg);
    } catch (err) {
      if (!alive.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setNote(msg);
      onNotice?.(msg);
    } finally {
      if (alive.current) setBusy('');
    }
  }, [onNotice]);

  const useForImages = () => {
    setEnabled(true);
    persist({ enabled: true, base });
    saveProviderPref('image', 'sdlocal');
    setNote('✓ Local Stable Diffusion is now the image engine — fully on-device.');
    onNotice?.('✓ Local Stable Diffusion selected as the image engine');
  };

  const d = dot(state);
  const native = isNativeShell();

  return (
    <div className="settings-section selfhosted-section">
      <div className="settings-section-title">🎨 STABLE DIFFUSION — ON-DEVICE IMAGES (PHONE-LOCAL)</div>
      <p className="settings-note">
        Renders entirely on this phone at <code>{SD_DEFAULT_BASE}</code> — no Wi-Fi, no LAN IP, no
        internet, no API key. Images come from <code>{base}/sdapi/v1/txt2img</code>. This is separate
        from Ollama on <code>:11434</code>, which handles text: two servers, two ports.
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
          {status?.model ? `${status.model} · ` : ''}
          {`${native ? 'native bridge' : activeTransport() === 'native' ? 'native bridge' : 'browser fetch'}`}
        </span>
      </div>

      {note && (
        <div className={`selfhosted-status ${state === 'running' ? 'ok' : 'fail'}`} style={{ marginBottom: 10 }}>
          {note}
        </div>
      )}

      {preview && (
        <div style={{ marginBottom: 10 }}>
          <div className="dock-section-title">TEST RENDER</div>
          <img
            src={preview.url}
            alt={`Test render, ${preview.w} by ${preview.h} pixels, produced in ${(preview.ms / 1000).toFixed(1)} seconds`}
            style={{
              marginTop: 6,
              width: 128,
              height: 128,
              objectFit: 'cover',
              borderRadius: 10,
              border: '1px solid rgba(127,240,189,.4)'
            }}
          />
        </div>
      )}

      <label className="settings-field">
        <span>Server URL</span>
        <input
          type="url"
          value={base}
          onChange={e => setBase(e.target.value)}
          onBlur={() => persist({ base })}
          placeholder={SD_DEFAULT_BASE}
        />
        <em>Phone-local default is {SD_DEFAULT_BASE}. The app appends /sdapi/v1/txt2img itself.</em>
      </label>

      <div className="lora-row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            className="prompt-mini-btn"
            title={`${p.steps} steps at ${p.size}x${p.size} — ${p.note}`}
            style={steps === p.steps && size === p.size ? { borderColor: '#7ff0bd', color: '#7ff0bd' } : undefined}
            onClick={() => {
              setSteps(p.steps);
              setSize(p.size);
              persist({ steps: p.steps, size: p.size });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="settings-field">
        <span>Steps — {steps}</span>
        <input
          type="range"
          min={1}
          max={60}
          step={1}
          value={steps}
          onChange={e => setSteps(Number(e.target.value))}
          onMouseUp={() => persist({ steps })}
          onTouchEnd={() => persist({ steps })}
          onBlur={() => persist({ steps })}
        />
        <em>More steps means more detail and a longer render. 16–24 is sane on a phone CPU.</em>
      </label>

      <label className="settings-field">
        <span>CFG scale — {cfgScale}</span>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={cfgScale}
          onChange={e => setCfgScale(Number(e.target.value))}
          onMouseUp={() => persist({ cfgScale })}
          onTouchEnd={() => persist({ cfgScale })}
          onBlur={() => persist({ cfgScale })}
        />
        <em>How strictly the render follows the prompt. 7 is the usual default.</em>
      </label>

      <label className="settings-field">
        <span>Render size — {size}px square</span>
        <input
          type="range"
          min={256}
          max={1024}
          step={64}
          value={size}
          onChange={e => setSize(Number(e.target.value))}
          onMouseUp={() => persist({ size })}
          onTouchEnd={() => persist({ size })}
          onBlur={() => persist({ size })}
        />
        <em>Memory use grows with the square of this number — 512 is the practical phone ceiling.</em>
      </label>

      <label className="settings-field">
        <span>Default negative prompt</span>
        <input
          type="text"
          value={negative}
          onChange={e => setNegative(e.target.value)}
          onBlur={() => persist({ negative })}
          placeholder="blurry, low quality, extra fingers"
        />
        <em>Appended to every local render unless the request supplies its own.</em>
      </label>

      <label className="settings-toggle-row">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={e => {
            setAutoStart(e.target.checked);
            persist({ autoStart: e.target.checked });
          }}
        />
        <span>
          Auto-start the server when it is not running
          <em style={{ display: 'block', color: '#8a8aa8', fontSize: 11 }}>
            Asks Termux to launch sd-server, then waits for {base}/ to answer.
          </em>
        </span>
      </label>

      <label className="settings-toggle-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            setEnabled(e.target.checked);
            persist({ enabled: e.target.checked });
          }}
        />
        <span>
          Enable the on-device image engine
          <em style={{ display: 'block', color: '#8a8aa8', fontSize: 11 }}>
            Makes SD LOCAL selectable as an image provider.
          </em>
        </span>
      </label>

      <div className="selfhosted-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn-test-server" disabled={busy !== ''} onClick={() => void probe()}>
          {busy === 'probe' ? 'CHECKING…' : '🔌 CHECK SERVER'}
        </button>
        <button className="prompt-mini-btn" disabled={busy !== ''} onClick={() => void handleStart()}>
          {busy === 'start' ? 'STARTING…' : '▶ START SERVER'}
        </button>
        <button className="prompt-mini-btn" disabled={busy !== ''} onClick={() => void testRender()}>
          {busy === 'render' ? 'RENDERING…' : '🖼 TEST RENDER'}
        </button>
        <button className="prompt-mini-btn" disabled={busy !== ''} onClick={useForImages}>
          USE SD FOR IMAGES
        </button>
      </div>

      <p className="settings-note" style={{ marginTop: 10 }}>
        <strong>Setup in Termux:</strong> install an sd-server build that exposes the A1111 API, then
        either put it on your PATH as <code>sd-server</code> or create <code>~/sd-server.sh</code> that
        launches it. The app runs it with <code>--port 1234</code> bound to loopback. A phone render
        takes tens of seconds to minutes depending on steps and size.
      </p>
    </div>
  );
}
