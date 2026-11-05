import { accountStore } from '../core/google/accountStore';
import { AuthError } from '../core/google/auth';
import { ApiError, listCalendars, listEvents } from '../core/google/calendarApi';
import { prefsStore } from '../core/storage/prefsStore';
import { idbEventCache } from '../core/storage/eventCache';
import { syncAll } from '../core/sync/syncService';
import { syncStore } from '../core/sync/syncStatus';
import { eventStart } from '../core/time/eventTime';
import { reminderStatusStore } from '../core/notify/reminderStatus';
import { applyFilters } from '../core/filters/filterEngine';
import {
  dueReminders, markNotified, notificationId, parseNotificationId, pruneNotified, reminderCandidates, reminderKey, reminderReason, reminderText, safeLink,
  type NotifiedMap,
} from '../core/notify/reminders';

const ALARM = 'dayflow-sync';
const REMIND_ALARM = 'dayflow-remind';
const NOTIFIED_KEY = 'dayflow:notified';
const JOIN_BUTTON = 0;
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

async function readNotified(): Promise<NotifiedMap> {
  const stored = (await chrome.storage.session.get(NOTIFIED_KEY))[NOTIFIED_KEY];
  return stored && typeof stored === 'object' ? (stored as NotifiedMap) : {};
}

let checking = false;

/** Shows a notification for each meeting starting within the lead time. Reads only the local cache. */
async function checkReminders(): Promise<void> {
  if (checking) return;
  checking = true;
  const setStatus = (patch: Partial<ReturnType<typeof reminderStatusStore.get>>) => reminderStatusStore.update((s) => ({ ...s, ...patch }));
  try {
    await Promise.all([prefsStore.ready, reminderStatusStore.ready]);
    const prefs = prefsStore.get();
    if (!prefs.remindersEnabled) return;
    if (!chrome.notifications) throw new Error('Notifications permission is missing. Reload the extension at chrome://extensions.');
    const now = new Date();
    const notified = pruneNotified(await readNotified(), now);
    const { visible } = applyFilters(await idbEventCache.getAllEvents(), prefs, now);
    const due = dueReminders(visible, now, prefs.reminderLeadMinutes, notified);
    let shown = 0;
    let failure: string | null = null;
    for (const e of due) {
      const { title, message } = reminderText(e, now);
      try {
        await chrome.notifications.create(notificationId(e), {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title,
          message,
          requireInteraction: true,
          buttons: safeLink(e.meetingLink) ? [{ title: 'Join meeting' }] : [],
        });
        shown++;
      } catch (err) {
        failure = err instanceof Error ? err.message : 'Could not show the notification.';
      }
    }
    // Only meetings that actually showed are marked, so a failure is retried on the next check.
    await chrome.storage.session.set({ [NOTIFIED_KEY]: markNotified(notified, failure ? [] : due) });
    const waiting = reminderCandidates(visible).find((e) => eventStart(e) > now && !(reminderKey(e) in notified) && !due.includes(e));
    setStatus({
      lastCheckedAt: now.getTime(),
      considered: visible.length,
      next: waiting ? { title: waiting.title, start: waiting.start, reason: reminderReason(waiting) } : null,
      lastShownAt: shown ? now.getTime() : reminderStatusStore.get().lastShownAt,
      lastError: failure,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Dayflow reminder check failed:', message);
    setStatus({ lastCheckedAt: Date.now(), lastError: message });
  } finally {
    checking = false;
  }
}

/** One check a minute. Left alone if it already exists so a restarting worker doesn't push the next check back. */
async function ensureReminderAlarm() {
  if (!(await chrome.alarms.get(REMIND_ALARM))) await chrome.alarms.create(REMIND_ALARM, { periodInMinutes: 1 });
}

async function findEvent(id: string) {
  const ref = parseNotificationId(id);
  if (!ref) return undefined;
  return (await idbEventCache.getAllEvents()).find((e) => e.calendarId === ref.calendarId && e.id === ref.id);
}

chrome.notifications?.onButtonClicked.addListener((id, index) => {
  if (index !== JOIN_BUTTON) return;
  void findEvent(id).then((e) => {
    const link = safeLink(e?.meetingLink);
    if (link) void chrome.tabs.create({ url: link });
    chrome.notifications.clear(id);
  });
});

chrome.notifications?.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  // Opening the side panel needs a user gesture; if Chrome doesn't count this click, fall back to the event page.
  void chrome.windows.getLastFocused().then(async (win) => {
    try {
      if (win.id === undefined) throw new Error('no window');
      await chrome.sidePanel.open({ windowId: win.id });
    } catch {
      const link = safeLink((await findEvent(id))?.htmlLink);
      if (link) void chrome.tabs.create({ url: link });
    }
  });
});

async function scheduleAlarm() {
  await prefsStore.ready;
  const minutes = Math.max(1, prefsStore.get().refreshIntervalMinutes);
  await chrome.alarms.create(ALARM, { periodInMinutes: minutes });
  await ensureReminderAlarm();
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if ((msg as { type?: string } | null)?.type !== SYNC_MESSAGE) return false;
  void sync().then(checkReminders).then(() => sendResponse({ ok: true }));
  return true; // async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void sync().then(checkReminders);
  if (alarm.name === REMIND_ALARM) void checkReminders();
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
  if (next.remindersEnabled && !lastPrefs.remindersEnabled) void checkReminders();
  lastPrefs = next;
});

// Alarms survive worker restarts, but make sure the reminder alarm exists after an update too.
void ensureReminderAlarm();
// Refresh the status straight away rather than waiting for the first alarm.
void checkReminders();
