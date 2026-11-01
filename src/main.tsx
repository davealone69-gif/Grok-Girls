import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './renderer/ResultCanvasCompat';
import './nativeAvatarBridge';
import './styles-phone.css';
import './styles-phone-final.css';

const renderApp = () => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

if (new URLSearchParams(window.location.search).get('hdDebug') === '1') {
  const debugWindow = window as unknown as Record<string, unknown>;
  debugWindow.__hdDebugReady = false;
  void import('./renderer/RendererTestHooks')
    .then(({ installRendererTestHooks }) => {
      installRendererTestHooks();
      renderApp();
      debugWindow.__hdDebugReady = true;
    })
    .catch(error => {
      console.error('Failed to load renderer test hooks', error);
      renderApp();
    });
} else {
  renderApp();
}

// Service worker policy:
//  - Browser (PWA): register on a real hosted origin for offline support.
//  - Localhost/127.0.0.1: never register; this is used by the browser audit
//    harness and by Capacitor's local webview, where a SW can retain stale APK
//    assets across updates.
const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
const isNativeWebview = !!cap?.isNativePlatform?.();
const isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && import.meta.env.PROD && !isLocalHost) {
  window.addEventListener('load', () => {
    if (isNativeWebview) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    } else {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  });
} else if ('serviceWorker' in navigator && isLocalHost) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
}
