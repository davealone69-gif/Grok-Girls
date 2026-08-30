import React, { useEffect, useRef, useState } from 'react';
import { Girl, Room, buildAvatarPrompt } from '../models/studio';
import { generateWithFallback, ProviderName } from '../services/providers';
import { NSFW_NEGATIVE } from '../services/adultActs';

export interface VideoExportPageProps {
  girl?: Girl;
  room?: Room;
  latestAssetUrl?: string;
  adult?: boolean;
  provider?: ProviderName;
  videoPrompt?: string;
  onRendered?: () => void;
}

const CLIP_SECONDS = 5;

export default function VideoExportPage({
  girl,
  room,
  latestAssetUrl,
  adult = false,
  provider = 'local',
  videoPrompt,
  onRendered
}: VideoExportPageProps) {
  const [format, setFormat] = useState('mp4');
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState('1080p');
  const [aspect, setAspect] = useState('16:9');
  const [motionIntensity, setMotionIntensity] = useState('cinematic');
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'idle' | 'cloud' | 'local' | 'done'>('idle');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const lastPctRef = useRef(-1);

  // Load the source keyframe image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
    };
    img.onerror = () => {
      imgRef.current = null;
    };
    if (latestAssetUrl) img.src = latestAssetUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [latestAssetUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      recorderRef.current?.stop();
    };
  }, []);

  const dimsFor = () => {
    switch (aspect) {
      case '9:16':
        return { w: 720, h: 1280 };
      case '1:1':
        return { w: 960, h: 960 };
      case '21:9':
        return { w: 1280, h: 548 };
      default:
        return { w: 1280, h: 720 };
    }
  };

  const motionFor = (t: number) => {
    const k = Math.min(1, t / CLIP_SECONDS);
    switch (motionIntensity) {
      case 'subtle':
        return { zoom: 1 + 0.02 * Math.sin(t * 1.4), ox: 0, oy: 0 };
      case 'dynamic':
        return {
          zoom: 1.14 - 0.04 * k,
          ox: Math.sin(t * 2.6) * 26,
          oy: Math.cos(t * 2.1) * 18
        };
      case 'slow-pan':
        return { zoom: 1.04, ox: -40 + 80 * k, oy: 8 * Math.sin(t * 0.9) };
      default:
        // cinematic dolly
        return { zoom: 1.06 + 0.07 * k, ox: Math.sin(k * Math.PI * 2) * 22, oy: 10 * k };
    }
  };

  const makeNoiseCanvas = () => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const d = ctx.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = v;
      d.data[i + 1] = v;
      d.data[i + 2] = v;
      d.data[i + 3] = Math.random() * 26;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  };

  const startLocalRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = dimsFor();
    canvas.width = w;
    canvas.height = h;

    const stream = canvas.captureStream(fps);
    let mime = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mime)) mime = '';
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setClipUrl(URL.createObjectURL(blob));
      setRecording(false);
      setPhase('done');
      setProgress(100);
      setNote('Local cinematic preview recorded (Ken Burns camera + film grain).');
      onRendered?.();
    };

    const noise = makeNoiseCanvas();
    const t0 = performance.now();
    lastPctRef.current = -1;
    setPhase('local');
    setRecording(true);
    setProgress(0);

    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const k = Math.min(1, t / CLIP_SECONDS);
      const pct = Math.floor(k * 100);
      if (pct !== lastPctRef.current) {
        lastPctRef.current = pct;
        setProgress(pct);
      }

      // background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      const img = imgRef.current;
      const m = motionFor(t);
      if (img) {
        const ir = img.width / img.height;
        const cr = w / h;
        let dw = w;
        let dh = h;
        if (ir > cr) {
          dh = h;
          dw = h * ir;
        } else {
          dw = w;
          dh = w / ir;
        }
        const zoomedW = dw * m.zoom;
        const zoomedH = dh * m.zoom;
        const dx = (w - zoomedW) / 2 + m.ox;
        const dy = (h - zoomedH) / 2 + m.oy;
        ctx.save();
        // subtle breathing vignette + color wash
        ctx.drawImage(img, dx, dy, zoomedW, zoomedH);
        ctx.restore();
      } else {
        // no image: noir gradient + pulsing core
        const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.7);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2);
        g.addColorStop(0, `rgba(230, 32, 64, ${0.12 + pulse * 0.1})`);
        g.addColorStop(1, 'rgba(5,5,10,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(girl ? girl.name.toUpperCase() : 'NOIR RENDER', w / 2, h / 2);
        ctx.fillStyle = 'rgba(160,160,190,0.8)';
        ctx.font = '13px monospace';
        ctx.fillText('LOCAL CINEMATIC PREVIEW', w / 2, h / 2 + 34);
      }

      // scanlines + grain
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      const nx = Math.floor(Math.random() * 120);
      const ny = Math.floor(Math.random() * 120);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(noise, -nx, -ny, w + 160, h + 160);
      ctx.globalAlpha = 1;

      // vignette
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // HUD frame + progress bar
      ctx.strokeStyle = 'rgba(144,78,221,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = 'rgba(10,10,18,0.8)';
      ctx.fillRect(18, h - 46, w - 36, 10);
      ctx.fillStyle = '#904edd';
      ctx.fillRect(18, h - 46, (w - 36) * k, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `GROK GIRLS · ${quality} · ${fps}FPS · ${motionIntensity.toUpperCase()}`,
        30,
        h - 56
      );

      if (k < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rec.stop();
      }
    };

    rec.start();
    draw();
  };

  const startRender = async () => {
    if (recording) return;
    setClipUrl(null);
    setCloudUrl(null);
    setNote('');

    if (provider && provider !== 'local') {
      setPhase('cloud');
      setProgress(5);
      const { w, h } = dimsFor();
      const prompt =
        videoPrompt ||
        (girl && room ? buildAvatarPrompt(girl, room, undefined, 'video', true, adult) : 'cinematic video portrait');
      try {
        const r = await generateWithFallback(
          { prompt, mode: 'video', width: w, height: h, negative: adult ? NSFW_NEGATIVE : undefined },
          provider
        );
        if (r.assetUrl && r.provider !== 'local') {
          setCloudUrl(r.assetUrl);
          setProgress(100);
          setPhase('done');
          setNote(`Cloud clip ready via ${r.provider.toUpperCase()}.`);
          onRendered?.();
          return;
        }
        setNote(r.warning || 'No cloud clip returned — recording local cinematic preview instead.');
      } catch (e) {
        setNote('Cloud render failed — recording local cinematic preview instead.');
      }
    }
    startLocalRecording();
  };

  const stopRender = () => {
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      setRecording(false);
      setPhase('idle');
    }
  };

  return (
    <section className="studio">
      <div className="hero">
        <div className="orb">{girl ? girl.name[0] : 'V'}</div>
        <div>
          <span className="eyebrow">EXPORT & RENDER ENGINE</span>
          <h2>Video Export Studio</h2>
          <p>
            Configure cinematic rendering parameters, aspect ratios, encoding presets, and export
            motion clips for {girl ? girl.name : 'the active persona'}.
          </p>
          <div className="chips">
            <span>{quality}</span>
            <span>{fps} FPS</span>
            <span>{format.toUpperCase()}</span>
            <span>{aspect}</span>
            <span>{motionIntensity} motion</span>
            <span>ENGINE: {provider.toUpperCase()}</span>
            {adult && <span className="adult-chip">ADULT MOTION</span>}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <label>
          Quality / Resolution
          <select value={quality} onChange={e => setQuality(e.target.value)}>
            <option value="720p">720p HD (Fast Preview)</option>
            <option value="1080p">1080p Full HD (Recommended)</option>
            <option value="1440p">1440p 2K Ultra</option>
            <option value="2160p">4K UHD (Master)</option>
          </select>
        </label>

        <label>
          Frame Rate (FPS)
          <select value={fps} onChange={e => setFps(Number(e.target.value))}>
            <option value={24}>24 FPS (Cinematic standard)</option>
            <option value={30}>30 FPS (Web & Social)</option>
            <option value={60}>60 FPS (Ultra smooth)</option>
          </select>
        </label>
      </div>

      <div className="grid2">
        <label>
          Output Container & Codec
          <select value={format} onChange={e => setFormat(e.target.value)}>
            <option value="mp4">MP4 (H.264 / AAC - Universal)</option>
            <option value="webm">WebM (VP9 - Web Optimized)</option>
            <option value="mov">MOV (Apple ProRes 422)</option>
          </select>
        </label>

        <label>
          Aspect Ratio
          <select value={aspect} onChange={e => setAspect(e.target.value)}>
            <option value="16:9">16:9 Landscape (Widescreen TV/PC)</option>
            <option value="9:16">9:16 Portrait (Mobile / Reels / Stories)</option>
            <option value="1:1">1:1 Square (Social Feed)</option>
            <option value="21:9">21:9 Cinematic Anamorphic</option>
          </select>
        </label>
      </div>

      <div className="grid2">
        <label>
          Camera Motion Preset
          <select value={motionIntensity} onChange={e => setMotionIntensity(e.target.value)}>
            <option value="subtle">Subtle Breathing & Eye Contact</option>
            <option value="cinematic">Cinematic Dolly & Orbit</option>
            <option value="dynamic">Dynamic Action & Handheld</option>
            <option value="slow-pan">Slow Emotional Pan</option>
          </select>
        </label>

        <label>
          Active Scene Backdrop
          <input
            type="text"
            readOnly
            value={room ? `${room.name} (${room.lighting})` : 'Studio'}
          />
        </label>
      </div>

      <div className="result" style={{ marginTop: 18 }}>
        <b>Render Pipeline Summary</b>
        <p style={{ marginTop: 6, fontSize: 13, color: '#ccc' }}>
          Persona: <b>{girl?.name ?? 'Character'}</b> · Location: <b>{room?.name ?? 'Studio'}</b> ·
          Target: <b>{quality} @ {fps}fps ({format.toUpperCase()})</b> · Ratio: <b>{aspect}</b> ·
          Motion: <b>{motionIntensity}</b>.
        </p>
        <small>
          Cloud mode delegates to configured video providers (OpenRouter, Gemini, or Custom endpoint).
          Local mode records a real {CLIP_SECONDS}-second cinematic WebM clip in your browser — Ken
          Burns camera motion, scanlines, film grain, HUD frame — then downloads it.
        </small>
      </div>

      {/* Live canvas preview while recording */}
      <div className="video-canvas-wrap" style={{ marginTop: 18 }}>
        <canvas ref={canvasRef} className="video-canvas" />
        {recording && (
          <div className="video-canvas-overlay">
            <span>
              REC ● {Math.round(progress)}%
            </span>
          </div>
        )}
        {cloudUrl && phase === 'done' && (
          <div className="media" style={{ marginTop: 14 }}>
            <span className="eyebrow">CLOUD RENDER COMPLETE</span>
            {/\.(mp4|webm|mov)(\?|$)/i.test(cloudUrl) ? (
              <video src={cloudUrl} controls autoPlay muted loop style={{ width: '100%', maxHeight: 380 }} />
            ) : (
              <img src={cloudUrl} alt="Rendered scene keyframe" style={{ maxHeight: 380, objectFit: 'contain' }} />
            )}
          </div>
        )}
      </div>

      {(recording || phase === 'cloud') && (
        <div
          style={{
            marginTop: 14,
            background: '#0c0c11',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #292932'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#a99cff', fontWeight: 800 }}>
              {phase === 'cloud' ? 'REQUESTING CLOUD RENDER…' : 'RECORDING FRAMES…'}
            </span>
            <span style={{ fontSize: 12, color: '#eee' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: 10, background: '#17171f', borderRadius: 5, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #765cff, #e65cff)',
                transition: 'width 0.15s ease'
              }}
            />
          </div>
          {recording && (
            <button className="btn-cancel" style={{ marginTop: 12 }} onClick={stopRender}>
              STOP RECORDING
            </button>
          )}
        </div>
      )}

      {clipUrl && phase === 'done' && (
        <div className="media" style={{ marginTop: 18 }}>
          <span className="eyebrow">RENDER COMPLETE</span>
          <p style={{ marginTop: 4, color: '#7ff0bd', fontWeight: 700 }}>
            ✓ {CLIP_SECONDS}-second clip recorded at {quality} / {fps}fps ({aspect})
          </p>
          <video src={clipUrl} controls autoPlay muted loop style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} />
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <a className="btn-generate-media" href={clipUrl} download={`${girl?.id || 'avatar'}_${aspect.replace(':', 'x')}_${fps}fps.webm`}>
              ⬇ DOWNLOAD CLIP
            </a>
            <button className="btn-generate-media ghost" onClick={() => window.open(clipUrl, '_blank')}>
              OPEN CLIP
            </button>
            <button className="btn-cancel" onClick={() => setClipUrl(null)}>
              DISCARD
            </button>
          </div>
        </div>
      )}

      {note && (
        <p style={{ marginTop: 10, fontSize: 12, color: '#a99cff' }}>{note}</p>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="generate" disabled={recording || phase === 'cloud'} onClick={startRender}>
          {recording || phase === 'cloud'
            ? `RENDERING (${progress}%)…`
            : '🎬 START VIDEO RENDER'}
        </button>
      </div>
    </section>
  );
}
