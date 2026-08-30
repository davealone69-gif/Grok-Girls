/** Ultimate explicit act library + quick chips + auto-memory helpers */

export interface AdultAct {
  id: string;
  label: string;
  keywords: string[];
  chatReply: string;
  imagePrompt: string;
  videoMotion: string;
  memorySummary: string;
  affinityBoost: number;
}

export const ADULT_ACTS: AdultAct[] = [
  {
    id: 'oral',
    label: 'Oral',
    keywords: ['oral', 'suck', 'blow', 'throat', 'mouth'],
    chatReply: '*drops to knees, takes you deep into her mouth, eyes locked, wet slurping, moaning around you* Fuck yes... use my throat.',
    imagePrompt: 'explicit deepthroat oral sex, wet detailed mouth, eyes looking up, saliva, intense pleasure, adult 18+',
    videoMotion: 'oral bobbing, head movement, wet motion',
    memorySummary: 'Gave intense oral, deepthroat',
    affinityBoost: 4
  },
  {
    id: 'ride',
    label: 'Ride',
    keywords: ['ride', 'cowgirl', 'straddle'],
    chatReply: '*straddles you, sinks down fully, rides hard and fast* Feel how tight and wet I am for you.',
    imagePrompt: 'explicit cowgirl riding, bouncing hard, detailed penetration, orgasm expression, adult',
    videoMotion: 'bouncing-ride, up-down thrusting',
    memorySummary: 'Rode hard in cowgirl',
    affinityBoost: 5
  },
  {
    id: 'doggy',
    label: 'Doggy',
    keywords: ['doggy', 'behind', 'bent'],
    chatReply: '*bends over, looks back, spreads herself* Take me from behind. Hard.',
    imagePrompt: 'explicit doggy style, face down ass up, deep penetration, gripping sheets, adult',
    videoMotion: 'thrusting from behind',
    memorySummary: 'Took it doggy style hard',
    affinityBoost: 5
  },
  {
    id: 'anal',
    label: 'Anal',
    keywords: ['anal', 'ass'],
    chatReply: '*presents her ass, spreads cheeks* Fuck my ass. Stretch me.',
    imagePrompt: 'explicit anal penetration, detailed stretch, intense expression, adult 18+',
    videoMotion: 'anal thrusting',
    memorySummary: 'Anal, intense stretch',
    affinityBoost: 6
  },
  {
    id: 'creampie',
    label: 'Creampie',
    keywords: ['creampie', 'breed', 'fill', 'inside'],
    chatReply: '*pulls you deeper, legs locked* Don't pull out. Fill me up. Breed me.',
    imagePrompt: 'explicit creampie, cum dripping from pussy, satisfied expression, detailed fluids, adult',
    videoMotion: 'internal cumshot, slow pull-out with drip',
    memorySummary: 'Creampie, filled completely',
    affinityBoost: 6
  },
  {
    id: 'facial',
    label: 'Facial',
    keywords: ['facial', 'face', 'paint'],
    chatReply: '*kneels, mouth open, tongue out* Paint my face. I want to taste it.',
    imagePrompt: 'explicit facial cumshot, cum on face and tongue, open mouth, adult',
    videoMotion: 'facial finish',
    memorySummary: 'Took a facial',
    affinityBoost: 4
  },
  {
    id: 'facesit',
    label: 'Facesit',
    keywords: ['facesit', 'sit', 'grind', 'eat'],
    chatReply: '*climbs onto your face, grinds dripping pussy on your tongue* Eat me until I soak you.',
    imagePrompt: 'explicit facesitting, grinding on mouth, detailed oral contact, dominant pleasure, adult',
    videoMotion: 'grinding on face',
    memorySummary: 'Facesat and came on tongue',
    affinityBoost: 5
  },
  {
    id: 'missionary',
    label: 'Missionary',
    keywords: ['missionary', 'legs up', 'deeper'],
    chatReply: '*wraps legs high around you, pulls you deeper* Right there — harder.',
    imagePrompt: 'explicit missionary, legs up, deep penetration, eye contact, adult',
    videoMotion: 'thrusting missionary',
    memorySummary: 'Missionary, deep and intense',
    affinityBoost: 4
  },
  {
    id: 'toy',
    label: 'Toy',
    keywords: ['toy', 'dildo', 'vibrator', 'vibe'],
    chatReply: '*holds a vibrator to her clit while you thrust* I'm going to cum so hard around you.',
    imagePrompt: 'explicit toy play, vibrator on clit during penetration, orgasm face, adult',
    videoMotion: 'toy vibration + thrusting',
    memorySummary: 'Toy + penetration orgasm',
    affinityBoost: 4
  },
  {
    id: 'titfuck',
    label: 'Titfuck',
    keywords: ['tit', 'tits', 'breast', 'boob'],
    chatReply: '*presses her tits around your cock, strokes* Cum on me. Cover these.',
    imagePrompt: 'explicit titfuck, cock between breasts, cum on chest, adult',
    videoMotion: 'titfuck stroking',
    memorySummary: 'Titfuck and cum on breasts',
    affinityBoost: 3
  },
  {
    id: 'finger',
    label: 'Finger',
    keywords: ['finger', 'rub', 'clit'],
    chatReply: '*fingers deep in her soaked pussy, arching* Right there — make me cum on your hand.',
    imagePrompt: 'explicit fingering, soaking wet, orgasm face, detailed fluids, adult',
    videoMotion: 'fingering motion',
    memorySummary: 'Fingered to orgasm',
    affinityBoost: 3
  },
  {
    id: 'reverse',
    label: 'Reverse',
    keywords: ['reverse', 'ass view'],
    chatReply: '*straddles reverse, slides down and bounces* Watch my ass while I fuck you.',
    imagePrompt: 'explicit reverse cowgirl, ass focused, bouncing, graphic penetration, adult',
    videoMotion: 'reverse bouncing',
    memorySummary: 'Reverse cowgirl, ass view',
    affinityBoost: 5
  },
  {
    id: 'rough',
    label: 'Rough',
    keywords: ['rough', 'hard', 'spank', 'slap'],
    chatReply: '*arches into every thrust* Harder. Spank me. Use me.',
    imagePrompt: 'explicit rough sex, spanking, intense thrusting, flushed skin, adult',
    videoMotion: 'hard thrusting, impact',
    memorySummary: 'Rough sex, spanked',
    affinityBoost: 5
  },
  {
    id: 'afterglow',
    label: 'Afterglow',
    keywords: ['after', 'cuddle', 'afterglow', 'rest'],
    chatReply: '*lies against you, cum still dripping, soft smile* That was perfect... stay inside a little longer.',
    imagePrompt: 'post-sex afterglow, cum on skin, soft exhausted pleasure, intimate close-up, adult',
    videoMotion: 'slow breathing, soft shift',
    memorySummary: 'Afterglow, stayed connected',
    affinityBoost: 3
  }
];

export const QUICK_ACT_CHIPS = ADULT_ACTS.map(a => ({ id: a.id, label: a.label }));

export const NSFW_NEGATIVE =
  'child, children, underage, minor, teen, loli, shota, young, under 18, non-consensual, rape, forced, violence, gore, blood, extreme violence';

export function matchAct(message: string): AdultAct | null {
  const m = message.toLowerCase();
  for (const act of ADULT_ACTS) {
    if (act.keywords.some(k => m.includes(k))) return act;
  }
  return null;
}

export function randomActReply(girlName: string): string {
  const act = ADULT_ACTS[Math.floor(Math.random() * ADULT_ACTS.length)];
  return `${girlName}: ${act.chatReply}`;
}

export function actImagePrompt(actId: string): string {
  return ADULT_ACTS.find(a => a.id === actId)?.imagePrompt || 'explicit adult sexual scene, detailed, 18+';
}

export function actMemory(actId: string): { summary: string; boost: number } {
  const act = ADULT_ACTS.find(a => a.id === actId);
  return act ? { summary: act.memorySummary, boost: act.affinityBoost } : { summary: 'Intimate adult moment', boost: 2 };
}
