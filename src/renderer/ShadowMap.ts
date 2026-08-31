/* ------------------------------------------------------------------ */
/* ShadowMap — depth-only framebuffer with a 32F depth texture for     */
/* PCF shadow mapping (milestone 3).                                   */
/* ------------------------------------------------------------------ */

export interface ShadowMap {
  framebuffer: WebGLFramebuffer;
  depthTexture: WebGLTexture;
  size: number;
}

export function createShadowMap(
  gl: WebGL2RenderingContext,
  size = 2048
): ShadowMap {
  const framebuffer = gl.createFramebuffer();
  const depthTexture = gl.createTexture();

  if (!framebuffer || !depthTexture) {
    throw new Error('Failed to create shadow map');
  }

  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT32F,
    size,
    size,
    0,
    gl.DEPTH_COMPONENT,
    gl.FLOAT,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Shadow framebuffer incomplete: ${status}`);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return {
    framebuffer,
    depthTexture,
    size
  };
}

/** Delete the shadow map GL resources (renderer release path). */
export function destroyShadowMap(
  gl: WebGL2RenderingContext,
  shadow: ShadowMap
): void {
  gl.deleteTexture(shadow.depthTexture);
  gl.deleteFramebuffer(shadow.framebuffer);
}
