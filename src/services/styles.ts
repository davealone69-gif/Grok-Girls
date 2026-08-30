import { AvatarDraft } from './avatarCreator';

export interface StylePreset {
  id: string;
  name: string;
  icon: string;
  accent: string;
  lighting: 'noir' | 'studio' | 'full' | 'bust' | 'wireframe';
  chair: string;
  prompt: string;
  filter: string;
  description: string;
}

export const stylePresets: StylePreset[] = [
  {
    id: 'noir',
    name: 'Noir Boudoir',
    icon: '🖤',
    accent: '#E62040',
    lighting: 'noir',
    chair: 'vintage tufted dark leather armchair, moody boudoir with crimson edge lighting',
    prompt: 'moody gothic boudoir, crimson rim lighting, soft seductive shadows, film noir atmosphere',
    filter: 'contrast(1.15) brightness(1.02) drop-shadow(0 0 35px rgba(230, 32, 64, 0.35))',
    description: 'The signature Ruby Noir look — leather, lace, crimson glow.'
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    icon: '🌆',
    accent: '#00F2FE',
    lighting: 'studio',
    chair: 'cyberpunk throne chair, magenta and cyan neon haze, holographic billboards',
    prompt: 'cyberpunk night city, neon rim lighting, holographic accents, chrome reflections, wet asphalt glow',
    filter: 'contrast(1.1) saturate(1.25) drop-shadow(0 0 30px rgba(0, 242, 254, 0.4))',
    description: 'Neon-soaked cyberpunk cityscape with holo accents.'
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    icon: '🌇',
    accent: '#F59E0B',
    lighting: 'studio',
    chair: 'luxury penthouse lounge at golden hour, warm window light streaming in',
    prompt: 'golden hour sunlight, warm amber tones, soft bokeh, editorial fashion glow',
    filter: 'sepia(0.18) saturate(1.2) brightness(1.05) drop-shadow(0 20px 40px rgba(0, 0, 0, 0.8))',
    description: 'Warm sunset editorial lighting with soft bokeh.'
  },
  {
    id: 'candle',
    name: 'Candlelight',
    icon: '🕯️',
    accent: '#FF7A3C',
    lighting: 'noir',
    chair: 'black velvet chaise lounge, candlelit gothic boudoir, flickering candelabra',
    prompt: 'flickering candlelight, deep shadows, baroque chiaroscuro, romantic darkness',
    filter: 'sepia(0.3) contrast(1.2) brightness(0.95) drop-shadow(0 0 40px rgba(255, 122, 60, 0.35))',
    description: 'Baroque chiaroscuro lit by candle flames.'
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    icon: '🌸',
    accent: '#F472B6',
    lighting: 'studio',
    chair: 'bright minimal studio with pastel seamless backdrop and soft diffusers',
    prompt: 'soft pastel palette, dreamy airy lighting, delicate blush tones, airy atmosphere',
    filter: 'saturate(0.9) brightness(1.08) drop-shadow(0 15px 30px rgba(244, 114, 182, 0.3))',
    description: 'Airy, delicate pastel studio mood.'
  },
  {
    id: 'bw',
    name: 'B&W Noir',
    icon: '🎞️',
    accent: '#F5F5FA',
    lighting: 'studio',
    chair: 'high-contrast classic studio, dark seamless backdrop, hard key light',
    prompt: 'black and white film noir, high contrast monochrome, classic Hollywood glamour, silver gelatin look',
    filter: 'grayscale(1) contrast(1.25) brightness(1.02) drop-shadow(0 18px 36px rgba(0, 0, 0, 0.85))',
    description: 'Classic monochrome Hollywood glamour.'
  },
  {
    id: 'bluehour',
    name: 'Blue Hour',
    icon: '🌌',
    accent: '#5AA0FF',
    lighting: 'studio',
    chair: 'metropolitan rooftop at twilight blue hour, glowing city lights',
    prompt: 'twilight blue hour, cool moonlight, cinematic night atmosphere, distant city bokeh',
    filter: 'hue-rotate(-8deg) saturate(1.1) brightness(1.02) drop-shadow(0 18px 40px rgba(90, 160, 255, 0.3))',
    description: 'Cool blue-hour rooftop atmosphere.'
  },
  {
    id: 'redroom',
    name: 'Red Room',
    icon: '🔴',
    accent: '#FF2B4E',
    lighting: 'noir',
    chair: 'dark leather armchair wrapped in deep red velvet drapes, theatrical spotlight',
    prompt: 'deep crimson room, red velvet drapes, theatrical spotlight, dramatic saturated reds',
    filter: 'contrast(1.2) saturate(1.3) brightness(0.98) drop-shadow(0 0 44px rgba(255, 43, 78, 0.4))',
    description: 'Saturated theatrical red velvet set.'
  },
  {
    id: 'explicit',
    name: 'Explicit Hard',
    icon: '🔥',
    accent: '#FF0040',
    lighting: 'noir',
    chair: 'leather sofa mid-sex, explicit adult scene, detailed anatomy',
    prompt: 'explicit graphic sexual act, detailed anatomy, fluids, intense pleasure, hardcore adult photography, 18+',
    filter: 'contrast(1.25) saturate(1.15) brightness(1.0) drop-shadow(0 0 40px rgba(255, 0, 64, 0.45))',
    description: 'Hardcore explicit sex scene lighting and framing.'
  },
  {
    id: 'aftercare',
    name: 'Afterglow',
    icon: '💦',
    accent: '#FF6B9D',
    lighting: 'studio',
    chair: 'rumpled sheets, post-sex afterglow, soft window light',
    prompt: 'post-sex afterglow, cum on skin, soft exhausted pleasure, intimate close-up, adult',
    filter: 'saturate(0.95) brightness(1.05) drop-shadow(0 15px 35px rgba(255, 107, 157, 0.3))',
    description: 'Soft post-sex intimacy and fluids.'
  },
  {
    id: 'bondage',
    name: 'Bondage Suite',
    icon: '⛓',
    accent: '#9B59B6',
    lighting: 'noir',
    chair: 'dark bondage frame, leather restraints, dramatic side light',
    prompt: 'bondage restraints, collar, explicit adult power exchange, detailed, 18+',
    filter: 'contrast(1.2) brightness(0.95) drop-shadow(0 0 35px rgba(155, 89, 182, 0.4))',
    description: 'Restrained explicit power-play scene.'
  }
];

export function applyStylePreset(draft: AvatarDraft, s: StylePreset): AvatarDraft {
  return {
    ...draft,
    chairSetting: s.chair,
    colorAccent: s.accent,
    styleTag: s.prompt
  };
}
