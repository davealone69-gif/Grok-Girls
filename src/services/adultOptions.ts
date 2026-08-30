export type NudityLevel = 'covered' | 'implied' | 'artistic_nude';

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
}

export const adultOptions = {
  nudityLevel: ['covered', 'implied', 'artistic_nude'] as const,
  wardrobe: [
    'elegant lingerie set',
    'lace bodysuit',
    'silk robe loosely draped',
    'sheer fashion wrap',
    'minimal editorial styling',
    'no clothing, artistic fine-art presentation'
  ],
  coverage: [
    'fully covered styling',
    'strategic fabric draping',
    'silhouette and shadow concealment',
    'tasteful partial coverage',
    'unclothed artistic figure with non-explicit framing'
  ],
  pose: [
    'standing relaxed three-quarter pose',
    'seated portrait pose',
    'reclining editorial pose',
    'back-facing over-shoulder pose',
    'side-profile silhouette pose',
    'arms folded naturally for modest framing',
    'kneeling fashion pose with non-explicit framing'
  ],
  bodyPresentation: [
    'natural adult anatomy',
    'athletic adult physique',
    'curvy adult physique',
    'slim adult physique',
    'soft natural proportions',
    'stylized fashion-model proportions'
  ],
  scene: [
    'private luxury bedroom studio',
    'dark leather boudoir studio',
    'minimalist fine-art studio',
    'luxury penthouse bedroom',
    'velvet chaise lounge set',
    'warm candlelit editorial set',
    'cyberpunk private suite'
  ],
  lighting: [
    'soft diffused studio light',
    'dramatic rim lighting',
    'warm candlelit glow',
    'low-key cinematic lighting',
    'cool moonlight with subtle rim light',
    'high-fashion beauty lighting'
  ],
  camera: [
    'full-body editorial framing',
    'three-quarter portrait framing',
    'side-profile composition',
    'rear three-quarter composition',
    'wide environmental composition',
    '85mm fashion photography look'
  ],
  styling: [
    'luxury fashion editorial',
    'gothic glamour',
    'cinematic fine-art photography',
    'modern boudoir editorial',
    'cyberpunk fashion editorial',
    'classic monochrome fine-art'
  ],
  accessories: [
    'none',
    'velvet choker and delicate jewelry',
    'gold body chain',
    'silk stockings and garter accessories',
    'ornamental jewelry',
    'cybernetic jewelry accents'
  ],
  mood: [
    'confident and composed',
    'sensual and elegant',
    'mysterious and cinematic',
    'relaxed and intimate',
    'bold editorial attitude',
    'dreamy fine-art atmosphere'
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
  mood: adultOptions.mood[0]
});

export function buildAdultPrompt(adult: AdultSelections): string {
  const nude = adult.nudityLevel === 'artistic_nude'
    ? 'Non-explicit artistic nude presentation of a consenting fictional adult 18+, with tasteful framing, no sexual activity, and no explicit sexual focus.'
    : adult.nudityLevel === 'implied'
      ? 'Adult implied-nude editorial presentation using draping, silhouette, and shadow for tasteful concealment.'
      : 'Adult fashion/boudoir presentation with clothing and modest coverage.';

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
    'Photorealistic adult editorial/fine-art rendering, anatomically coherent, tasteful composition, no minors, no sexual activity.'
  ].join(' ');
}
