import { checkFramebufferComplete, createRenderTarget, RenderTarget } from './RenderTargetFactory';

export interface IblTargetSet {
  equirectToCube: RenderTarget;
  irradiance: RenderTarget;
  brdfLut: RenderTarget;
  prefilterMipTargets: RenderTarget[];
  destroy(): void;
}

export interface IblTargetOptions {
  width: number;
  height: number;
  prefilterSize?: number;
  prefilterMipCount?: number;
}

/**
 * All IBL stages that render into an FBO use the same capability probe.
 * Float textures intended only for sampling remain outside this factory.
 */
export function createIblRenderTargets(gl: WebGL2RenderingContext, options: IblTargetOptions): IblTargetSet {
  const prefilterSize = options.prefilterSize ?? 128;
  const mipCount = options.prefilterMipCount ?? Math.max(1, Math.floor(Math.log2(prefilterSize)) + 1);
  const targets: RenderTarget[] = [];

  try {
    const equirectToCube = createRenderTarget(gl, {
      width: options.width,
      height: options.height,
      color: 'rgba16f',
      depth: null,
    });
    targets.push(equirectToCube);

    const irradiance = createRenderTarget(gl, {
      width: Math.max(1, Math.floor(options.width / 4)),
      height: Math.max(1, Math.floor(options.height / 4)),
      color: 'rgba16f',
      depth: null,
    });
    targets.push(irradiance);

    const brdfLut = createRenderTarget(gl, {
      width: Math.max(1, Math.floor(options.width / 2)),
      height: Math.max(1, Math.floor(options.height / 2)),
      color: 'rg16f',
      depth: null,
    });
    targets.push(brdfLut);

    const prefilterMipTargets: RenderTarget[] = [];
    for (let mip = 0; mip < mipCount; mip++) {
      const size = Math.max(1, prefilterSize >> mip);
      const target = createRenderTarget(gl, {
        width: size,
        height: size,
        color: 'rgba16f',
        depth: null,
      });
      // Each mip has its own FBO/attachment and is explicitly checked.
      if (!checkFramebufferComplete(gl, target.framebuffer)) {
        target.destroy();
        throw new Error(`IBL prefilter mip ${mip} framebuffer is incomplete`);
      }
      prefilterMipTargets.push(target);
      targets.push(target);
    }

    return {
      equirectToCube,
      irradiance,
      brdfLut,
      prefilterMipTargets,
      destroy() {
        for (const target of targets) target.destroy();
      },
    };
  } catch (error) {
    for (const target of targets) target.destroy();
    throw error;
  }
}
