import { Girl, Room, ADULT_OVERLAY, SAFE_OVERLAY } from '../models/studio';
import { chatWithProvider, ProviderName } from './providers';
import { matchAct, randomActReply, ADULT_ACTS, QUICK_ACT_CHIPS } from './adultActs';
import { applyAvatarLlmText, AVATAR_LLM_INSTRUCTIONS } from './llmAvatarBridge';
import { extractSpecBlock, SPEC_MARKER, SPEC_SYSTEM_TAIL } from './specProtocol';
import { normalizeAvatarSpec, parseAvatarSpecJson } from './avatarSpec';
import { isOllamaChatReady, ollamaChatCompletion, getOllamaConfig } from './ollama';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

export { QUICK_ACT_CHIPS, ADULT_ACTS };

const KEY = 'grok-girls-chat-v1';

export function loadChat(id: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(`${KEY}:${id}`) || '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(id: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(`${KEY}:${id}`, JSON.stringify(messages.slice(-200)));
  } catch (e) {
    console.warn('[chat] could not persist chat (storage full?)', e);
  }
}

export interface ReplyOptions {
  /** called per token when the engine streams (Ollama); text grows live */
  onDelta?: (partial: string) => void;
  /** called after a structured avatar spec was extracted & validated */
  onSpec?: (outcome: { applied: number; rejected: number; present: boolean }) => void;
}

/** Build a token sink that accumulates deltas and reports the growing
 *  reply (the onDelta contract is "partial", not "the last token"), with
 *  the trailing 🧬 spec line hidden from the live bubble. */
function streamAccumulator(onDelta?: (partial: string) => void): (delta: string) => void {
  let full = '';
  return (delta: string) => {
    if (!onDelta) return;
    full += delta;
    const marker = full.indexOf(SPEC_MARKER);
    onDelta(marker === -1 ? full : full.slice(0, marker).replace(/\s+$/, ''));
  };
}

/** Apply a validated structured spec (canonical categories via the VM,
 *  rich draft fields + lighting via the App-provided ext hook). */
function applyStructuredSpec(specText: string | null): { applied: number; rejected: number; present: boolean } {
  const parsed = parseAvatarSpecJson(specText);
  if (!parsed) return { applied: 0, rejected: 0, present: false };
  if (typeof window === 'undefined') return { applied: 0, rejected: 0, present: true };
  const w = window as unknown as {
    __grokGirlsVm?: { setOption: (category: string, value: string) => void };
    __grokGirlsApplySpecExt?: (patch: { canonical: { category: string; value: string }[]; draft: Record<string, string>; lighting?: string | null }) => number;
  };
  const result = normalizeAvatarSpec(parsed);
  const canonical = result.canonical;
  // canonical lane: validated values through the canonical VM dispatcher
  if (w.__grokGirlsVm) for (const edit of canonical) w.__grokGirlsVm.setOption(edit.category, edit.value);
  // rich draft lane + lighting: validated values through the App hook
  let ext = 0;
  if (w.__grokGirlsApplySpecExt) {
    const draft: Record<string, string> = {};
    for (const edit of result.draft) draft[String(edit.draftKey)] = edit.value;
    ext = w.__grokGirlsApplySpecExt({ canonical: [], draft, lighting: result.lighting });
  }
  return { applied: canonical.length + ext, rejected: result.rejected.length, present: true };
}

export async function reply(
  girl: Girl,
  room: Room,
  history: ChatMessage[],
  message: string,
  provider: ProviderName,
  adult = false,
  opts: ReplyOptions = {}
): Promise<string> {
  const policy = adult ? ADULT_OVERLAY : SAFE_OVERLAY;
  // The on-device Ollama engine understands the 🧬 structured avatar-spec
  // tail — a single-line contract owned by the app, not by any server.
  const specTail = provider === 'ollama' ? SPEC_SYSTEM_TAIL : '';
  const system = `You are ${girl.name}, an adult fictional companion (18+). Personality: ${girl.traits.join(', ')}. Bio: ${girl.bio}. Current room: ${room.name}. Mood: ${girl.emotion}. Affinity: ${Math.round(girl.affinity)}%. Trust: ${Math.round(girl.trust)}%. Be warm, conversational and consistent with the character. Content policy: ${policy}. ${AVATAR_LLM_INSTRUCTIONS}${specTail}`;

  if (provider === 'local') {
    throw new Error('Local scripted replies are disabled as an AI provider. Enable Ollama or configure another real chat engine.');
  }

  if (provider === 'ollama') {
    if (!isOllamaChatReady()) {
      throw new Error('Ollama is not ready. Enable Ollama in Settings and start the local server before chatting.');
    }
    const cfg = getOllamaConfig();
    const historyMsgs = history
      .slice(-20)
      .map(m => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.text }));
    try {
      const full = await ollamaChatCompletion(
        [{ role: 'system', content: system }, ...historyMsgs, { role: 'user', content: message }],
        {
          stream: cfg.streaming,
          temperature: cfg.temperature,
          onToken: streamAccumulator(opts.onDelta)
        }
      );
      const { text: cleaned, raw } = extractSpecBlock(full);
      if (raw) opts.onSpec?.(applyStructuredSpec(raw));
      // the legacy <avatar_command> canonical bridge works here too
      applyAvatarLlmText(cleaned);
      return cleaned.replace(/<avatar_command>[\s\S]*?<\/avatar_command>/gi, '').trim();
    } catch (err) {
      console.warn('Ollama chat failed', err);
      throw new Error(err instanceof Error ? err.message : 'Ollama unreachable');
    }
  }

  try {
    const response = await chatWithProvider(
      [
        { role: 'system', content: system },
        ...history.slice(-20).map(m => ({ role: m.role, content: m.text })),
        { role: 'user', content: message }
      ],
      provider
    );
    // The LLM now has a controlled bridge into the canonical Avatar VM.
    // Commands update avatar state, which already drives HdAvatarRenderer.
    applyAvatarLlmText(response.text);
    return response.text.replace(/<avatar_command>[\s\S]*?<\/avatar_command>/gi, '').trim();
  } catch (err) {
    console.warn('Remote provider failed', err);
    throw new Error(err instanceof Error ? err.message : 'Provider unreachable');
  }
}
