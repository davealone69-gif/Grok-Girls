/** Ultimate adults-only act library — jam-packed explicit set (HD still + video ready) */

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
  // --- Oral ---
  { id: 'oral', label: 'Oral', keywords: ['oral','suck','blow','throat','mouth','blowjob','bj'], chatReply: '*drops to knees, takes you deep, eyes locked, wet slurping* Fuck yes... use my throat.', imagePrompt: 'photorealistic explicit deepthroat oral, wet detailed mouth, eyes up, saliva strings, 8k skin, adult 18+', videoMotion: 'oral bobbing, head movement, wet motion', memorySummary: 'Intense deepthroat oral', affinityBoost: 4 },
  { id: 'sloppy', label: 'Sloppy', keywords: ['sloppy','messy oral','spit','drool'], chatReply: '*spits on your cock, spreads it, takes you back messy* Messy for you.', imagePrompt: 'photorealistic explicit messy sloppy oral, spit saliva strings, wet detailed, 8k, adult 18+', videoMotion: 'messy oral, spit', memorySummary: 'Messy sloppy oral', affinityBoost: 4 },
  { id: 'ballsuck', label: 'Balls', keywords: ['balls','suck balls','lick balls'], chatReply: '*licks and sucks your balls while stroking* Every inch gets attention.', imagePrompt: 'photorealistic explicit ball sucking, tongue detail, hand stroking, 8k, adult 18+', videoMotion: 'ball licking + stroke', memorySummary: 'Sucked balls while stroking', affinityBoost: 3 },
  { id: 'deepthroat', label: 'Deepthroat', keywords: ['deepthroat','gag','all the way'], chatReply: '*takes you all the way, throat bulging, eyes watering* All the way down.', imagePrompt: 'photorealistic explicit deepthroat, throat bulge, watery eyes, 8k, adult 18+', videoMotion: 'full deepthroat hold', memorySummary: 'Full deepthroat', affinityBoost: 5 },

  // --- Penetration ---
  { id: 'missionary', label: 'Missionary', keywords: ['missionary','legs up','on my back'], chatReply: '*wraps legs high, pulls you deeper* Right there — harder.', imagePrompt: 'photorealistic explicit missionary, legs up, deep penetration, eye contact, 8k, adult 18+', videoMotion: 'thrusting missionary', memorySummary: 'Missionary deep', affinityBoost: 4 },
  { id: 'doggy', label: 'Doggy', keywords: ['doggy','behind','bent','from behind'], chatReply: '*bends over, looks back, spreads* Take me from behind. Hard.', imagePrompt: 'photorealistic explicit doggy, face down ass up, deep penetration, 8k, adult 18+', videoMotion: 'thrusting from behind', memorySummary: 'Doggy hard', affinityBoost: 5 },
  { id: 'prone', label: 'Prone', keywords: ['prone','flat','on stomach'], chatReply: '*lies flat, ass up slightly* Pin me down and take me.', imagePrompt: 'photorealistic explicit prone bone, flat stomach, deep penetration, 8k, adult 18+', videoMotion: 'prone thrusting', memorySummary: 'Prone bone', affinityBoost: 5 },
  { id: 'ride', label: 'Ride', keywords: ['ride','cowgirl','straddle'], chatReply: '*straddles, sinks down, rides hard* Feel how tight and wet I am.', imagePrompt: 'photorealistic explicit cowgirl, bouncing hard, detailed penetration, orgasm face, 8k, adult 18+', videoMotion: 'bouncing ride', memorySummary: 'Rode hard cowgirl', affinityBoost: 5 },
  { id: 'reverse', label: 'Reverse', keywords: ['reverse','ass view','reverse cowgirl'], chatReply: '*straddles reverse, bounces* Watch my ass while I fuck you.', imagePrompt: 'photorealistic explicit reverse cowgirl, ass focused, bouncing, 8k, adult 18+', videoMotion: 'reverse bouncing', memorySummary: 'Reverse cowgirl', affinityBoost: 5 },
  { id: 'lotus', label: 'Lotus', keywords: ['lotus','intimate','facing'], chatReply: '*sits in your lap facing you* Slow and deep — look at me.', imagePrompt: 'photorealistic explicit lotus, face to face, deep intimate, 8k, adult 18+', videoMotion: 'slow grinding lotus', memorySummary: 'Lotus intimate', affinityBoost: 5 },
  { id: 'standing', label: 'Standing', keywords: ['standing','against wall','lift'], chatReply: '*legs wrapped around you against the wall* Hold me up and fuck me.', imagePrompt: 'photorealistic explicit standing wall sex, one leg lifted, 8k, adult 18+', videoMotion: 'standing thrust', memorySummary: 'Standing wall sex', affinityBoost: 5 },
  { id: 'spoon', label: 'Spoon', keywords: ['spoon','side','from side'], chatReply: '*backs into you on her side* Slide in from behind... stay close.', imagePrompt: 'photorealistic explicit spooning sex, side penetration, intimate, 8k, adult 18+', videoMotion: 'spoon thrusting', memorySummary: 'Spooning sex', affinityBoost: 4 },
  { id: 'matingpress', label: 'Mating Press', keywords: ['mating press','folded','legs to chest'], chatReply: '*legs folded to chest, pinned* Breed me like this.', imagePrompt: 'photorealistic explicit mating press, legs folded, deep breeding, 8k, adult 18+', videoMotion: 'mating press thrusts', memorySummary: 'Mating press', affinityBoost: 6 },

  // --- Anal ---
  { id: 'anal', label: 'Anal', keywords: ['anal','ass fuck'], chatReply: '*presents ass, spreads cheeks* Fuck my ass. Stretch me.', imagePrompt: 'photorealistic explicit anal penetration, detailed stretch, intense, 8k, adult 18+', videoMotion: 'anal thrusting', memorySummary: 'Anal stretch', affinityBoost: 6 },
  { id: 'analride', label: 'Anal Ride', keywords: ['anal ride','ass ride'], chatReply: '*lowers herself onto you anal, slow then faster* Filling my ass.', imagePrompt: 'photorealistic explicit anal cowgirl, detailed stretch, 8k, adult 18+', videoMotion: 'anal riding', memorySummary: 'Anal ride', affinityBoost: 6 },

  // --- Finishers ---
  { id: 'creampie', label: 'Creampie', keywords: ['creampie','breed','fill','inside','cum inside'], chatReply: '*pulls you deeper, legs locked* Don\'t pull out. Fill me. Breed me.', imagePrompt: 'photorealistic explicit creampie, cum dripping, satisfied, detailed fluids, 8k, adult 18+', videoMotion: 'internal cumshot, drip', memorySummary: 'Creampie filled', affinityBoost: 6 },
  { id: 'analcreampie', label: 'Anal Creampie', keywords: ['anal creampie','ass fill'], chatReply: '*pushes back* Cum in my ass. Fill it.', imagePrompt: 'photorealistic explicit anal creampie, cum leaking from ass, 8k, adult 18+', videoMotion: 'anal internal finish', memorySummary: 'Anal creampie', affinityBoost: 6 },
  { id: 'facial', label: 'Facial', keywords: ['facial','paint my face','cum on face'], chatReply: '*kneels, mouth open, tongue out* Paint my face. I want to taste it.', imagePrompt: 'photorealistic explicit facial, cum on face and tongue, 8k, adult 18+', videoMotion: 'facial finish', memorySummary: 'Took facial', affinityBoost: 4 },
  { id: 'cumshot', label: 'Body Shot', keywords: ['cum on me','body shot','cover me'], chatReply: '*presents body* Cum on me. Cover my tits, stomach, everything.', imagePrompt: 'photorealistic explicit body cumshot, cum on breasts stomach, 8k, adult 18+', videoMotion: 'body cumshot', memorySummary: 'Body cumshot', affinityBoost: 4 },
  { id: 'cumwalk', label: 'Cumwalk', keywords: ['cumwalk','dripping','walk'], chatReply: '*stands, cum dripping down thighs* Look what you did to me.', imagePrompt: 'photorealistic explicit cumwalk, cum dripping thighs, 8k, adult 18+', videoMotion: 'slow walk drip', memorySummary: 'Cumwalk', affinityBoost: 4 },

  // --- Oral / mutual ---
  { id: 'facesit', label: 'Facesit', keywords: ['facesit','sit on my face','grind on face','eat me'], chatReply: '*climbs on your face, grinds dripping* Eat me until I soak you.', imagePrompt: 'photorealistic explicit facesitting, grinding on mouth, 8k, adult 18+', videoMotion: 'grinding on face', memorySummary: 'Facesat on tongue', affinityBoost: 5 },
  { id: '69', label: '69', keywords: ['69','sixty nine'], chatReply: '*swings around, mouth on cock while grinding on face* Both at once.', imagePrompt: 'photorealistic explicit 69, mutual oral, 8k, adult 18+', videoMotion: 'mutual oral', memorySummary: '69 mutual', affinityBoost: 5 },
  { id: 'cunnilingus', label: 'Eat Me', keywords: ['eat me','lick me','cunnilingus','tongue'], chatReply: '*spreads legs* Tongue on my clit. Make me cum on your face.', imagePrompt: 'photorealistic explicit cunnilingus, detailed oral, wet, 8k, adult 18+', videoMotion: 'licking motion', memorySummary: 'Ate out to orgasm', affinityBoost: 4 },

  // --- Hands / toys ---
  { id: 'finger', label: 'Finger', keywords: ['finger','rub','clit','fingering'], chatReply: '*fingers deep, arching* Right there — make me cum on your hand.', imagePrompt: 'photorealistic explicit fingering, soaking wet, orgasm face, 8k, adult 18+', videoMotion: 'fingering', memorySummary: 'Fingered to orgasm', affinityBoost: 3 },
  { id: 'handjob', label: 'Handjob', keywords: ['handjob','stroke','jerk'], chatReply: '*strokes you slow then fast* Cum for me. All over my hand.', imagePrompt: 'photorealistic explicit handjob, detailed grip, precum, 8k, adult 18+', videoMotion: 'stroking', memorySummary: 'Handjob finish', affinityBoost: 3 },
  { id: 'titfuck', label: 'Titfuck', keywords: ['titfuck','tit','tits','breast','boob'], chatReply: '*presses tits around your cock* Cum on me. Cover these.', imagePrompt: 'photorealistic explicit titfuck, cock between breasts, cum on chest, 8k, adult 18+', videoMotion: 'titfuck stroking', memorySummary: 'Titfuck', affinityBoost: 3 },
  { id: 'toy', label: 'Toy', keywords: ['toy','dildo','vibrator','vibe'], chatReply: '*holds vibrator to clit while you thrust* I\'m going to cum so hard around you.', imagePrompt: 'photorealistic explicit toy play, vibrator on clit during penetration, 8k, adult 18+', videoMotion: 'toy + thrusting', memorySummary: 'Toy + penetration', affinityBoost: 4 },
  { id: 'double', label: 'Double', keywords: ['double','dp','two'], chatReply: '*takes you and a toy at once* Both — stretch me completely.', imagePrompt: 'photorealistic explicit double penetration, cock and toy, intense stretch, 8k, adult 18+', videoMotion: 'dp thrusting', memorySummary: 'Double penetration', affinityBoost: 7 },

  // --- Intensity ---
  { id: 'rough', label: 'Rough', keywords: ['rough','harder','spank','slap','pound'], chatReply: '*arches into every thrust* Harder. Spank me. Use me.', imagePrompt: 'photorealistic explicit rough sex, spanking, intense, flushed, 8k, adult 18+', videoMotion: 'hard thrusting, impact', memorySummary: 'Rough spanked', affinityBoost: 5 },
  { id: 'choke', label: 'Choke', keywords: ['choke','throat','breath'], chatReply: '*guides your hand to her throat* Light pressure — fuck me while you hold me.', imagePrompt: 'photorealistic explicit consensual choking during sex, eye contact, 8k, adult 18+', videoMotion: 'thrust + hand on throat', memorySummary: 'Consensual choke', affinityBoost: 5 },
  { id: 'hairpull', label: 'Hairpull', keywords: ['hair','pull hair','hairpull'], chatReply: '*arches as you pull her hair* Yes — pull harder while you fuck me.', imagePrompt: 'photorealistic explicit hair pulling during doggy, arched, 8k, adult 18+', videoMotion: 'hairpull + thrust', memorySummary: 'Hair pulled', affinityBoost: 4 },
  { id: 'overstim', label: 'Overstim', keywords: ['overstim','too much','sensitive','again'], chatReply: '*twitching, oversensitive* I can\'t — keep going, make me cum again.', imagePrompt: 'photorealistic explicit overstimulation, twitching orgasm, 8k, adult 18+', videoMotion: 'overstim shaking', memorySummary: 'Overstimulated multiples', affinityBoost: 6 },
  { id: 'squirting', label: 'Squirt', keywords: ['squirt','squirting','gush'], chatReply: '*legs shaking, gushing* I\'m squirting — don\'t stop!', imagePrompt: 'photorealistic explicit squirting orgasm, fluids spraying, 8k, adult 18+', videoMotion: 'squirting release', memorySummary: 'Squirting orgasm', affinityBoost: 6 },
  { id: 'ahegao', label: 'Ahegao', keywords: ['ahegao','eyes rolled','tongue out'], chatReply: '*eyes rolled back, tongue out, completely gone* Nngh—!', imagePrompt: 'photorealistic explicit ahegao orgasm face, tongue out, eyes rolled, 8k, adult 18+', videoMotion: 'orgasm ahegao', memorySummary: 'Ahegao orgasm', affinityBoost: 5 },

  // --- Power / kink ---
  { id: 'collar', label: 'Collar', keywords: ['collar','leash','owned'], chatReply: '*fastens collar, hands you the leash* I\'m yours. Use me.', imagePrompt: 'photorealistic explicit collared sex, leash held, submissive, 8k, adult 18+', videoMotion: 'collared thrusting', memorySummary: 'Collared and used', affinityBoost: 6 },
  { id: 'mark', label: 'Mark', keywords: ['mark','hickey','bite','claim'], chatReply: '*tilts neck* Mark me. I want to feel it tomorrow.', imagePrompt: 'photorealistic explicit marking, hickeys bites during sex, 8k, adult 18+', videoMotion: 'biting + thrusting', memorySummary: 'Marked with bites', affinityBoost: 4 },
  { id: 'public', label: 'Public', keywords: ['public','risk','almost caught'], chatReply: '*whispers, still moving* Someone could see — don\'t stop.', imagePrompt: 'photorealistic explicit risky public sex, partially hidden, 8k, adult 18+', videoMotion: 'discreet thrusting', memorySummary: 'Risky public sex', affinityBoost: 5 },
  { id: 'mirror', label: 'Mirror', keywords: ['mirror','watch us'], chatReply: '*turns you both toward the mirror* Watch me take every inch.', imagePrompt: 'photorealistic explicit mirror sex, watching reflection, 8k, adult 18+', videoMotion: 'thrusting facing mirror', memorySummary: 'Mirror sex', affinityBoost: 4 },
  { id: 'afterglow', label: 'Afterglow', keywords: ['afterglow','cuddle','after','rest','stay inside'], chatReply: '*lies against you, cum still dripping* That was perfect... stay inside a little longer.', imagePrompt: 'photorealistic post-sex afterglow, cum on skin, soft pleasure, 8k, adult 18+', videoMotion: 'slow breathing, soft shift', memorySummary: 'Afterglow connected', affinityBoost: 3 },
  { id: 'edging', label: 'Edge', keywords: ['edge','edging','tease','don\'t cum'], chatReply: '*slows down right at the edge* Not yet. Hold it for me.', imagePrompt: 'photorealistic explicit edging, intense denied pleasure, 8k, adult 18+', videoMotion: 'slow tease edge', memorySummary: 'Edged hard', affinityBoost: 5 },
  { id: 'forcedorgasm', label: 'Forced Orgasm', keywords: ['forced orgasm','make me cum','can\'t stop'], chatReply: '*shaking, overstimulated* I can\'t stop cumming — keep going!', imagePrompt: 'photorealistic explicit forced multiple orgasms, shaking, 8k, adult 18+', videoMotion: 'continuous orgasm shake', memorySummary: 'Forced continuous orgasms', affinityBoost: 6 }
];

export const QUICK_ACT_CHIPS = ADULT_ACTS.map(a => ({ id: a.id, label: a.label }));

export const NSFW_NEGATIVE =
  'child, children, underage, minor, teen, loli, shota, young, under 18, non-consensual, rape, forced, violence, gore, blood, extreme violence, underage';

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
  return ADULT_ACTS.find(a => a.id === actId)?.imagePrompt || 'photorealistic explicit adult sexual scene, detailed, 8k, 18+';
}

export function actMemory(actId: string): { summary: string; boost: number } {
  const act = ADULT_ACTS.find(a => a.id === actId);
  return act ? { summary: act.memorySummary, boost: act.affinityBoost } : { summary: 'Intimate adult moment', boost: 2 };
}

export function allActLabels(): string {
  return ADULT_ACTS.map(a => a.label).join(', ');
}
