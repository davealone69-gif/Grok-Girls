import type { Memory } from './types';

const KEY = 'grok-girls.memories';

export class MemoryStore {
  private items: Memory[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');

  list(avatarId?: string) { return this.items.filter(m => !avatarId || m.avatarId === avatarId); }

  add(avatarId: string, text: string, importance = 0.5) {
    const memory: Memory = { id: crypto.randomUUID(), avatarId, text, importance, createdAt: Date.now() };
    this.items = [memory, ...this.items].slice(0, 500);
    localStorage.setItem(KEY, JSON.stringify(this.items));
    return memory;
  }

  clear(avatarId?: string) {
    this.items = avatarId ? this.items.filter(m => m.avatarId !== avatarId) : [];
    localStorage.setItem(KEY, JSON.stringify(this.items));
  }
}
