import React, { useCallback, useEffect, useState } from 'react';
import OllamaPanel from './OllamaPanel';
import SdLocalPanel from './SdLocalPanel';

type ComfyUiStatus = { running: boolean; started?: boolean; version?: string; message: string; method?: string };
type NativeComfyUi = {
  status(opts?: { base?: string; timeoutMs?: number }): Promise<ComfyUiStatus>;
  startServer(opts?: { base?: string; timeoutMs?: number }): Promise<ComfyUiStatus>;
};
function nativeComfyUi(): NativeComfyUi | null {
  const c = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  const p = c?.Plugins?.['ComfyUiLocal'] as NativeComfyUi | undefined;
  return p && typeof p.status === 'function' && typeof p.startServer === 'function' ? p : null;
}
export interface ServerManagerModalProps { isOpen: boolean; onClose: () => void; onNotice?: (message: string) => void; }

export default function ServerManagerModal({ isOpen, onClose, onNotice }: ServerManagerModalProps) {
  const [comfy, setComfy] = useState<ComfyUiStatus>({ running: false, message: 'Not checked yet.' });
  const [busy, setBusy] = useState<'check' | 'start' | ''>('');
  const [message, setMessage] = useState('');

  const checkComfyUi = useCallback(async () => {
    setBusy('check');
    try {
      const native = nativeComfyUi();
      if (native) {
        const status = await native.status({ base: 'http://127.0.0.1:8188', timeoutMs: 6000 });
        setComfy(status);
        setMessage(status.message);
      } else {
        const response = await fetch('http://127.0.0.1:8188/system_stats', { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error('ComfyUI returned HTTP ' + response.status);
        const json = await response.json();
        const status = { running: true, version: String(json?.system?.comfyui_version || 'unknown'), message: 'ComfyUI API responds. This does not prove generation works.' };
        setComfy(status);
        setMessage(status.message);
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setComfy({ running: false, message: text });
      setMessage(text);
    } finally { setBusy(''); }
  }, []);

  const startComfyUi = useCallback(async () => {
    setBusy('start');
    setMessage('Sending start request to Termux and waiting for the ComfyUI API…');
    try {
      const native = nativeComfyUi();
      if (!native) throw new Error('Android ComfyUI bridge unavailable in this build. Install the updated APK.');
      const result = await native.startServer({ base: 'http://127.0.0.1:8188', timeoutMs: 120000 });
      setComfy({ ...result, running: Boolean(result.running || result.started) });
      setMessage(result.message);
      onNotice?.(result.message);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setComfy({ running: false, message: text });
      setMessage(text);
      onNotice?.(text);
    } finally { setBusy(''); }
  }, [onNotice]);

  useEffect(() => { if (isOpen) void checkComfyUi(); }, [isOpen, checkComfyUi]);
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop server-manager-backdrop" onClick={onClose}>
      <div className="modal-card settings-card server-manager-card" role="dialog" aria-modal="true" aria-labelledby="server-manager-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="server-manager-title">🖥 SERVER MANAGER</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close server manager">✕</button>
        </div>
        <p className="settings-note">Start local services from this app through the Android-to-Termux bridge. A responding port is not proof a model can finish a job, so use each engine's real test.</p>
        <section className="settings-section selfhosted-section server-manager-comfy">
          <div className="settings-section-title">🧩 COMFYUI · 127.0.0.1:8188</div>
          <div className="server-manager-status-row">
            <span className={'server-manager-dot ' + (comfy.running ? 'is-running' : 'is-stopped')} />
            <strong>{comfy.running ? 'API RESPONDING' : 'NOT READY'}</strong>
            {comfy.version && <span>v{comfy.version}</span>}
          </div>
          <p className="settings-note">{message || comfy.message}</p>
          <div className="selfhosted-actions server-manager-actions">
            <button className="btn-test-server" disabled={busy !== ''} onClick={() => void checkComfyUi()}>{busy === 'check' ? 'CHECKING…' : 'CHECK COMFYUI'}</button>
            <button className="prompt-mini-btn" disabled={busy !== '' || comfy.running} onClick={() => void startComfyUi()}>{busy === 'start' ? 'STARTING…' : '▶ START COMFYUI'}</button>
            <button className="prompt-mini-btn" disabled={busy !== '' || !comfy.running} onClick={() => void checkComfyUi()}>VERIFY API</button>
          </div>
          <p className="settings-note">Starts the existing Termux checkout in ~/llama/llama.cpp/ComfyUI, applies the Python preload workaround, logs to ~/comfyui-crash.log, and waits for /system_stats. It avoids starting a duplicate process.</p>
        </section>
        <OllamaPanel onNotice={onNotice} />
        <SdLocalPanel onNotice={onNotice} />
        <section className="settings-section selfhosted-section">
          <div className="settings-section-title">🧊 HUNYUAN3D · WORKER</div>
          <p className="settings-note">The current Hunyuan3D custom nodes report missing hy3dpaint, and a separate 3D worker on port 8081 is not verified. This screen will not claim 3D generation is ready until a real model job succeeds.</p>
        </section>
      </div>
    </div>
  );
}
