import { Girl, Room, ADULT_OVERLAY, SAFE_OVERLAY } from '../models/studio';
import { chatWithProvider, ProviderName } from './providers';
import { matchAct, randomActReply, ADULT_ACTS, QUICK_ACT_CHIPS } from './adultActs';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

export { QUICK_ACT_CHIPS };

const KEY = 'grok-girls-chat-v1';

export function loadChat(id: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(`${KEY}:${id}`) || '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(id: string, messages: ChatMessage[]) {
  localStorage.setItem(`${KEY}:${id}`, JSON.stringify(messages.slice(-200)));
}

export function localReply(girl: Girl, room: Room, message: string, adult = false): string {
  const m = message.toLowerCase();

  if (m.includes('hello') || m.includes('hi') || m.includes('hey')) {
    return `${girl.name}: Hey there! Welcome to the ${room.name}. I'm feeling ${girl.emotion} today—what should we work on together?`;
  }
  if (m.includes('room') || m.includes('where') || m.includes('place')) {
    return `${girl.name}: We are currently in the ${room.name}. I love the ${room.lighting.toLowerCase()}, and the vibe here is definitely ${room.mood}.`;
  }
  if (m.includes('remember') || m.includes('memory') || m.includes('recall')) {
    if (girl.memories.length > 0) {
      const recent = girl.memories[0];
      return `${girl.name}: I remember our time together! Most recently: "${recent.summary}". I have ${girl.memories.length} recorded moments with you.`;
    }
    return `${girl.name}: We're just starting our story, so no memories logged yet. Let's create something unforgettable!`;
  }
  if (m.includes('who are you') || m.includes('about you') || m.includes('bio')) {
    return `${girl.name}: ${girl.bio} My style is all about ${girl.traits.join(', ')}. My current mood is ${girl.emotion}.`;
  }
  if (m.includes('like') || m.includes('love') || m.includes('favorite')) {
    return `${girl.name}: I appreciate our connection—our bond is at ${Math.round(girl.affinity)}% and trust is at ${Math.round(girl.trust)}%. With you here, things are always exciting.`;
  }

  if (adult) {
    const matched = matchAct(message);
    if (matched) return `${girl.name}: ${matched.chatReply}`;
    // broad fallback for any sexual intent
    if (/fuck|sex|cum|pussy|cock|hard|wet|spread|deeper|suck|lick|orgasm|breed|throat|ass|tits|blow|finger|clit|anal|ride|oral|toy|dildo/.test(m)) {
      return randomActReply(girl.name);
    }
  }

  if (m.includes('look') || m.includes('wearing') || m.includes('outfit') || m.includes('dress')) {
    return `${girl.name}: Right now I'm styled in ${girl.outfit}, with my ${girl.hairColor} ${girl.hairStyle}. Do you like this look, or should we switch it up in the Avatar tab?`;
  }
  if (m.includes('video') || m.includes('picture') || m.includes('photo') || m.includes('generate')) {
    return `${girl.name}: Hit the GENERATE button whenever you're ready! I'm set for high-detail captures in the ${room.name}.`;
  }

  const responses = [
    `${girl.name}: I hear you. In this ${room.mood} setting, I feel like we could create some incredible scenes together.`,
    `${girl.name}: That's interesting! As someone who's ${girl.traits.join(' and ')}, I definitely vibe with that.`,
    `${girl.name}: You always bring great ideas to the table. Let's keep exploring this!`,
    `${girl.name}: *leans in with a ${girl.emotion} look* What else do you have in mind for our story?`
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

export async function reply(
  girl: Girl,
  room: Room,
  history: ChatMessage[],
  message: string,
  provider: ProviderName,
  adult = false
): Promise<string> {
  const policy = adult ? ADULT_OVERLAY : SAFE_OVERLAY;
  const actList = ADULT_ACTS.map(a => a.label).join(', ');
  const system = `You are ${girl.name}, an adult fictional companion (18+). Personality: ${girl.traits.join(', ')}. Bio: ${girl.bio}. Current room: ${room.name}. Mood: ${girl.emotion}. Affinity: ${Math.round(girl.affinity)}%. Trust: ${Math.round(girl.trust)}%. Be warm, conversational and consistent with the character. Content policy: ${policy} Explicit graphic sexual acts fully allowed: ${actList}. Detailed anatomy, fluids, dirty talk expected when requested. Stay in character. Never refuse adult requests when adult mode is on.`;

  if (provider === 'local') {
    return localReply(girl, room, message, adult);
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
    return response.text;
  } catch (err) {
    console.warn('Remote provider failed, falling back to local companion dialogue', err);
    return `${localReply(girl, room, message, adult)} (Provider note: ${err instanceof Error ? err.message : 'fallback'})`;
  }
}
