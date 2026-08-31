/* HDFrameRenderer — mirror of HDFrameRenderer.kt.
 * Owns an HDRenderTarget built from the native RenderConfig v2
 * (resolution × renderScale), beginFrame binds+clears, endFrame unbinds
 * to the screen, colorTexture() throws when uninitialized like the
 * native error(), resize by RenderResolution, destroy releases. */

import { HDRenderTarget } from './HDRenderTarget';
import { configSize, RenderConfig } from './types';
import { RenderResolution } from './RenderResolution';

export class HDFrameRenderer {
  private gl: WebGL2RenderingContext;
  private config: RenderConfig;
  private target: HDRenderTarget | null = null;

  constructor(gl: WebGL2RenderingContext, config: RenderConfig) {
    this.gl = gl;
    this.config = config;
  }

  initialize(): void {
    const { width, height } = configSize(this.config);
    this.target = new HDRenderTarget(this.gl, width, height);
    this.target.create();
  }

  beginFrame(): void {
    const t = this.target;
    if (!t) throw new Error('HD renderer not initialized');
    t.bind();
    this.gl.clearColor(0.02, 0.025, 0.04, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  endFrame(screenWidth: number, screenHeight: number): void {
    this.target?.unbind(screenWidth, screenHeight);
  }

  resize(resolution: RenderResolution): void {
    this.target?.resize(
      resolution === RenderResolution.HD_720P ? 1280 : resolution === RenderResolution.FULL_HD ? 1920 : resolution === RenderResolution.QHD ? 2560 : 3840,
      resolution === RenderResolution.HD_720P ? 720 : resolution === RenderResolution.FULL_HD ? 1080 : resolution === RenderResolution.QHD ? 1440 : 2160
    );
  }

  colorTexture(): WebGLTexture {
    if (!this.target) throw new Error('HD renderer not initialized');
    return this.target.colorTexture!;
  }

  destroy(): void {
    this.target?.destroy();
    this.target = null;
  }
}
