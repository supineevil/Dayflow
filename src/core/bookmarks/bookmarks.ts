/** Fixed palette. Stored by key so colours can be tuned later without migrating data. */
export const BOOKMARK_COLOURS = [
  { key: 'slate', name: 'Grey', hex: '#64748b' },
  { key: 'red', name: 'Red', hex: '#ef4444' },
  { key: 'orange', name: 'Orange', hex: '#f97316' },
  { key: 'amber', name: 'Yellow', hex: '#eab308' },
  { key: 'green', name: 'Green', hex: '#22c55e' },
  { key: 'teal', name: 'Teal', hex: '#14b8a6' },
  { key: 'blue', name: 'Blue', hex: '#3b82f6' },
  { key: 'purple', name: 'Purple', hex: '#8b5cf6' },
  { key: 'pink', name: 'Pink', hex: '#ec4899' },
] as const;

export type BookmarkColour = (typeof BOOKMARK_COLOURS)[number]['key'];

const FALLBACK: BookmarkColour = 'blue';

export function isColour(value: unknown): value is BookmarkColour {
  return BOOKMARK_COLOURS.some((c) => c.key === value);
}

export function colourHex(key: string): string {
  return (BOOKMARK_COLOURS.find((c) => c.key === key) ?? BOOKMARK_COLOURS.find((c) => c.key === FALLBACK)!).hex;
}

export interface BookmarkSection {
  id: string;
  name: string;
  colour: BookmarkColour;
}

export interface Bookmark {
  id: string;
  /** `null` means the built-in "Unsorted" group. */
  sectionId: string | null;
  url: string;
  label: string;
  colour: BookmarkColour;
  createdAt: string;
}

export interface BookmarkState {
  sections: BookmarkSection[];
  bookmarks: Bookmark[];
}


/**
 * Turns what the user typed or pasted into a safe http(s) URL, or null.
 * "example.com/x" gets https://. Anything with another scheme (javascript:, file:, …) is rejected.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/?#]+:\d+(?:[/?#]|$)/.test(text);
  try {
    const url = new URL(hasScheme ? text : `https://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "https://www.example.com/a" -> "example.com" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Sections that exist, plus a null group for bookmarks without one (or whose section was removed). */
export function groupBookmarks(state: BookmarkState): { section: BookmarkSection | null; bookmarks: Bookmark[] }[] {
  const known = new Set(state.sections.map((s) => s.id));
  const groups = state.sections.map((section) => ({
    section: section as BookmarkSection | null,
    bookmarks: state.bookmarks.filter((b) => b.sectionId === section.id),
  }));
  const loose = state.bookmarks.filter((b) => b.sectionId === null || !known.has(b.sectionId));
  return loose.length > 0 ? [...groups, { section: null, bookmarks: loose }] : groups;
}

export function searchBookmarks(state: BookmarkState, query: string): Bookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return state.bookmarks;
  return state.bookmarks.filter((b) => `${b.label} ${b.url}`.toLowerCase().includes(q));
}

// ---- pure reducers (tested) ----

export function withSection(state: BookmarkState, section: BookmarkSection): BookmarkState {
  return { ...state, sections: [...state.sections, section] };
}

