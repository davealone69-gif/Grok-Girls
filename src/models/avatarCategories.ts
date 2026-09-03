/* ------------------------------------------------------------------ */
/* AvatarCategories — canonical category catalog (Kotlin mirror).      */
/*                                                                     */
/* All option data lives in models/avatarCatalog.ts (the ONE master    */
/* catalog). This module keeps the historical public surface stable:   */
/*   AVATAR_CATEGORIES + applyCategoryOption + activeCategoryOption    */
/*                                                                     */
/* Deviation (standing product rule): the Kotlin gender options        */
/* "Female / Male / Androgynous" are rendered here as                  */
/* "Female / Non-binary / Android" — male avatars are not part of      */
/* this product (see avatarCatalog GENDER_RICH).                       */
/* ------------------------------------------------------------------ */
import type { AvatarDraft } from '../services/avatarCreator';
import {
  AVATAR_CATEGORIES,
  applyCategoryOption as catalogApply,
  activeCategoryOption as catalogActive,
  AvatarCategory
} from './avatarCatalog';

export type { AvatarCategory };

/** Display list for the CATEGORIES dock tab (single source: catalog). */
export { AVATAR_CATEGORIES };

/** Apply one canonical category option onto the draft. */
export function applyCategoryOption(d: AvatarDraft, categoryId: string, option: string): AvatarDraft {
  return catalogApply(d, categoryId, option);
}

/** Which canonical option is currently active for a category. */
export function activeCategoryOption(d: AvatarDraft, categoryId: string): string {
  return catalogActive(d, categoryId);
}
