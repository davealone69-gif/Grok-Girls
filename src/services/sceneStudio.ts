export interface SceneConfig { id: string; name: string; prompt: string; negative: string; lighting: string; camera: string; motion: string; }

export const LIGHTING_PRESETS = ['softbox', 'three-point', 'golden-hour', 'neon-rim', 'moonlight', 'dramatic', 'explicit-closeup', 'sex-scene-key'] as const;
export const CAMERA_PRESETS = ['portrait-85mm', 'cinematic-35mm', 'wide-24mm', 'telephoto-135mm', 'low-angle', 'high-angle', 'pov-penetration', 'closeup-genital', 'over-shoulder-thrust'] as const;
export const MOTION_PRESETS = ['static', 'slow-pan', 'orbit', 'push-in', 'pull-out', 'handheld', 'thrusting', 'bouncing-ride', 'grinding', 'oral-bobbing'] as const;

export function createScene(name = 'New Scene'): SceneConfig {
  return { id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, prompt: '', negative: '', lighting: 'three-point', camera: 'portrait-85mm', motion: 'static' };
}

export function composeScenePrompt(scene: SceneConfig, characterPrompt = ''): { prompt: string; negative: string } {
  return {
    prompt: [characterPrompt, scene.prompt, `${scene.lighting} lighting`, `${scene.camera} camera`, `${scene.motion} motion`].filter(Boolean).join(', '),
    negative: scene.negative,
  };
}

export function saveScene(scene: SceneConfig): void {
  const key = 'grok-girls-scenes-v1';
  let scenes: SceneConfig[] = [];
  try { scenes = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  scenes = [scene, ...scenes.filter(s => s.id !== scene.id)].slice(0, 200);
  localStorage.setItem(key, JSON.stringify(scenes));
}

export function loadScenes(): SceneConfig[] {
  try { return JSON.parse(localStorage.getItem('grok-girls-scenes-v1') || '[]'); } catch { return []; }
}

export function deleteScene(id: string): void {
  localStorage.setItem('grok-girls-scenes-v1', JSON.stringify(loadScenes().filter(s => s.id !== id)));
}
