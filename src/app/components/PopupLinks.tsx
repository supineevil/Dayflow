import { Bookmark as BookmarkIcon, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toggleSectionCollapsed } from '@/core/bookmarks/bookmarkStore';
import { colourHex, groupBookmarks, hostOf, searchBookmarks, type Bookmark } from '@/core/bookmarks/bookmarks';
import { LOOSE_GROUP, isCollapsed } from '@/core/bookmarks/collapse';
import { useBookmarks, useCollapsedSections } from '@/app/hooks/useBookmarks';
import { Button } from './ui/Button';

function LinkRow({ bookmark }: { bookmark: Bookmark }) {
  return (
    <li>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noreferrer noopener"
        title={bookmark.url}
        className="flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 hover:bg-hover"
      >
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: colourHex(bookmark.colour) }} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{bookmark.label}</span>
          <span className="block truncate text-xs text-subtle">{hostOf(bookmark.url)}</span>
        </span>
      </a>
    </li>
  );
}

/** Quick access to your bookmarks from the toolbar popup. Adding and editing live in the side panel. */
export function PopupLinks({ onOpenFull }: { onOpenFull: () => void }) {
  const state = useBookmarks();
  const collapsed = useCollapsedSections();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = searching ? searchBookmarks(state, query) : [];

  if (state.bookmarks.length === 0 && state.sections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-subtle">
        <BookmarkIcon className="mx-auto mb-2 size-5" />
        <p>No bookmarks yet.</p>
        <p className="mt-1">Add pages in the side panel, then they show up here.</p>
        <Button size="sm" className="mt-3" onClick={onOpenFull}>Open side panel</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2 top-2 size-4 text-subtle" />
        <input
          className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-8 text-[13px] outline-none focus:border-accent"
          placeholder="Search bookmarks"
          aria-label="Search bookmarks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-2 text-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {searching ? (
          results.length === 0 ? (
            <p className="py-4 text-center text-xs text-subtle">Nothing matches “{query.trim()}”.</p>
          ) : (
            <ul>{results.map((b) => <LinkRow key={b.id} bookmark={b} />)}</ul>
          )
        ) : (
          groupBookmarks(state).map(({ section, bookmarks }) => {
            const key = section?.id ?? LOOSE_GROUP;
            const folded = isCollapsed(collapsed, key);
            const listId = `popup-links-${key}`;
            return (
              <section key={key} aria-label={section?.name ?? 'No section'}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  <button
                    type="button"
                    aria-expanded={!folded}
                    aria-controls={listId}
                    onClick={() => toggleSectionCollapsed(key)}
                    className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left uppercase hover:text-fg"
                  >
                    {folded ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : <ChevronDown aria-hidden className="size-3.5 shrink-0" />}
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: section ? colourHex(section.colour) : 'var(--fg-subtle)' }} />
                    <span className="truncate">{section?.name ?? 'No section'}</span>
                    <span className="font-normal normal-case text-subtle">{bookmarks.length}</span>
                  </button>
                </h2>
                <div id={listId} hidden={folded}>
                  {bookmarks.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-subtle">Empty.</p>
                  ) : (
                    <ul>{bookmarks.map((b) => <LinkRow key={b.id} bookmark={b} />)}</ul>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
