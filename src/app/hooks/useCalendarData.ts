import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyFilters, type FilterResult } from '@/core/filters/filterEngine';
import type { CalendarEvent, CalendarInfo } from '@/core/models';
import { accountStore } from '@/core/google/accountStore';
import { idbEventCache } from '@/core/storage/eventCache';
import { requestSync } from '@/core/sync/requestSync';
import { syncStore } from '@/core/sync/syncStatus';
import { usePrefs } from './usePrefs';
import { useStore } from './useStore';

/**
 * Reads the local cache (which the background worker keeps in sync with Google) and
 * re-reads whenever a sync reports progress. The UI never talks to Google directly.
 */
export function useCalendarData(now: Date) {
  const { prefs } = usePrefs();
  const account = useStore(accountStore);
  const sync = useStore(syncStore);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([idbEventCache.getAllEvents(), idbEventCache.getCalendars()])
      .then(([e, c]) => {
        if (cancelled) return;
        setEvents(e);
        setCalendars(c);
        setCacheError(null);
        setCacheLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCacheError(err instanceof Error ? err.message : 'Could not read the local calendar cache.');
        setCacheLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sync.version]);

  const refresh = useCallback(() => requestSync(), []);

  // `now` ticks every 30s; the filter result only changes meaningfully for the
  // `past` rule, so bucket it to the minute to avoid pointless recomputation.
  const minute = Math.floor(now.getTime() / 60_000);
  const filtered: FilterResult = useMemo(
    () => applyFilters(events, prefs, new Date(minute * 60_000)),
    [events, prefs, minute],
  );

  const syncing = sync.state === 'syncing';
  return {
    account,
    calendars,
    filtered,
    refresh,
    syncing,
    lastSyncedAt: sync.lastSyncedAt,
    syncError: sync.error,
    cacheError,
    /** True until we can show something: no cache read yet, or the very first sync hasn't produced calendars. */
    loading: !cacheLoaded || (account.signedIn && syncing && calendars.length === 0),
  };
}
