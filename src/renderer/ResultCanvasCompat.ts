import { HDRenderer } from './HDRenderer';

type RendererRuntime = HDRenderer & { gl?: WebGL2RenderingContext };
type RenderResultRuntime = { canvas: HTMLCanvasElement } & Record<string, unknown>;
type RendererPrototype = { render: (this: RendererRuntime) => RenderResultRuntime };
type PatchedConstructor = typeof HDRenderer & { __resultCanvasPatched?: boolean };

/** Keep RenderResult.canvas tied to the real WebGL surface for GPU readback.
 * The renderer still creates its separate 2D canvas for PNG encoding. */
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
