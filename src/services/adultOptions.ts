export type NudityLevel = 'covered' | 'implied' | 'artistic_nude' | 'explicit_nude' | 'graphic_sex';

export interface AdultSelections {
  nudityLevel: NudityLevel;
  wardrobe: string;
  coverage: string;
  pose: string;
  bodyPresentation: string;
  scene: string;
  lighting: string;
  camera: string;
  styling: string;
  accessories: string;
  mood: string;
  act?: string;
}

export const adultOptions = {
  nudityLevel: ['covered', 'implied', 'artistic_nude', 'explicit_nude', 'graphic_sex'] as const,
  wardrobe: [
    'elegant lingerie set',
    'lace bodysuit',
    'silk robe loosely draped',
    'sheer fashion wrap',
    'minimal editorial styling',
    'no clothing, artistic fine-art presentation',
    'fully nude, explicit adult presentation',
    'torn lingerie, mid-sex state',
    'collar and restraints only'
  ],
  coverage: [
    'fully covered styling',
    'strategic fabric draping',
    'silhouette and shadow concealment',
    'tasteful partial coverage',
    'unclothed artistic figure with non-explicit framing',
    'full explicit nudity, detailed anatomy',
    'spread legs, exposed genitals, graphic detail',
    'penetrated, fluids visible'
  ],
  pose: [
    'standing relaxed three-quarter pose',
    'seated portrait pose',
    'reclining editorial pose',
    'back-facing over-shoulder pose',
    'side-profile silhouette pose',
    'arms folded naturally for modest framing',
    'kneeling fashion pose with non-explicit framing',
    'on all fours, arched back, looking back',
    'legs spread wide, presenting',
    'missionary, legs wrapped around partner',
    'cowgirl riding, bouncing',
    'doggy style, face down ass up',
    'facesitting, grinding on mouth',
    'bent over furniture, gripping edges',
    'kneeling oral, looking up',
    'standing against wall, one leg lifted'
  ],
  bodyPresentation: [
    'natural adult anatomy',
    'athletic adult physique',
    'curvy adult physique',
    'slim adult physique',
    'soft natural proportions',
    'stylized fashion-model proportions',
    'detailed aroused genitals, wet',
    'breasts with erect nipples',
    'ass spread, detailed'
  ],
  scene: [
    'private luxury bedroom studio',
    'dark leather boudoir studio',
    'minimalist fine-art studio',
    'luxury penthouse bedroom',
    'velvet chaise lounge set',
    'warm candlelit editorial set',
    'cyberpunk private suite',
    'leather armchair mid-sex',
    'sofa sex scene',
    'against neon wall',
    'rooftop railing outdoor sex'
  ],
  lighting: [
    'soft diffused studio light',
    'dramatic rim lighting',
    'warm candlelit glow',
    'low-key cinematic lighting',
    'cool moonlight with subtle rim light',
    'high-fashion beauty lighting',
    'harsh explicit close-up lighting',
    'neon cyber sex lighting'
  ],
  camera: [
    'full-body editorial framing',
    'three-quarter portrait framing',
    'side-profile composition',
    'rear three-quarter composition',
    'wide environmental composition',
    '85mm fashion photography look',
    'close-up genital detail',
    'POV oral / penetration',
    'over-shoulder thrusting view'
  ],
  styling: [
    'luxury fashion editorial',
    'gothic glamour',
    'cinematic fine-art photography',
    'modern boudoir editorial',
    'cyberpunk fashion editorial',
    'classic monochrome fine-art',
    'explicit adult photography',
    'hardcore graphic sex scene'
  ],
  accessories: [
    'none',
    'velvet choker and delicate jewelry',
    'gold body chain',
    'silk stockings and garter accessories',
    'ornamental jewelry',
    'cybernetic jewelry accents',
    'collar and leash',
    'restraints / cuffs',
    'vibrator / toy visible'
  ],
  mood: [
    'confident and composed',
    'sensual and elegant',
    'mysterious and cinematic',
    'relaxed and intimate',
    'bold editorial attitude',
    'dreamy fine-art atmosphere',
    'desperate lust',
    'dominant / submissive',
    'orgasmic intensity'
  ],
  act: [
    'none',
    'explicit oral sex, deepthroat, wet detailed',
    'explicit vaginal penetration, deep thrusts',
    'explicit anal penetration',
    'mutual masturbation, fingering, soaking',
    'facesitting, grinding on tongue',
    'cowgirl riding hard',
    'doggy style rough',
    'missionary legs up',
    'titfuck / cum on breasts',
    'creampie, internal cumshot visible',
    'facial, cum on face',
    'double penetration',
    'toy play, dildo / vibrator'
  ]
} as const;

export const defaultAdultSelections = (): AdultSelections => ({
  nudityLevel: 'covered',
  wardrobe: adultOptions.wardrobe[0],
  coverage: adultOptions.coverage[0],
  pose: adultOptions.pose[0],
  bodyPresentation: adultOptions.bodyPresentation[0],
  scene: adultOptions.scene[0],
  lighting: adultOptions.lighting[0],
  camera: adultOptions.camera[0],
  styling: adultOptions.styling[0],
  accessories: adultOptions.accessories[0],
  mood: adultOptions.mood[0],
  act: 'none'
});

export function buildAdultPrompt(adult: AdultSelections): string {
  const nude =
    adult.nudityLevel === 'graphic_sex'
      ? 'Explicit graphic sexual activity between consenting adults 18+. Detailed anatomy, fluids, penetration, oral, orgasm expressions fully allowed and expected.'
      : adult.nudityLevel === 'explicit_nude'
        ? 'Explicit full nudity of a consenting fictional adult 18+, detailed anatomy, aroused state, no clothing.'
        : adult.nudityLevel === 'artistic_nude'
          ? 'Non-explicit artistic nude presentation of a consenting fictional adult 18+, with tasteful framing.'
          : adult.nudityLevel === 'implied'
            ? 'Adult implied-nude editorial presentation using draping, silhouette, and shadow for tasteful concealment.'
            : 'Adult fashion/boudoir presentation with clothing and modest coverage.';

  const actBit = adult.act && adult.act !== 'none' ? `Sexual act: ${adult.act}.` : '';

  return [
    '18+ adult-only mode.',
    nude,
    `Wardrobe: ${adult.wardrobe}.`,
    `Coverage: ${adult.coverage}.`,
    `Pose: ${adult.pose}.`,
    `Body presentation: ${adult.bodyPresentation}.`,
    `Scene: ${adult.scene}.`,
    `Lighting: ${adult.lighting}.`,
    `Camera: ${adult.camera}.`,
    `Styling: ${adult.styling}.`,
    `Accessories: ${adult.accessories}.`,
    `Mood: ${adult.mood}.`,
    actBit,
    'Photorealistic adult rendering, anatomically coherent, explicit when requested, no minors.'
  ].filter(Boolean).join(' ');
}
