import {
  hostOf, mergeImport, normalizeUrl, sanitizeState, withBookmark, withBookmarkPatch, withSection, withSectionMoved, withSectionPatch,
  withoutBookmark, withoutSection, withBookmarkMoved, withBookmarkNudged, withSectionReordered,
  type Bookmark, type BookmarkColour, type BookmarkSection, type BookmarkState, type MergeResult,
} from './bookmarks';
import { expandOne, toggleAll, toggleCollapsed } from './collapse';
import { createStore } from '@/core/storage/store';

const EMPTY: BookmarkState = { sections: [], bookmarks: [] };

const hydrate = (stored: Partial<BookmarkState>): BookmarkState => sanitizeState(stored).state;

export const bookmarkStore = createStore<BookmarkState>('dayflow:bookmarks', EMPTY, hydrate);

export function addSection(name: string, colour: BookmarkColour): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  bookmarkStore.update((s) => withSection(s, { id, name: trimmed, colour }));
  return id;
}

export function updateSection(id: string, patch: Partial<Omit<BookmarkSection, 'id'>>): void {
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) return;
  bookmarkStore.update((s) => withSectionPatch(s, id, name ? { ...patch, name } : patch));
}

export function deleteSection(id: string): void {
  bookmarkStore.update((s) => withoutSection(s, id));
  bookmarkUiStore.update((u) => (u.collapsed.includes(id) ? { collapsed: expandOne(u.collapsed, id) } : u));
}
export const moveSection = (id: string, delta: -1 | 1) => bookmarkStore.update((s) => withSectionMoved(s, id, delta));

export interface NewBookmark {
  url: string;
  label?: string;
  colour: BookmarkColour;
  sectionId: string | null;
}

/** Returns false when the URL isn't a valid web address. */
export function addBookmark(input: NewBookmark): boolean {
  const url = normalizeUrl(input.url);
  if (!url) return false;
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    sectionId: input.sectionId,
    url,
    label: input.label?.trim() || hostOf(url),
    colour: input.colour,
    createdAt: new Date().toISOString(),
  };
  bookmarkStore.update((s) => withBookmark(s, bookmark));
  return true;
}

/** Returns false when a new URL is given but isn't valid. */
export function updateBookmark(id: string, patch: Partial<Pick<Bookmark, 'url' | 'label' | 'colour' | 'sectionId'>>): boolean {
  const next = { ...patch };
  if (patch.url !== undefined) {
    const url = normalizeUrl(patch.url);
    if (!url) return false;
    next.url = url;
  }
  if (patch.label !== undefined) next.label = patch.label.trim() || hostOf(next.url ?? bookmarkStore.get().bookmarks.find((b) => b.id === id)?.url ?? '');
  bookmarkStore.update((s) => withBookmarkPatch(s, id, next));
  return true;
}

export const deleteBookmark = (id: string) => bookmarkStore.update((s) => withoutBookmark(s, id));

/** Adds an imported set to what's already here. */
export function importMerge(incoming: BookmarkState): MergeResult {
  const result = mergeImport(bookmarkStore.get(), incoming);
  bookmarkStore.update(() => result.state);
  return result;
}

/** Throws away the current bookmarks and uses the imported set. */
export function importReplace(incoming: BookmarkState): void {
  bookmarkStore.update(() => incoming);
}

export const moveBookmarkTo = (id: string, sectionId: string | null, beforeId: string | null) =>
  bookmarkStore.update((s) => withBookmarkMoved(s, id, sectionId, beforeId));
export const nudgeBookmark = (id: string, delta: -1 | 1) => bookmarkStore.update((s) => withBookmarkNudged(s, id, delta));
export const reorderSection = (id: string, targetId: string) => bookmarkStore.update((s) => withSectionReordered(s, id, targetId));

// ---- which sections are folded away (a view preference, so it is not exported or merged) ----

interface BookmarkUi {
  collapsed: string[];
}

export const bookmarkUiStore = createStore<BookmarkUi>('dayflow:bookmarks-ui', { collapsed: [] }, (stored) => ({
  collapsed: [...new Set(Array.isArray(stored.collapsed) ? stored.collapsed : [])].filter((x): x is string => typeof x === 'string'),
}));

export const toggleSectionCollapsed = (id: string) => bookmarkUiStore.update((u) => ({ collapsed: toggleCollapsed(u.collapsed, id) }));
export const expandSection = (id: string) => bookmarkUiStore.update((u) => (u.collapsed.includes(id) ? { collapsed: expandOne(u.collapsed, id) } : u));
export const toggleAllSections = (ids: string[]) => bookmarkUiStore.update((u) => ({ collapsed: toggleAll(u.collapsed, ids) }));
