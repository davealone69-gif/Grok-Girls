import type { Room } from './types';

export const ROOMS: Room[] = [
  { id: 'studio', name: 'Photo Studio', environment: 'professional seamless studio', lighting: 'softbox key and rim light', mood: 'clean, focused', interactions: ['center frame', 'three-quarter pose'] },
  { id: 'bedroom', name: 'Bedroom', environment: 'modern private bedroom', lighting: 'warm bedside lamps and city glow', mood: 'private, luxurious', interactions: ['on bed', 'edge of bed', 'at mirror'] },
  { id: 'club', name: 'Nightclub', environment: 'dark neon nightclub', lighting: 'magenta and cyan neon', mood: 'electric nightlife', interactions: ['booth', 'dancefloor'] },
  { id: 'dungeon', name: 'Dark Studio', environment: 'dramatic private set', lighting: 'red accent and focused spots', mood: 'intense, controlled', interactions: ['center', 'standing'] },
];

export function roomById(id: string) { return ROOMS.find(room => room.id === id) ?? ROOMS[0]; }
