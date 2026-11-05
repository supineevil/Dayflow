import { format } from 'date-fns';
import type { CalendarEvent } from '../models';
import { eventStart } from '../time/eventTime';

export const DEFAULT_REMINDER_LEAD = 5;
export const REMINDER_LEAD_OPTIONS = [1, 2, 5, 10, 15, 30] as const;

/** Whatever was stored (old versions, bad data) becomes a whole number of minutes between 1 and 60. */
export function clampLead(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_REMINDER_LEAD;
  return Math.min(60, Math.max(1, n));
}

/**
 * Only meetings you said Yes to, or ones you organise yourself. An event with no response from you that someone else
 * owns (a mailing-list invite, a shared calendar, a holiday) gets no reminder: Google gives no sign you agreed to it.
 */
export const wantsReminder = (e: CalendarEvent): boolean =>
  e.selfResponse === 'accepted' || (e.selfResponse === undefined && e.organizerIsSelf === true);

/** Why an event qualifies, for the Settings status line. */
export const reminderReason = (e: CalendarEvent): string => (e.selfResponse === 'accepted' ? 'you said Yes' : 'you organise it');

/** Timed, not cancelled, and accepted: the events a reminder can be for, soonest first. */
export function reminderCandidates(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((e) => !e.isAllDay && e.status !== 'cancelled' && wantsReminder(e))
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());
}

/** Same event, same start: one reminder. A moved event gets a new key, so it is reminded again. */
export const reminderKey = (e: CalendarEvent): string => `${e.calendarId}\u0000${e.id}\u0000${e.start}`;

/** Reminders already shown, key to the event's start time (ms), so old ones can be forgotten. */
export type NotifiedMap = Record<string, number>;

/**
 * Accepted timed events that start within `leadMinutes` from now and haven't been reminded yet.
 * Events that already started are skipped, so reconnecting or changing the setting never fires stale reminders.
 */
export function dueReminders(events: CalendarEvent[], now: Date, leadMinutes: number, notified: NotifiedMap): CalendarEvent[] {
  const horizon = now.getTime() + clampLead(leadMinutes) * 60_000;
  return reminderCandidates(events).filter((e) => {
    const start = eventStart(e).getTime();
    return start > now.getTime() && start <= horizon && !(reminderKey(e) in notified);
  });
}

/** Drops entries for events that started more than an hour ago. */
export function pruneNotified(notified: NotifiedMap, now: Date): NotifiedMap {
  const cutoff = now.getTime() - 60 * 60_000;
  return Object.fromEntries(Object.entries(notified).filter(([, start]) => start >= cutoff));
}

export function markNotified(notified: NotifiedMap, events: CalendarEvent[]): NotifiedMap {
  const next = { ...notified };
  for (const e of events) next[reminderKey(e)] = eventStart(e).getTime();
  return next;
}

export function reminderText(e: CalendarEvent, now: Date): { title: string; message: string } {
  const start = eventStart(e);
  const minutes = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / 60_000));
  const when = `Starts in ${minutes} min (${format(start, 'p')})`;
  return { title: e.title || '(No title)', message: e.location ? `${when} · ${e.location}` : when };
}

const ID_PREFIX = 'dayflow-reminder:';

/** The notification id carries the event, so a click can find it again without any saved state. */
export const notificationId = (e: Pick<CalendarEvent, 'calendarId' | 'id'>): string =>
  `${ID_PREFIX}${encodeURIComponent(e.calendarId)}:${encodeURIComponent(e.id)}`;

export function parseNotificationId(id: string): { calendarId: string; id: string } | null {
  if (!id.startsWith(ID_PREFIX)) return null;
  const [calendarId, eventId, ...rest] = id.slice(ID_PREFIX.length).split(':');
  if (!calendarId || !eventId || rest.length) return null;
  try {
    return { calendarId: decodeURIComponent(calendarId), id: decodeURIComponent(eventId) };
  } catch {
    return null;
  }
}

/** Only https links are opened from a notification. */
export const safeLink = (url: string | undefined): string | undefined => (url && /^https:\/\//i.test(url) ? url : undefined);
