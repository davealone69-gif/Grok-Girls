import { getRenderTargetCapabilities, createRenderTarget } from './RenderTargetFactory';
import { loadGltfAvatar } from './gltf/GltfAvatar';

export function installRendererDiagnostics(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const previous = (w.__hdDebug as Record<string, unknown> | undefined) ?? {};
  w.__hdDebug = {
    ...previous,
    getRenderTargetCapabilities: (gl: WebGL2RenderingContext) => getRenderTargetCapabilities(gl),
    createRenderTarget: (gl: WebGL2RenderingContext, request: Parameters<typeof createRenderTarget>[1]) => createRenderTarget(gl, request),
    loadGltfAvatar,
  };
}
