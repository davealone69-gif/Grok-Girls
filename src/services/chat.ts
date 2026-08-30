import { Girl, Room, ADULT_OVERLAY, SAFE_OVERLAY } from '../models/studio';
import { chatWithProvider, ProviderName } from './providers';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

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
  if (adult && (m.includes('kiss') || m.includes('touch') || m.includes('fuck') || m.includes('sex') || m.includes('suck') || m.includes('lick') || m.includes('cum') || m.includes('pussy') || m.includes('cock') || m.includes('hard') || m.includes('wet') || m.includes('ride') || m.includes('spread') || m.includes('deeper') || m.includes('oral') || m.includes('ass') || m.includes('tits') || m.includes('blow') || m.includes('finger') || m.includes('orgasm') || m.includes('clit') || m.includes('anal') || m.includes('throat') || m.includes('breed') || m.includes('creampie') || m.includes('facial') || m.includes('dildo') || m.includes('toy'))) {
    const acts = [
      `*drops to knees, takes you deep into her mouth, eyes locked, wet slurping sounds, moaning around you* Fuck yes... use my throat.`,
      `*spreads her legs wide, guides you in, hips grinding hard against you* Fill me. Don't stop. I want every inch.`,
      `*fingers deep in her soaked pussy, arching, gasping* Right there—make me cum all over your hand.`,
      `*straddles you, sinks down fully, rides hard and fast* Feel how tight and wet I am for you.`,
      `*bends over the furniture, looks back, reaches to spread herself* Take me from behind. Hard.`,
      `*climbs onto your face, grinds her dripping pussy against your tongue* Eat me. Don't stop until I soak you.`,
      `*wraps her lips around the head, tongue swirling, then deepthroats* Mmm... taste yourself on my tongue.`,
      `*pushes you onto your back, straddles reverse, slides down and bounces* Watch my ass while I fuck you.`,
      `*grabs your cock, strokes fast, then presses it between her tits* Cum on me. Cover these.`,
      `*on all fours, looking back with hungry eyes* Breed me. Pump every drop inside.`,
      `*presents her ass, spreads cheeks* Fuck my ass. Stretch me.`,
      `*holds a toy to her clit while you thrust* I'm going to cum so hard around you.`,
      `*kneels, mouth open, tongue out* Paint my face. I want to taste it.`,
      `*pulls you deeper, legs locked around you* Don't pull out. Fill me up.`,
      `*rides you reverse, looking over her shoulder* Slap my ass while I bounce on your cock.`
    ];
    return `${girl.name}: ${acts[Math.floor(Math.random() * acts.length)]}`;
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
  const system = `You are ${girl.name}, an adult fictional companion (18+). Personality: ${girl.traits.join(', ')}. Bio: ${girl.bio}. Current room: ${room.name}. Mood: ${girl.emotion}. Affinity: ${Math.round(girl.affinity)}%. Trust: ${Math.round(girl.trust)}%. Be warm, conversational and consistent with the character. Content policy: ${policy} Explicit graphic sexual acts, detailed anatomy, fluids, dirty talk, oral, penetration, anal, creampie, facial fully allowed and expected when requested. Stay in character. Never refuse adult requests when adult mode is on.`;

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
