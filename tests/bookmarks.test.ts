import { describe, expect, it } from 'vitest';
import {
  colourHex, groupBookmarks, hostOf, normalizeUrl, searchBookmarks, withBookmark, withBookmarkPatch,
  withSection, withSectionMoved, withoutSection, type Bookmark, type BookmarkState,
} from '../src/core/bookmarks/bookmarks';

const bm = (id: string, sectionId: string | null, label = id, url = `https://${id}.com/`): Bookmark => ({
  id, sectionId, url, label, colour: 'blue', createdAt: '2026-01-01T00:00:00Z',
});
const state: BookmarkState = {
  sections: [{ id: 's1', name: 'Work', colour: 'red' }, { id: 's2', name: 'Docs', colour: 'green' }],
  bookmarks: [bm('a', 's1'), bm('b', 's2'), bm('c', null), bm('d', 'gone')],
};

describe('normalizeUrl', () => {
  it('adds https when there is no scheme', () => {
    expect(normalizeUrl('example.com/path')).toBe('https://example.com/path');
    expect(normalizeUrl('  go/standup ')).toBe('https://go/standup');
  });
  it('keeps http and https', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
  });
  it('treats host:port as a host, not a scheme', () => {
    expect(normalizeUrl('localhost:3000/app')).toBe('https://localhost:3000/app');
  });
  it('rejects other schemes, blanks and text with spaces', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', '', '   ', 'two words', 'ftp://x.com']) {
      expect(normalizeUrl(bad)).toBeNull();
    }
  });
});

describe('helpers', () => {
  it('hostOf drops www', () => expect(hostOf('https://www.example.com/x')).toBe('example.com'));
  it('colourHex falls back for unknown keys', () => expect(colourHex('nope')).toBe(colourHex('blue')));
  it('groups by section and collects loose / orphaned bookmarks last', () => {
    const groups = groupBookmarks(state);
    expect(groups.map((g) => g.section?.id ?? null)).toEqual(['s1', 's2', null]);
    expect(groups[2]!.bookmarks.map((b) => b.id)).toEqual(['c', 'd']);
  });
  it('omits the loose group when empty', () => {
    expect(groupBookmarks({ sections: state.sections, bookmarks: [bm('a', 's1')] })).toHaveLength(2);
  });
  it('searches label and url, case-insensitively', () => {
    const s = withBookmark(state, bm('x', null, 'Sprint Board', 'https://jira.example.com/'));
    expect(searchBookmarks(s, 'sprint').map((b) => b.id)).toEqual(['x']);
    expect(searchBookmarks(s, 'JIRA').map((b) => b.id)).toEqual(['x']);
    expect(searchBookmarks(s, '')).toHaveLength(s.bookmarks.length);
  });
});

