import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface ColorWheelProps {
  color: string;
  onChange: (hex: string) => void;
  accentColors?: string[];
}

// Convert HSV to Hex
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number, k = (n + h / 60) % 6) =>
    v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const b = Math.round(f(1) * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Convert Hex to HSV
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { h: 0, s: 1, v: 1 };

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s, v };
}

export default function ColorWheel({
  color,
  onChange,
  accentColors = ['#E62040', '#904EDD', '#00F2FE', '#1F2430', '#F5F5FA']
}: ColorWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [isDragging, setIsDragging] = useState(false);
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setHexInput(color);
    setHsv(hexToHsv(color));
  }, [color]);

  // Draw the color wheel circle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const index = (y * size + x) * 4;

        if (dist <= radius) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          if (angle < 0) angle += 360;
          const sat = Math.min(1, dist / radius);
          const hex = hsvToHex(angle, sat, hsv.v);
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);

          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        } else {
          data[index + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw donut ring cutout
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Center filled circle showing current active color
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = hsvToHex(hsv.h, hsv.s, hsv.v);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e1e2d';
    ctx.stroke();

    // Selector ring on the wheel
    const selAngle = (hsv.h - 90) * (Math.PI / 180);
    const selDist = Math.max(radius * 0.48, Math.min(radius, hsv.s * radius));
    const selX = center + Math.cos(selAngle) * selDist;
    const selY = center + Math.sin(selAngle) * selDist;

    ctx.beginPath();
    ctx.arc(selX, selY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  }, [hsv.h, hsv.s, hsv.v]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const size = rect.width;
      const center = size / 2;
      const radius = center - 4;
      const x = e.clientX - rect.left - center;
      const y = e.clientY - rect.top - center;
      const dist = Math.sqrt(x * x + y * y);

      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      const sat = Math.max(0.1, Math.min(1, dist / radius));

      const nextHsv = { ...hsv, h: Math.round(angle), s: sat };
      setHsv(nextHsv);
      const newHex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
      setHexInput(newHex);
      onChange(newHex);
    },
    [hsv, onChange]
  );

  return (
    <div className="color-wheel-container">
      {/* Canvas Wheel */}
      <div className="wheel-wrapper">
        <canvas
          ref={canvasRef}
          width={130}
          height={130}
          className="wheel-canvas"
          onPointerDown={e => {
            setIsDragging(true);
            handlePointer(e);
          }}
          onPointerMove={e => {
            if (isDragging) handlePointer(e);
          }}
          onPointerUp={() => setIsDragging(false)}
        />
      </div>

      {/* Sliders for Value & Saturation */}
      <div className="slider-group">
        <div className="vertical-slider-col">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={hsv.v}
            onChange={e => {
              const v = parseFloat(e.target.value);
              const next = { ...hsv, v };
              setHsv(next);
              const newHex = hsvToHex(next.h, next.s, next.v);
              setHexInput(newHex);
              onChange(newHex);
            }}
            className="vert-slider"
            title="Brightness / Luminance"
          />
        </div>
        <div className="vertical-slider-col">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={hsv.s}
            onChange={e => {
              const s = parseFloat(e.target.value);
              const next = { ...hsv, s };
              setHsv(next);
              const newHex = hsvToHex(next.h, next.s, next.v);
              setHexInput(newHex);
              onChange(newHex);
            }}
            className="vert-slider"
            title="Saturation"
          />
        </div>
      </div>

      {/* Hex & Swatches */}
      <div className="hex-swatches-col">
        <div className="hex-display-box">
          <span className="hex-hash">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setHexInput(`#${val}`);
              if (/^[0-9A-F]{6}$/i.test(val)) {
                const newHex = `#${val}`;
                setHsv(hexToHsv(newHex));
                onChange(newHex);
              }
            }}
            maxLength={6}
            className="hex-input"
          />
        </div>

        <div className="recent-label">RECENT</div>
        <div className="swatches-row">
          {accentColors.map(c => (
            <button
              key={c}
              type="button"
              className={`swatch-btn ${color.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setHsv(hexToHsv(c));
                setHexInput(c);
                onChange(c);
              }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
