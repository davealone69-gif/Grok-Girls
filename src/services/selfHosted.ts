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

/* ------------------------------- storage (canonical settings record) */
import {
  getSelfHostBase as shGetBase,
  saveSelfHostBase as shSetBase,
  getSelfHostType as shGetType,
  saveSelfHostType as shSetType,
  getSelfHostCheckpoint as shGetCkpt,
  saveSelfHostCheckpoint as shSetCkpt,
  getSelfHostSampler as shGetSampler,
  saveSelfHostSampler as shSetSampler,
  getSelfHostUpscaler as shGetUpscaler,
  saveSelfHostUpscaler as shSetUpscaler,
  getSelfHostHiresFix as shGetHires,
  saveSelfHostHiresFix as shSetHires,
  getSelfHostLoras as shGetLoras,
  saveSelfHostLoras as shSetLoras
} from './settingsState';

export function getServerBase(): string {
  return shGetBase();
}
export function saveServerBase(url: string) {
  shSetBase(url);
}
export function getServerType(): SelfHostServerType {
  const t = shGetType();
  return t === 'a1111' || t === 'comfy' ? t : 'unknown';
}
export function saveServerType(t: SelfHostServerType) {
  shSetType(t);
}
export function getCheckpoint(): string {
  return shGetCkpt();
}
export function saveCheckpoint(name: string) {
  shSetCkpt(name);
}
export function getSampler(): string {
  return shGetSampler();
}
export function saveSampler(name: string) {
  shSetSampler(name);
}
export function getUpscaler(): string {
  return shGetUpscaler();
}
export function saveUpscaler(name: string) {
  shSetUpscaler(name);
}
export function getHiresFix(): boolean {
  return shGetHires();
}
export function saveHiresFix(v: boolean) {
  shSetHires(v);
}
export function loadLoraSlots(): LoraSlot[] {
  return shGetLoras();
}
export function saveLoraSlots(slots: LoraSlot[]) {
  shSetLoras(slots);
}


/* Fetch with a hard timeout so an unreachable server can never leave the UI
   stuck "busy" (and GENERATE disabled) for minutes. */
function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const signal =
    typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function'
      ? (AbortSignal as any).timeout(ms)
      : undefined;
  return fetch(url, { ...init, signal });
}

