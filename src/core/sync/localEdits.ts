import { idbEventCache } from '../storage/eventCache';
import { syncStore } from './syncStatus';

/**
 * Removes events from the local cache straight after deleting them at Google, so they vanish at once
 * rather than after the next sync. The sync that follows reconciles anything this misses.
 */
export async function dropFromCache(calendarId: string, match: { ids?: string[]; seriesId?: string }): Promise<void> {
  const all = await idbEventCache.getAllEvents();
  const ids = all
    .filter((e) => e.calendarId === calendarId && (match.ids?.includes(e.id) || (!!match.seriesId && e.recurringEventId === match.seriesId)))
    .map((e) => e.id);
  const meta = await idbEventCache.getMeta(calendarId);
  if (!meta || ids.length === 0) return;
  await idbEventCache.applyChanges(calendarId, [], ids, meta);
  syncStore.update((s) => ({ ...s, version: s.version + 1 }));
}
