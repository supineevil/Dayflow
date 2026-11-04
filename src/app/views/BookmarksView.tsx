import { ArrowDown, ArrowUp, Bookmark as BookmarkIcon, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderPlus, GripVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState, type DragEvent, type FormEvent } from 'react';
import {
  addBookmark, addSection, deleteBookmark, deleteSection, moveBookmarkTo, moveSection, nudgeBookmark, reorderSection, toggleAllSections, toggleSectionCollapsed, expandSection, updateBookmark, updateSection,
} from '@/core/bookmarks/bookmarkStore';
import { LOOSE_GROUP, isCollapsed } from '@/core/bookmarks/collapse';
import {
  colourHex, groupBookmarks, hostOf, searchBookmarks,
  type Bookmark, type BookmarkColour, type BookmarkSection,
} from '@/core/bookmarks/bookmarks';
import { useBookmarks, useCollapsedSections } from '@/app/hooks/useBookmarks';
import { Button, IconButton } from '@/app/components/ui/Button';
import { BookmarkBackup } from '@/app/components/BookmarkBackup';
import { ColourPicker } from '@/app/components/ColourPicker';
import { cn } from '@/app/lib/cn';

const inputClass = 'h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent';

interface FormProps {
  sections: BookmarkSection[];
  initial?: Bookmark;
  defaultSectionId?: string | null;
  onDone: () => void;
}

function BookmarkForm({ sections, initial, defaultSectionId = null, onDone }: FormProps) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [colour, setColour] = useState<BookmarkColour>(initial?.colour ?? 'blue');
  const [sectionId, setSectionId] = useState<string | null>(initial?.sectionId ?? defaultSectionId);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = initial
      ? updateBookmark(initial.id, { url, label, colour, sectionId })
      : addBookmark({ url, label, colour, sectionId });
    if (!ok) {
      setError('Enter a web address like example.com or https://example.com/page');
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <input
        className={inputClass}
        placeholder="Paste a web address"
        aria-label="Web address"
        value={url}
        autoFocus
        onChange={(e) => { setUrl(e.target.value); setError(''); }}
      />
      <input className={inputClass} placeholder="Label (optional, e.g. Sprint board)" aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select className={inputClass} aria-label="Section" value={sectionId ?? ''} onChange={(e) => setSectionId(e.target.value || null)}>
        <option value="">No section</option>
        {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <ColourPicker label="Bookmark colour" value={colour} onChange={setColour} />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" variant="primary" type="submit" disabled={!url.trim()}>{initial ? 'Save' : 'Add bookmark'}</Button>
      </div>
    </form>
  );
}

function SectionForm({ initial, onDone }: { initial?: BookmarkSection; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [colour, setColour] = useState<BookmarkColour>(initial?.colour ?? 'purple');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (initial) updateSection(initial.id, { name, colour });
    else addSection(name, colour);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <input className={inputClass} placeholder="Section name (e.g. Casework)" aria-label="Section name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <ColourPicker label="Section colour" value={colour} onChange={setColour} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" variant="primary" type="submit" disabled={!name.trim()}>{initial ? 'Save' : 'Create section'}</Button>
      </div>
    </form>
  );
}

interface RowDnd {
  draggable: boolean;
  dragging: boolean;
  /** Show the "dropping here" line above this row. */
  indicator: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
}

interface RowProps {
  bookmark: Bookmark;
  onEdit: () => void;
  dnd: RowDnd;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function BookmarkRow({ bookmark, onEdit, dnd, canMoveUp, canMoveDown }: RowProps) {
  const reveal = 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100';
  return (
    <li
      draggable={dnd.draggable}
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDrop={dnd.onDrop}
      onDragEnd={dnd.onDragEnd}
      className={cn(
        'group flex items-center gap-1 rounded-md pr-1 hover:bg-hover',
        dnd.dragging && 'opacity-40',
        dnd.indicator && 'shadow-[0_-2px_0_0_var(--accent)]',
      )}
    >
      <a
        href={bookmark.url}
        target="_blank"
        rel="noreferrer noopener"
        // Otherwise the browser drags the link itself instead of the row.
        draggable={false}
        title={dnd.draggable ? 'Drag to rearrange' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2"
      >
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: colourHex(bookmark.colour) }} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{bookmark.label}</span>
          <span className="block truncate text-xs text-subtle">{hostOf(bookmark.url)}</span>
        </span>
      </a>
      {dnd.draggable && (
        <>
          <IconButton label={`Move ${bookmark.label} up`} disabled={!canMoveUp} onClick={() => nudgeBookmark(bookmark.id, -1)} className={reveal}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton label={`Move ${bookmark.label} down`} disabled={!canMoveDown} onClick={() => nudgeBookmark(bookmark.id, 1)} className={reveal}>
            <ArrowDown className="size-3.5" />
          </IconButton>
        </>
      )}
      <IconButton label={`Edit ${bookmark.label}`} onClick={onEdit} className={reveal}>
        <Pencil className="size-3.5" />
      </IconButton>
      <IconButton label={`Delete ${bookmark.label}`} onClick={() => deleteBookmark(bookmark.id)} className={reveal}>
        <Trash2 className="size-3.5" />
      </IconButton>
    </li>
  );
}

