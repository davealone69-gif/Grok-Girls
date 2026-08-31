/* ------------------------------------------------------------------ */
/* AvatarDesignerViewModel — mirror of the Kotlin ViewModel.           */
/*                                                                     */
/*   class AvatarDesignerViewModel : ViewModel() {                     */
/*     private val _avatar = MutableStateFlow(AvatarDefinition())      */
/*     val avatar: StateFlow<AvatarDefinition>; get() = _avatar        */
/*     fun setOption(category: String, value: String) {                */
/*       _avatar.value = when (category) {                             */
/*         "gender" -> _avatar.value.copy(gender = value) ...          */
/*         else -> _avatar.value   // unknown category: NO-OP          */
/*       } } }                                                         */
/*                                                                     */
/* The store is the single dispatcher for canonical edits: the         */
/* CATEGORIES panel and any future native-style surface call           */
/* setOption(category, value); the canonical AvatarDefinition is        */
/* copied immutably and unknown categories are ignored — exactly like  */
/* the Kotlin `when` switch.                                           */
/*                                                                     */
/* Bridge to the rich draft (two one-way flows, no feedback loops):    */
/*  - setOption emits the changed {category, value}; the React layer   */
/*    applies it onto the draft via applyCategoryOption.               */
/*  - syncFromDraft absorbs rich-UI edits (hair cards, color wheel,    */
/*    ...) so get() always mirrors the current avatar; it emits         */
/*    nothing back (the canonical vocabulary is coarser than the       */
/*    draft — pushing it back would clobber the user's precise picks). */
/* ------------------------------------------------------------------ */
import type { AvatarDraft } from '../services/avatarCreator';
import { DEFAULT_AVATAR_DEFINITION, AvatarDefinition, toAvatarDefinition } from './avatarDefinition';

export interface AvatarDesignerViewModel {
  /** Current canonical definition (the ViewModel's StateFlow value). */
  get(): AvatarDefinition;
  /** Subscribe to canonical changes. The callback receives the change
   *  for setOption emissions and undefined for silent syncs. */
  subscribe(cb: (def: AvatarDefinition, change?: { category: string; value: string }) => void): () => void;
  /** Kotlin setOption mirror: immutable copy of one field; unknown
   *  categories are a no-op. */
  setOption(category: string, value: string): void;
  /** Absorb a rich-draft edit (no emission). */
  syncFromDraft(d: AvatarDraft): void;
}

const FIELD_KEYS: Record<string, keyof AvatarDefinition> = {
  gender: 'gender',
  skin: 'skin',
  head: 'head',
  age: 'age',
  hair: 'hair',
  eyes: 'eyes',
  face: 'face',
  body: 'body',
  tattoos: 'tattoos',
  augmentations: 'augmentations',
  outfit: 'outfit'
};

export function createAvatarDesignerViewModel(): AvatarDesignerViewModel {
  // private val _avatar = MutableStateFlow(AvatarDefinition())
  let _avatar: AvatarDefinition = { ...DEFAULT_AVATAR_DEFINITION };
  const subs = new Set<(def: AvatarDefinition, change?: { category: string; value: string }) => void>();

  const get = () => _avatar;

  const subscribe = (cb: (def: AvatarDefinition, change?: { category: string; value: string }) => void) => {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  };

  // fun setOption(category, value) — when(category) { ... else -> no-op }
  const setOption = (category: string, value: string) => {
    const key = FIELD_KEYS[category];
    if (!key) return; // else branch of the Kotlin switch
    _avatar = { ..._avatar, [key]: value }; // copy semantics
    subs.forEach(cb => cb(_avatar, { category, value }));
  };

  const syncFromDraft = (d: AvatarDraft) => {
    const def = toAvatarDefinition(d);
    if (JSON.stringify(def) === JSON.stringify(_avatar)) return;
    _avatar = def;
    subs.forEach(cb => cb(_avatar, undefined));
  };

  return { get, subscribe, setOption, syncFromDraft };
}
