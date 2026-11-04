import { addMinutes } from 'date-fns';
import { formatDayIn, formatTimeIn, inWorkingHours, zoneAbbr, zoneLabel } from '../time/zones';

export interface MeetingInput {
  title: string;
  start: Date;
  durationMinutes: number;
  attendees: string[];
  /** Free text from you; the per-zone times are appended when `zones` is set. */
  notes?: string;
  /** Zones whose local times are written into the invitation, so customers see their own time. */
  zones?: string[];
  /** Zone the event is stored in on Google's side (yours). */
  timeZone: string;
  /** Idempotency key for the Meet creation request. */
  requestId: string;
}

const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

export const isEmail = (s: string) => EMAIL.test(s);

/** Splits pasted text on spaces, commas and semicolons, lower-cases and removes duplicates. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    // "Name <a@b.com>" pastes leave angle brackets behind.
    const token = raw.replace(/^<|>$/g, '').toLowerCase();
    if (!token) continue;
    if (!isEmail(token)) invalid.push(raw);
    else if (!valid.includes(token)) valid.push(token);
  }
  return { valid, invalid };
}

/** One line per zone, e.g. "New York: Thu 5 Nov, 9am – 9:30am EST". */
export function zoneTimesText(start: Date, end: Date, zones: string[]): string {
  return zones
    .map((z) => `${zoneLabel(z)}: ${formatDayIn(start, z)}, ${formatTimeIn(start, z)} – ${formatTimeIn(end, z)} ${zoneAbbr(start, z)}`)
    .join('\n');
}

/** Is the whole meeting inside working hours in this zone? */
export function fitsWorkingHours(start: Date, durationMinutes: number, zone: string, hours: { start: string; end: string }): boolean {
  return inWorkingHours(start, zone, hours) && inWorkingHours(addMinutes(start, durationMinutes - 1), zone, hours);
}

/** The events.insert request body. Pure, so it can be tested without Google. */
export function buildMeetingBody(m: MeetingInput) {
  const end = addMinutes(m.start, m.durationMinutes);
  const parts: string[] = [];
  if (m.notes?.trim()) parts.push(m.notes.trim());
  if (m.zones?.length) parts.push(`Meeting time\n${zoneTimesText(m.start, end, m.zones)}`);
  return {
    summary: m.title.trim(),
    ...(parts.length ? { description: parts.join('\n\n') } : {}),
    start: { dateTime: m.start.toISOString(), timeZone: m.timeZone },
    end: { dateTime: end.toISOString(), timeZone: m.timeZone },
    attendees: m.attendees.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: m.requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
  };
}
