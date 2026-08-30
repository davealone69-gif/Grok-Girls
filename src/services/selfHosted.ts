/* ------------------------------------------------------------------ */
/* Self-Hosted generation engine (first-class)                         */
/* Supports AUTOMATIC1111 SD-WebUI (sdapi/v1) and ComfyUI.             */
/* No third-party guardrails: it is your server, your model,           */
/* your content policy. The app just sends the prompt you compiled.    */
/* ------------------------------------------------------------------ */

export type SelfHostServerType = 'a1111' | 'comfy' | 'unknown';

export interface LoraSlot {
  name: string;
  weight: number;
}

export interface SelfHostStatus {
  ok: boolean;
  serverType: SelfHostServerType;
  message: string;
  modelCount?: number;
  loraCount?: number;
}

export interface SelfHostRequest {
  prompt: string;
  negative?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}

export interface SelfHostResult {
  assetUrl?: string;
  status: 'ready' | 'queued' | 'error';
  warning?: string;
  jobId?: string;
}

/* ------------------------------- storage ------------------------------ */
const K_BASE = 'grok-girls-selfhosted-base';
const K_TYPE = 'grok-girls-selfhosted-type';
const K_CKPT = 'grok-girls-selfhosted-ckpt';
const K_SAMPLER = 'grok-girls-selfhosted-sampler';
const K_UPSCALER = 'grok-girls-selfhosted-upscaler';
const K_HIRES = 'grok-girls-selfhosted-hires';
const K_LORAS = 'grok-girls-selfhosted-loras';

