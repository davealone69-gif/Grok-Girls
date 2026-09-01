/* Canonical navigation model with a native XML override. */

export interface MenuItem {
  id: string;
  kind: 'Button' | 'CheckBox' | 'EditText' | 'TextView';
  section: 'rail' | 'header' | 'angles' | 'dock' | 'options';
  label?: string;
  title?: string;
  hint?: string;
}

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'rail_header', kind: 'TextView', section: 'rail', label: 'BUILD' },
  { id: 'appearance', kind: 'Button', section: 'rail', label: 'Builder', title: 'Appearance Studio' },
  { id: 'presets', kind: 'Button', section: 'rail', label: 'Presets', title: 'Preset Identities' },
  { id: 'import', kind: 'Button', section: 'rail', label: 'Import', title: 'Import & Data' },
  { id: 'body', kind: 'Button', section: 'rail', label: 'Body', title: 'Body & Build' },
  { id: 'clothing', kind: 'Button', section: 'rail', label: 'Clothing', title: 'Lingerie & Corsetry' },
  { id: 'hair', kind: 'Button', section: 'rail', label: 'Hair', title: 'Hair Styling' },
  { id: 'face', kind: 'Button', section: 'rail', label: 'Face', title: 'Face & Makeup' },
  { id: 'eyes', kind: 'Button', section: 'rail', label: 'Eyes', title: 'Eyes & Eyeliner' },
  { id: 'accessories', kind: 'Button', section: 'rail', label: 'Accessories', title: 'Accessories' },
  { id: 'augments', kind: 'Button', section: 'rail', label: 'Augments', title: 'Augments' },
  { id: 'tattoos', kind: 'Button', section: 'rail', label: 'Tattoos', title: 'Tattoos & Lace' },
  { id: 'animations', kind: 'Button', section: 'rail', label: 'Animations', title: 'Video & Animation Studio' },
  { id: 'story', kind: 'Button', section: 'rail', label: 'Story', title: 'Story Campaign' },
  { id: 'gallery', kind: 'Button', section: 'rail', label: 'Gallery', title: 'Generation Archive' },
  { id: 'chat', kind: 'Button', section: 'rail', label: 'Chat', title: 'Interactive Dialogue' },
  { id: 'premium', kind: 'Button', section: 'rail', label: 'Premium', title: 'Premium & Upgrades' },
  { id: 'help', kind: 'Button', section: 'rail', label: '?', title: 'Help & Shortcuts' },
  { id: 'settings', kind: 'Button', section: 'rail', label: '⚙', title: 'AI Provider Settings' },
  { id: 'header_title', kind: 'TextView', section: 'header', label: 'AVATAR DESIGNER' },
  { id: 'generate', kind: 'Button', section: 'header', label: 'GENERATE RENDER', title: 'Generate high-detail render' },
  { id: 'hd_render', kind: 'Button', section: 'header', label: 'HD RENDER', title: 'On-device HD renderer' },
  { id: 'random', kind: 'Button', section: 'header', label: 'Random', title: 'Randomize Persona Traits' },
  { id: 'rotate', kind: 'Button', section: 'header', label: 'Rotate', title: 'Rotate view' },
  { id: 'zoom', kind: 'Button', section: 'header', label: 'Zoom', title: 'Zoom view' },
  { id: 'angle_front', kind: 'Button', section: 'angles', label: 'FRONT', title: 'Front Portrait' },
  { id: 'angle_3q', kind: 'Button', section: 'angles', label: '3/4', title: 'Three-quarter angle' },
  { id: 'angle_side', kind: 'Button', section: 'angles', label: 'SIDE', title: 'Side profile' },
  { id: 'angle_back', kind: 'Button', section: 'angles', label: 'BACK', title: 'Back silhouette' },
  { id: 'hair_style', kind: 'Button', section: 'dock', label: 'HAIR STYLE' },
  { id: 'hair_color', kind: 'Button', section: 'dock', label: 'HAIR COLOR' },
  { id: 'makeup', kind: 'Button', section: 'dock', label: 'MAKEUP' },
  { id: 'catMakeup', kind: 'Button', section: 'dock', label: 'MAKEUP' },
  { id: 'eyebrows', kind: 'Button', section: 'dock', label: 'EYEBROWS' },
  { id: 'scene_style', kind: 'Button', section: 'dock', label: 'SCENE STYLE' },
  { id: 'catAvatar', kind: 'Button', section: 'dock', label: 'CATEGORIES' },
  { id: 'options_header', kind: 'TextView', section: 'options', label: 'APPEARANCE' },
  { id: 'details_header', kind: 'TextView', section: 'options', label: 'DETAILS' },
  { id: 'toggle_tattoos', kind: 'CheckBox', section: 'options', label: 'Tattoos' },
  { id: 'toggle_augments', kind: 'CheckBox', section: 'options', label: 'Augmentations' },
  { id: 'avatar_id', kind: 'EditText', section: 'options', hint: 'Avatar ID' },
  { id: 'load_outfit', kind: 'Button', section: 'options', label: 'Load Outfit', title: 'Load outfit preset' },
  { id: 'cancel', kind: 'Button', section: 'options', label: 'Cancel', title: 'Discard draft' },
  { id: 'save', kind: 'Button', section: 'options', label: 'SAVE', title: 'Save avatar' }
];

