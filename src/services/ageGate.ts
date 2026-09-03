import { isAgeConfirmed as ageConfirmed, confirmAdultAge as markAdult } from './settingsState';

/** Has the 18+ gate been confirmed? (canonical settings record) */
export function isAgeConfirmed(): boolean {
  return ageConfirmed();
}

/** Record the 18+ confirmation (canonical settings record). */
export function confirmAdultAge(): void {
  markAdult();
}
