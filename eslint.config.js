// @ts-check
// Lint toolchain lives in tools/lint/node_modules because
// typescript-eslint does not support the app's pinned TypeScript 7.
// The app build is unaffected — it still uses the root TS.
import js from './tools/lint/node_modules/@eslint/js/src/index.js';
import tseslint from './tools/lint/node_modules/typescript-eslint/dist/index.js';
import reactHooks from './tools/lint/node_modules/eslint-plugin-react-hooks/index.js';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'android/**',
      'native/**',
      'node_modules/**',
      'public/**',
      '.toolchain/**',
      'tools/lint/**',
      'tsconfig.tsbuildinfo'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // browser
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        indexedDB: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        alert: 'readonly',
        Image: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        DOMException: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        ReadableStream: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MediaRecorder: 'readonly',
        WebSocket: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        WebGL2RenderingContext: 'readonly',
        WebGLRenderingContext: 'readonly',
        ImageData: 'readonly',
        OffscreenCanvas: 'readonly',
        structuredClone: 'readonly',
        queueMicrotask: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        DataTransfer: 'readonly',
        ClipboardItem: 'readonly',
        getComputedStyle: 'readonly',
        matchMedia: 'readonly',
        // node/build
        process: 'readonly',
        __dirname: 'readonly'
      }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The codebase intentionally uses `any` at a few provider/GL
      // boundaries where the upstream shape is genuinely unknown.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
);