function attr(el: Element, name: string): string {
  return el.getAttribute(`android:${name}`) ?? el.getAttribute(name) ?? '';
}
function cleanId(value: string): string {
  return value.replace(/^@\+?id\//, '').trim();
}
function sectionFor(el: Element): MenuItem['section'] | null {
  const id = cleanId(attr(el, 'id')).toLowerCase();
  const ancestors: string[] = [];
  let p: Element | null = el;
  while (p) {
    ancestors.push(cleanId(attr(p, 'id')).toLowerCase());
    p = p.parentElement;
  }
  if (id.startsWith('angle')) return 'angles';
  if (id.startsWith('cat')) return 'dock';
  if (ancestors.includes('navigationrail')) return 'rail';
  if (ancestors.includes('headerbar')) return 'header';
  if (ancestors.includes('optionspanel') || ancestors.includes('optionscontainer')) return 'options';
  return null;
}
function parseMenuXml(xml: string): MenuItem[] {
  if (!xml.trim()) throw new Error('empty menu XML');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement) throw new Error('malformed menu XML');
  const controls = Array.from(doc.querySelectorAll('Button,CheckBox,EditText,TextView'));
  const items: MenuItem[] = [];
  for (const el of controls) {
    const id = cleanId(attr(el, 'id'));
    if (!id) throw new Error('menu control missing android:id');
    const section = sectionFor(el);
    if (!section) continue;
    const kind = el.tagName as MenuItem['kind'];
    const label = attr(el, 'text').trim() || undefined;
    const title = attr(el, 'contentDescription').trim() || undefined;
    const hint = attr(el, 'hint').trim() || undefined;
    items.push({ id, kind, section, label, title, hint });
  }
  if (!items.length) throw new Error('menu XML contains no supported controls');
  return items;
}

export async function loadMenuXml(): Promise<MenuItem[]> {
  try {
    const response = await fetch('/menu.xml', { cache: 'no-store' });
    if (!response.ok) return DEFAULT_MENU;
    return parseMenuXml(await response.text());
  } catch {
    return DEFAULT_MENU;
  }
}

export function menuLabel(items: MenuItem[], id: string): string {
  return items.find(i => i.id === id)?.label ?? DEFAULT_MENU.find(i => i.id === id)?.label ?? id;
}
export function menuTitle(items: MenuItem[], id: string): string {
  return items.find(i => i.id === id)?.title ?? DEFAULT_MENU.find(i => i.id === id)?.title ?? '';
}
export function menuSection(items: MenuItem[], section: MenuItem['section']): MenuItem[] {
  return items.filter(i => i.section === section);
}
