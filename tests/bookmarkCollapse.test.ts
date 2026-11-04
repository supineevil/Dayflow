import { describe, expect, it } from 'vitest';
import { LOOSE_GROUP, expandOne, isCollapsed, sanitizeCollapsed, toggleAll, toggleCollapsed } from '../src/core/bookmarks/collapse';

describe('collapsing sections', () => {
  it('toggles one section on and off', () => {
    expect(toggleCollapsed([], 'a')).toEqual(['a']);
    expect(toggleCollapsed(['a', 'b'], 'a')).toEqual(['b']);
    expect(isCollapsed(['a'], 'a')).toBe(true);
    expect(isCollapsed(['a'], 'b')).toBe(false);
  });
  it('expands one without touching the rest', () => {
    expect(expandOne(['a', 'b'], 'a')).toEqual(['b']);
    expect(expandOne(['b'], 'a')).toEqual(['b']);
  });
  it('collapse-all folds everything, then unfolds when all are already folded', () => {
    const ids = ['a', 'b', LOOSE_GROUP];
    const folded = toggleAll(['a'], ids);
    expect([...folded].sort()).toEqual([...ids].sort());
    expect(toggleAll(folded, ids)).toEqual([]);
  });
  it('collapse-all does not duplicate ids', () => {
    expect(toggleAll(['a', 'a'], ['a', 'b']).filter((x) => x === 'a')).toHaveLength(1);
  });
  it('cleans stored data and removes sections that no longer exist', () => {
    expect(sanitizeCollapsed(['a', 'gone', 7, 'a', LOOSE_GROUP], ['a', 'b'])).toEqual(['a', LOOSE_GROUP]);
    expect(sanitizeCollapsed('x', ['a'])).toEqual([]);
    expect(sanitizeCollapsed(undefined, ['a'])).toEqual([]);
  });
});
