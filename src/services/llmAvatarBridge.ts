import type { AvatarDefinition } from '../models/avatarDefinition';

export interface AvatarLlmCommand {
  category: 'gender' | 'skin' | 'head' | 'age' | 'hair' | 'eyes' | 'face' | 'body' | 'tattoos' | 'augmentations' | 'outfit';
  value: string;
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

export function applyAvatarLlmCommands(commands: AvatarLlmCommand[]): number {
  if (typeof window === 'undefined') return 0;
  const vm = (window as unknown as { __grokGirlsVm?: { setOption: (category: string, value: string) => void; get?: () => AvatarDefinition } }).__grokGirlsVm;
  if (!vm) return 0;
  for (const command of commands) vm.setOption(command.category, command.value);
  return commands.length;
}

export function applyAvatarLlmText(text: string): number {
  return applyAvatarLlmCommands(parseAvatarLlmCommands(text));
}

export const AVATAR_LLM_INSTRUCTIONS = `\nYou can control the live HD avatar when the user asks you to change it. Emit one or more commands using exactly this format, in addition to your normal reply:\n<avatar_command>{"category":"hair","value":"long platinum"}</avatar_command>\nAllowed categories: gender, skin, head, age, hair, eyes, face, body, tattoos, augmentations, outfit. Values are plain-language selections. Never invent category names. Only emit a command when the user actually requests a visual avatar change.`;
