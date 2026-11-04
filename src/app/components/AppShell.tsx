import { startOfDay } from 'date-fns';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TabId } from '@/core/models';
import { reorderTabs } from '@/core/nav/tabOrder';
import { filterByResponse } from '@/core/filters/responseFilter';
import { greeting } from '@/core/planning/greeting';
import { useAccount } from '@/app/hooks/useAccount';
import { useCalendarData } from '@/app/hooks/useCalendarData';
import { useNow } from '@/app/hooks/useNow';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useTheme } from '@/app/hooks/useTheme';
import { cn } from '@/app/lib/cn';
import { AgendaView } from '@/app/views/AgendaView';
import { BookmarksView } from '@/app/views/BookmarksView';
import { MeetingView } from '@/app/views/MeetingView';
import { SettingsView } from '@/app/views/SettingsView';
import { TodayView } from '@/app/views/TodayView';
import { IconButton } from './ui/Button';
import { ConnectCard } from './ConnectCard';
import { ResponseFilterBar } from './ResponseFilterBar';
import { StatusBanner } from './StatusBanner';
import { TAB_META } from './tabMeta';

type ViewId = TabId;

/** Full app chrome for the side panel and the options page. */
export function AppShell({ wide = false }: { wide?: boolean }) {
  useTheme();
  const now = useNow();
  const { prefs, setPrefs } = usePrefs();
  const { calendars, filtered, refresh, syncing, loading, syncError, cacheError, account } = useCalendarData(now);
  const { busy, error: connectError, connect, disconnect } = useAccount();
  const [view, setView] = useState<ViewId | null>(null);
  const [day, setDay] = useState(() => startOfDay(new Date()));

  const active: ViewId = view ?? prefs.defaultView;
  const navRef = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState<TabId | null>(null);
  const [dropTarget, setDropTarget] = useState<TabId | null>(null);
  // Keep the selected tab visible when the bar is narrower than its contents.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [active]);
  const hiddenCount = filtered.hidden.length;
  const shown = useMemo(() => filterByResponse(filtered.visible, prefs.responseFilter), [filtered.visible, prefs.responseFilter]);

  return (
    <div className={cn('mx-auto flex min-h-screen flex-col', wide ? 'max-w-2xl' : 'max-w-full')}>
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{greeting(now, prefs.workingHours)}</div>
            <div className="flex items-center gap-1.5 text-xs text-subtle">
              {account.email && <span className="truncate">{account.email}</span>}
              {hiddenCount > 0 && <span>{hiddenCount} hidden</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {account.signedIn && (
              <IconButton label={syncing ? 'Syncing…' : 'Refresh'} onClick={() => void refresh()} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </IconButton>
            )}
            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open Google Calendar"
              title="Open Google Calendar"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
        <nav
          ref={navRef}
          aria-label="Views"
          onWheel={(e) => {
            // Let a mouse wheel scroll the tab bar sideways.
            if (e.deltaY !== 0 && e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY;
          }}
          className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {prefs.tabOrder.map((id) => {
            const { label, icon: Icon } = TAB_META[id];
            return (
              <button
                key={id}
                type="button"
                draggable
                aria-current={active === id ? 'page' : undefined}
                title="Drag to rearrange"
                onClick={() => setView(id)}
                onDragStart={(e) => {
                  setDragging(id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', id);
                }}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTarget !== id) setDropTarget(id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) setPrefs((p) => ({ tabOrder: reorderTabs(p.tabOrder, dragging, id) }));
                  setDragging(null);
                  setDropTarget(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors',
                  active === id ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-hover hover:text-fg',
                  dragging === id && 'opacity-40',
                  dragging && dropTarget === id && dragging !== id && 'ring-2 ring-accent',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </nav>
        {(active === 'today' || active === 'agenda') && <ResponseFilterBar />}
      </header>

      <main className="flex-1 px-4 py-4">
        {account.signedIn && syncError && active !== 'settings' && (
          <StatusBanner error={syncError} onReconnect={() => void connect()} onRetry={() => void refresh()} busy={busy || syncing} />
        )}
        {cacheError && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-surface p-3 text-xs text-danger">
            Couldn't read the local calendar cache: {cacheError}
          </div>
        )}
        {active === 'settings' ? (
          <SettingsView calendars={calendars} filtered={filtered} signedIn={account.signedIn} email={account.email} onDisconnect={() => void disconnect()} busy={busy} />
        ) : active === 'meet' ? (
          <MeetingView now={now} signedIn={account.signedIn} onReconnect={() => void connect()} busy={busy} />
        ) : active === 'links' ? (
          <BookmarksView />
        ) : !account.signedIn ? (
          <ConnectCard onConnect={() => void connect()} busy={busy} error={connectError} />
        ) : loading ? (
          <p className="py-10 text-center text-xs text-subtle">Loading your calendar…</p>
        ) : active === 'agenda' ? (
          <AgendaView events={shown} now={now} />
        ) : (
          <TodayView events={shown} now={now} day={day} onDayChange={setDay} />
        )}
      </main>
    </div>
  );
}
