import { addMinutes } from 'date-fns';
import type { CalendarEvent, ResponseStatus } from '../models';
import { eventEnd, eventStart } from '../time/eventTime';
import { AuthError } from './auth';
import { ApiError } from './calendarApi';
import type { GoogleAttendee } from './types';

/** You can change events you organize. All-day events are left to Google Calendar. */
export const canEditEvent = (e: CalendarEvent) => !!e.organizerIsSelf && !e.isAllDay && e.status !== 'cancelled';
export const canCancelEvent = (e: CalendarEvent) => !!e.organizerIsSelf && e.status !== 'cancelled';
/** You can answer, or remove, an event you were invited to. Someone else's event on a calendar you merely follow stays read-only. */
export const canRespond = (e: CalendarEvent) => !e.organizerIsSelf && e.selfResponse !== undefined && e.status !== 'cancelled';

/** Guests you may add or remove: not you (the organizer) and not rooms or other resources. */
export const isGuest = (a: GoogleAttendee) => !a.organizer && !a.resource && !!a.email;

/**
 * Google's patch replaces the whole attendee list, so we start from the live list and keep every
 * entry (with its response and flags) unless it is one of the guests being removed.
 */
export function changeAttendees(current: GoogleAttendee[], add: string[], remove: string[]): GoogleAttendee[] {
  const drop = new Set(remove.map((e) => e.toLowerCase()));
  const kept = current.filter((a) => !(isGuest(a) && drop.has(a.email!.toLowerCase())));
  const have = new Set(kept.map((a) => a.email?.toLowerCase()));
  const added: GoogleAttendee[] = [];
  for (const raw of add) {
    const email = raw.toLowerCase();
    if (have.has(email)) continue;
    have.add(email);
    added.push({ email });
  }
  return [...kept, ...added];
}

/** Sets your own response in the full list. Null when you are not on it. */
export function withResponse(current: GoogleAttendee[], response: ResponseStatus): GoogleAttendee[] | null {
  if (!current.some((a) => a.self)) return null;
  return current.map((a) => (a.self ? { ...a, responseStatus: response } : a));
}

export interface EditForm {
  title: string;
  start: Date;
  durationMinutes: number;
  timeZone: string;
  /** The complete new guest list, only when guests were added or removed. */
  attendees?: GoogleAttendee[];
}

/**
 * Only the fields that actually changed. Re-sending an unchanged time could reset guests' responses
 * or trigger a "time changed" email, so untouched fields are left out.
 */
export function buildEditPatch(original: CalendarEvent, f: EditForm) {
  const patch: Record<string, unknown> = {};
  const title = f.title.trim();
  if (title && title !== original.title) patch.summary = title;

  const oldStart = eventStart(original).getTime();
  const oldDuration = Math.round((eventEnd(original).getTime() - oldStart) / 60_000);
  if (f.start.getTime() !== oldStart || f.durationMinutes !== oldDuration) {
    patch.start = { dateTime: f.start.toISOString(), timeZone: f.timeZone };
    patch.end = { dateTime: addMinutes(f.start, f.durationMinutes).toISOString(), timeZone: f.timeZone };
  }
  if (f.attendees) patch.attendees = f.attendees;
  return patch;
}

export interface WriteFailure {
  message: string;
  needsReconnect: boolean;
}

export function describeWriteError(err: unknown): WriteFailure {
  if (err instanceof AuthError || (err instanceof ApiError && err.isInsufficientScope)) {
    return { message: 'Dayflow needs permission to change events. Reconnect Google and approve it.', needsReconnect: true };
  }
  if (err instanceof ApiError && err.status === 403) {
    return { message: "Google won't let you change this event. You may not own its calendar, or the organizer restricts changes.", needsReconnect: false };
  }
  if (err instanceof ApiError && err.status === 404) {
    return { message: 'Google could not find this event. It may have been deleted already.', needsReconnect: false };
  }
  return { message: err instanceof Error ? err.message : 'Something went wrong. Nothing was changed.', needsReconnect: false };
}
