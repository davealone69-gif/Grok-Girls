export type Mood = 'neutral' | 'happy' | 'sad' | 'excited' | 'calm' | 'confident' | 'playful';

export interface Avatar {
  id: string;
  name: string;
  description: string;
  mood: Mood;
  energy: number;
  confidence: number;
  relationship: number;
  tags: string[];
}

export interface Room {
  id: string;
  name: string;
  environment: string;
  lighting: string;
  mood: string;
  interactions: string[];
}

export interface Memory {
  id: string;
  avatarId: string;
  text: string;
  importance: number;
  createdAt: number;
}

export interface SceneState {
  avatarId: string;
  roomId: string;
  interaction: string;
  camera: string;
}
