export type Emotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'calm' | 'confident' | 'surprised';

export interface AvatarSpec {
  id: string;
  name: string;
  age: number;
  style: string;
  hair: string;
  eyes: string;
  outfit: string;
  personality: string;
  pose: string;
  effects: string[];
  prompt: string;
}

export interface AvatarState {
  mood: number;
  energy: number;
  trust: number;
  affection: number;
  relationshipLevel: number;
  emotion: Emotion;
  roomId: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  objects: string[];
}

export interface Memory {
  id: string;
  summary: string;
  roomId: string;
  importance: number;
  createdAt: number;
}

export const rooms: Room[] = [
  { id: 'studio', name: 'Studio', description: 'Creator workspace for building and staging characters.', atmosphere: 'focused', objects: ['mirror', 'camera', 'lighting rig'] },
  { id: 'lounge', name: 'Lounge', description: 'Relaxed conversation and relationship scene.', atmosphere: 'warm', objects: ['sofa', 'music player', 'window'] },
  { id: 'club', name: 'Club', description: 'High-energy showcase environment.', atmosphere: 'energetic', objects: ['stage', 'lights', 'sound system'] },
  { id: 'gallery', name: 'Gallery', description: 'Preview and curate finished creations.', atmosphere: 'cinematic', objects: ['display wall', 'projector', 'export desk'] },
];

export const starterAvatar: AvatarSpec = {
  id: crypto.randomUUID(),
  name: 'Nova',
  age: 25,
  style: 'cinematic cyber',
  hair: 'silver',
  eyes: 'amber',
  outfit: 'designer streetwear',
  personality: 'confident, curious, playful',
  pose: 'relaxed portrait',
  effects: ['rim light'],
  prompt: '',
};

export function buildPrompt(spec: AvatarSpec, room?: Room): string {
  const scene = room ? `, staged in ${room.name}, ${room.atmosphere} atmosphere` : '';
  return [
    'high-quality character portrait',
    spec.style,
    `${spec.age}-year-old adult character`,
    `${spec.hair} hair`,
    `${spec.eyes} eyes`,
    spec.outfit,
    spec.personality,
    spec.pose,
    spec.effects.join(', '),
    scene,
    'detailed lighting, polished composition, safe-for-work presentation',
  ].filter(Boolean).join(', ');
}

export function initialState(avatarId: string, roomId = 'studio'): AvatarState {
  void avatarId;
  return { mood: 0.65, energy: 0.8, trust: 0.5, affection: 0.35, relationshipLevel: 1, emotion: 'neutral', roomId };
}

export function respond(state: AvatarState, message: string): { state: AvatarState; text: string } {
  const positive = /love|great|nice|thanks|awesome|good/i.test(message);
  const next = {
    ...state,
    mood: clamp(state.mood + (positive ? 0.06 : 0.01)),
    trust: clamp(state.trust + 0.02),
    affection: clamp(state.affection + (positive ? 0.03 : 0.01)),
    energy: clamp(state.energy - 0.01),
    emotion: positive ? 'happy' : 'calm',
  } as AvatarState;
  return { state: next, text: positive ? 'Nice. I am keeping that direction in the studio memory.' : 'Got it. I have added that to the current scene context.' };
}

export function addMemory(list: Memory[], summary: string, roomId: string, importance = 0.5): Memory[] {
  const next = [...list, { id: crypto.randomUUID(), summary: summary.slice(0, 240), roomId, importance, createdAt: Date.now() }];
  return next.sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt).slice(0, 150);
}

export function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
