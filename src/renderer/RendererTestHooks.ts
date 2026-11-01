import { HDRenderer, buildDefaultScene } from './HDRenderer';
import { HdAvatarRenderer, defaultAvatarSkeleton } from './HdAvatarRenderer';
import { DEFAULT_AVATAR_PARAMETERS } from './avatar/AvatarParameters';
import { Skeleton, Bone } from './avatar/Skeleton';
import { MorphController } from './avatar/MorphTarget';
import { DEFAULT_AVATAR_MATERIAL } from './avatar/AvatarMaterial';
import {
  createProceduralSkinTextures,
  destroyProceduralSkinTextures,
  createThicknessTexture,
  destroyThicknessTexture,
  createSpecularTexture,
  destroySpecularTexture,
  createPoreTexture,
  destroyPoreTexture,
  createWrinkleTexture,
  destroyWrinkleTexture
} from './ProceduralSkinTextures';
import { DEFAULT_ADVANCED_SKIN_MATERIAL } from './AdvancedSkinMaterial';
import { MorphShader } from './MorphShader';
import { createFaceControls, applyFaceControls, FaceExpressionController, BlinkController } from './avatar/FaceControls';
import { correctiveRules, evaluateCorrectives } from './avatar/Correctives';
import { uploadMorphWeights } from './avatar/MorphTargets';
import { createEyeTextures, destroyEyeTextures } from './EyeTextures';
import { EyeShader } from './EyeShader';
import { DEFAULT_EYE_PARAMETERS, DEFAULT_IRIS_COLOR } from './EyeMaterial';
import { createHairTextures, destroyHairTextures } from './HairTextures';
import { HairShader } from './HairShader';
import { DEFAULT_HAIR_PARAMETERS } from './HairMaterial';
import { createShadowMap, destroyShadowMap } from './ShadowMap';
import { ShadowShader } from './ShadowShader';
import { createIblPipeline, destroyIblPipeline, generateStudioEnvironment, DEFAULT_IBL_SETTINGS } from './IblPipeline';
import { CinematicPipeline, CinematicRenderer, createFullscreenTriangle } from './CinematicPipeline';
import { probeCapabilities, createRenderTarget, checkFramebufferComplete } from './RenderTarget';
import { parseGlb } from './avatar/GlbLoader';
import { readAccessor, toFloat32 } from './avatar/GltfAccessor';
import { loadAvatarGlb, disposeAvatarAsset, updateSkeleton } from './avatar/GltfAvatar';
import { computeGlobalTransforms, evaluateSkins } from './avatar/GltfSkeleton';
import { uploadGltfTexture, loadGltfImage } from './avatar/GltfImages';
import { HDFrameRenderer } from './HDFrameRenderer';
import { RenderResolution, RENDER_RESOLUTIONS } from './RenderResolution';
import { HDRenderTarget } from './HDRenderTarget';
import { installRendererDiagnostics } from './RendererDiagnostics';

/** Install renderer-only test hooks. Loaded only when the browser URL opts in with ?hdDebug=1. */
export function installRendererTestHooks(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  w.__hdDebug = {
    HDRenderer,
    buildDefaultScene,
    HDRenderTarget,
    RenderResolution,
    RENDER_RESOLUTIONS,
    HDFrameRenderer,
    HdAvatarRenderer,
    defaultAvatarSkeleton,
    Skeleton,
    Bone,
    MorphController,
    DEFAULT_AVATAR_PARAMETERS,
    DEFAULT_AVATAR_MATERIAL,
    createProceduralSkinTextures,
    destroyProceduralSkinTextures,
    createThicknessTexture,
    destroyThicknessTexture,
    createSpecularTexture,
    destroySpecularTexture,
    createPoreTexture,
    destroyPoreTexture,
    createWrinkleTexture,
    destroyWrinkleTexture,
    DEFAULT_ADVANCED_SKIN_MATERIAL,
    MorphShader,
    createFaceControls,
    applyFaceControls,
    FaceExpressionController,
    BlinkController,
    correctiveRules,
    evaluateCorrectives,
    uploadMorphWeights,
    createEyeTextures,
    destroyEyeTextures,
    EyeShader,
    DEFAULT_EYE_PARAMETERS,
    DEFAULT_IRIS_COLOR,
    createHairTextures,
    destroyHairTextures,
    HairShader,
    DEFAULT_HAIR_PARAMETERS,
    createShadowMap,
    destroyShadowMap,
    ShadowShader,
    createIblPipeline,
    destroyIblPipeline,
    generateStudioEnvironment,
    DEFAULT_IBL_SETTINGS,
    CinematicPipeline,
    CinematicRenderer,
    createFullscreenTriangle,
    probeCapabilities,
    createRenderTarget,
    checkFramebufferComplete,
    parseGlb,
    readAccessor,
    toFloat32,
    loadAvatarGlb,
    disposeAvatarAsset,
    updateSkeleton,
    computeGlobalTransforms,
    evaluateSkins,
    uploadGltfTexture,
    loadGltfImage
  };
  installRendererDiagnostics();
}
