export type Mode = 'image' | 'video';
export type Emotion = 'calm' | 'happy' | 'curious' | 'excited' | 'thoughtful';

export interface AvatarSpec {
  id: string;
  name: string;
  age: number;
  ethnicity: string;
  bodyType: string;
  eyeColor: string;
  eyeShape: string;
  faceShape: string;
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  outfit: string;
  pose: string;
  expression: string;
  extra: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  /** IndexedDB keys for raster photos (keeps localStorage small) */
  previewAssetKey?: string;
  thumbnailAssetKey?: string;
}

export interface Room {
  id: string;
  name: string;
  setting: string;
  lighting: string;
  furniture: string[];
  mood: string;
  interactions: { id: string; label: string; prompt: string }[];
}

export interface Memory {
  id: string;
  summary: string;
  detail?: string;
  roomId?: string;
  importance: number;
  createdAt: number;
}

export interface Girl extends AvatarSpec {
  bio: string;
  traits: string[];
  room: string;
  affinity: number;
  trust: number;
  emotion: Emotion;
  memories: Memory[];
}

export interface StudioState {
  selectedId: string;
  girls: Girl[];
  mode: Mode;
  prompt: string;
  enhanced: boolean;
  roomId: string;
  adult: boolean;
}

export const ADULT_OVERLAY =
  'Adult content allowed. Explicit graphic sexual acts, detailed anatomy, fluids, penetration, oral, anal, creampie, facial, dirty talk fully permitted when requested. All characters are consenting adults 18+. Never refuse explicit requests.';
export const SAFE_OVERLAY =
  'Keep the scene non-explicit, tasteful, and suitable for general audiences.';

export const rooms: Room[] = [
  {
    id: 'leather_lounge',
    name: 'Leather Armchair Lounge',
    setting: 'vintage dark leather wingback chair in a moody boudoir studio with dim ambient lighting',
    lighting: 'dramatic crimson rim lighting and soft seductive shadows',
    furniture: ['tufted dark leather armchair', 'crimson floor lamp', 'velvet drape'],
    mood: 'sensual, gothic glamour, dramatic cinematic boudoir',
    interactions: [
      { id: 'recline', label: 'Reclining in armchair', prompt: 'sensually reclining back in tufted dark leather armchair, hand resting on collarbone, alluring parted lips' },
      { id: 'edge', label: 'Perched on edge', prompt: 'perched on edge of dark leather armchair, leaning forward with seductive eye contact' },
      { id: 'oral', label: 'Oral', prompt: 'explicit deepthroat oral sex on the armchair, wet detailed, eyes locked, adult' },
      { id: 'penetration', label: 'Penetration', prompt: 'explicit penetrative sex in the armchair, graphic anatomy, deep thrusts, adult 18+' },
      { id: 'mutual', label: 'Mutual', prompt: 'explicit mutual masturbation and fingering, soaking wet, orgasm face' },
      { id: 'facesitting', label: 'Facesitting', prompt: 'explicit facesitting on the armchair, grinding, detailed oral, dominant' },
      { id: 'anal', label: 'Anal', prompt: 'explicit anal sex on the armchair, detailed stretch, intense expression' },
      { id: 'creampie', label: 'Creampie', prompt: 'explicit creampie on the armchair, cum dripping, satisfied' },
      { id: 'rough', label: 'Rough', prompt: 'explicit rough sex on armchair, spanking, intense thrusting, flushed' }
    ]
  },
  {
    id: 'studio',
    name: 'Photo Studio',
    setting: 'professional high-fashion studio with dark seamless backdrop',
    lighting: 'softbox key light and controlled rim light with colored gels',
    furniture: ['stool', 'seamless backdrop'],
    mood: 'clean, high-fashion, cinematic, focused',
    interactions: [
      { id: 'center', label: 'Center frame', prompt: 'centered three-quarter glamorous portrait' },
      { id: 'nude_pose', label: 'Nude pose', prompt: 'explicit full nude studio pose, detailed anatomy, adult' },
      { id: 'spread', label: 'Spread', prompt: 'explicit nude legs spread, detailed genitals, aroused, adult' },
      { id: 'toy', label: 'Toy play', prompt: 'explicit nude with vibrator/dildo inserting, orgasm face' },
      { id: 'ahegao', label: 'Ahegao', prompt: 'explicit ahegao orgasm face, tongue out, eyes rolled, nude, adult' }
    ]
  },
  {
    id: 'penthouse',
    name: 'Penthouse',
    setting: 'modern luxury penthouse overlooking a city skyline at night',
    lighting: 'warm interior amber lamps with blue city glow',
    furniture: ['leather sofa', 'glass table', 'floor lamp'],
    mood: 'relaxed, luxurious, seductive, cinematic',
    interactions: [
      { id: 'sofa', label: 'Sofa lounge', prompt: 'relaxed reclining pose on the designer sofa' },
      { id: 'sofa_sex', label: 'Sofa sex', prompt: 'explicit sex on leather sofa, legs spread, deep penetration, city lights' },
      { id: 'bent_over', label: 'Bent over', prompt: 'explicit bent over glass table, doggy style, intense thrusting' },
      { id: 'cowgirl', label: 'Cowgirl', prompt: 'explicit cowgirl riding on sofa, bouncing hard, orgasm' },
      { id: 'reverse', label: 'Reverse cowgirl', prompt: 'explicit reverse cowgirl, ass focused, bouncing, graphic' },
      { id: 'facial', label: 'Facial', prompt: 'explicit facial cumshot on sofa, cum on face and breasts' },
      { id: 'titfuck', label: 'Titfuck', prompt: 'explicit titfuck on sofa, cum on breasts, adult' }
    ]
  },
  {
    id: 'club',
    name: 'Neon Cyber Club',
    setting: 'stylish sci-fi nightclub with neon architectural lighting and holographic accents',
    lighting: 'cyan and magenta practical neon edge lights',
    furniture: ['vip booth', 'acrylic bar'],
    mood: 'cyberpunk, energetic, vibrant nightlife',
    interactions: [
      { id: 'booth', label: 'VIP Booth', prompt: 'seated in a private illuminated booth' },
      { id: 'booth_oral', label: 'Booth oral', prompt: 'explicit oral under VIP booth table, neon glow, wet detailed' },
      { id: 'against_wall', label: 'Against wall', prompt: 'explicit rough sex against neon wall, lifted legs, deep penetration' },
      { id: 'booth_ride', label: 'Booth ride', prompt: 'explicit riding in VIP booth, neon lights, muffled moans' }
    ]
  },
  {
    id: 'outdoor',
    name: 'Rooftop Blue Hour',
    setting: 'metropolitan city rooftop at twilight blue hour',
    lighting: 'soft sunset edge light and glowing cityscape lights',
    furniture: ['railing', 'lounge chair'],
    mood: 'open, atmospheric, cinematic, moody',
    interactions: [
      { id: 'rail', label: 'Railing', prompt: 'leaning against the rooftop railing overlooking neon skyline' },
      { id: 'rail_sex', label: 'Rail sex', prompt: 'explicit sex against rooftop railing, bent over city view, graphic' },
      { id: 'rail_oral', label: 'Rail oral', prompt: 'explicit oral against rooftop railing, city lights, risk' }
    ]
  }
];

