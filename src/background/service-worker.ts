import { accountStore } from '../core/google/accountStore';
import { AuthError } from '../core/google/auth';
import { ApiError, listCalendars, listEvents } from '../core/google/calendarApi';
import { prefsStore } from '../core/storage/prefsStore';
import { idbEventCache } from '../core/storage/eventCache';
import { syncAll } from '../core/sync/syncService';
import { syncStore } from '../core/sync/syncStatus';

const ALARM = 'dayflow-sync';
export const SYNC_MESSAGE = 'dayflow:sync';

let running: Promise<void> | null = null;

function bump() {
  syncStore.update((s) => ({ ...s, version: s.version + 1 }));
}

async function runSync(): Promise<void> {
  await Promise.all([accountStore.ready, prefsStore.ready, syncStore.ready]);
  if (!accountStore.get().signedIn) return;

  syncStore.update((s) => ({ ...s, state: 'syncing', error: null }));
  const loginHint = accountStore.get().email ?? undefined;
  try {
    const result = await syncAll(
      {
        api: { listCalendars: () => listCalendars(loginHint), listEvents: (id, opts) => listEvents(id, opts, loginHint) },
        cache: idbEventCache,
        onProgress: bump,
      },
      prefsStore.get().disabledCalendarIds,
    );
    // The primary calendar's id is the account's email address; used only as a sign-in hint and for display.
    if (result.primaryId && result.primaryId !== accountStore.get().email) {
      accountStore.update(() => ({ signedIn: true, email: result.primaryId ?? null }));
    }
    const failure = result.failures[0];
    syncStore.update((s) => ({
      ...s,
      state: failure ? 'error' : 'idle',
      lastSyncedAt: Date.now(),
      error: failure ? { code: 'partial', message: `${result.failures.length} calendar(s) failed to sync: ${failure.message}` } : null,
      version: s.version + 1,
    }));
  } catch (err) {
    const code = err instanceof AuthError ? err.code : err instanceof ApiError && err.isNetwork ? 'offline' : 'failed';
    const message = err instanceof Error ? err.message : 'Sync failed.';
    // Deliberately not logging event data; errors here carry only status text.
    console.error('Dayflow sync failed:', code, message);
    syncStore.update((s) => ({ ...s, state: 'error', error: { code, message } }));
  }
}

/** One sync at a time; concurrent callers share the in-flight run. */
function sync(): Promise<void> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function scheduleAlarm() {
  await prefsStore.ready;
  const minutes = Math.max(1, prefsStore.get().refreshIntervalMinutes);
  await chrome.alarms.create(ALARM, { periodInMinutes: minutes });
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if ((msg as { type?: string } | null)?.type !== SYNC_MESSAGE) return false;
  void sync().then(() => sendResponse({ ok: true }));
  return true; // async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void sync();
});

chrome.runtime.onInstalled.addListener(() => void scheduleAlarm());
chrome.runtime.onStartup.addListener(() => void scheduleAlarm());

// Re-time the alarm when the interval changes, and sync when a calendar is switched back on so it fills in.
let lastPrefs = prefsStore.get();
prefsStore.subscribe(() => {
  const next = prefsStore.get();
  if (next.refreshIntervalMinutes !== lastPrefs.refreshIntervalMinutes) void scheduleAlarm();
  const reEnabled = lastPrefs.disabledCalendarIds.some((id) => !next.disabledCalendarIds.includes(id));
  if (reEnabled) void sync();
  lastPrefs = next;
});