type Drag = { kind: 'bookmark' | 'section'; id: string };

export function BookmarksView() {
  const state = useBookmarks();
  const collapsed = useCollapsedSections();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<{ sectionId: string | null } | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** What the pointer is over while dragging: `row:<bookmark id>` or `sec:<section id | loose>`. */
  const [over, setOver] = useState<string | null>(null);

  const searching = query.trim().length > 0;
  const results = searching ? searchBookmarks(state, query) : [];
  const groups = groupBookmarks(state);
  const empty = state.bookmarks.length === 0 && state.sections.length === 0;
  const groupIds = groups.map((g) => g.section?.id ?? LOOSE_GROUP);
  const allCollapsed = groupIds.length > 0 && groupIds.every((id) => isCollapsed(collapsed, id));

  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const startDrag = (e: DragEvent, next: Drag) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', next.id);
    setDrag(next);
  };

  /** Rows for one list. `sectionId` is where a bookmark dropped on a row ends up. Dragging is off while searching. */
  const renderRows = (list: Bookmark[], sectionId: string | null, canDrag: boolean) =>
    list.map((b, i) => {
      if (editing === b.id) {
        return <li key={b.id}><BookmarkForm sections={state.sections} initial={b} onDone={() => setEditing(null)} /></li>;
      }
      const dnd: RowDnd = {
        draggable: canDrag,
        dragging: drag?.kind === 'bookmark' && drag.id === b.id,
        indicator: drag?.kind === 'bookmark' && drag.id !== b.id && over === `row:${b.id}`,
        onDragStart: (e) => startDrag(e, { kind: 'bookmark', id: b.id }),
        onDragOver: (e) => {
          if (drag?.kind !== 'bookmark') return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (over !== `row:${b.id}`) setOver(`row:${b.id}`);
        },
        onDrop: (e) => {
          if (drag?.kind !== 'bookmark') return;
          e.preventDefault();
          e.stopPropagation();
          moveBookmarkTo(drag.id, sectionId, b.id);
          endDrag();
        },
        onDragEnd: endDrag,
      };
      return <BookmarkRow key={b.id} bookmark={b} onEdit={() => setEditing(b.id)} dnd={dnd} canMoveUp={i > 0} canMoveDown={i < list.length - 1} />;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-2 size-4 text-subtle" />
          <input className={`${inputClass} pl-8`} placeholder="Search bookmarks" aria-label="Search bookmarks" value={query} onChange={(e) => setQuery(e.target.value)} />
          {searching && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-2 text-subtle hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </div>
        {!searching && groups.length > 1 && (
          <IconButton label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'} onClick={() => toggleAllSections(groupIds)}>
            {allCollapsed ? <ChevronsUpDown className="size-4" /> : <ChevronsDownUp className="size-4" />}
          </IconButton>
        )}
        <IconButton label="New section" onClick={() => { setAddingSection(true); setAdding(null); }}><FolderPlus className="size-4" /></IconButton>
        <IconButton label="Add bookmark" onClick={() => { setAdding({ sectionId: null }); setAddingSection(false); }}><Plus className="size-4" /></IconButton>
      </div>

      {addingSection && <SectionForm onDone={() => setAddingSection(false)} />}
      {adding && <BookmarkForm sections={state.sections} defaultSectionId={adding.sectionId} onDone={() => setAdding(null)} />}

      {empty && !adding && !addingSection && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-subtle">
          <BookmarkIcon className="mx-auto mb-2 size-5" />
          <p>No bookmarks yet.</p>
          <p className="mt-1">Use + to save a page, or the folder icon to create a section such as “Casework” or “Docs”.</p>
        </div>
      )}

      {searching ? (
        results.length === 0 ? (
          <p className="py-6 text-center text-xs text-subtle">Nothing matches “{query.trim()}”.</p>
        ) : (
          <ul className="space-y-0.5">{renderRows(results, null, false)}</ul>
        )
      ) : (
        groups.map(({ section, bookmarks }) => {
          const key = section?.id ?? LOOSE_GROUP;
          const folded = isCollapsed(collapsed, key);
          const listId = `bookmarks-${key}`;
          const index = section ? state.sections.findIndex((s) => s.id === section.id) : -1;
          return (
            <section
              key={key}
              aria-label={section?.name ?? 'No section'}
              onDragOver={(e) => {
                if (!drag) return;
                const sectionDrop = drag.kind === 'section' && section !== null && drag.id !== section.id;
                if (drag.kind !== 'bookmark' && !sectionDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== `sec:${key}`) setOver(`sec:${key}`);
              }}
              onDrop={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (drag.kind === 'bookmark') moveBookmarkTo(drag.id, section?.id ?? null, null);
                else if (section) reorderSection(drag.id, section.id);
                endDrag();
              }}
              className={cn(
                'rounded-lg',
                drag && over === `sec:${key}` && !(drag.kind === 'section' && drag.id === section?.id) && 'ring-2 ring-accent/60 ring-offset-2 ring-offset-bg',
                drag?.kind === 'section' && drag.id === section?.id && 'opacity-40',
              )}
            >
              {section && editingSection === section.id ? (
                <SectionForm initial={section} onDone={() => setEditingSection(null)} />
              ) : (
                <div
                  className="group mb-1 flex items-center gap-1.5 px-1"
                  draggable={section !== null}
                  title={section ? 'Drag to rearrange sections' : undefined}
                  onDragStart={(e) => section && startDrag(e, { kind: 'section', id: section.id })}
                  onDragEnd={endDrag}
                >
                  {section && <GripVertical aria-hidden className="size-3.5 shrink-0 cursor-grab text-subtle" />}
                  <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: section ? colourHex(section.colour) : 'var(--fg-subtle)' }} />
                  <h2 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    <button
                      type="button"
                      aria-expanded={!folded}
                      aria-controls={listId}
                      onClick={() => toggleSectionCollapsed(key)}
                      className="flex w-full min-w-0 items-center gap-1 rounded py-1 text-left uppercase hover:text-fg"
                    >
                      {folded ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : <ChevronDown aria-hidden className="size-3.5 shrink-0" />}
                      <span className="truncate">{section?.name ?? 'No section'}</span>
                      <span className="font-normal normal-case text-subtle">{bookmarks.length}</span>
                    </button>
                  </h2>
                  {section && confirmDelete === section.id ? (
                    <>
                      <span className="text-xs text-subtle">Delete section? Bookmarks are kept.</span>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Keep</Button>
                      <Button size="sm" variant="secondary" onClick={() => { deleteSection(section.id); setConfirmDelete(null); }}>Delete</Button>
                    </>
                  ) : (
                    <>
                      <IconButton label={`Add to ${section?.name ?? 'no section'}`} onClick={() => { expandSection(key); setAdding({ sectionId: section?.id ?? null }); setAddingSection(false); }}>
                        <Plus className="size-3.5" />
                      </IconButton>
                      {section && (
                        <span className="flex opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <IconButton label="Move section up" disabled={index === 0} onClick={() => moveSection(section.id, -1)}><ArrowUp className="size-3.5" /></IconButton>
                          <IconButton label="Move section down" disabled={index === state.sections.length - 1} onClick={() => moveSection(section.id, 1)}><ArrowDown className="size-3.5" /></IconButton>
                          <IconButton label={`Edit ${section.name}`} onClick={() => setEditingSection(section.id)}><Pencil className="size-3.5" /></IconButton>
                          <IconButton label={`Delete ${section.name}`} onClick={() => setConfirmDelete(section.id)}><Trash2 className="size-3.5" /></IconButton>
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              <div id={listId} hidden={folded}>
                {bookmarks.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-subtle">Empty. Use + to add a page here.</p>
                ) : (
                  <ul className="space-y-0.5">{renderRows(bookmarks, section?.id ?? null, true)}</ul>
                )}
              </div>
            </section>
          );
        })
      )}

      <BookmarkBackup />
    </div>
  );
}
