import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import { HDRenderer, buildDefaultScene } from './HDRenderer';
import { RenderResolution } from './RenderResolution';

export interface HDRenderViewHandle { onResume(): void; onPause(): void; release(): void; getAngle(): number; readCenterPixel(): [number, number, number, number]; render(): void; }
export interface HDRenderViewProps {
  className?: string; style?: CSSProperties; seed?: number; gender?: string; skin?: string; hair?: string; eyes?: string; face?: string; body?: string; outfit?: string; age?: string; tattoos?: string; augmentations?: string; resolution?: RenderResolution; renderScale?: number; hdr?: boolean; bloom?: boolean; shadows?: boolean;
}

export const HDRenderView = forwardRef<HDRenderViewHandle, HDRenderViewProps>(function HDRenderView(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HDRenderer | null>(null);
  const pausedRef = useRef(false);
  const angleRef = useRef(0);
  const definition = () => ({ gender: props.gender ?? 'Female', skin: props.skin ?? 'Skin 1', hair: props.hair ?? 'Long', eyes: props.eyes ?? 'Natural', face: props.face ?? 'Natural', body: props.body ?? 'Average', outfit: props.outfit ?? 'Tech', age: props.age ?? 'Adult', tattoos: props.tattoos ?? 'None', augmentations: props.augmentations ?? 'None' });

  const renderNow = () => {
    const canvas = canvasRef.current;
    if (!canvas || pausedRef.current) return;
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, depth: true });
    if (!gl) return;
    if (!rendererRef.current) rendererRef.current = new HDRenderer(gl);
    const renderer = rendererRef.current;
    // Default interactive preview is now QHD. A caller can explicitly request
    // another native resolution; the render scale is kept separate so the
    // final image can be supersampled without changing the UI viewport.
    renderer.configure({ resolution: props.resolution ?? RenderResolution.QHD, renderScale: props.renderScale ?? 1, enableDepth: true, enableMsaa: true, msaaSamples: 4, hdr: props.hdr ?? true, bloom: props.bloom ?? true, shadows: props.shadows ?? true, samples: 1, seed: props.seed ?? 7 });
    renderer.loadScene(buildDefaultScene(definition(), props.seed ?? 7));
    renderer.render();
    angleRef.current += 0.5;
  };

  useEffect(() => { pausedRef.current = false; renderNow(); return () => { pausedRef.current = true; rendererRef.current?.dispose(); rendererRef.current = null; }; }, []);
  useImperativeHandle(ref, () => ({
    onResume: () => { pausedRef.current = false; renderNow(); }, onPause: () => { pausedRef.current = true; }, release: () => { pausedRef.current = true; rendererRef.current?.dispose(); rendererRef.current = null; }, getAngle: () => angleRef.current,
    readCenterPixel: () => { const canvas = canvasRef.current; const gl = canvas?.getContext('webgl2', { preserveDrawingBuffer: true }); if (!gl || !canvas) return [0, 0, 0, 0]; const px = new Uint8Array(4); gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2], px[3]]; }, render: renderNow
  }));
  return <canvas ref={canvasRef} className={props.className ?? 'hd3d-canvas'} style={props.style} aria-label="HD 3D avatar viewport" />;
});
