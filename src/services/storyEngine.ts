export interface StoryBeat { id: string; title: string; text: string; imagePrompt: string; choices: string[]; }
export interface Story { id: string; title: string; premise: string; beats: StoryBeat[]; currentBeat: number; createdAt: number; }

export function createStory(title = 'New Story', premise = ''): Story {
  return { id: `story-${Date.now()}`, title, premise, beats: [], currentBeat: 0, createdAt: Date.now() };
}

export function addBeat(story: Story, title: string, text: string, imagePrompt: string, choices: string[] = []): Story {
  return { ...story, beats: [...story.beats, { id: `beat-${Date.now()}-${story.beats.length}`, title, text, imagePrompt, choices: choices.slice(0, 6) }] };
}

export function chooseBeat(story: Story, choiceIndex: number): Story {
  if (story.currentBeat >= story.beats.length - 1) return story;
  return { ...story, currentBeat: Math.max(0, Math.min(story.currentBeat + 1, story.beats.length - 1)) };
}

export function saveStory(story: Story): void {
  const key = 'grok-girls-stories-v1';
  let stories: Story[] = [];
  try { stories = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  localStorage.setItem(key, JSON.stringify([story, ...stories.filter(s => s.id !== story.id)].slice(0, 100)));
}

export function loadStories(): Story[] { try { return JSON.parse(localStorage.getItem('grok-girls-stories-v1') || '[]'); } catch { return []; } }