describe('reducers', () => {
  it('removing a section keeps its bookmarks as unsorted', () => {
    const next = withoutSection(state, 's1');
    expect(next.sections.map((s) => s.id)).toEqual(['s2']);
    expect(next.bookmarks.find((b) => b.id === 'a')!.sectionId).toBeNull();
    expect(next.bookmarks).toHaveLength(4);
  });
  it('moves a section and ignores out-of-range moves', () => {
    expect(withSectionMoved(state, 's1', 1).sections.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(withSectionMoved(state, 's1', -1)).toBe(state);
    expect(withSectionMoved(state, 's2', 1)).toBe(state);
  });
  it('patches one bookmark only', () => {
    const next = withBookmarkPatch(state, 'a', { label: 'New', colour: 'pink', sectionId: 's2' });
    expect(next.bookmarks.find((b) => b.id === 'a')).toMatchObject({ label: 'New', colour: 'pink', sectionId: 's2' });
    expect(next.bookmarks.find((b) => b.id === 'b')!.label).toBe('b');
  });
  it('appends sections', () => {
    expect(withSection(state, { id: 's3', name: 'X', colour: 'teal' }).sections).toHaveLength(3);
  });
});

import { exportBookmarks, mergeImport, parseImport, sanitizeState } from '../src/core/bookmarks/bookmarks';

describe('export / import', () => {
  const ids = () => { let n = 0; return () => `new${++n}`; };

  it('round-trips through export and parse', () => {
    const parsed = parseImport(exportBookmarks(state));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.sections).toEqual(state.sections);
      // the orphaned bookmark 'd' (missing section) comes back unsorted
      expect(parsed.state.bookmarks.map((b) => b.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(parsed.state.bookmarks.find((b) => b.id === 'd')!.sectionId).toBeNull();
      expect(parsed.skipped).toBe(0);
    }
  });

  it('rejects files that are not Dayflow exports', () => {
    expect(parseImport('not json')).toMatchObject({ ok: false });
    expect(parseImport('{"a":1}')).toMatchObject({ ok: false });
    expect(parseImport('[]')).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ format: 'dayflow-bookmarks', version: 99 }))).toMatchObject({ ok: false });
  });

  it('drops unsafe addresses and bad entries, and counts them', () => {
    const text = JSON.stringify({
      format: 'dayflow-bookmarks', version: 1,
      sections: [{ id: 's', name: ' Work ', colour: 'nope' }, { id: 's', name: 'Dup' }, { id: 'x', name: '  ' }],
      bookmarks: [
        { id: '1', url: 'javascript:alert(1)', label: 'bad' },
        { id: '2', url: 'example.com', sectionId: 's' },
        { id: '2', url: 'again.com' },
        { id: '3', url: 'https://ok.com', label: '', colour: 'zzz', sectionId: 'missing' },
        'junk',
      ],
    });
    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state.sections).toEqual([{ id: 's', name: 'Work', colour: 'blue' }]);
    expect(parsed.state.bookmarks.map((b) => [b.id, b.url, b.sectionId, b.colour])).toEqual([
      ['2', 'https://example.com/', 's', 'blue'],
      ['3', 'https://ok.com/', null, 'blue'],
    ]);
    expect(parsed.state.bookmarks[1]!.label).toBe('ok.com');
    expect(parsed.skipped).toBe(3);
  });

  it('sanitizeState tolerates garbage', () => {
    expect(sanitizeState(null).state).toEqual({ sections: [], bookmarks: [] });
    expect(sanitizeState({ sections: 5, bookmarks: 'x' }).state).toEqual({ sections: [], bookmarks: [] });
  });

  it('merge matches sections by name, skips duplicates and never changes existing data', () => {
    const incoming: BookmarkState = {
      sections: [{ id: 'i1', name: 'work', colour: 'pink' }, { id: 'i2', name: 'Fun', colour: 'teal' }],
      bookmarks: [
        bm('p', 'i1', 'dup', 'https://a.com/'), // same url + same section as existing 'a'
        bm('q', 'i1', 'new work', 'https://new.com/'),
        bm('r', 'i2', 'fun', 'https://fun.com/'),
        bm('s', null, 'loose', 'https://c.com/'), // same url as existing loose 'c'
        bm('t', null, 'loose2', 'https://other.com/'),
      ],
    };
    const r = mergeImport(state, incoming, ids());
    expect(r.addedSections).toBe(1);
    expect(r.addedBookmarks).toBe(3);
    expect(r.duplicates).toBe(2);
    expect(r.state.sections.map((s) => s.name)).toEqual(['Work', 'Docs', 'Fun']);
    expect(r.state.sections[0]).toEqual(state.sections[0]);
    expect(r.state.bookmarks.slice(0, 4)).toEqual(state.bookmarks);
    const newWork = r.state.bookmarks.find((b) => b.label === 'new work')!;
    expect(newWork.sectionId).toBe('s1');
    expect(r.state.bookmarks.find((b) => b.label === 'fun')!.sectionId).toBe(r.state.sections[2]!.id);
  });

  it('importing the same file twice adds nothing the second time', () => {
    const parsed = parseImport(exportBookmarks(state));
    if (!parsed.ok) throw new Error('parse failed');
    const first = mergeImport({ sections: [], bookmarks: [] }, parsed.state, ids());
    const second = mergeImport(first.state, parsed.state, ids());
    expect(second.addedBookmarks).toBe(0);
    expect(second.addedSections).toBe(0);
    expect(second.state).toEqual(first.state);
  });
});

