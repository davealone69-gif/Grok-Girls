import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installRendererDiagnostics } from './renderer/RendererDiagnostics';
import './menu-mobile.css';

installRendererDiagnostics();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker policy:
//  - Browser (PWA): register as before — offline support + installability.
//  - Capacitor webview (the APK): NO service worker. The webview serves the
//    bundled assets directly, and a cached SW could keep serving a STALE app
//    after an APK update. Unregister any SW left over from older builds.
const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
const isNativeWebview = !!cap?.isNativePlatform?.();
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    if (isNativeWebview) {
      navigator.serviceWorker
        .getRegistrations()
        .then(rs => rs.forEach(r => r.unregister()))
        .catch(() => {
          /* nothing to unregister */
        });
    } else {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support unavailable — app still works online */
      });
    }
  });
}
