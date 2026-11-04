/** Id used for the "No section" group, which has no section id of its own. */
export const LOOSE_GROUP = 'loose';

export const isCollapsed = (collapsed: string[], id: string): boolean => collapsed.includes(id);

export function toggleCollapsed(collapsed: string[], id: string): string[] {
  return collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
}

export const expandOne = (collapsed: string[], id: string): string[] => collapsed.filter((x) => x !== id);

/** Collapses every group in `ids`, or expands all when they're already all collapsed. */
export function toggleAll(collapsed: string[], ids: string[]): string[] {
  return ids.every((id) => collapsed.includes(id)) ? collapsed.filter((x) => !ids.includes(x)) : [...new Set([...collapsed, ...ids])];
}

/** Cleans stored data and drops ids of sections that no longer exist. */
export function sanitizeCollapsed(stored: unknown, validIds: string[]): string[] {
  const valid = new Set([...validIds, LOOSE_GROUP]);
  return [...new Set(Array.isArray(stored) ? stored : [])].filter((x): x is string => typeof x === 'string' && valid.has(x));
}
