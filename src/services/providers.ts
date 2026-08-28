export type ProviderName = 'local' | 'openrouter' | 'gemini' | 'custom';
export type Mode = 'image' | 'video';

export interface GenerationRequest {
  prompt: string;
  mode: Mode;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
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
const keyFor = (p: string) => env()[`VITE_${p.toUpperCase()}_API_KEY`] ?? '';
const endpointFor = (p: string, m: Mode) =>
  env()[`VITE_${p.toUpperCase()}_${m.toUpperCase()}_ENDPOINT`] ??
  env()[`VITE_${p.toUpperCase()}_ENDPOINT`] ??
  '';

function createLocalPlaceholderSvg(prompt: string, mode: Mode, width = 768, height = 768): string {
  const isVideo = mode === 'video';
  const pLower = prompt.toLowerCase();
  
  // Choose theme colors based on scene cues
  let col1 = '#3b1c6d';
  let col2 = '#e94560';
  let accent = '#ff6b8a';
  
  if (pLower.includes('neon') || pLower.includes('club')) {
    col1 = '#0f2042';
    col2 = '#00f2fe';
    accent = '#e65cff';
  } else if (pLower.includes('penthouse') || pLower.includes('luxury') || pLower.includes('gold')) {
    col1 = '#2b1b0e';
    col2 = '#e5a93b';
    accent = '#ffe082';
  } else if (pLower.includes('crimson') || pLower.includes('flirty')) {
    col1 = '#380a15';
    col2 = '#f43f5e';
    accent = '#fb7185';
  } else if (pLower.includes('sugarlab') || pLower.includes('pastel')) {
    col1 = '#281c3d';
    col2 = '#c084fc';
    accent = '#f472b6';
  }

  // Extract character name if present
  const nameMatch = prompt.match(/^([A-Za-z0-9 ]+?)(?:,| adult|\()/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Grok Persona';

  const cleanPrompt = prompt
    .replace(/[<>&"]/g, '')
    .slice(0, 140)
    + (prompt.length > 140 ? '…' : '');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a12"/>
      <stop offset="50%" stop-color="${col1}"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${col2}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="42%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${col2}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="blurFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <circle cx="${width * 0.5}" cy="${height * 0.42}" r="${width * 0.38}" fill="url(#halo)"/>

  <!-- Artistic Ambient Aura -->
  <circle cx="${width * 0.75}" cy="${height * 0.3}" r="140" fill="${col2}" opacity="0.22" filter="url(#blurFilter)"/>
  <circle cx="${width * 0.25}" cy="${height * 0.6}" r="160" fill="${accent}" opacity="0.18" filter="url(#blurFilter)"/>

  <!-- Character Silhouette / Portrait Geometry -->
  <g transform="translate(${width * 0.5}, ${height * 0.45})">
    <!-- Shoulder contour -->
    <path d="M -180,180 C -150,90 -90,70 -40,55 L 40,55 C 90,70 150,90 180,180 Z" fill="#141424" stroke="${col2}" stroke-width="1.5" stroke-opacity="0.6"/>
    <!-- Neck -->
    <rect x="-24" y="5" width="48" height="58" rx="10" fill="#1f1e33"/>
    <!-- Head / Hair Aura -->
    <ellipse cx="0" cy="-45" rx="72" ry="85" fill="${col1}" opacity="0.7"/>
    <!-- Face Contour -->
    <path d="M -50,-60 Q 0,-70 50,-60 Q 55,5 0,45 Q -55,5 -50,-60 Z" fill="#24233a" stroke="${accent}" stroke-width="1.5" stroke-opacity="0.8"/>
    <!-- Hair Highlights -->
    <path d="M -60,-65 Q -30,-110 35,-95 Q 65,-60 62,15 Q 40,-30 20,-60 Q -10,-80 -60,-65 Z" fill="url(#glowGrad)"/>
    <!-- Subtle Eyes Hint -->
    <ellipse cx="-20" cy="-22" rx="7" ry="3.5" fill="${accent}" opacity="0.85"/>
    <ellipse cx="20" cy="-22" rx="7" ry="3.5" fill="${accent}" opacity="0.85"/>
  </g>

  <!-- Top Badge -->
  <g transform="translate(32, 44)">
    <rect width="180" height="32" rx="8" fill="#11111d" stroke="${col2}" stroke-width="1" opacity="0.9"/>
    <text x="14" y="21" fill="#ffffff" font-family="Inter, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5">
      GROK GIRLS ${isVideo ? 'VIDEO' : 'IMAGE'}
    </text>
  </g>

  <!-- Bottom Info Card -->
  <g transform="translate(32, ${height - 110})">
    <rect width="${width - 64}" height="78" rx="12" fill="#10101a" fill-opacity="0.88" stroke="#34344a" stroke-width="1"/>
    <text x="20" y="28" fill="#ffffff" font-family="Inter, sans-serif" font-size="16" font-weight="700">
      ${name}
    </text>
    <text x="20" y="54" fill="#a0a0b8" font-family="Inter, sans-serif" font-size="12">
      ${cleanPrompt}
    </text>
  </g>
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
  const url =
    d.url ??
    d.assetUrl ??
    d.output?.url ??
    d.output?.[0]?.url ??
    d.data?.[0]?.url ??
    d.images?.[0]?.url ??
    d.video?.url;
  const job = d.id ?? d.jobId ?? d.task_id;
  return {
    provider: p,
    status: m === 'video' && !url ? 'queued' : 'ready',
    assetUrl: url,
    jobId: job,
    text: d.text ?? d.message,
    warning: url || job ? undefined : 'Provider returned no media URL'
  };
}

async function post(p: ProviderName, r: GenerationRequest): Promise<GenerationResult> {
  const key = keyFor(p);
  const endpoint = endpointFor(p, r.mode);
  if (!key || !endpoint) {
    return {
      provider: p,
      status: 'error',
      warning: `${p} ${r.mode} endpoint is not configured.`,
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
  const model = env()[`VITE_${p.toUpperCase()}_${r.mode.toUpperCase()}_MODEL`] ?? env()[`VITE_${p.toUpperCase()}_MODEL`];
  const body = {
    prompt: r.prompt,
    model,
    width: r.width,
    height: r.height,
    steps: r.steps,
    cfg: r.cfg,
    seed: r.seed
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: p === 'gemini' ? { 'Content-Type': 'application/json' } : headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${p} HTTP ${response.status}`);
  return parse(response, p, r.mode);
}

class Local {
  readonly name = 'local' as const;
  available() {
    return true;
  }
  async generate(r: GenerationRequest): Promise<GenerationResult> {
    const assetUrl = createLocalPlaceholderSvg(r.prompt, r.mode, r.width ?? 768, r.height ?? 768);
    return {
      provider: 'local',
      status: 'ready',
      assetUrl,
      text: `Local ${r.mode} rendered successfully. Connect OpenRouter, Gemini, or a Custom endpoint for neural cloud generation.`
    };
  }
}

class Cloud {
  constructor(public readonly name: Exclude<ProviderName, 'local'>) {}
  available() {
    return Boolean(keyFor(this.name) && (endpointFor(this.name, 'image') || endpointFor(this.name, 'video')));
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
      if (p.name === preferred) {
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
  if (preferred === 'openrouter') {
    const key = e.VITE_OPENROUTER_API_KEY ?? '';
    if (!key) return { provider: 'openrouter' as const, text: 'OpenRouter is not configured.', warning: 'Set VITE_OPENROUTER_API_KEY.' };
    const endpoint = e.VITE_OPENROUTER_CHAT_ENDPOINT ?? 'https://openrouter.ai/api/v1/chat/completions';
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'http://localhost',
        'X-Title': 'Grok Girls'
      },
      body: JSON.stringify({ model: e.VITE_OPENROUTER_CHAT_MODEL ?? 'openai/gpt-4o-mini', messages })
    });
    if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}`);
    const d = await r.json();
    return { provider: 'openrouter' as const, text: d.choices?.[0]?.message?.content ?? 'No response.' };
  }
  if (preferred === 'gemini') {
    const key = e.VITE_GEMINI_API_KEY ?? '';
    if (!key) return { provider: 'gemini' as const, text: 'Gemini is not configured.', warning: 'Set VITE_GEMINI_API_KEY.' };
    const model = e.VITE_GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash';
    const endpoint =
      e.VITE_GEMINI_CHAT_ENDPOINT ??
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
  const key = e.VITE_CUSTOM_AI_KEY ?? '';
  const endpoint = e.VITE_CUSTOM_CHAT_ENDPOINT ?? '';
  if (!key || !endpoint) return { provider: 'custom' as const, text: 'Custom provider is not configured.' };
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: e.VITE_CUSTOM_CHAT_MODEL, messages })
  });
  if (!r.ok) throw new Error(`Custom HTTP ${r.status}`);
  const d = await r.json();
  return { provider: 'custom' as const, text: d.choices?.[0]?.message?.content ?? d.text ?? 'No response.' };
}
