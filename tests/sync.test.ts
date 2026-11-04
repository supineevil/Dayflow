import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/core/google/calendarApi';
import { AuthError } from '../src/core/google/auth';
import type { GoogleEvent } from '../src/core/google/types';
import { SYNC_SCHEMA, needsFullSync, syncAll, type SyncApi } from '../src/core/sync/syncService';
import { memoryCache } from './helpers';

const NOW = new Date('2026-11-04T12:00:00Z');
const timed = (id: string, title = id): GoogleEvent => ({
  id, summary: title, start: { dateTime: '2026-11-05T09:00:00Z' }, end: { dateTime: '2026-11-05T10:00:00Z' },
});

function fakeApi(over: Partial<SyncApi> = {}): SyncApi & { listEvents: ReturnType<typeof vi.fn> } {
  return {
    listCalendars: async () => [{ id: 'a', summary: 'A', primary: true }, { id: 'b', summary: 'B' }],
    listEvents: vi.fn(async () => ({ events: [timed('e1')], nextSyncToken: 'tok1' })),
    ...over,
  } as never;
}

describe('syncAll', () => {
  it('does a full sync first, bounded by a window, and stores the sync token', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, []);
    const firstCall = api.listEvents.mock.calls[0]!;
    expect(firstCall[1]).toHaveProperty('timeMin');
    expect(firstCall[1]).toHaveProperty('timeMax');
    expect(firstCall[1]).not.toHaveProperty('syncToken');
    expect(cache.metas.get('a')?.syncToken).toBe('tok1');
    expect(cache.events.size).toBe(2); // one per calendar
  });

  it('uses the sync token (and no time bounds) on the next run, applying changes and deletions', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, []);
    api.listEvents.mockClear();
    api.listEvents.mockImplementation(async (_id: string, opts: { syncToken?: string }) => ({
      events: [timed('e1', 'Renamed'), { id: 'gone', status: 'cancelled' }, timed('e2')],
      nextSyncToken: opts.syncToken === 'tok1' ? 'tok2' : 'bad',
    }));
    await syncAll({ api, cache, now: () => NOW }, []);
    const opts = api.listEvents.mock.calls[0]![1];
    expect(opts).toEqual({ syncToken: 'tok1' });
    expect(cache.metas.get('a')?.syncToken).toBe('tok2');
    expect([...cache.events.values()].find((e) => e.calendarId === 'a' && e.id === 'e1')?.title).toBe('Renamed');
  });

  it('removes events that Google reports as cancelled', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, []);
    api.listEvents.mockResolvedValue({ events: [{ id: 'e1', status: 'cancelled' }], nextSyncToken: 'tok2' });
    await syncAll({ api, cache, now: () => NOW }, []);
    expect([...cache.events.values()].some((e) => e.calendarId === 'a' && e.id === 'e1')).toBe(false);
  });

  it('wipes and fully resyncs on 410 Gone', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, []);
    api.listEvents.mockReset();
    api.listEvents
      .mockRejectedValueOnce(new ApiError(410, 'fullSyncRequired', 'gone'))
      .mockResolvedValue({ events: [timed('fresh')], nextSyncToken: 'tokNew' });
    await syncAll({ api, cache, now: () => NOW }, ['b']);
    expect([...cache.events.values()].filter((e) => e.calendarId === 'a').map((e) => e.id)).toEqual(['fresh']);
    expect(cache.metas.get('a')?.syncToken).toBe('tokNew');
  });

  it('skips disabled calendars', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, ['b']);
    expect(api.listEvents.mock.calls.map((c) => c[0])).toEqual(['a']);
  });

  it('drops cached data for calendars that no longer exist', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    await syncAll({ api, cache, now: () => NOW }, []);
    api.listCalendars = async () => [{ id: 'a', summary: 'A' }];
    await syncAll({ api, cache, now: () => NOW }, []);
    expect([...cache.events.values()].some((e) => e.calendarId === 'b')).toBe(false);
    expect(cache.cals.has('b')).toBe(false);
  });

  it('records a per-calendar failure but still syncs the rest', async () => {
    const cache = memoryCache();
    const api = fakeApi();
    api.listEvents.mockImplementation(async (id: string) => {
      if (id === 'a') throw new ApiError(500, undefined, 'boom');
      return { events: [timed('ok')], nextSyncToken: 't' };
    });
    const result = await syncAll({ api, cache, now: () => NOW }, []);
    expect(result.failures).toEqual([{ calendarId: 'a', message: 'boom' }]);
    expect(cache.metas.get('b')?.syncToken).toBe('t');
  });

  it('aborts on an auth error', async () => {
    const api = fakeApi();
    api.listEvents.mockRejectedValue(new AuthError('expired', 'sign in'));
    await expect(syncAll({ api, cache: memoryCache(), now: () => NOW }, [])).rejects.toMatchObject({ code: 'expired' });
  });
});

describe('needsFullSync', () => {
  const meta = (from: string, to: string, token = 't', schema = SYNC_SCHEMA) => ({ calendarId: 'a', syncToken: token, schema, windowFrom: from, windowTo: to });
  it('is true without a token, false with a fresh window, true once the window has drifted', () => {
    expect(needsFullSync(undefined, NOW)).toBe(true);
    expect(needsFullSync({ calendarId: 'a', windowFrom: '', windowTo: '' }, NOW)).toBe(true);
    expect(needsFullSync(meta('2026-10-05T00:00:00Z', '2027-03-04T00:00:00Z'), NOW)).toBe(false);
    expect(needsFullSync(meta('2026-08-01T00:00:00Z', '2026-12-01T00:00:00Z'), NOW)).toBe(true);
  });
  it('is true when the cache was built by an older sync schema', () => {
    expect(needsFullSync(meta('2026-10-05T00:00:00Z', '2027-03-04T00:00:00Z', 't', SYNC_SCHEMA - 1), NOW)).toBe(true);
  });
});