import { withBookmarkMoved, withBookmarkNudged, withSectionReordered } from '../src/core/bookmarks/bookmarks';

describe('drag and drop moves', () => {
  const base: BookmarkState = {
    sections: [{ id: 'A', name: 'A', colour: 'red' }, { id: 'B', name: 'B', colour: 'green' }],
    bookmarks: [bm('a1', 'A'), bm('b1', 'B'), bm('a2', 'A'), bm('a3', 'A'), bm('n1', null), bm('b2', 'B')],
  };
  const order = (s: BookmarkState, sectionId: string | null) => s.bookmarks.filter((b) => b.sectionId === sectionId).map((b) => b.id);

  it('reorders within a section', () => {
    const next = withBookmarkMoved(base, 'a3', 'A', 'a1');
    expect(order(next, 'A')).toEqual(['a3', 'a1', 'a2']);
    expect(order(next, 'B')).toEqual(['b1', 'b2']);
  });
  it('moves to another section before a given bookmark', () => {
    const next = withBookmarkMoved(base, 'a1', 'B', 'b2');
    expect(order(next, 'A')).toEqual(['a2', 'a3']);
    expect(order(next, 'B')).toEqual(['b1', 'a1', 'b2']);
    expect(next.bookmarks.find((b) => b.id === 'a1')!.sectionId).toBe('B');
  });
  it('drops at the end of a section when no target is given', () => {
    expect(order(withBookmarkMoved(base, 'a1', 'B', null), 'B')).toEqual(['b1', 'b2', 'a1']);
    expect(order(withBookmarkMoved(base, 'a1', 'A', null), 'A')).toEqual(['a2', 'a3', 'a1']);
  });
  it('can move into an empty section and out to no section', () => {
    const withEmpty = withSection(base, { id: 'C', name: 'C', colour: 'pink' });
    expect(order(withBookmarkMoved(withEmpty, 'a1', 'C', null), 'C')).toEqual(['a1']);
    expect(order(withBookmarkMoved(base, 'a1', null, null), null)).toEqual(['n1', 'a1']);
  });
  it('ignores impossible moves', () => {
    expect(withBookmarkMoved(base, 'a1', 'A', 'a1')).toBe(base);
    expect(withBookmarkMoved(base, 'nope', 'A', null)).toBe(base);
    expect(withBookmarkMoved(base, 'a1', 'missing', null)).toBe(base);
  });
  it('never loses or duplicates bookmarks', () => {
    const next = withBookmarkMoved(withBookmarkMoved(base, 'b2', 'A', 'a2'), 'n1', 'B', null);
    expect(next.bookmarks.map((b) => b.id).sort()).toEqual(base.bookmarks.map((b) => b.id).sort());
  });
  it('nudges within a section only', () => {
    expect(order(withBookmarkNudged(base, 'a2', -1), 'A')).toEqual(['a2', 'a1', 'a3']);
    expect(order(withBookmarkNudged(base, 'a2', 1), 'A')).toEqual(['a1', 'a3', 'a2']);
    expect(withBookmarkNudged(base, 'a1', -1)).toBe(base);
    expect(withBookmarkNudged(base, 'a3', 1)).toBe(base);
    expect(order(withBookmarkNudged(base, 'n1', 1), null)).toEqual(['n1']);
  });
  it('reorders sections by dropping on another', () => {
    expect(withSectionReordered(base, 'B', 'A').sections.map((s) => s.id)).toEqual(['B', 'A']);
    expect(withSectionReordered(base, 'A', 'A')).toBe(base);
    expect(withSectionReordered(base, 'A', 'zzz')).toBe(base);
  });
});
