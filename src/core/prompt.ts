import type { Avatar, Room, SceneState } from './types';

export function buildGenerationPrompt(avatar: Avatar, room: Room, scene: SceneState, video = false) {
  const medium = video ? 'cinematic video, natural motion, temporal consistency' : 'high quality still image, detailed composition';
  return [
    medium,
    `character: ${avatar.name}`,
    avatar.description,
    `mood: ${avatar.mood}, energy ${avatar.energy}/100, confidence ${avatar.confidence}/100`,
    `environment: ${room.environment}`,
    `lighting: ${room.lighting}`,
    `scene mood: ${room.mood}`,
    `interaction: ${scene.interaction}`,
    `camera: ${scene.camera}`,
    'consistent identity, coherent anatomy, polished studio production',
  ].join(', ');
}