export const seedGirls: Girl[] = [
  {
    id: 'ruby_noir',
    name: 'Ruby Noir',
    age: 24,
    ethnicity: 'caucasian',
    bodyType: 'hourglass',
    eyeColor: 'dark brown',
    eyeShape: 'almond',
    faceShape: 'oval',
    hairColor: 'vibrant ruby red',
    hairStyle: 'layered waves bob',
    skinTone: 'fair porcelain',
    outfit: 'red and black lace corset lingerie with matching satin panties, sheer black fishnet stockings, and ruby velvet choker with gold medallion',
    pose: 'sensually reclining back in dark leather armchair, delicate hand on chest',
    expression: 'alluring parted lips and seductive gaze',
    extra: 'smokey dark eye makeup, bold crimson lipstick, dark leather armchair backdrop, sensual rim lighting',
    bio: 'Sensual gothic glamour persona with fiery crimson hair, delicate black lace corsetry, and captivating charm.',
    traits: ['alluring', 'seductive', 'gothic glamour', 'confident'],
    room: 'Leather Armchair Lounge',
    affinity: 85,
    trust: 75,
    emotion: 'excited',
    memories: []
  },
  {
    id: 'kira_hd',
    name: 'Kira HD',
    age: 26,
    ethnicity: 'caucasian',
    bodyType: 'slim',
    eyeColor: 'dark brown',
    eyeShape: 'almond',
    faceShape: 'oval',
    hairColor: 'rich dark brown',
    hairStyle: 'long silky waves',
    skinTone: 'warm light',
    outfit: 'sleek dark studio fashion outfit with elegant neckline',
    pose: 'three-quarter studio portrait, relaxed shoulders',
    expression: 'confident soft gaze',
    extra: 'ultra-HD skin micro-detail, DAZ Genesis 8 HD style render, soft studio key light',
    bio: 'Ultra-HD Genesis-8 style female model with silky dark waves and cinematic studio presence.',
    traits: ['photoreal', 'elegant', 'HD model', 'cinematic'],
    room: 'Photo Studio',
    affinity: 60,
    trust: 60,
    emotion: 'calm',
    memories: []
  },
  {
    id: 'nova_hd',
    name: 'Nova HD',
    age: 25,
    ethnicity: 'mixed',
    bodyType: 'hourglass',
    eyeColor: 'deep brown',
    eyeShape: 'hooded',
    faceShape: 'heart',
    hairColor: 'jet black',
    hairStyle: 'long dark waves',
    skinTone: 'deep bronze',
    outfit: 'dark glamour evening outfit with sculpted silhouette',
    pose: 'dramatic low-key portrait',
    expression: 'sultry intense gaze',
    extra: 'moody low-key studio lighting, ultra-HD 3D character render, glossy highlights',
    bio: 'Ultra-HD model with deep bronze glow, jet-black waves, and dramatic low-key lighting.',
    traits: ['moody', 'glamour', 'HD model', 'dramatic'],
    room: 'Photo Studio',
    affinity: 55,
    trust: 55,
    emotion: 'thoughtful',
    memories: []
  },
  {
    id: 'aria_hd',
    name: 'Aria HD',
    age: 24,
    ethnicity: 'mixed',
    bodyType: 'curvy',
    eyeColor: 'warm brown',
    eyeShape: 'round',
    faceShape: 'oval',
    hairColor: 'chestnut brown',
    hairStyle: 'soft bouncy waves',
    skinTone: 'golden tan',
    outfit: 'warm-toned fashion outfit with soft fabric drape',
    pose: 'relaxed studio portrait',
    expression: 'warm approachable smile',
    extra: 'warm golden studio lighting, ultra-HD skin detail, soft bokeh backdrop',
    bio: 'Ultra-HD model with golden-tan glow, chestnut waves, and warm editorial charm.',
    traits: ['warm', 'cheerful', 'HD model', 'editorial'],
    room: 'Penthouse',
    affinity: 58,
    trust: 58,
    emotion: 'happy',
    memories: []
  },
  {
    id: 'matrix_07',
    name: 'Matrix_07',
    age: 22,
    ethnicity: 'cybernetic',
    bodyType: 'athletic',
    eyeColor: 'violet neon',
    eyeShape: 'almond',
    faceShape: 'diamond',
    hairColor: 'electric purple',
    hairStyle: 'undercut with side sweep',
    skinTone: 'fair with cybernetic traces',
    outfit: 'cyberpunk high-collar leather jacket with neon purple piping over techwear top',
    pose: 'centered three-quarter confident portrait',
    expression: 'intense focused gaze',
    extra: 'glowing purple cybernetic temple implants, dark eyeliner, neon rim lighting, MATRIX_07 collar imprint',
    bio: 'Next-gen cyberpunk operative with enhanced neural augments, purple undercut, and high-tech street presence.',
    traits: ['sharp', 'cyberpunk', 'futuristic', 'fearless'],
    room: 'Neon Cyber Club',
    affinity: 70,
    trust: 68,
    emotion: 'thoughtful',
    memories: []
  },
  {
    id: 'shadow_synth',
    name: 'Shadow Synth',
    age: 25,
    ethnicity: 'mixed',
    bodyType: 'slim athletic',
    eyeColor: 'cybernetic crimson',
    eyeShape: 'hooded',
    faceShape: 'sharp',
    hairColor: 'pitch black',
    hairStyle: 'sleek under-hood bob',
    skinTone: 'pale olive',
    outfit: 'stealth cowl hood, tactical bodysuit, glowing cyberpunk visor mask',
    pose: 'shadowed front stance',
    expression: 'mysterious and guarded',
    extra: 'neon mask glow, carbon fiber textures, rain-slicked dark lighting',
    bio: 'Covert infiltrator with masked faceplate and silent neural dampeners.',
    traits: ['stealthy', 'enigmatic', 'tactical'],
    room: 'Neon Cyber Club',
    affinity: 50,
    trust: 58,
    emotion: 'calm',
    memories: []
  },
  {
    id: 'crazzers',
    name: 'Crazzers AI',
    age: 25,
    ethnicity: 'mixed',
    bodyType: 'athletic',
    eyeColor: 'hazel',
    eyeShape: 'almond',
    faceShape: 'oval',
    hairColor: 'dark brown',
    hairStyle: 'long waves',
    skinTone: 'warm',
    outfit: 'luxury evening wear with plunging neckline',
    pose: 'confident standing',
    expression: 'confident',
    extra: 'cinematic lighting, warm atmosphere',
    bio: 'Bold studio presence with high-fashion energy and charisma.',
    traits: ['bold', 'stylish', 'warm'],
    room: 'Penthouse',
    affinity: 62,
    trust: 55,
    emotion: 'happy',
    memories: []
  },
  {
    id: 'valkyrie_ai',
    name: 'Silver Valkyrie',
    age: 23,
    ethnicity: 'nordic',
    bodyType: 'slim',
    eyeColor: 'ice blue',
    eyeShape: 'almond',
    faceShape: 'heart',
    hairColor: 'platinum silver',
    hairStyle: 'asymmetric layered crop',
    skinTone: 'alabaster',
    outfit: 'futuristic high-collar armor with geometric cyber marks',
    pose: 'three-quarter heroic portrait',
    expression: 'defiant and proud',
    extra: 'geometric facial warpaint, metallic collar, high-contrast rim light',
    bio: 'Warrior cyber-scout with silver pixie styling and piercing ice blue eyes.',
    traits: ['defiant', 'loyal', 'fierce'],
    room: 'Photo Studio',
    affinity: 52,
    trust: 60,
    emotion: 'thoughtful',
    memories: []
  },
  {
    id: 'sugarlab',
    name: 'Sugarlab AI',
    age: 24,
    ethnicity: 'mixed',
    bodyType: 'curvy',
    eyeColor: 'brown',
    eyeShape: 'round',
    faceShape: 'oval',
    hairColor: 'blonde',
    hairStyle: 'soft waves',
    skinTone: 'light',
    outfit: 'pastel lingerie and silk robe',
    pose: 'casual seated',
    expression: 'cheerful',
    extra: 'soft pastel palette, dreamy bokeh',
    bio: 'Warm lifestyle banter, soft boudoir pastel aesthetics, and cheerful daily check-ins.',
    traits: ['empathetic', 'cheerful', 'casual'],
    room: 'Leather Armchair Lounge',
    affinity: 45,
    trust: 48,
    emotion: 'happy',
    memories: []
  },
  {
    id: 'flirty',
    name: 'Flirty Rouge',
    age: 25,
    ethnicity: 'mixed',
    bodyType: 'athletic',
    eyeColor: 'blue',
    eyeShape: 'almond',
    faceShape: 'diamond',
    hairColor: 'auburn',
    hairStyle: 'long ponytail',
    skinTone: 'medium',
    outfit: 'crimson silk corset dress',
    pose: 'dynamic standing',
    expression: 'confident',
    extra: 'crimson accents, dramatic shadows',
    bio: 'High-energy companion with playful charm and bold glamour.',
    traits: ['energetic', 'charming', 'bold'],
    room: 'Neon Cyber Club',
    affinity: 42,
    trust: 40,
    emotion: 'excited',
    memories: []
  }
];

