export type AvatarVideoStyle = 'cartoon' | 'realistic' | 'anime' | 'pixel' | 'minimalist';
export type AvatarAnimation = 'idle' | 'wave' | 'talk' | 'dance' | 'jump' | 'spin';
export type AvatarBackground = 'transparent' | 'gradient' | 'solid' | 'pattern';
export type HairStyle = 'short' | 'long' | 'curly' | 'bald' | 'mohawk';
export type Accessory = 'none' | 'glasses' | 'earrings' | 'hat' | 'headphones';

export interface HDAvatarVideoConfig {
  style: AvatarVideoStyle;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  clothingColor: string;
  hairStyle: HairStyle;
  accessories: Accessory;
  background: AvatarBackground;
  name?: string;
  animation: AvatarAnimation;
  width?: number;
  height?: number;
  fps?: number;
  durationMs?: number;
  transparent?: boolean;
}

export interface HDVideoResult {
  blob: Blob;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
}

const defaults: HDAvatarVideoConfig = {
  style: 'cartoon',
  skinColor: '#FFD5B8',
  hairColor: '#4A3728',
  eyeColor: '#4A90E2',
  clothingColor: '#667EEA',
  hairStyle: 'short',
  accessories: 'none',
  background: 'transparent',
  animation: 'idle',
  width: 1920,
  height: 1080,
  fps: 30,
  durationMs: 5000,
  transparent: false
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHair(ctx: CanvasRenderingContext2D, c: HDAvatarVideoConfig, cx: number, cy: number, r: number) {
  ctx.fillStyle = c.hairColor;
  switch (c.hairStyle) {
    case 'bald': return;
    case 'mohawk':
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - r + 10);
      ctx.lineTo(cx, cy - r - 48);
      ctx.lineTo(cx + 14, cy - r + 10);
      ctx.closePath();
      ctx.fill();
      return;
    case 'curly':
      for (let i = 0; i < 13; i++) {
        const a = Math.PI + (i * Math.PI) / 12;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * (r + 9), cy - 8 + Math.sin(a) * (r + 9), 17, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    case 'long':
      ctx.beginPath();
      ctx.arc(cx, cy - 15, r + 7, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - r - 7, cy - 15, (r + 7) * 2, 70);
      return;
    default:
      ctx.beginPath();
      ctx.arc(cx, cy - 15, r + 6, Math.PI, Math.PI * 2);
      ctx.fill();
  }
}

function drawAvatar(ctx: CanvasRenderingContext2D, c: HDAvatarVideoConfig, t: number) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = Math.min(w, h) / 500;
  const cx = w / 2;
  const cy = h * 0.45;
  const r = 80 * s;
  const bob = Math.sin(t * 2) * 3 * s;
  const talk = c.animation === 'talk' ? Math.abs(Math.sin(t * 12)) : 0;
  const wave = c.animation === 'wave' ? Math.sin(t * 5) * 0.7 : 0;
  const dance = c.animation === 'dance' ? Math.sin(t * 5) : 0;
  const jump = c.animation === 'jump' ? Math.abs(Math.sin(t * 3)) * 35 * s : 0;
  const spin = c.animation === 'spin' ? t * 2 : 0;

  ctx.clearRect(0, 0, w, h);
  if (!c.transparent && c.background !== 'transparent') {
    if (c.background === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#667eea');
      g.addColorStop(1, '#764ba2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (c.background === 'pattern') {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e9ecef';
      for (let x = 0; x < w; x += 32 * s) for (let y = 0; y < h; y += 32 * s) ctx.fillRect(x, y, 16 * s, 16 * s);
    } else {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, w, h);
    }
  }

  ctx.save();
  ctx.translate(0, bob - jump);
  if (c.animation === 'spin') {
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.translate(-cx, -cy);
  }
  if (c.animation === 'dance') ctx.rotate(dance * 0.06);

  const bodyW = 150 * s;
  const bodyH = 150 * s;
  ctx.fillStyle = c.clothingColor;
  roundedRect(ctx, cx - bodyW / 2, cy + 50 * s, bodyW, bodyH, 20 * s);
  ctx.fill();

  ctx.fillStyle = c.skinColor;
  ctx.fillRect(cx - 20 * s, cy + 8 * s, 40 * s, 55 * s);

  ctx.beginPath();
  if (c.style === 'realistic') ctx.ellipse(cx, cy, 65 * s, 78 * s, 0, 0, Math.PI * 2);
  else if (c.style === 'anime') ctx.ellipse(cx, cy, 72 * s, 78 * s, 0, 0, Math.PI * 2);
  else ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx, c, cx, cy, r);

  const eyeScale = c.style === 'anime' ? 1.25 : 1;
  const eyeY = cy - 10 * s;
  for (const ex of [-30, 30]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + ex * s, eyeY, 20 * s * eyeScale, 24 * s * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eyeColor;
    ctx.beginPath();
    ctx.arc(cx + ex * s, eyeY, 11 * s * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx + ex * s, eyeY, 5 * s * eyeScale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#333';
  if (talk > 0) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 40 * s, 16 * s, (4 + talk * 15) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy + 35 * s, 15 * s, 0, Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(2, 2 * s);
    ctx.stroke();
  }

  ctx.fillStyle = c.skinColor;
  ctx.save();
  ctx.translate(cx + 72 * s, cy + 62 * s);
  ctx.rotate(wave);
  ctx.fillRect(0, -10 * s, 62 * s, 20 * s);
  ctx.restore();
  ctx.fillRect(cx - 134 * s, cy + 52 * s, 62 * s, 20 * s);

  if (c.accessories === 'glasses') {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(cx - 49 * s, cy - 27 * s, 40 * s, 38 * s);
    ctx.strokeRect(cx + 9 * s, cy - 27 * s, 40 * s, 38 * s);
    ctx.beginPath(); ctx.moveTo(cx - 9 * s, cy - 8 * s); ctx.lineTo(cx + 9 * s, cy - 8 * s); ctx.stroke();
  } else if (c.accessories === 'hat') {
    ctx.fillStyle = '#222';
    ctx.fillRect(cx - 42 * s, cy - 100 * s, 84 * s, 40 * s);
    ctx.beginPath(); ctx.ellipse(cx, cy - 100 * s, 70 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
  } else if (c.accessories === 'earrings') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx - 70 * s, cy + 18 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 70 * s, cy + 18 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  } else if (c.accessories === 'headphones') {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 10 * s;
    ctx.beginPath(); ctx.arc(cx, cy - 45 * s, 78 * s, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(cx - 83 * s, cy - 25 * s, 16 * s, 55 * s); ctx.fillRect(cx + 67 * s, cy - 25 * s, 16 * s, 55 * s);
  }

  if (c.name) {
    ctx.fillStyle = '#333';
    ctx.font = `700 ${20 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(c.name, cx, h - 30 * s);
  }
  ctx.restore();
}

export function normalizeHDAvatarVideoConfig(config: Partial<HDAvatarVideoConfig>): HDAvatarVideoConfig {
  return { ...defaults, ...config, width: Math.max(320, Math.min(3840, config.width ?? defaults.width)), height: Math.max(320, Math.min(2160, config.height ?? defaults.height)), fps: Math.max(1, Math.min(60, config.fps ?? defaults.fps)), durationMs: Math.max(250, Math.min(60000, config.durationMs ?? defaults.durationMs)) };
}

export async function renderHDAvatarVideo(input: Partial<HDAvatarVideoConfig>, onProgress?: (progress: number) => void): Promise<HDVideoResult> {
  const config = normalizeHDAvatarVideoConfig(input);
  const canvas = document.createElement('canvas');
  canvas.width = config.width!;
  canvas.height = config.height!;
  const ctx = canvas.getContext('2d', { alpha: config.transparent })!;
  const fps = config.fps!;
  const durationMs = config.durationMs!;
  const stream = canvas.captureStream(fps);
  const preferred = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = preferred.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not available in this browser.');
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Avatar video recorder failed.'));
    recorder.onstop = () => resolve();
  });

  recorder.start(250);
  const start = performance.now();
  const frameMs = 1000 / fps;
  let nextFrame = start;
  while (true) {
    const now = performance.now();
    const elapsed = now - start;
    const t = elapsed / 1000;
    drawAvatar(ctx, config, t);
    onProgress?.(Math.min(100, Math.round((elapsed / durationMs) * 100)));
    if (elapsed >= durationMs) break;
    nextFrame += frameMs;
    const wait = Math.max(0, nextFrame - performance.now());
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  }
  recorder.stop();
  await stopped;
  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  return { blob, url: URL.createObjectURL(blob), mimeType: blob.type, width: config.width!, height: config.height!, fps, durationMs };
}

export function downloadHDVideo(result: HDVideoResult, filename = 'avatar-video.webm') {
  const a = document.createElement('a');
  a.href = result.url;
  a.download = filename.endsWith('.webm') ? filename : `${filename}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function revokeHDVideo(result: HDVideoResult) {
  URL.revokeObjectURL(result.url);
}