function lsGet(k: string): string {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

export function getServerBase(): string {
  return lsGet(K_BASE);
}
export function saveServerBase(url: string) {
  lsSet(K_BASE, url.trim().replace(/\/+$/, ''));
}
export function getServerType(): SelfHostServerType {
  const t = lsGet(K_TYPE);
  return t === 'a1111' || t === 'comfy' ? t : 'unknown';
}
export function saveServerType(t: SelfHostServerType) {
  lsSet(K_TYPE, t);
}
export function getCheckpoint(): string {
  return lsGet(K_CKPT);
}
export function saveCheckpoint(name: string) {
  lsSet(K_CKPT, name);
}
export function getSampler(): string {
  return lsGet(K_SAMPLER);
}
export function saveSampler(name: string) {
  lsSet(K_SAMPLER, name);
}
export function getUpscaler(): string {
  return lsGet(K_UPSCALER);
}
export function saveUpscaler(name: string) {
  lsSet(K_UPSCALER, name);
}
export function getHiresFix(): boolean {
  return lsGet(K_HIRES) === '1';
}
export function saveHiresFix(v: boolean) {
  lsSet(K_HIRES, v ? '1' : '0');
}
export function loadLoraSlots(): LoraSlot[] {
  try {
    const raw = lsGet(K_LORAS);
    const parsed = raw ? (JSON.parse(raw) as LoraSlot[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}
export function saveLoraSlots(slots: LoraSlot[]) {
  try {
    lsSet(K_LORAS, JSON.stringify(slots.slice(0, 3)));
  } catch {}
}

/* ------------------------------ discovery ----------------------------- */
export async function detectServer(base: string): Promise<SelfHostServerType> {
  const a1111 = await fetch(`${base}/sdapi/v1/sd-models`, { method: 'GET' }).catch(() => null);
  if (a1111 && a1111.ok) return 'a1111';
  const comfy = await fetch(`${base}/system_stats`, { method: 'GET' }).catch(() => null);
  if (comfy && comfy.ok) return 'comfy';
  return 'unknown';
}

export async function testConnection(): Promise<SelfHostStatus> {
  const base = getServerBase();
  if (!base) {
    return { ok: false, serverType: 'unknown', message: 'No server URL configured yet.' };
  }
  const type = await detectServer(base);
  if (type === 'unknown') {
    return {
      ok: false,
      serverType: 'unknown',
      message: `No A1111 or ComfyUI API found at ${base}. Check the URL and that the server is running with its API enabled (A1111: launch with --api).`
    };
  }
  saveServerType(type);
  try {
    if (type === 'a1111') {
      const modelsRes = await fetch(`${base}/sdapi/v1/sd-models`);
      const models = (await modelsRes.json()) as { title?: string }[];
      let loraCount = 0;
      try {
        const lorasRes = await fetch(`${base}/sdapi/v1/loras`);
        const loras = (await lorasRes.json()) as unknown[];
        loraCount = Array.isArray(loras) ? loras.length : 0;
      } catch {}
      if (Array.isArray(models) && models.length && !getCheckpoint()) {
        saveCheckpoint(models[0].title || '');
      }
      return {
        ok: true,
        serverType: 'a1111',
        message: 'Connected — AUTOMATIC1111 Stable Diffusion WebUI',
        modelCount: Array.isArray(models) ? models.length : 0,
        loraCount
      };
    }
    const statsRes = await fetch(`${base}/system_stats`);
    await statsRes.json();
    return { ok: true, serverType: 'comfy', message: 'Connected — ComfyUI server' };
  } catch (e) {
    return {
      ok: false,
      serverType: type,
      message: `Reached a ${type.toUpperCase()} server but the request failed: ${e instanceof Error ? e.message : 'unknown error'}`
    };
  }
}

export async function fetchModels(): Promise<string[]> {
  const base = getServerBase();
  if (!base) return [];
  const type = getServerType() !== 'unknown' ? getServerType() : await detectServer(base);
  try {
    if (type === 'a1111') {
      const r = await fetch(`${base}/sdapi/v1/sd-models`);
      const d = (await r.json()) as { title?: string }[];
      return Array.isArray(d) ? d.map(m => m.title || '').filter(Boolean) : [];
    }
    if (type === 'comfy') {
      const r = await fetch(`${base}/object_info/CheckpointLoaderSimple`);
      const d = await r.json();
      const opts = d?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
      return Array.isArray(opts) ? opts : [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchLoras(): Promise<string[]> {
  const base = getServerBase();
  if (!base) return [];
  const type = getServerType() !== 'unknown' ? getServerType() : await detectServer(base);
  try {
    if (type === 'a1111') {
      const r = await fetch(`${base}/sdapi/v1/loras`);
      const d = (await r.json()) as { name?: string }[];
      return Array.isArray(d) ? d.map(l => l.name || '').filter(Boolean) : [];
    }
    if (type === 'comfy') {
      const r = await fetch(`${base}/object_info/LoraLoader`);
      const d = await r.json();
      const opts = d?.LoraLoader?.input?.required?.lora_name?.[0];
      return Array.isArray(opts) ? opts : [];
    }
    return [];
  } catch {
    return [];
  }
}

/* ----------------------------- payloads ------------------------------ */
export const A1111_SAMPLERS = [
  'DPM++ 2M Karras',
  'DPM++ SDE Karras',
  'Euler a',
  'Euler',
  'UniPC',
  'DDIM',
  'DPM++ 2M SDE Karras',
  'Heun'
];

export const A1111_UPSCALERS = ['Latent', 'Latent (nearest)', 'R-ESRGAN 4x+', '4x-UltraSharp', 'SwinIR_4x'];

export function buildA1111Payload(req: SelfHostRequest) {
  const loras = loadLoraSlots().filter(l => l.name.trim());
  const prompt = loras.length
    ? `${req.prompt} ${loras.map(l => `<lora:${l.name.trim()}:${l.weight}>`).join(' ')}`
    : req.prompt;
  const model = getCheckpoint();
  return {
    prompt,
    negative_prompt: req.negative ?? '',
    steps: req.steps ?? 28,
    cfg_scale: req.cfg ?? 7,
    width: req.width ?? 1024,
    height: req.height ?? 1024,
    sampler_name: getSampler() || 'DPM++ 2M Karras',
    seed: req.seed ?? -1,
    batch_size: 1,
    enable_hr: getHiresFix(),
    hr_upscaler: getUpscaler() || 'Latent',
    hr_second_pass_steps: Math.max(8, Math.round((req.steps ?? 28) / 2)),
    denoising_strength: 0.5,
    ...(model ? { override_settings: { sd_model_checkpoint: model } } : {})
  };
}

export function buildComfyPayload(req: SelfHostRequest, clientId: string) {
  const ckpt = getCheckpoint();
  const sampler = (getSampler() || 'DPM++ 2M Karras').toLowerCase().replace(/\s+/g, '_');
  const apiJson: Record<string, any> = {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: req.seed ?? Math.floor(Math.random() * 1e9),
        steps: req.steps ?? 28,
        cfg: req.cfg ?? 7,
        sampler_name: sampler.includes('euler_a') ? 'euler_ancestral' : sampler,
        scheduler: 'karras',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0]
      }
    },
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: req.width ?? 1024, height: req.height ?? 1024, batch_size: 1 }
    },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: req.prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: req.negative ?? '', clip: ['4', 1] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'grok_girls', images: ['8', 0] }
    }
  };
  return { apiJson, ckpt, clientId };
}

/* ------------------------------ generation ---------------------------- */
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

export async function generateSelfHosted(req: SelfHostRequest): Promise<SelfHostResult> {
  const base = getServerBase();
  if (!base) {
    return {
      status: 'error',
      warning: 'Self-hosted server URL is not configured. Open ⚙ Settings → Self-Hosted and enter your A1111 or ComfyUI address.'
    };
  }
  const type = getServerType() !== 'unknown' ? getServerType() : await detectServer(base);

  if (type === 'a1111') {
    try {
      const body = buildA1111Payload(req);
      const r = await fetch(`${base}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        throw new Error(`A1111 HTTP ${r.status} — is the API enabled? Launch the WebUI with the --api flag.`);
      }
      const d = await r.json();
      const b64: string | undefined = d?.images?.[0];
      if (!b64) return { status: 'error', warning: 'A1111 returned no image. Check the server log.' };
      return { status: 'ready', assetUrl: `data:image/png;base64,${b64}` };
    } catch (e) {
      return {
        status: 'error',
        warning: `Self-hosted render failed: ${e instanceof Error ? e.message : 'connection error'}`
      };
    }
  }

  if (type === 'comfy') {
    const clientId = 'grok-girls-' + Math.random().toString(36).slice(2, 8);
    const { apiJson, ckpt } = buildComfyPayload(req, clientId);
    if (!ckpt) {
      return {
        status: 'error',
        warning: 'No checkpoint selected — open ⚙ Settings → Self-Hosted and pick a model.'
      };
    }
    try {
      const submit = await fetch(`${base}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: apiJson, client_id: clientId })
      });
      if (!submit.ok) throw new Error(`ComfyUI HTTP ${submit.status} (submit)`);
      const { prompt_id } = await submit.json();
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        await sleep(1500);
        const h = await fetch(`${base}/history/${prompt_id}`).catch(() => null);
        if (!h || !h.ok) continue;
        const data = await h.json();
        const entry = data[prompt_id];
        if (!entry) continue;
        if (entry.status?.status_str === 'error') {
          return { status: 'error', warning: 'ComfyUI workflow failed — check the server log.' };
        }
        const outs = entry.outputs?.['9']?.images;
        if (Array.isArray(outs) && outs.length) {
          const img = outs[0];
          const params = new URLSearchParams({
            filename: img.filename,
            subfolder: img.subfolder || '',
            type: img.type || 'output'
          });
          const imgRes = await fetch(`${base}/view?${params}`);
          if (!imgRes.ok) return { status: 'error', warning: 'ComfyUI image fetch failed.' };
          const blob = await imgRes.blob();
          return { status: 'ready', assetUrl: URL.createObjectURL(blob), jobId: prompt_id };
        }
      }
      return {
        status: 'queued',
        warning: 'ComfyUI render is still running (timed out at 3 min) — check the server.',
        jobId: prompt_id
      };
    } catch (e) {
      return {
        status: 'error',
        warning: `ComfyUI render failed: ${e instanceof Error ? e.message : 'connection error'}`
      };
    }
  }

  return {
    status: 'error',
    warning: `Unrecognized server at ${base}. Expected A1111 (sdapi/v1) or ComfyUI. Run TEST CONNECTION in Settings.`
  };
}
