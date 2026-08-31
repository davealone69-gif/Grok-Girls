/* ------------------------------------------------------------------ */
/* Menu XML loader (data-driven menu format).                          */
/* The left rail + dock labels/titles come from /public/menu.xml.      */
/* Parsing is strict: a missing, unparseable or structurally invalid   */
/* file returns null and the app falls back to DEFAULT_MENU, so a      */
/* FAULTY menu XML can never break navigation.                         */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  id: string;
  icon?: string;
  label?: string;
  title?: string;
}

/** Built-in menu — mirrors the current UI and is the fallback for any
 *  missing / malformed menu.xml. */
export const DEFAULT_MENU: MenuItem[] = [
  { id: 'edit_inspector', icon: '✏️', label: 'Edit', title: 'Edit Identity (inspector)' },
  { id: 'presets', icon: '🗂️', label: 'Presets', title: 'Preset Identities' },
  { id: 'appearance', icon: '💀', label: 'Appearance', title: 'Appearance Studio' },
  { id: 'body', icon: '👤', label: 'Body', title: 'Body & Build' },
  { id: 'clothing', icon: '👚', label: 'Clothing', title: 'Lingerie & Corsetry' },
  { id: 'hair', icon: '💇', label: 'Hair', title: 'Hair Styling' },
  { id: 'face', icon: '🎭', label: 'Face', title: 'Face & Makeup' },
  { id: 'eyes', icon: '👁', label: 'Eyes', title: 'Eyes & Eyeliner' },
  { id: 'accessories', icon: '💍', label: 'Accessories', title: 'Chokers & Accessories' },
  { id: 'augments', icon: '⚡', label: 'Augments', title: 'Augments' },
  { id: 'tattoos', icon: '🖤', label: 'Tattoos', title: 'Tattoos & Lace' },
  { id: 'animations', icon: '🎬', label: 'Animations', title: 'Video & Animation Studio' },
  { id: 'import', icon: '📥', label: 'Import', title: 'Import & Data' },
  { id: 'story', icon: '📖', label: 'Story', title: 'Story Campaign' },
  { id: 'gallery', icon: '🖼', label: 'Gallery', title: 'Generation Archive' },
  { id: 'premium', icon: '⭐', label: 'Premium', title: 'Premium & Upgrades' },
  { id: 'help', icon: '❓', label: 'Help', title: 'Help & Shortcuts' },
  { id: 'random', icon: '🎲', title: 'Randomize Persona Traits' },
  { id: 'stats', icon: '📊', title: 'Stats & Achievements' },
  { id: 'settings', icon: '⚙️', title: 'AI Provider Settings' },
  { id: 'chat', icon: '💬', title: 'Interactive Dialogue' },
  { id: 'hair_style', label: 'HAIR STYLE' },
  { id: 'hair_color', label: 'HAIR COLOR' },
  { id: 'makeup', label: 'MAKEUP' },
  { id: 'eyebrows', label: 'EYEBROWS' },
  { id: 'scene_style', label: 'SCENE STYLE' }
];

/** Parse menu XML strictly. Returns null for anything malformed. */
export function parseMenuXml(xml: string): MenuItem[] | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return null;
    const root = doc.documentElement;
    if (!root || root.tagName !== 'menu') return null;
    const items: MenuItem[] = [];
    for (const sec of Array.from(root.getElementsByTagName('section'))) {
      for (const el of Array.from(sec.getElementsByTagName('item'))) {
        const id = el.getAttribute('id');
        if (!id) return null; // strict: every item must carry an id
        items.push({
          id,
          icon: el.getAttribute('icon') || undefined,
          label: el.getAttribute('label') || undefined,
          title: el.getAttribute('title') || undefined
        });
      }
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

/** Load the menu: menu.xml when valid, DEFAULT_MENU otherwise. */
export async function loadMenuXml(): Promise<MenuItem[]> {
  try {
    const res = await fetch('/menu.xml', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseMenuXml(await res.text());
    if (items) return items;
    console.warn('[menu] menu.xml is invalid — using the built-in menu');
  } catch (e) {
    console.warn('[menu] menu.xml unavailable — using the built-in menu', e);
  }
  return DEFAULT_MENU;
}

export function findMenuItem(menu: MenuItem[], id: string): MenuItem | undefined {
  return menu.find(i => i.id === id);
}
