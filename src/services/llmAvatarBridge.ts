import type { AvatarDefinition } from '../models/avatarDefinition';
import { canonicalOptionFor } from './avatarSpec';

export interface AvatarLlmCommand {
  category: 'gender' | 'skin' | 'head' | 'age' | 'hair' | 'eyes' | 'face' | 'body' | 'tattoos' | 'augmentations' | 'outfit';
  value: string;
}

export interface AvatarLlmApplyResult {
  applied: number;
  rejected: { category: string; value: string; reason: string }[];
}

const CATEGORIES = new Set<AvatarLlmCommand['category']>([
  'gender', 'skin', 'head', 'age', 'hair', 'eyes', 'face', 'body',
  'tattoos', 'augmentations', 'outfit'
]);

export function parseAvatarLlmCommands(text: string): AvatarLlmCommand[] {
  const commands: AvatarLlmCommand[] = [];
  const re = /<avatar_command>\s*(\{[\s\S]*?\})\s*<\/avatar_command>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    try {
      const value = JSON.parse(match[1]) as Partial<AvatarLlmCommand>;
      if (typeof value.category === 'string' && CATEGORIES.has(value.category as AvatarLlmCommand['category']) && typeof value.value === 'string' && value.value.trim()) {
        commands.push({ category: value.category as AvatarLlmCommand['category'], value: value.value.trim() });
      }
    } catch {
      // Ignore malformed model output. The chat response remains usable.
    }
  }
  return commands;
}

/** Apply validated canonical commands through the canonical VM. */
export function applyAvatarLlmCommands(commands: AvatarLlmCommand[]): AvatarLlmApplyResult {
  const result: AvatarLlmApplyResult = { applied: 0, rejected: [] };
  if (typeof window === 'undefined') return result;
  const vm = (window as unknown as { __grokGirlsVm?: { setOption: (category: string, value: string) => void; get?: () => AvatarDefinition } }).__grokGirlsVm;
  if (!vm) return result;
  for (const command of commands) {
    const res = canonicalOptionFor(command.category, command.value);
    if ('canonical' in res) {
      vm.setOption(command.category, res.canonical);
      result.applied += 1;
    } else {
      result.rejected.push({ category: command.category, value: command.value, reason: res.error });
    }
  }
  return result;
}

export function applyAvatarLlmText(text: string): AvatarLlmApplyResult {
  return applyAvatarLlmCommands(parseAvatarLlmCommands(text));
}

export const AVATAR_LLM_INSTRUCTIONS = `\nYou can control the live HD avatar when the user asks you to change it. Emit one or more commands using exactly this format, in addition to your normal reply:\n<avatar_command>{"category":"hair","value":"long platinum"}</avatar_command>\nAllowed categories: gender, skin, head, age, hair, eyes, face, body, tattoos, augmentations, outfit. Values are plain-language selections. Never invent category names. Only emit a command when the user actually requests a visual avatar change.`;
