import { createStore } from '../storage/store';

/** What the background reminder check last did. Shown in Settings so a missing reminder can be diagnosed. */
export interface ReminderStatus {
  lastCheckedAt: number | null;
  /** Events in the local cache that were considered (after hide rules). */
  considered: number;
  /** The next meeting a reminder is waiting for. */
  next: { title: string; start: string; reason: string } | null;
  lastShownAt: number | null;
  lastError: string | null;
}

export const reminderStatusStore = createStore<ReminderStatus>('dayflow:reminder-status', {
  lastCheckedAt: null,
  considered: 0,
  next: null,
  lastShownAt: null,
  lastError: null,
});
