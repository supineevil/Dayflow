import { addDays, startOfDay } from 'date-fns';
import { normalizeEvent } from '../google/normalize';
import type { GoogleCalendarListEntry } from '../google/types';
import type { ListEventsOptions, ListEventsResult } from '../google/calendarApi';
import type { CalendarEvent, CalendarInfo } from '../models';
import type { CalendarSyncMeta, EventCache } from '../storage/eventCache';

/** Bump when normalize/fields change what is cached, so existing caches are rebuilt. 2 = organizer/creator emails. */
export const SYNC_SCHEMA = 2;
export const WINDOW_PAST_DAYS = 30;
export const WINDOW_FUTURE_DAYS = 120;
/** Re-run a full sync when the cached window has drifted this far from where it should be. */
const WINDOW_DRIFT_DAYS = 7;
const DEFAULT_COLOR = '#6366f1';
const CONCURRENCY = 3;

export interface SyncApi {
  listCalendars(): Promise<GoogleCalendarListEntry[]>;
  listEvents(calendarId: string, opts: ListEventsOptions): Promise<ListEventsResult>;
}

export interface SyncDeps {
  api: SyncApi;
  cache: EventCache;
  now?: () => Date;
  /** Called after each calendar is written so the UI can refresh progressively. */
  onProgress?: () => void;
}

export interface SyncResult {
  calendars: CalendarInfo[];
  primaryId: string | undefined;
  /** Calendars that failed for a non-auth reason. Others still synced. */
  failures: { calendarId: string; message: string }[];
}

/** True for the two ways Google tells us a sync token is unusable. */
const isStaleToken = (err: unknown) =>
  typeof err === 'object' && err !== null && 'status' in err && ((err as { status: number }).status === 410 || (err as { status: number }).status === 400);

export function toCalendarInfo(c: GoogleCalendarListEntry): CalendarInfo {
  return { id: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || DEFAULT_COLOR, primary: c.primary };
}

export function desiredWindow(now: Date): { from: Date; to: Date } {
  const today = startOfDay(now);
  return { from: addDays(today, -WINDOW_PAST_DAYS), to: addDays(today, WINDOW_FUTURE_DAYS) };
}

export function needsFullSync(meta: CalendarSyncMeta | undefined, now: Date): boolean {
  if (!meta?.syncToken || meta.schema !== SYNC_SCHEMA) return true;
  const want = desiredWindow(now);
  const driftMs = WINDOW_DRIFT_DAYS * 86_400_000;
  return want.from.getTime() - new Date(meta.windowFrom).getTime() > driftMs || new Date(meta.windowTo).getTime() - want.to.getTime() < -driftMs;
}

async function fullSync(cal: CalendarInfo, deps: SyncDeps, now: Date): Promise<void> {
  const { from, to } = desiredWindow(now);
  const { events, nextSyncToken } = await deps.api.listEvents(cal.id, { timeMin: from.toISOString(), timeMax: to.toISOString() });
  const normalized = events.map((g) => normalizeEvent(g, { id: cal.id, name: cal.name, color: cal.color })).filter((e): e is CalendarEvent => !!e && e.status !== 'cancelled');
  await deps.cache.replaceEvents(cal.id, normalized, {
    calendarId: cal.id,
    syncToken: nextSyncToken,
    schema: SYNC_SCHEMA,
    windowFrom: from.toISOString(),
    windowTo: to.toISOString(),
  });
}

async function incrementalSync(cal: CalendarInfo, meta: CalendarSyncMeta, deps: SyncDeps): Promise<void> {
  const { events, nextSyncToken } = await deps.api.listEvents(cal.id, { syncToken: meta.syncToken });
  const upserts: CalendarEvent[] = [];
  const deletedIds: string[] = [];
  for (const g of events) {
    const e = normalizeEvent(g, { id: cal.id, name: cal.name, color: cal.color });
    if (!e) continue;
    if (e.status === 'cancelled') deletedIds.push(e.id);
    else upserts.push(e);
  }
  await deps.cache.applyChanges(cal.id, upserts, deletedIds, { ...meta, syncToken: nextSyncToken ?? meta.syncToken });
}

async function syncCalendar(cal: CalendarInfo, deps: SyncDeps, now: Date): Promise<void> {
  const meta = await deps.cache.getMeta(cal.id);
  if (!needsFullSync(meta, now) && meta) {
    try {
      await incrementalSync(cal, meta, deps);
      return;
    } catch (err) {
      if (!isStaleToken(err)) throw err;
      // Token expired or rejected: Google says to wipe and start over.
    }
  }
  await fullSync(cal, deps, now);
}

/**
 * Syncs every enabled calendar. Auth errors abort the whole run (nothing else will work);
 * any other per-calendar error is recorded and the remaining calendars continue.
 */
export async function syncAll(deps: SyncDeps, disabledCalendarIds: string[]): Promise<SyncResult> {
  const now = (deps.now ?? (() => new Date()))();
  const calendars = (await deps.api.listCalendars()).map(toCalendarInfo);

  const cached = await deps.cache.getCalendars();
  const liveIds = new Set(calendars.map((c) => c.id));
  await deps.cache.removeCalendars(cached.filter((c) => !liveIds.has(c.id)).map((c) => c.id));
  await deps.cache.putCalendars(calendars);
  deps.onProgress?.();

  const disabled = new Set(disabledCalendarIds);
  const queue = calendars.filter((c) => !disabled.has(c.id));
  const failures: SyncResult['failures'] = [];
  let fatal: unknown;

  const worker = async () => {
    for (let cal = queue.shift(); cal && !fatal; cal = queue.shift()) {
      try {
        await syncCalendar(cal, deps, now);
        deps.onProgress?.();
      } catch (err) {
        if (err instanceof Error && err.name === 'AuthError') fatal = err;
        else failures.push({ calendarId: cal.id, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (fatal) throw fatal;

  return { calendars, primaryId: calendars.find((c) => c.primary)?.id, failures };
}
