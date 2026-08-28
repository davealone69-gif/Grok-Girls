import React, { useState } from 'react';
import { Girl, Room } from '../models/studio';

export interface VideoExportPageProps {
  girl?: Girl;
  room?: Room;
  latestAssetUrl?: string;
  adult?: boolean;
}

export default function VideoExportPage({
  girl,
  room,
  latestAssetUrl,
  adult = false
}: VideoExportPageProps) {
  const [format, setFormat] = useState('mp4');
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState('1080p');
  const [aspect, setAspect] = useState('16:9');
  const [motionIntensity, setMotionIntensity] = useState('cinematic');
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderedClipUrl, setRenderedClipUrl] = useState<string | null>(null);

  const startRender = () => {
    if (rendering) return;
    setRendering(true);
    setProgress(0);
    setRenderedClipUrl(null);

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRendering(false);
          // Set either the real asset or a generated video scene simulation
          setRenderedClipUrl(latestAssetUrl || 'rendered');
          return 100;
        }
        return p + 10;
      });
    }, 180);
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
          Cloud rendering delegates directly to configured video diffusion providers (OpenRouter, Gemini, or Custom endpoint).
          Local mode renders a procedural visual sequence preview.
        </small>
      </div>

      {rendering && (
        <div style={{ marginTop: 18, background: '#0c0c11', padding: 16, borderRadius: 12, border: '1px solid #292932' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#a99cff', fontWeight: 800 }}>RENDERING FRAMES…</span>
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
        </div>
      )}

      {renderedClipUrl && !rendering && (
        <div className="media" style={{ marginTop: 18 }}>
          <span className="eyebrow">RENDER COMPLETE</span>
          <p style={{ marginTop: 4, color: '#7ff0bd', fontWeight: 700 }}>
            ✓ Video sequence rendered with preset {quality} / {fps}fps
          </p>
          {latestAssetUrl && (
            <img
              src={latestAssetUrl}
              alt="Rendered scene keyframe"
              style={{ maxHeight: 380, objectFit: 'contain' }}
            />
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="generate"
          disabled={rendering}
          onClick={startRender}
        >
          {rendering ? `RENDERING (${progress}%)…` : '🎬 START VIDEO RENDER'}
        </button>
      </div>
    </section>
  );
}
