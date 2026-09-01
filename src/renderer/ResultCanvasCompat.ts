import { HDRenderer } from './HDRenderer';
import type { RenderResult } from './types';

type RendererRuntime = { gl?: WebGL2RenderingContext };
type RendererPrototype = { render: (this: RendererRuntime) => RenderResult };
type PatchedConstructor = typeof HDRenderer & { __resultCanvasPatched?: boolean };

/** Keep RenderResult.canvas tied to the real WebGL surface for GPU readback.
 * The renderer still creates its separate 2D canvas for PNG encoding.
 *
 * Do not intersect RendererRuntime with HDRenderer here: HDRenderer.gl is
 * private, and TypeScript reduces that intersection to never.
 */
const Ctor = HDRenderer as PatchedConstructor;
if (!Ctor.__resultCanvasPatched) {
  const proto = HDRenderer.prototype as unknown as RendererPrototype;
  const original = proto.render;
  proto.render = function patchedRender(this: RendererRuntime) {
    const result = original.call(this);
    const glCanvas = this.gl?.canvas;
    if (glCanvas instanceof HTMLCanvasElement) result.canvas = glCanvas;
    return result;
  };
  Ctor.__resultCanvasPatched = true;
}
