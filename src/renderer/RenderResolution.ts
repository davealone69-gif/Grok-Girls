/* ------------------------------------------------------------------ */
/* RenderResolution — mirror of the native enum.                       */
/*                                                                     */
/*   enum class RenderResolution(val width: Int, val height: Int) {    */
/*     HD_720P(1280, 720), FULL_HD(1920, 1080),                        */
/*     QHD(2560, 1440), UHD_4K(3840, 2160)                             */
/*   }                                                                 */
/* ------------------------------------------------------------------ */

export enum RenderResolution {
  HD_720P = 'HD_720P',
  FULL_HD = 'FULL_HD',
  QHD = 'QHD',
  UHD_4K = 'UHD_4K'
}

export const RENDER_RESOLUTIONS: Record<RenderResolution, { width: number; height: number }> = {
  [RenderResolution.HD_720P]: { width: 1280, height: 720 },
  [RenderResolution.FULL_HD]: { width: 1920, height: 1080 },
  [RenderResolution.QHD]: { width: 2560, height: 1440 },
  [RenderResolution.UHD_4K]: { width: 3840, height: 2160 }
};
