/* ------------------------------------------------------------------ */
/* Menu/layout loader — native Android XML format.                     */
/*                                                                     */
/* The app renders its navigation rail, preview header actions,        */
/* camera-angle strip and options panel from /public/menu.xml,         */
/* authored like a native Android layout (LinearLayout / Button /      */
/* CheckBox / EditText with android:id and android:text).              */
/*                                                                     */
/* Parsing is strict: a missing, unparseable or structurally invalid   */
/* file returns null and the app falls back to DEFAULT_MENU, so a      */
/* FAULTY menu XML can never break navigation.                         */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  id: string;
  kind: 'Button' | 'CheckBox' | 'EditText' | 'TextView';
  section: 'rail' | 'header' | 'angles' | 'dock' | 'options';
  label?: string;
  title?: string;
  hint?: string;
}

/** android:id -> logical id (prefixes like btn/cat/angle stripped). */
const ID_ALIASES: Record<string, string> = {
  btnBuilder: 'appearance',
  btnPresets: 'presets',
  btnImport: 'import',
  btnBody: 'body',
  btnClothing: 'clothing',
  btnHair: 'hair',
  btnFace: 'face',
  btnEyes: 'eyes',
  btnAccessories: 'accessories',
  btnAugments: 'augments',
  btnTattoos: 'tattoos',
  btnAnimations: 'animations',
  btnStory: 'story',
  btnGallery: 'gallery',
  btnPremium: 'premium',
  btnChat: 'chat',
  btnHelp: 'help',
  btnSettings: 'settings',
  btnGenerate: 'generate',
  btnRandom: 'random',
  btnRotate: 'rotate',
  btnZoom: 'zoom',
  angleFront: 'angle_front',
  angleThreeQuarter: 'angle_3q',
  angleSide: 'angle_side',
  angleBack: 'angle_back',
  catHairStyle: 'hair_style',
  catHairColor: 'hair_color',
  catMakeup: 'makeup',
  catEyebrows: 'eyebrows',
  catSceneStyle: 'scene_style',
  catAvatar: 'catAvatar',
  tattooToggle: 'toggle_tattoos',
  augmentToggle: 'toggle_augments',
  avatarId: 'avatar_id',
  btnLoadOutfit: 'load_outfit',
  btnCancel: 'cancel',
  btnSave: 'save',
  railHeader: 'rail_header',
  headerTitle: 'header_title',
  optionsHeader: 'options_header',
  detailsHeader: 'details_header'
};

const SECTION_IDS: Record<string, MenuItem['section']> = {
  navigationRail: 'rail',
  headerBar: 'header',
  angleStrip: 'angles',
  optionsContainer: 'dock',
  optionsPanel: 'options'
};

function sectionOf(el: Element): MenuItem['section'] | null {
  let node: Element | null = el.parentElement;
  while (node) {
    const rawId = node.getAttribute('android:id') || node.getAttribute('id');
    if (rawId) {
      const key = rawId.replace(/^@\+id\//, '');
      if (SECTION_IDS[key]) return SECTION_IDS[key];
    }
    node = node.parentElement;
  }
  return null;
}

/** Parse the native menu XML strictly. Returns null for anything malformed. */
export function parseMenuXml(xml: string): MenuItem[] | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return null;
    const root = doc.documentElement;
    if (!root || root.tagName !== 'LinearLayout') return null;

    const all = Array.from(root.querySelectorAll('*'));
    const rawIds = all
      .map(el => el.getAttribute('android:id') || el.getAttribute('id'))
      .filter((id): id is string => Boolean(id))
      .map(id => id.replace(/^@\+id\//, ''));

    // structural requirements: the three anchor sections must exist
    if (!rawIds.includes('navigationRail') || !rawIds.includes('angleStrip') || !rawIds.includes('optionsPanel')) {
      return null;
    }

    const items: MenuItem[] = [];
    for (const el of all) {
      const tag = el.tagName;
      if (!['Button', 'CheckBox', 'EditText', 'TextView'].includes(tag)) continue;
      const rawId = el.getAttribute('android:id') || el.getAttribute('id');
      const section = sectionOf(el);
      const text = el.getAttribute('android:text');
      const hint = el.getAttribute('android:hint');
      const title = el.getAttribute('android:contentDescription');
      if (!rawId) return null; // strict: every widget must carry an id
      const logical = ID_ALIASES[rawId.replace(/^@\+id\//, '')];
      if (!logical) continue; // unknown widget — ignore, not an error
      if (!section) continue; // widget outside a known panel — ignore
      // Button/CheckBox must carry android:text; EditText uses android:hint
      if ((tag === 'Button' || tag === 'CheckBox') && !text) return null;
      items.push({
        id: logical,
        kind: tag as MenuItem['kind'],
        section,
        label: text || undefined,
        title: title || undefined,
        hint: hint || undefined
      });
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

/** Built-in layout — mirrors the shipped menu.xml and is the fallback for
 *  any missing / malformed file. */
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
  { id: 'accessories', kind: 'Button', section: 'rail', label: 'Accessories', title: 'Chokers & Accessories' },
  { id: 'augments', kind: 'Button', section: 'rail', label: 'Augments', title: 'Augments' },
  { id: 'tattoos', kind: 'Button', section: 'rail', label: 'Tattoos', title: 'Tattoos & Lace' },
  { id: 'animations', kind: 'Button', section: 'rail', label: 'Animations', title: 'Video & Animation Studio' },
  { id: 'story', kind: 'Button', section: 'rail', label: 'Story', title: 'Story Campaign' },
  { id: 'gallery', kind: 'Button', section: 'rail', label: 'Gallery', title: 'Generation Archive' },
  { id: 'premium', kind: 'Button', section: 'rail', label: 'Premium', title: 'Premium & Upgrades' },
  { id: 'chat', kind: 'Button', section: 'rail', label: 'Chat', title: 'Interactive Dialogue' },
  { id: 'help', kind: 'Button', section: 'rail', label: '?', title: 'Help & Shortcuts' },
  { id: 'settings', kind: 'Button', section: 'rail', label: '⚙', title: 'AI Provider Settings' },
  { id: 'header_title', kind: 'TextView', section: 'header', label: 'AVATAR DESIGNER' },
  { id: 'generate', kind: 'Button', section: 'header', label: 'GENERATE RENDER', title: 'Generate high-detail render' },
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

/** Load the menu: menu.xml when valid, DEFAULT_MENU otherwise. */
export async function loadMenuXml(): Promise<MenuItem[]> {
  try {
    const res = await fetch('/menu.xml', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseMenuXml(await res.text());
    if (items) return items;
    console.warn('[menu] menu.xml is invalid — using the built-in layout');
  } catch (e) {
    console.warn('[menu] menu.xml unavailable — using the built-in layout', e);
  }
  return DEFAULT_MENU;
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
