/* ------------------------------------------------------------------ */
/* HDRenderTarget — mirror of the native framebuffer wrapper.          */
/*                                                                     */
/*   class HDRenderTarget(private var width: Int, private var height:  */
/*   Int) { var framebuffer/colorTexture/depthBuffer = 0; private set  */
/*     fun create()   — destroy + gen FBO/texture/RBO, RGBA8 color,    */
/*                      DEPTH_COMPONENT24, completeness check that     */
/*                      THROWS like the Kotlin IllegalStateException   */
/*     fun bind()     — bind FBO + viewport(width, height)             */
/*     fun unbind(screenWidth, screenHeight) — bind 0 + viewport       */
/*     fun resize(w,h)— no-op when unchanged, else recreate            */
/*     fun destroy()  — delete all three handles                      */
/* ------------------------------------------------------------------ */

export class HDRenderTarget {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;

  private _framebuffer: WebGLFramebuffer | null = null;
  private _colorTexture: WebGLTexture | null = null;
  private _depthBuffer: WebGLRenderbuffer | null = null;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;
  }

  get framebuffer(): WebGLFramebuffer | null {
    return this._framebuffer;
  }
  get colorTexture(): WebGLTexture | null {
    return this._colorTexture;
  }
  get depthBuffer(): WebGLRenderbuffer | null {
    return this._depthBuffer;
  }

  create(): void {
    this.destroy();
    const gl = this.gl;

    const fb = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;
    const depth = gl.createRenderbuffer()!;

    // color texture — RGBA8, linear, clamp to edge (Kotlin params)
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // depth buffer — DEPTH_COMPONENT24
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.width, this.height);

    // framebuffer attachments
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      gl.deleteRenderbuffer(depth);
      // Kotlin: throw IllegalStateException("HD framebuffer incomplete: 0x…")
      throw new Error('HD framebuffer incomplete: 0x' + status.toString(16));
    }

    this._framebuffer = fb;
    this._colorTexture = tex;
    this._depthBuffer = depth;
  }

  bind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  unbind(screenWidth: number, screenHeight: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, screenWidth, screenHeight);
  }

  resize(newWidth: number, newHeight: number): void {
    if (this.width === newWidth && this.height === newHeight) return;
    this.width = newWidth;
    this.height = newHeight;
    this.create();
  }

  destroy(): void {
    const gl = this.gl;
    if (this._framebuffer) {
      gl.deleteFramebuffer(this._framebuffer);
      this._framebuffer = null;
    }
    if (this._colorTexture) {
      gl.deleteTexture(this._colorTexture);
      this._colorTexture = null;
    }
    if (this._depthBuffer) {
      gl.deleteRenderbuffer(this._depthBuffer);
      this._depthBuffer = null;
    }
  }
}
