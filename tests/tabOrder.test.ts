import { describe, expect, it } from 'vitest';
import { DEFAULT_TAB_ORDER } from '../src/core/models/prefs';
import { normalizeTabOrder, nudgeTab, reorderTabs } from '../src/core/nav/tabOrder';

describe('tab order', () => {
  it('defaults when nothing valid is stored', () => {
    expect(normalizeTabOrder(undefined)).toEqual(DEFAULT_TAB_ORDER);
    expect(normalizeTabOrder('x')).toEqual(DEFAULT_TAB_ORDER);
    expect(normalizeTabOrder([])).toEqual(DEFAULT_TAB_ORDER);
  });
  it('keeps a saved order, drops unknown and repeated ids, appends missing ones', () => {
    expect(normalizeTabOrder(['links', 'bogus', 'today', 'links', 7])).toEqual(['links', 'today', 'agenda', 'meet', 'settings']);
  });
  it('always contains every tab exactly once', () => {
    const out = normalizeTabOrder(['settings']);
    expect([...out].sort()).toEqual([...DEFAULT_TAB_ORDER].sort());
  });
  it('moves a tab onto another one, in both directions', () => {
    expect(reorderTabs(DEFAULT_TAB_ORDER, 'links', 'today')).toEqual(['links', 'today', 'agenda', 'meet', 'settings']);
    expect(reorderTabs(DEFAULT_TAB_ORDER, 'today', 'meet')).toEqual(['agenda', 'meet', 'today', 'links', 'settings']);
  });
  it('ignores a no-op reorder', () => {
    expect(reorderTabs(DEFAULT_TAB_ORDER, 'today', 'today')).toBe(DEFAULT_TAB_ORDER);
  });
  it('nudges by one and stops at the ends', () => {
    expect(nudgeTab(DEFAULT_TAB_ORDER, 'meet', -1)).toEqual(['today', 'meet', 'agenda', 'links', 'settings']);
    expect(nudgeTab(DEFAULT_TAB_ORDER, 'meet', 1)).toEqual(['today', 'agenda', 'links', 'meet', 'settings']);
    expect(nudgeTab(DEFAULT_TAB_ORDER, 'today', -1)).toBe(DEFAULT_TAB_ORDER);
    expect(nudgeTab(DEFAULT_TAB_ORDER, 'settings', 1)).toBe(DEFAULT_TAB_ORDER);
  });
});