export function withSectionPatch(state: BookmarkState, id: string, patch: Partial<Omit<BookmarkSection, 'id'>>): BookmarkState {
  return { ...state, sections: state.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Bookmarks in a removed section are kept and fall back to Unsorted. */
export function withoutSection(state: BookmarkState, id: string): BookmarkState {
  return {
    sections: state.sections.filter((s) => s.id !== id),
    bookmarks: state.bookmarks.map((b) => (b.sectionId === id ? { ...b, sectionId: null } : b)),
  };
}

export function withBookmark(state: BookmarkState, bookmark: Bookmark): BookmarkState {
  return { ...state, bookmarks: [...state.bookmarks, bookmark] };
}

export function withBookmarkPatch(state: BookmarkState, id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>): BookmarkState {
  return { ...state, bookmarks: state.bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function withoutBookmark(state: BookmarkState, id: string): BookmarkState {
  return { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== id) };
}

/** Moves a section one place earlier (-1) or later (+1). */
export function withSectionMoved(state: BookmarkState, id: string, delta: -1 | 1): BookmarkState {
  const from = state.sections.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= state.sections.length) return state;
  const sections = [...state.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved!);
  return { ...state, sections };
}

/**
 * Puts a bookmark in `sectionId` (null = no section) directly before `beforeId`, or at the end of
 * that section when `beforeId` is null or not found. Unknown ids leave the state unchanged.
 */
export function withBookmarkMoved(state: BookmarkState, id: string, sectionId: string | null, beforeId: string | null): BookmarkState {
  if (beforeId === id) return state;
  const moving = state.bookmarks.find((b) => b.id === id);
  if (!moving) return state;
  const known = new Set(state.sections.map((s) => s.id));
  if (sectionId !== null && !known.has(sectionId)) return state;

  const rest = state.bookmarks.filter((b) => b.id !== id);
  const beforeAt = beforeId ? rest.findIndex((b) => b.id === beforeId) : -1;
  let at = beforeAt;
  if (at < 0) {
    const inTarget = (b: Bookmark) => (sectionId === null ? b.sectionId === null || !known.has(b.sectionId) : b.sectionId === sectionId);
    const last = rest.map(inTarget).lastIndexOf(true);
    at = last >= 0 ? last + 1 : rest.length;
  }
  const bookmarks = [...rest];
  bookmarks.splice(at, 0, { ...moving, sectionId });
  return { ...state, bookmarks };
}

/** Moves a bookmark one place up (-1) or down (+1) inside its own section. */
export function withBookmarkNudged(state: BookmarkState, id: string, delta: -1 | 1): BookmarkState {
  const group = groupBookmarks(state).find((g) => g.bookmarks.some((b) => b.id === id));
  if (!group) return state;
  const i = group.bookmarks.findIndex((b) => b.id === id);
  const j = i + delta;
  if (j < 0 || j >= group.bookmarks.length) return state;
  const before = delta < 0 ? group.bookmarks[j]!.id : (group.bookmarks[j + 1]?.id ?? null);
  return withBookmarkMoved(state, id, group.section?.id ?? null, before);
}

/** Moves a section to where `targetId` currently is; the others shift to make room. */
export function withSectionReordered(state: BookmarkState, id: string, targetId: string): BookmarkState {
  const from = state.sections.findIndex((s) => s.id === id);
  const to = state.sections.findIndex((s) => s.id === targetId);
  if (from < 0 || to < 0 || from === to) return state;
  const sections = [...state.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved!);
  return { ...state, sections };
}

// ---- backup: export / import ----

export const EXPORT_FORMAT = 'dayflow-bookmarks';
export const EXPORT_VERSION = 1;
const MAX_IMPORT_CHARS = 5_000_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Cleans anything read from storage or a file. Unknown colours fall back, bookmarks whose address
 * isn't a safe http(s) URL are dropped (counted in `skipped`), and bookmarks pointing at a missing
 * section become unsorted.
 */
export function sanitizeState(raw: unknown): { state: BookmarkState; skipped: number } {
  const input = isRecord(raw) ? raw : {};
  let skipped = 0;

  const sections: BookmarkSection[] = [];
  const sectionIds = new Set<string>();
  for (const s of Array.isArray(input.sections) ? input.sections : []) {
    if (!isRecord(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name.trim() || sectionIds.has(s.id)) continue;
    sectionIds.add(s.id);
    sections.push({ id: s.id, name: s.name.trim(), colour: isColour(s.colour) ? s.colour : 'blue' });
  }

  const bookmarks: Bookmark[] = [];
  const bookmarkIds = new Set<string>();
  for (const b of Array.isArray(input.bookmarks) ? input.bookmarks : []) {
    if (!isRecord(b) || typeof b.id !== 'string' || typeof b.url !== 'string' || bookmarkIds.has(b.id)) {
      skipped++;
      continue;
    }
    const url = normalizeUrl(b.url);
    if (!url) {
      skipped++;
      continue;
    }
    bookmarkIds.add(b.id);
    bookmarks.push({
      id: b.id,
      url,
      label: typeof b.label === 'string' && b.label.trim() ? b.label.trim() : hostOf(url),
      sectionId: typeof b.sectionId === 'string' && sectionIds.has(b.sectionId) ? b.sectionId : null,
      colour: isColour(b.colour) ? b.colour : 'blue',
      createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date(0).toISOString(),
    });
  }
  return { state: { sections, bookmarks }, skipped };
}

export function exportBookmarks(state: BookmarkState, now: Date = new Date()): string {
  return JSON.stringify(
    { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), sections: state.sections, bookmarks: state.bookmarks },
    null,
    2,
  );
}

export type ParsedImport = { ok: true; state: BookmarkState; skipped: number } | { ok: false; error: string };

export function parseImport(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That file is too large to be a Dayflow bookmarks export.' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON. Choose a file exported from Dayflow.' };
  }
  if (!isRecord(data) || data.format !== EXPORT_FORMAT) return { ok: false, error: 'That doesn’t look like a Dayflow bookmarks export.' };
  if (typeof data.version !== 'number' || data.version > EXPORT_VERSION) {
    return { ok: false, error: 'That export is from a newer version of Dayflow. Update the extension and try again.' };
  }
  const { state, skipped } = sanitizeState(data);
  return { ok: true, state, skipped };
}

export interface MergeResult {
  state: BookmarkState;
  addedBookmarks: number;
  addedSections: number;
  duplicates: number;
}

/**
 * Adds imported bookmarks to the current ones. Sections match by name (ignoring case); a bookmark
 * already in the same section with the same address is skipped. Existing data is never changed.
 */
export function mergeImport(current: BookmarkState, incoming: BookmarkState, newId: () => string = () => crypto.randomUUID()): MergeResult {
  const sections = [...current.sections];
  const bookmarks = [...current.bookmarks];
  const idMap = new Map<string, string>();
  let addedSections = 0;

  for (const s of incoming.sections) {
    const existing = sections.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
    if (existing) {
      idMap.set(s.id, existing.id);
    } else {
      const id = newId();
      sections.push({ ...s, id });
      idMap.set(s.id, id);
      addedSections++;
    }
  }

  const seen = new Set(bookmarks.map((b) => `${b.sectionId ?? ''}\u0000${b.url}`));
  let addedBookmarks = 0;
  let duplicates = 0;
  for (const b of incoming.bookmarks) {
    const sectionId = b.sectionId ? idMap.get(b.sectionId) ?? null : null;
    const key = `${sectionId ?? ''}\u0000${b.url}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    bookmarks.push({ ...b, id: newId(), sectionId });
    addedBookmarks++;
  }
  return { state: { sections, bookmarks }, addedBookmarks, addedSections, duplicates };
}
