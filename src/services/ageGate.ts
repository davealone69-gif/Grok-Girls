const AGE_KEY = 'grok-girls-age-confirmed-v1';

export function isAgeConfirmed(): boolean {
  try { return localStorage.getItem(AGE_KEY) === '18+'; } catch { return false; }
}

export function confirmAdultAge(): void {
  try { localStorage.setItem(AGE_KEY, '18+'); } catch {}
}