/* ------------------------------ discovery ----------------------------- */
export async function detectServer(base: string): Promise<SelfHostServerType> {
  const a1111 = await fetchWithTimeout(`${base}/sdapi/v1/sd-models`, { method: 'GET' }).catch(() => null);
  if (a1111 && a1111.ok) return 'a1111';
  const comfy = await fetchWithTimeout(`${base}/system_stats`, { method: 'GET' }).catch(() => null);
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
      message: `No A1111 or ComfyUI API found at ${base}. Check the URL and that the server is running with its API enabled (A1111: launch with --api). If the browser blocked the request, also add --cors-allow-origins=* (ComfyUI allows browsers by default).`
    };
  }
  saveServerType(type);
  try {
    if (type === 'a1111') {
      const modelsRes = await fetchWithTimeout(`${base}/sdapi/v1/sd-models`);
      const models = (await modelsRes.json()) as { title?: string }[];
      let loraCount = 0;
      try {
        const lorasRes = await fetchWithTimeout(`${base}/sdapi/v1/loras`);
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
    const statsRes = await fetchWithTimeout(`${base}/system_stats`);
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
      const r = await fetchWithTimeout(`${base}/sdapi/v1/sd-models`);
      const d = (await r.json()) as { title?: string }[];
      return Array.isArray(d) ? d.map(m => m.title || '').filter(Boolean) : [];
    }
    if (type === 'comfy') {
      const r = await fetchWithTimeout(`${base}/object_info/CheckpointLoaderSimple`);
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
      const r = await fetchWithTimeout(`${base}/sdapi/v1/loras`);
      const d = (await r.json()) as { name?: string }[];
      return Array.isArray(d) ? d.map(l => l.name || '').filter(Boolean) : [];
    }
    if (type === 'comfy') {
      const r = await fetchWithTimeout(`${base}/object_info/LoraLoader`);
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error('Could not read render data'));
    fr.readAsDataURL(blob);
  });
}

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
      // A1111 txt2img only responds when the image is finished — on a busy
      // GPU with Hires-Fix this routinely exceeds the discovery timeout.
      // Give it a full 5 minutes; discovery/short calls keep the 8s cap.
      const r = await fetchWithTimeout(
        `${base}/sdapi/v1/txt2img`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        },
        300000
      );
      if (!r.ok) {
        throw new Error(`A1111 HTTP ${r.status} — is the API enabled? Launch the WebUI with --api.`);
      }
      const d = await r.json();
      const b64: string | undefined = d?.images?.[0];
      if (!b64) return { status: 'error', warning: 'A1111 returned no image. Check the server log.' };
      return { status: 'ready', assetUrl: `data:image/png;base64,${b64}` };
    } catch (e) {
      const hint = e instanceof Error && /fetch|network/i.test(e.message)
        ? ' If the browser blocked the request (CORS), launch A1111 with: --api --cors-allow-origins=*'
        : '';
      return {
        status: 'error',
        warning: `Self-hosted render failed: ${e instanceof Error ? e.message : 'connection error'}.${hint}`
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
      const submit = await fetchWithTimeout(`${base}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: apiJson, client_id: clientId })
      });
      if (!submit.ok) throw new Error(`ComfyUI HTTP ${submit.status} (submit)`);
      const { prompt_id } = await submit.json();
      // M7: persist the queued job so a closed app resumes it on next launch
      saveComfyJob({ promptId: prompt_id, base, prompt: req.prompt, createdAt: Date.now() });
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        await sleep(1500);
        const h = await fetchWithTimeout(`${base}/history/${prompt_id}`).catch(() => null);
        if (!h || !h.ok) continue;
        const data = await h.json();
        const entry = data[prompt_id];
        if (!entry) continue;
        if (entry.status?.status_str === 'error') {
          clearComfyJob();
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
          const imgRes = await fetchWithTimeout(`${base}/view?${params}`);
          if (!imgRes.ok) return { status: 'error', warning: 'ComfyUI image fetch failed.' };
          const blob = await imgRes.blob();
          // Persist as a data URL so the render survives reloads and stays in
          // the gallery (blob: URLs die when the page unloads).
          const dataUrl = await blobToDataUrl(blob);
          clearComfyJob();
          return { status: 'ready', assetUrl: dataUrl, jobId: prompt_id };
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


/* ------------------------------------------------------------------ */
/* M7 — ComfyUI job resume: the 3-minute poll loop abandons a queued   */
/* job when the app closes. We persist the prompt_id at submit time    */
/* and resume polling on the next launch.                              */
/* ------------------------------------------------------------------ */

interface ComfyJob {
  promptId: string;
  base: string;
  prompt: string;
  createdAt: number;
}

const COMFY_JOB_KEY = 'grok-girls-comfy-job-v1';

function saveComfyJob(job: ComfyJob) {
  try {
    localStorage.setItem(COMFY_JOB_KEY, JSON.stringify(job));
  } catch (e) {
    console.warn('[comfy] could not persist job', e);
  }
}

function clearComfyJob() {
  try {
    localStorage.removeItem(COMFY_JOB_KEY);
  } catch {}
}

export interface ComfyResumeResult {
  status: 'ready' | 'error' | 'queued';
  assetUrl?: string;
  warning?: string;
  avatarId?: string;
  prompt?: string;
}

/** Poll a previously submitted ComfyUI job. Returns null when there is
 *  nothing to resume. Keeps the job stored while it is still running so a
 *  later launch can try again. */
export async function resumeComfyJob(): Promise<ComfyResumeResult | null> {
  let job: ComfyJob;
  try {
    const raw = localStorage.getItem(COMFY_JOB_KEY);
    if (!raw) return null;
    job = JSON.parse(raw) as ComfyJob;
    if (!job?.promptId || !job?.base) return null;
  } catch {
    return null;
  }
  const { promptId, base } = job;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const h = await fetchWithTimeout(`${base}/history/${promptId}`).catch(() => null);
    if (!h || !h.ok) continue;
    const data = await h.json();
    const entry = data[promptId];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') {
      clearComfyJob();
      return { status: 'error', warning: 'ComfyUI workflow failed — check the server log.', prompt: job.prompt };
    }
    const outs = entry.outputs?.['9']?.images;
    if (Array.isArray(outs) && outs.length) {
      const img = outs[0];
      const params = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output'
      });
      const imgRes = await fetchWithTimeout(`${base}/view?${params}`);
      if (!imgRes.ok) {
        clearComfyJob();
        return { status: 'error', warning: 'ComfyUI image fetch failed.', prompt: job.prompt };
      }
      const blob = await imgRes.blob();
      const dataUrl = await blobToDataUrl(blob);
      clearComfyJob();
      return { status: 'ready', assetUrl: dataUrl, prompt: job.prompt };
    }
  }
  // Still running — keep the job stored for the next launch.
  return { status: 'queued', warning: 'ComfyUI render still running — will resume on next launch.', prompt: job.prompt };
}
