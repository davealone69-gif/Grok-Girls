export type Emotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'calm' | 'confident' | 'surprised';
export interface AvatarSpec { id: string; name: string; age: number; style: string; hair: string; eyes: string; outfit: string; personality: string; pose: string; effects: string[]; prompt: string; }
export interface AvatarState { mood: number; energy: number; trust: number; affection: number; relationshipLevel: number; emotion: Emotion; roomId: string; }
export interface Room { id: string; name: string; description: string; atmosphere: string; objects: string[]; }
export interface Memory { id: string; summary: string; roomId: string; importance: number; createdAt: number; }

export const rooms: Room[] = [
  { id: 'studio', name: 'Photo Studio', description: 'Professional creator workspace for building and staging characters.', atmosphere: 'clean, focused', objects: ['mirror', 'camera', 'softboxes'] },
  { id: 'bedroom', name: 'Bedroom', description: 'Private cinematic environment for character scenes.', atmosphere: 'warm, luxurious', objects: ['bed', 'mirror', 'accent chair'] },
  { id: 'club', name: 'Nightclub', description: 'High-energy showcase environment.', atmosphere: 'electric nightlife', objects: ['booth', 'bar', 'neon lights'] },
  { id: 'dark-set', name: 'Dark Set', description: 'Dramatic private production set.', atmosphere: 'intense, controlled', objects: ['bench', 'spotlights', 'backdrop'] },
];

export const starterAvatar: AvatarSpec = { id: 'nova', name: 'Nova', age: 25, style: 'cinematic cyber', hair: 'silver', eyes: 'amber', outfit: 'designer streetwear', personality: 'confident, curious, playful', pose: 'relaxed portrait', effects: ['rim light'], prompt: '' };

export function buildPrompt(spec: AvatarSpec, room?: Room): string {
  const scene = room ? `staged in ${room.name}, ${room.atmosphere} atmosphere, ${room.objects.join(', ')}` : '';
  return ['high-quality character portrait', spec.style, `${spec.age}-year-old adult character`, `${spec.hair} hair`, `${spec.eyes} eyes`, spec.outfit, spec.personality, spec.pose, spec.effects.join(', '), scene, 'detailed lighting, coherent anatomy, polished composition'].filter(Boolean).join(', ');
}
export function initialState(avatarId: string, roomId = 'studio'): AvatarState { void avatarId; return { mood: .65, energy: .8, trust: .5, affection: .35, relationshipLevel: 1, emotion: 'neutral', roomId }; }
export function respond(state: AvatarState, message: string): { state: AvatarState; text: string } { const positive = /love|great|nice|thanks|awesome|good/i.test(message); const next = { ...state, mood: clamp(state.mood + (positive ? .06 : .01)), trust: clamp(state.trust + .02), affection: clamp(state.affection + (positive ? .03 : .01)), energy: clamp(state.energy - .01), emotion: positive ? 'happy' : 'calm' } as AvatarState; return { state: next, text: positive ? 'Nice. I am keeping that direction in studio memory.' : 'Got it. I have added that to the current scene context.' }; }
export function addMemory(list: Memory[], summary: string, roomId: string, importance = .5): Memory[] { return [...list, { id: crypto.randomUUID(), summary: summary.slice(0, 240), roomId, importance, createdAt: Date.now() }].sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt).slice(0, 150); }
export function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