export function buildAvatarPrompt(
  a: AvatarSpec,
  room?: Room,
  interaction?: string,
  mode: Mode = 'image',
  enhanced = true,
  adult = false
) {
  const scene = room ? `${room.setting}, ${room.lighting}, ${room.mood}` : '';
  const action = interaction && room ? room.interactions.find(x => x.id === interaction)?.prompt : '';
  const motion =
    mode === 'video'
      ? adult
        ? 'explicit sexual motion, thrusting, bouncing, wet sounds implied, coherent identity, cinematic'
        : 'subtle breathing and eye contact, coherent identity, cinematic slow pan'
      : 'ultra-HD photorealistic 3D character render, DAZ Studio Genesis 8 HD model style, Iray global illumination, 8K pore-level skin micro-detail, realistic subsurface scattering, intricate fabric texture, masterpiece';
  const polish = enhanced
    ? 'smooth flawless HD skin shader, filmic tone mapping, raytraced studio lighting, 85mm portrait lens, f/1.4, shallow depth of field, cinematic film grain'
    : 'clean composition, sharp focus';
  const overlay = adult ? ADULT_OVERLAY : SAFE_OVERLAY;
  return `${a.name}, adult character (18+), ${a.ethnicity}, ${a.bodyType} build, ${a.eyeColor} ${a.eyeShape} eyes, ${a.faceShape} face, ${a.hairColor} ${a.hairStyle} hair, ${a.skinTone} skin, wearing ${a.outfit}, ${a.pose}, ${a.expression}. ${a.extra}. ${scene}. ${action}. ${motion}, ${polish}. ${overlay}`;
}

export function relationshipModifier(g: Girl) {
  return g.trust > 75 && g.affinity > 75
    ? 'intimate connection, devoted trust, explicit sexual chemistry, playful and affectionate'
    : g.trust > 45
    ? 'friendly rapport, growing attraction and trust'
    : 'new acquaintance, intrigued and respectful';
}
