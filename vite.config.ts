import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Production-only Content-Security-Policy. Injected at build time so the
// Vite dev server (inline HMR scripts, websockets) stays untouched.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "connect-src 'self' http: https: data: blob:",
  "worker-src 'self' blob:",
  "media-src blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

function injectCsp(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), injectCsp()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
