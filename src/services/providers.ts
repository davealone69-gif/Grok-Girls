import { generateSelfHosted, getServerBase } from './selfHosted';

export type ProviderName = 'local' | 'openrouter' | 'gemini' | 'custom' | 'selfhosted';
export type Mode = 'image' | 'video';

export interface GenerationRequest {
  prompt: string;
  mode: Mode;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  negative?: string;
}

export interface GenerationResult {
  provider: ProviderName;
  status: 'ready' | 'queued' | 'fallback' | 'error';
  text?: string;
  assetUrl?: string;
  warning?: string;
  jobId?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const env = () => (import.meta.env || {}) as Record<string, string | undefined>;

export function getSavedApiKey(p: string): string {
  try {
    const val = localStorage.getItem(`grok-girls-key-${p.toLowerCase()}`);
    if (val && val.trim()) return val.trim();
  } catch {}
  return env()[`VITE_${p.toUpperCase()}_API_KEY`] ?? '';
}

export function saveApiKey(p: string, key: string) {
  try {
    localStorage.setItem(`grok-girls-key-${p.toLowerCase()}`, key.trim());
  } catch {}
}

export function getSavedEndpoint(p: string, m?: Mode | 'chat'): string {
  try {
    if (m) {
      const modeKey = localStorage.getItem(`grok-girls-endpoint-${p.toLowerCase()}-${m}`);
      if (modeKey && modeKey.trim()) return modeKey.trim();
    }
    const genericKey = localStorage.getItem(`grok-girls-endpoint-${p.toLowerCase()}`);
    if (genericKey && genericKey.trim()) return genericKey.trim();
  } catch {}
  if (m) {
    const fromEnv = env()[`VITE_${p.toUpperCase()}_${m.toUpperCase()}_ENDPOINT`];
    if (fromEnv) return fromEnv;
  }
  return env()[`VITE_${p.toUpperCase()}_ENDPOINT`] ?? '';
}

export function saveEndpoint(p: string, url: string, m?: Mode | 'chat') {
  try {
    if (m) {
      localStorage.setItem(`grok-girls-endpoint-${p.toLowerCase()}-${m}`, url.trim());
    } else {
      localStorage.setItem(`grok-girls-endpoint-${p.toLowerCase()}`, url.trim());
    }
  } catch {}
}

export function getSavedModel(p: string, m?: Mode | 'chat'): string {
  try {
    const k = m
      ? `grok-girls-model-${p.toLowerCase()}-${m}`
      : `grok-girls-model-${p.toLowerCase()}`;
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  } catch {}
  return '';
}

export function saveModel(p: string, model: string, m?: Mode | 'chat') {
  try {
    const k = m
      ? `grok-girls-model-${p.toLowerCase()}-${m}`
      : `grok-girls-model-${p.toLowerCase()}`;
    localStorage.setItem(k, model.trim());
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Local procedural "NOIR RENDER" engine                               */
/* Draws a stylized boudoir portrait SVG that reflects the prompt:     */
/* hair colour, outfit hints, accent colour, cyber/neon scene cues.    */
/* ------------------------------------------------------------------ */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RenderPalette {
  hair: string;
  hairHi: string;
  accent: string;
  skin: string;
  corset: string;
  backdrop: [string, string, string];
  neon: boolean;
}

function paletteFromPrompt(prompt: string): RenderPalette {
  const p = prompt.toLowerCase();
  let hair = '#8a3b28';
  let hairHi = '#d97a5a';
  if (p.includes('ruby red') || p.includes('crimson') || p.includes('burgundy')) {
    hair = '#c81e3a';
    hairHi = '#ff6b85';
  } else if (p.includes('electric purple') || p.includes('violet')) {
    hair = '#7b3fe4';
    hairHi = '#c39bff';
  } else if (p.includes('jet black') || p.includes('pitch black')) {
    hair = '#1b1b26';
    hairHi = '#4d4d66';
  } else if (p.includes('platinum') || p.includes('silver')) {
    hair = '#cfd2e0';
    hairHi = '#ffffff';
  } else if (p.includes('blonde') || p.includes('champagne')) {
    hair = '#e0b56a';
    hairHi = '#f8e6b8';
  } else if (p.includes('neon cyan') || p.includes('cyan')) {
    hair = '#00c8d6';
    hairHi = '#8ff6ff';
  } else if (p.includes('auburn')) {
    hair = '#a13a22';
    hairHi = '#e07a4e';
  } else if (p.includes('dark brown')) {
    hair = '#4a2e22';
    hairHi = '#7a5040';
  }

  let accent = '#e62040';
  const accentMatch = prompt.match(/color accent:\s*(#[0-9a-fA-F]{6})/i);
  if (accentMatch) accent = accentMatch[1];

  const skin = p.includes('rich espresso')
    ? '#6b4331'
    : p.includes('deep bronze')
    ? '#8a5a3b'
    : p.includes('golden tan')
    ? '#c08a5e'
    : p.includes('olive')
    ? '#caa080'
    : p.includes('cybernetic pale')
    ? '#d8e2eb'
    : '#e9c3ae';

  const corset =
    p.includes('black satin') || p.includes('midnight') || p.includes('leather jacket')
      ? '#16161f'
      : '#57101f';

  const neon = p.includes('neon') || p.includes('club') || p.includes('cyber') || p.includes('matrix');
  const backdrop: [string, string, string] = neon
    ? ['#0b0e1e', '#2a0f4a', '#00f2fe']
    : p.includes('moonlight') || p.includes('blue hour')
    ? ['#0a1220', '#12203a', '#5aa0ff']
    : ['#120a10', '#2b0d16', accent];

  return { hair, hairHi, accent, skin, corset, backdrop, neon };
}

export function createLocalPlaceholderSvg(
  prompt: string,
  mode: Mode,
  width = 768,
  height = 768,
  seed?: number
): string {
  const isVideo = mode === 'video';
  const W = width;
  const H = height;
  const pal = paletteFromPrompt(prompt);
  const pLower = prompt.toLowerCase();

  const seedVal = seed ?? hashSeed(prompt + W + H);
  const nameMatch = prompt.match(/^([A-Za-z0-9 ]+?)(?:,| adult|\()/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Grok Persona';
  const seedId = String(seedVal % 1000000).padStart(6, '0');

  const hasFishnets = pLower.includes('fishnet');
  const hasChoker = pLower.includes('choker');
  const hasThighHighs = pLower.includes('thigh-high') || pLower.includes('stockings');
  const hasGown = pLower.includes('gown') || pLower.includes('robe') || pLower.includes('dress');
  const hasCyber = pLower.includes('cyber') || pLower.includes('augment') || pLower.includes('led');
  const hasTattoo = pLower.includes('tattoo');

  const cx = W * 0.5;
  const headY = H * 0.34;
  const torsoY = H * 0.52;
  const headR = W * 0.085;

  // Hair silhouette (behind everything)
  const hairPath = `
    M ${cx - 95} ${H * 0.86}
    C ${cx - 150} ${H * 0.55}, ${cx - 165} ${H * 0.34}, ${cx - 118} ${H * 0.22}
    C ${cx - 70} ${H * 0.10}, ${cx + 70} ${H * 0.10}, ${cx + 118} ${H * 0.22}
    C ${cx + 165} ${H * 0.34}, ${cx + 150} ${H * 0.55}, ${cx + 95} ${H * 0.86}
    C ${cx + 60} ${H * 0.72}, ${cx + 45} ${H * 0.60}, ${cx + 30} ${H * 0.50}
    C ${cx + 10} ${H * 0.62}, ${cx - 10} ${H * 0.62}, ${cx - 30} ${H * 0.50}
    C ${cx - 45} ${H * 0.60}, ${cx - 60} ${H * 0.72}, ${cx - 95} ${H * 0.86} Z
  `;

  const chairFill = '#241522';
  const chairHighlight = '#3d2438';

  const netPattern = hasFishnets
    ? `
  <pattern id="fishnet" width="9" height="9" patternUnits="userSpaceOnUse">
    <path d="M0 0 L9 9 M9 0 L0 9" stroke="#0c0c14" stroke-width="1.1" opacity="0.75"/>
    <path d="M0 4.5 L9 4.5 M4.5 0 L4.5 9" stroke="#0c0c14" stroke-width="0.5" opacity="0.5"/>
  </pattern>`
    : '';

  const legGrad = `
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${pal.skin}"/>
      <stop offset="85%" stop-color="${pal.skin}"/>
      <stop offset="100%" stop-color="${pal.accent}" stop-opacity="0.55"/>
    </linearGradient>`;

  const legLeft = `
    <path d="M ${cx - 52} ${torsoY} C ${cx - 62} ${H * 0.62}, ${cx - 58} ${H * 0.74}, ${cx - 50} ${H * 0.90}
             L ${cx - 8} ${H * 0.90} C ${cx - 16} ${H * 0.74}, ${cx - 20} ${H * 0.62}, ${cx - 22} ${torsoY} Z"
          fill="url(#skinGrad)"/>
    ${hasThighHighs ? `
    <path d="M ${cx - 56} ${H * 0.68} C ${cx - 54} ${H * 0.75}, ${cx - 52} ${H * 0.86}, ${cx - 50} ${H * 0.90}
             L ${cx - 8} ${H * 0.90} C ${cx - 12} ${H * 0.86}, ${cx - 14} ${H * 0.75}, ${cx - 18} ${H * 0.68} Z"
          fill="#0e0e16" opacity="0.9"/>` : ''}
    ${hasFishnets ? `
    <path d="M ${cx - 52} ${torsoY} C ${cx - 62} ${H * 0.62}, ${cx - 58} ${H * 0.74}, ${cx - 50} ${H * 0.90}
             L ${cx - 8} ${H * 0.90} C ${cx - 16} ${H * 0.74}, ${cx - 20} ${H * 0.62}, ${cx - 22} ${torsoY} Z"
          fill="url(#fishnet)"/>` : ''}`;

  const legRight = `
    <path d="M ${cx + 22} ${torsoY} C ${cx + 20} ${H * 0.62}, ${cx + 34} ${H * 0.76}, ${cx + 52} ${H * 0.90}
             L ${cx + 8} ${H * 0.90} C ${cx + 4} ${H * 0.76}, ${cx - 4} ${H * 0.62}, ${cx - 2} ${torsoY} Z"
          fill="url(#skinGrad)"/>
    ${hasThighHighs ? `
    <path d="M ${cx + 14} ${H * 0.70} C ${cx + 26} ${H * 0.78}, ${cx + 44} ${H * 0.88}, ${cx + 52} ${H * 0.90}
             L ${cx + 8} ${H * 0.90} C ${cx + 6} ${H * 0.88}, ${cx + 8} ${H * 0.78}, ${cx + 10} ${H * 0.70} Z"
          fill="#0e0e16" opacity="0.9"/>` : ''}
    ${hasFishnets ? `
    <path d="M ${cx + 22} ${torsoY} C ${cx + 20} ${H * 0.62}, ${cx + 34} ${H * 0.76}, ${cx + 52} ${H * 0.90}
             L ${cx + 8} ${H * 0.90} C ${cx + 4} ${H * 0.76}, ${cx - 4} ${H * 0.62}, ${cx - 2} ${torsoY} Z"
          fill="url(#fishnet)"/>` : ''}`;

  const torso = hasGown
    ? `<path d="M ${cx - 46} ${H * 0.36} C ${cx - 70} ${H * 0.42}, ${cx - 78} ${H * 0.60}, ${cx - 68} ${H * 0.90}
             L ${cx + 68} ${H * 0.90} C ${cx + 78} ${H * 0.60}, ${cx + 70} ${H * 0.42}, ${cx + 46} ${H * 0.36}
             C ${cx + 30} ${H * 0.40}, ${cx + 18} ${H * 0.38}, ${cx} ${H * 0.37}
             C ${cx - 18} ${H * 0.38}, ${cx - 30} ${H * 0.40}, ${cx - 46} ${H * 0.36} Z"
          fill="${pal.corset}"/>`
    : `<path d="M ${cx - 44} ${H * 0.37} C ${cx - 60} ${H * 0.44}, ${cx - 62} ${H * 0.52}, ${cx - 52} ${H * 0.62}
             L ${cx - 40} ${torsoY} L ${cx + 40} ${torsoY} L ${cx + 52} ${H * 0.62}
             C ${cx + 62} ${H * 0.52}, ${cx + 60} ${H * 0.44}, ${cx + 44} ${H * 0.37}
             C ${cx + 28} ${H * 0.41}, ${cx + 14} ${H * 0.39}, ${cx} ${H * 0.385}
             C ${cx - 14} ${H * 0.39}, ${cx - 28} ${H * 0.41}, ${cx - 44} ${H * 0.37} Z"
          fill="${pal.corset}"/>
      <path d="M ${cx - 40} ${H * 0.40} L ${cx + 40} ${H * 0.40} M ${cx - 38} ${H * 0.46} L ${cx + 38} ${H * 0.46}
               M ${cx - 34} ${H * 0.52} L ${cx + 34} ${H * 0.52} M ${cx - 28} ${H * 0.58} L ${cx + 28} ${H * 0.58}"
            stroke="${pal.accent}" stroke-width="1" opacity="0.55" fill="none"/>`;

  const armLeft = `
    <path d="M ${cx - 50} ${H * 0.40} C ${cx - 86} ${H * 0.46}, ${cx - 96} ${H * 0.56}, ${cx - 88} ${H * 0.66}
             L ${cx - 70} ${H * 0.62} C ${cx - 76} ${H * 0.56}, ${cx - 70} ${H * 0.50}, ${cx - 52} ${H * 0.47} Z"
          fill="url(#skinGrad)"/>`;
  const armRight = `
    <path d="M ${cx + 50} ${H * 0.40} C ${cx + 86} ${H * 0.46}, ${cx + 96} ${H * 0.56}, ${cx + 88} ${H * 0.66}
             L ${cx + 70} ${H * 0.62} C ${cx + 76} ${H * 0.56}, ${cx + 70} ${H * 0.50}, ${cx + 52} ${H * 0.47} Z"
          fill="url(#skinGrad)"/>`;

  const head = `
    <ellipse cx="${cx}" cy="${headY}" rx="${headR}" ry="${headR * 1.22}" fill="url(#skinGrad)"/>
    <path d="M ${cx - headR * 0.55} ${headY + headR * 0.15} Q ${cx} ${headY + headR * 0.32} ${cx + headR * 0.55} ${headY + headR * 0.15} Z"
          fill="#000000" opacity="0.16"/>
    <path d="M ${cx - headR * 0.62} ${headY + headR * 0.52} Q ${cx - headR * 0.3} ${headY + headR * 0.42} ${cx - headR * 0.08} ${headY + headR * 0.5}"
          stroke="${pal.accent}" stroke-width="${headR * 0.16}" stroke-linecap="round" fill="none" opacity="0.9"/>
    <path d="M ${cx + headR * 0.62} ${headY + headR * 0.52} Q ${cx + headR * 0.3} ${headY + headR * 0.42} ${cx + headR * 0.08} ${headY + headR * 0.5}"
          stroke="${pal.accent}" stroke-width="${headR * 0.16}" stroke-linecap="round" fill="none" opacity="0.9"/>
    <path d="M ${cx - headR * 0.28} ${headY - headR * 0.42} Q ${cx - headR * 0.14} ${headY - headR * 0.52} ${cx} ${headY - headR * 0.44} Q ${cx + headR * 0.14} ${headY - headR * 0.52} ${cx + headR * 0.28} ${headY - headR * 0.42}"
          stroke="#241a2e" stroke-width="2" fill="none" opacity="0.85"/>
    <ellipse cx="${cx}" cy="${headY - headR * 0.55}" rx="${headR * 0.52}" ry="${headR * 0.16}" fill="#ffffff" opacity="0.10"/>
    <ellipse cx="${cx - headR * 0.52}" cy="${headY + headR * 0.26}" rx="${headR * 0.2}" ry="${headR * 0.12}" fill="${pal.accent}" opacity="0.12" style="filter: url(#rimGlow)"/>
    <ellipse cx="${cx + headR * 0.52}" cy="${headY + headR * 0.26}" rx="${headR * 0.2}" ry="${headR * 0.12}" fill="${pal.accent}" opacity="0.12" style="filter: url(#rimGlow)"/>
    <path d="M ${cx - headR * 0.05} ${headY - headR * 0.18} L ${cx - headR * 0.02} ${headY + headR * 0.34}" stroke="#000000" stroke-width="2" opacity="0.10"/>
    <path d="M ${cx - headR * 0.2} ${headY + headR * 0.6} Q ${cx} ${headY + headR * 0.68} ${cx + headR * 0.2} ${headY + headR * 0.6}" stroke="#ffd9de" stroke-width="1.6" fill="none" opacity="0.55"/>`;

  const choker = hasChoker
    ? `<path d="M ${cx - headR * 0.55} ${headY + headR * 1.18} Q ${cx} ${headY + headR * 1.42} ${cx + headR * 0.55} ${headY + headR * 1.18} L ${cx + headR * 0.5} ${headY + headR * 1.34} Q ${cx} ${headY + headR * 1.58} ${cx - headR * 0.5} ${headY + headR * 1.34} Z"
        fill="${pal.accent}" opacity="0.95"/>
      <circle cx="${cx}" cy="${headY + headR * 1.4}" r="${headR * 0.12}" fill="#f59e0b"/>`
    : '';

  const rimLight = `
    <path d="M ${cx + 52} ${H * 0.62} C ${cx + 62} ${H * 0.52}, ${cx + 60} ${H * 0.44}, ${cx + 44} ${H * 0.37}
             C ${cx + 30} ${H * 0.41}, ${cx + 16} ${H * 0.39}, ${cx + headR * 0.9} ${headY - headR * 0.2}"
          stroke="${pal.accent}" stroke-width="3" fill="none" opacity="0.75"
          style="filter: url(#rimGlow)"/>`;

  const cyberGlow = hasCyber
    ? `<circle cx="${cx + headR * 0.95}" cy="${headY - headR * 0.35}" r="4" fill="${pal.accent}" style="filter: url(#rimGlow)"/>
       <path d="M ${cx + headR * 0.8} ${headY + headR * 0.1} L ${cx + headR * 1.15} ${headY + headR * 0.35}" stroke="${pal.accent}" stroke-width="2" opacity="0.9"/>`
    : '';

  const tattoo = hasTattoo
    ? `<path d="M ${cx - 78} ${H * 0.50} q 6 -10 12 0 q -6 10 -12 0 M ${cx - 72} ${H * 0.50} q 6 -10 12 0"
            stroke="${pal.accent}" stroke-width="1.6" fill="none" opacity="0.8"/>`
    : '';

  const grain = `
    <filter id="grainF">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seedVal % 999}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.07"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>`;

  const vignette = `
    <radialGradient id="vignette" cx="50%" cy="45%" r="70%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </radialGradient>`;

  const HUD = `
    <path d="M 26 26 L 26 64 M 26 26 L 64 26 M ${W - 64} 26 L ${W - 26} 26 M ${W - 26} 26 L ${W - 26} 64
             M 26 ${H - 64} L 26 ${H - 26} M 26 ${H - 26} L 64 ${H - 26} M ${W - 26} ${H - 64} L ${W - 26} ${H - 26} M ${W - 64} ${H - 26} L ${W - 26} ${H - 26}"
          stroke="${pal.accent}" stroke-width="2" fill="none" opacity="0.8"/>`;

  const badges = `
    <rect x="30" y="${H - 96}" width="${isVideo ? 168 : 150}" height="30" rx="6" fill="#0b0b14" stroke="${pal.accent}" stroke-opacity="0.6"/>
    <text x="44" y="${H - 76}" fill="#ffffff" font-family="monospace" font-size="13" font-weight="700" letter-spacing="2">
      ${isVideo ? 'NOIR VIDEO PREVIEW' : 'NOIR RENDER PREVIEW'}
    </text>
    <rect x="${W - 122}" y="${H - 96}" width="92" height="30" rx="6" fill="#0b0b14" stroke="#34344a"/>
    <text x="${W - 108}" y="${H - 76}" fill="${pal.accent}" font-family="monospace" font-size="13" font-weight="700" letter-spacing="1">
      SEED ${seedId}
    </text>`;

  const caption = `
    <rect x="${W * 0.5 - 150}" y="${H - 40}" width="300" height="26" rx="13" fill="#0b0b14" fill-opacity="0.82" stroke="${pal.accent}" stroke-opacity="0.35"/>
    <text x="${W * 0.5}" y="${H - 22}" fill="#fff" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" font-weight="700" letter-spacing="1">
      ${name.replace(/[<>&"]/g, '').slice(0, 26).toUpperCase()}
    </text>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.backdrop[0]}"/>
      <stop offset="55%" stop-color="${pal.backdrop[1]}"/>
      <stop offset="100%" stop-color="#050508"/>
    </linearGradient>
    <radialGradient id="keyLight" cx="42%" cy="30%" r="55%">
      <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${pal.accent}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    ${legGrad}
    ${netPattern}
    ${grain}
    ${vignette}
    <filter id="rimGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <circle cx="${W * 0.4}" cy="${H * 0.3}" r="${W * 0.5}" fill="url(#keyLight)"/>

  <!-- window light beams -->
  <g opacity="0.10">
    <path d="M ${W * 0.1} 0 L ${W * 0.34} 0 L ${W * 0.55} ${H} L ${W * 0.26} ${H} Z" fill="${pal.backdrop[2]}"/>
    <path d="M ${W * 0.42} 0 L ${W * 0.5} 0 L ${W * 0.66} ${H} L ${W * 0.55} ${H} Z" fill="${pal.backdrop[2]}"/>
  </g>

  <!-- crimson glow pool -->
  <ellipse cx="${cx + 40}" cy="${H * 0.78}" rx="${W * 0.36}" ry="${H * 0.16}" fill="${pal.accent}" opacity="0.14" style="filter: url(#softGlow)"/>

  <!-- armchair -->
  <g>
    <path d="M ${cx - 210} ${H * 0.98} L ${cx - 196} ${H * 0.34} C ${cx - 196} ${H * 0.24}, ${cx - 168} ${H * 0.18}, ${cx - 150} ${H * 0.20}
             L ${cx - 96} ${H * 0.24} L ${cx - 70} ${H * 0.72} C ${cx - 74} ${H * 0.82}, ${cx - 88} ${H * 0.90}, ${cx - 102} ${H * 0.92} Z"
          fill="${chairFill}"/>
    <path d="M ${cx + 210} ${H * 0.98} L ${cx + 196} ${H * 0.34} C ${cx + 196} ${H * 0.24}, ${cx + 168} ${H * 0.18}, ${cx + 150} ${H * 0.20}
             L ${cx + 96} ${H * 0.24} L ${cx + 70} ${H * 0.72} C ${cx + 74} ${H * 0.82}, ${cx + 88} ${H * 0.90}, ${cx + 102} ${H * 0.92} Z"
          fill="${chairFill}"/>
    <path d="M ${cx - 190} ${H * 0.98} L ${cx - 178} ${H * 0.38} Q ${cx - 170} ${H * 0.30} ${cx - 158} ${H * 0.30} L ${cx - 102} ${H * 0.34}"
          fill="none" stroke="${chairHighlight}" stroke-width="3" opacity="0.8"/>
    <path d="M ${cx + 190} ${H * 0.98} L ${cx + 178} ${H * 0.38} Q ${cx + 170} ${H * 0.30} ${cx + 158} ${H * 0.30} L ${cx + 102} ${H * 0.34}"
          fill="none" stroke="${chairHighlight}" stroke-width="3" opacity="0.8"/>
    <path d="M ${cx - 118} ${H * 0.99} C ${cx - 96} ${H * 0.93}, ${cx + 96} ${H * 0.93}, ${cx + 118} ${H * 0.99} L ${cx + 118} ${H}
             L ${cx - 118} ${H} Z" fill="#180f16"/>
    ${[0, 1, 2, 3].map(i => `<circle cx="${cx - 168}" cy="${H * 0.42 + i * 28}" r="3.4" fill="#3d2438"/>`).join('')}
    ${[0, 1, 2, 3].map(i => `<circle cx="${cx + 168}" cy="${H * 0.42 + i * 28}" r="3.4" fill="#3d2438"/>`).join('')}
  </g>

  <!-- hair -->
  <path d="${hairPath}" fill="${pal.hair}"/>
  <path d="${hairPath}" fill="none" stroke="${pal.hairHi}" stroke-width="2.4" opacity="0.5"
        style="filter: url(#rimGlow)"/>
  <path d="M ${cx - 66} ${H * 0.30} C ${cx - 86} ${H * 0.42}, ${cx - 88} ${H * 0.52}, ${cx - 74} ${H * 0.60}"
        stroke="${pal.hairHi}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.35"/>
  <path d="M ${cx + 66} ${H * 0.30} C ${cx + 86} ${H * 0.42}, ${cx + 88} ${H * 0.52}, ${cx + 74} ${H * 0.60}"
        stroke="${pal.hairHi}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.35"/>

  <!-- legs -->
  ${legLeft}
  ${legRight}
  <path d="M ${cx - 46} ${H * 0.56} C ${cx - 54} ${H * 0.66}, ${cx - 52} ${H * 0.78}, ${cx - 44} ${H * 0.88}" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.16" stroke-linecap="round"/>
  <path d="M ${cx + 32} ${H * 0.58} C ${cx + 38} ${H * 0.68}, ${cx + 44} ${H * 0.78}, ${cx + 46} ${H * 0.88}" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.16" stroke-linecap="round"/>

  <!-- torso & arms -->
  ${torso}
  ${armLeft}
  ${armRight}

  <!-- neck, head, face -->
  <rect x="${cx - headR * 0.22}" y="${headY + headR * 0.7}" width="${headR * 0.44}" height="${headR * 0.72}" fill="url(#skinGrad)"/>
  ${head}
  ${choker}
  ${cyberGlow}
  ${tattoo}
  ${rimLight}

  <!-- vignette + grain -->
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grainF)" opacity="0.5"/>

  ${HUD}
  ${badges}
  ${caption}
</svg>
`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function parse(response: Response, p: ProviderName, m: Mode): Promise<GenerationResult> {
  const raw = await response.text();
  let d: any = {};
  try {
    d = JSON.parse(raw);
  } catch {}
  let asset: string | undefined =
    d.url ??
    d.assetUrl ??
    d.output?.url ??
    (typeof d.output?.[0] === 'string' ? d.output[0] : d.output?.[0]?.url) ??
    d.data?.[0]?.url ??
    d.video?.url;
  let b64: string | undefined = d.data?.[0]?.b64_json;

  // A1111 / SD-WebUI: images: ["base64…"]
  if (!asset && Array.isArray(d.images) && typeof d.images[0] === 'string') {
    asset = d.images[0].startsWith('data:') ? d.images[0] : `data:image/png;base64,${d.images[0]}`;
  }
  // OpenAI-style image output: choices[0].message.images[0].image_url.url
  if (!asset) {
    const imgs = d.choices?.[0]?.message?.images;
    if (Array.isArray(imgs) && imgs[0]?.image_url?.url) asset = imgs[0].image_url.url;
  }
  // Gemini: candidates[0].content.parts[].inlineData
  if (!asset) {
    const parts = d.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        asset = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
      if (part?.fileData?.fileUri) {
        asset = part.fileData.fileUri;
        break;
      }
    }
  }
  // Imagen style: mediaItems[0].image.bytesBase64Encoded
  if (!asset && d.mediaItems?.[0]?.image?.bytesBase64Encoded) {
    asset = `data:image/png;base64,${d.mediaItems[0].image.bytesBase64Encoded}`;
  }
  if (!asset && d.images?.[0]?.bytesBase64Encoded) {
    asset = `data:image/png;base64,${d.images[0].bytesBase64Encoded}`;
  }
  // outputFormat PNG from Gemini Imagen (gcsUri)
  if (!asset && d.generatedImages?.[0]?.image?.uri) {
    asset = d.generatedImages[0].image.uri;
  }

  const job = d.id ?? d.jobId ?? d.task_id;
  return {
    provider: p,
    status: m === 'video' && !asset && !b64 ? 'queued' : 'ready',
    assetUrl: asset ?? (b64 ? `data:image/png;base64,${b64}` : undefined),
    jobId: job,
    text: d.text ?? d.message,
    warning: asset || b64 || job ? undefined : 'Provider returned no media URL'
  };
}

function defaultModel(p: ProviderName, m: Mode): string {
  const saved = getSavedModel(p, m) || getSavedModel(p);
  if (saved) return saved;
  if (p === 'selfhosted') return '';
  if (p === 'openrouter') {
    return m === 'image'
      ? env()['VITE_OPENROUTER_IMAGE_MODEL'] ?? 'google/gemini-2.5-flash-image-preview'
      : env()['VITE_OPENROUTER_VIDEO_MODEL'] ?? env()['VITE_OPENROUTER_CHAT_MODEL'] ?? 'openai/gpt-4o-mini';
  }
  if (p === 'gemini') {
    return m === 'image'
      ? env()['VITE_GEMINI_IMAGE_MODEL'] ?? 'gemini-2.5-flash-image'
      : env()['VITE_GEMINI_VIDEO_MODEL'] ?? env()['VITE_GEMINI_CHAT_MODEL'] ?? 'gemini-2.5-flash';
  }
  return '';
}

function defaultEndpoint(p: ProviderName, m: Mode, model: string): string {
  if (p === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  if (p === 'gemini') {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }
  return '';
}

async function post(p: ProviderName, r: GenerationRequest): Promise<GenerationResult> {
  if (p === 'selfhosted') {
    if (r.mode !== 'image') {
      return {
        provider: p,
        status: 'error',
        warning: 'Self-hosted engines currently render images — video requests go through the Video studio cloud path.',
        assetUrl: undefined,
        text: undefined
      };
    }
    const out = await generateSelfHosted({
      prompt: r.prompt,
      negative: r.negative,
      width: r.width,
      height: r.height,
      steps: r.steps,
      cfg: r.cfg,
      seed: r.seed
    });
    return {
      provider: p,
      status: out.status,
      assetUrl: out.assetUrl,
      warning: out.warning,
      jobId: out.jobId,
      text: out.status === 'ready' ? 'Self-hosted render complete.' : undefined
    };
  }
  const key = getSavedApiKey(p);
  const model = env()[`VITE_${p.toUpperCase()}_${r.mode.toUpperCase()}_MODEL`] ?? env()[`VITE_${p.toUpperCase()}_MODEL`] ?? defaultModel(p, r.mode);
  const endpoint = getSavedEndpoint(p, r.mode) || (p === 'custom' ? '' : defaultEndpoint(p, r.mode, model));
  if (!key || !endpoint) {
    return {
      provider: p,
      status: 'error',
      warning: `${p} ${r.mode} endpoint or API key is not configured. (Local procedural engine available)`,
      assetUrl: undefined,
      text: undefined
    };
  }
  const headers: any = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`
  };
  if (p === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    headers['X-Title'] = 'Grok Girls';
  }
  const url = p === 'gemini' ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : endpoint;

  let body: any;
  if (p === 'openrouter' && r.mode === 'image') {
    body = {
      model,
      modalities: ['image', 'text'],
      messages: [
        { role: 'user', content: [{ type: 'text', text: `Create an image exactly matching this description: ${r.prompt}` }] }
      ]
    };
  } else if (p === 'gemini') {
    body = {
      contents: [{ parts: [{ text: r.prompt }] }],
      generationConfig: r.mode === 'image' ? { responseModalities: ['IMAGE'] } : undefined
    };
  } else {
    body = {
      prompt: r.prompt,
      model: model || undefined,
      width: r.width,
      height: r.height,
      steps: r.steps,
      cfg: r.cfg,
      cfg_scale: r.cfg,
      seed: r.seed,
      negative_prompt: r.negative
    };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: p === 'gemini' ? { 'Content-Type': 'application/json' } : headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`${p} HTTP ${response.status}${errText ? ` — ${errText.slice(0, 160)}` : ''}`);
  }
  return parse(response, p, r.mode);
}

class Local {
  readonly name = 'local' as const;
  available() {
    return true;
  }
  async generate(r: GenerationRequest): Promise<GenerationResult> {
    const assetUrl = createLocalPlaceholderSvg(r.prompt, r.mode, r.width ?? 768, r.height ?? 768, r.seed);
    return {
      provider: 'local',
      status: 'ready',
      assetUrl,
      text: `Local procedural ${r.mode} rendered with the Noir engine. Connect OpenRouter, Gemini or a Custom endpoint in ⚙ Settings for cloud neural inference.`
    };
  }
}

class Cloud {
  constructor(public readonly name: Exclude<ProviderName, 'local'>) {}
  available() {
    if (this.name === 'selfhosted') {
      return Boolean(getServerBase());
    }
    if (this.name === 'custom') {
      return Boolean(getSavedApiKey(this.name) && getSavedEndpoint(this.name));
    }
    return Boolean(getSavedApiKey(this.name));
  }
  async generate(r: GenerationRequest): Promise<GenerationResult> {
    return post(this.name, r);
  }
}

export function providers() {
  return [new Local(), new Cloud('openrouter'), new Cloud('gemini'), new Cloud('custom')];
}

export async function generateWithFallback(
  r: GenerationRequest,
  preferred: ProviderName = 'local'
): Promise<GenerationResult> {
  const all = providers();
  for (const p of [...all.filter(x => x.name === preferred), ...all.filter(x => x.name !== preferred)]) {
    if (!p.available() && p.name !== 'local') continue;
    try {
      const out = await p.generate(r);
      if (out.status === 'ready' || out.status === 'queued' || p.name === 'local') return out;
    } catch (e) {
      if (p.name === preferred && preferred !== 'local') {
        return {
          provider: p.name,
          status: 'error',
          warning: e instanceof Error ? e.message : 'Generation failed',
          assetUrl: undefined,
          text: undefined
        };
      }
    }
  }
  return {
    provider: 'local',
    status: 'fallback',
    warning: 'No configured generation provider.',
    assetUrl: undefined,
    text: undefined
  };
}

export async function chatWithProvider(messages: ChatMessage[], preferred: ProviderName = 'openrouter') {
  const e = env();
  if (preferred === 'local') return { provider: 'local' as const, text: 'Local companion mode is active.' };

  if (preferred === 'selfhosted') {
    const chatEndpoint = getSavedEndpoint('custom', 'chat') || e.VITE_CUSTOM_CHAT_ENDPOINT || '';
    if (!chatEndpoint) {
      return {
        provider: 'selfhosted' as const,
        text: 'The self-hosted server is for image generation only. Switch the chat engine to Local, OpenRouter, Gemini or Custom to talk.',
        warning: 'No chat endpoint configured for self-hosted mode.'
      };
    }
    // Route self-hosted chat through an OpenAI-compatible endpoint if one is configured.
    const key = getSavedApiKey('custom');
    const r = await fetch(chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: e.VITE_CUSTOM_CHAT_MODEL ?? getSavedModel('custom', 'chat') ?? getSavedModel('custom'),
        messages
      })
    });
    if (!r.ok) throw new Error(`Self-hosted chat HTTP ${r.status}`);
    const d = await r.json();
    return {
      provider: 'selfhosted' as const,
      text: d.choices?.[0]?.message?.content ?? d.text ?? 'No response.'
    };
  }

  if (preferred === 'openrouter') {
    const key = getSavedApiKey('openrouter');
    if (!key) return { provider: 'openrouter' as const, text: 'OpenRouter API key is not configured.', warning: 'Set VITE_OPENROUTER_API_KEY or configure in Settings.' };
    const endpoint =
      getSavedEndpoint('openrouter', 'chat') || e.VITE_OPENROUTER_CHAT_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'http://localhost',
        'X-Title': 'Grok Girls'
      },
      body: JSON.stringify({
        model: e.VITE_OPENROUTER_CHAT_MODEL ?? getSavedModel('openrouter', 'chat') ?? getSavedModel('openrouter') ?? 'openai/gpt-4o-mini',
        messages
      })
    });
    if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}`);
    const d = await r.json();
    return { provider: 'openrouter' as const, text: d.choices?.[0]?.message?.content ?? 'No response.' };
  }

  if (preferred === 'gemini') {
    const key = getSavedApiKey('gemini');
    if (!key) return { provider: 'gemini' as const, text: 'Gemini API key is not configured.', warning: 'Set VITE_GEMINI_API_KEY or configure in Settings.' };
    const model =
      e.VITE_GEMINI_CHAT_MODEL ?? getSavedModel('gemini', 'chat') ?? getSavedModel('gemini') ?? 'gemini-2.5-flash';
    const endpoint =
      getSavedEndpoint('gemini', 'chat') ||
      getSavedEndpoint('gemini') ||
      e.VITE_GEMINI_CHAT_ENDPOINT ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const system = messages.find(m => m.role === 'system')?.content;
    const r = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents })
    });
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
    const d = await r.json();
    return { provider: 'gemini' as const, text: d.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? 'No response.' };
  }

  const key = getSavedApiKey('custom');
  const endpoint = getSavedEndpoint('custom', 'chat') || e.VITE_CUSTOM_CHAT_ENDPOINT || '';
  if (!key || !endpoint) return { provider: 'custom' as const, text: 'Custom provider API key or endpoint is not configured.' };
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: e.VITE_CUSTOM_CHAT_MODEL ?? getSavedModel('custom', 'chat') ?? getSavedModel('custom'),
      messages
    })
  });
  if (!r.ok) throw new Error(`Custom HTTP ${r.status}`);
  const d = await r.json();
  return { provider: 'custom' as const, text: d.choices?.[0]?.message?.content ?? d.text ?? 'No response.' };
}
