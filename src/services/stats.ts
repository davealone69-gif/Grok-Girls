export interface StudioStats {
  generations: number;
  favorites: number;
  chats: number;
  stories: number;
  imports: number;
  videos: number;
}

const KEY = 'grok-girls-stats-v1';

const defaults: StudioStats = {
  generations: 0,
  favorites: 0,
  chats: 0,
  stories: 0,
  imports: 0,
  videos: 0
};

export function loadStats(): StudioStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<StudioStats>) };
  } catch {
    return { ...defaults };
  }
}

export function saveStats(s: StudioStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function bumpStat(key: keyof StudioStats, n = 1): StudioStats {
  const s = loadStats();
  s[key] = Math.min(99999, (s[key] || 0) + n);
  saveStats(s);
  return s;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  test: (s: StudioStats) => boolean;
}

export const achievements: Achievement[] = [
  { id: 'first_render', name: 'First Light', desc: 'Generate your first render', icon: '✨', test: s => s.generations >= 1 },
  { id: 'render10', name: 'Rendering Machine', desc: 'Generate 10 renders', icon: '⚙️', test: s => s.generations >= 10 },
  { id: 'render25', name: 'Master Artist', desc: 'Generate 25 renders', icon: '🎨', test: s => s.generations >= 25 },
  { id: 'fav5', name: 'Curator', desc: 'Favorite 5 gallery items', icon: '★', test: s => s.favorites >= 5 },
  { id: 'chat10', name: 'Confidant', desc: 'Send 10 chat messages', icon: '💬', test: s => s.chats >= 10 },
  { id: 'story3', name: 'Storyteller', desc: 'Advance the story 3 times', icon: '📖', test: s => s.stories >= 3 },
  { id: 'import1', name: 'Collector', desc: 'Import your first image', icon: '🖼️', test: s => s.imports >= 1 },
  { id: 'video1', name: 'Director', desc: 'Record a video clip', icon: '🎬', test: s => s.videos >= 1 }
];
