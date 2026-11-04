import { DEFAULT_TAB_ORDER, TAB_IDS, type TabId } from '../models/prefs';

const isTabId = (v: unknown): v is TabId => TAB_IDS.includes(v as TabId);

/**
 * Cleans a stored order: unknown and repeated tabs are dropped, and tabs the user's saved order
 * doesn't mention (for example one added in a later version) are appended in their default place.
 */
export function normalizeTabOrder(stored: unknown): TabId[] {
  const kept: TabId[] = [];
  for (const id of Array.isArray(stored) ? stored : []) {
    if (isTabId(id) && !kept.includes(id)) kept.push(id);
  }
  return [...kept, ...DEFAULT_TAB_ORDER.filter((id) => !kept.includes(id))];
}

/** Moves `from` to where `to` currently is (the other tabs shift to make room). */
export function reorderTabs(order: TabId[], from: TabId, to: TabId): TabId[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0 || a === b) return order;
  const next = [...order];
  next.splice(a, 1);
  next.splice(b, 0, from);
  return next;
}

/** Moves a tab one place earlier (-1) or later (+1). Returns the same array at the ends. */
export function nudgeTab(order: TabId[], id: TabId, delta: -1 | 1): TabId[] {
  const i = order.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return order;
  return reorderTabs(order, id, order[j]!);
}
