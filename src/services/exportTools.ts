export interface ProjectBundle { version: 1; exportedAt: string; gallery: unknown[]; settings: Record<string, string>; }

export function collectProjectBundle(): ProjectBundle {
  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('grok-girls-')) settings[key] = localStorage.getItem(key) || '';
  }
  let gallery: unknown[] = [];
  try { gallery = JSON.parse(localStorage.getItem('grok-girls-gallery-v2') || '[]'); } catch {}
  return { version: 1, exportedAt: new Date().toISOString(), gallery, settings };
}

export function restoreProjectBundle(bundle: ProjectBundle): void {
  if (!bundle || bundle.version !== 1) throw new Error('Unsupported Grok-Girls project bundle');
  Object.entries(bundle.settings || {}).forEach(([key, value]) => localStorage.setItem(key, value));
  localStorage.setItem('grok-girls-gallery-v2', JSON.stringify(bundle.gallery || []));
}

export function downloadProjectBundle(): void {
  const blob = new Blob([JSON.stringify(collectProjectBundle(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `grok-girls-project-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importProjectFile(file: File): Promise<ProjectBundle> {
  const parsed = JSON.parse(await file.text()) as ProjectBundle;
  restoreProjectBundle(parsed);
  return parsed;
}
