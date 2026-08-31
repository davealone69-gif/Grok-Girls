const AGE_KEY = 'grok-girls-age-confirmed-v1';
const ADULT_KEY = 'grok-girls-adult-mode-v1';

export function isAgeConfirmed(): boolean {
  try { return localStorage.getItem(AGE_KEY) === '18+'; } catch { return false; }
}

export function confirmAdultAge(): void {
  try { localStorage.setItem(AGE_KEY, '18+'); } catch {}
}

export function clearAgeConfirmation(): void {
  try { localStorage.removeItem(AGE_KEY); localStorage.removeItem(ADULT_KEY); } catch {}
}

export function isAdultModeEnabled(): boolean {
  try { return isAgeConfirmed() && localStorage.getItem(ADULT_KEY) === 'enabled'; } catch { return false; }
}

export function setAdultMode(enabled: boolean): boolean {
  if (!isAgeConfirmed()) return false;
  try { localStorage.setItem(ADULT_KEY, enabled ? 'enabled' : 'disabled'); } catch {}
  return enabled;
}
