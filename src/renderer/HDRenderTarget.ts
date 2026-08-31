import { ColorInternal, createRenderTarget, DepthInternal, RenderTarget } from './RenderTargetFactory';

export class HDRenderTarget {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;
  private target: RenderTarget | null = null;
  private requestedColor: ColorInternal = 'rgba16f';
  private requestedDepth: DepthInternal = 'depth32f';

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;
  }

  get framebuffer(): WebGLFramebuffer | null { return this.target?.framebuffer ?? null; }
  get colorTexture(): WebGLTexture | null { return this.target?.colorTexture ?? null; }
  get depthBuffer(): WebGLRenderbuffer | null { return this.target?.depthBuffer ?? null; }
  get colorInternal(): number | null { return this.target?.colorInternal ?? null; }
  get depthInternal(): number | null { return this.target?.depthInternal ?? null; }
  get colorFormat(): ColorInternal | null { return this.target?.colorFormat ?? null; }
  get depthFormat(): DepthInternal { return this.target?.depthFormat ?? null; }

  create(): void {
    this.destroy();
    this.target = createRenderTarget(this.gl, {
      width: this.width,
      height: this.height,
      color: this.requestedColor,
      depth: this.requestedDepth,
    });
  }

  bind(): void {
    if (!this.target) throw new Error('HD render target not initialized');
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.target.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  unbind(screenWidth: number, screenHeight: number): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, screenWidth, screenHeight);
  }

  resize(newWidth: number, newHeight: number): void {
    if (this.width === newWidth && this.height === newHeight) return;
    this.width = newWidth;
    this.height = newHeight;
    this.create();
  }

  destroy(): void {
    this.target?.destroy();
    this.target = null;
  }
}
