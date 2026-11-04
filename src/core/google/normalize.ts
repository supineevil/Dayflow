import type { CalendarEvent, ResponseStatus } from '../models/event';
import type { GoogleEvent } from './types';

interface CalendarRef {
  id: string;
  name: string;
  color: string;
}

const MEETING_LINK = /https?:\/\/(?:[\w-]+\.)*(?:zoom\.us|zoomgov\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com)\/[^\s<>"')]+/i;
const RESPONSES: readonly string[] = ['accepted', 'declined', 'tentative', 'needsAction'];
const MAX_DESCRIPTION = 4000;

/** Google descriptions may contain HTML. Reduce them to plain text; the UI never renders HTML. */
export function htmlToText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

export function findMeetingLink(g: GoogleEvent): string | undefined {
  const video = g.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video' && p.uri);
  if (video?.uri) return video.uri;
  if (g.hangoutLink) return g.hangoutLink;
  return `${g.location ?? ''} ${g.description ?? ''}`.match(MEETING_LINK)?.[0];
}

/**
 * Converts one API event. Returns null for entries we cannot place on a timeline.
 * Cancelled events are returned with status "cancelled" so the caller can delete them from the cache.
 */
export function normalizeEvent(g: GoogleEvent, cal: CalendarRef): CalendarEvent | null {
  if (!g.id || !g.start || !g.end) {
    // Cancelled tombstones from incremental sync carry only an id, which is all the caller needs.
    return g.id && g.status === 'cancelled'
      ? {
          id: g.id, calendarId: cal.id, calendarName: cal.name, title: '', start: '', end: '', isAllDay: false,
          color: cal.color, visibility: 'default', status: 'cancelled',
        }
      : null;
  }
  const isAllDay = !!g.start.date && !g.start.dateTime;
  const start = isAllDay ? g.start.date : g.start.dateTime;
  const end = isAllDay ? g.end.date : g.end.dateTime;
  if (!start || !end) return null;

  const self = g.attendees?.find((a) => a.self)?.responseStatus;
  const description = g.description ? htmlToText(g.description) : undefined;

  return {
    id: g.id,
    calendarId: cal.id,
    calendarName: cal.name,
    // Events you can only see as busy (other people's private events) arrive without a title.
    title: g.summary?.trim() || 'Busy',
    description: description || undefined,
    start,
    end,
    isAllDay,
    location: g.location?.trim() || undefined,
    meetingLink: findMeetingLink(g),
    color: cal.color,
    recurringEventId: g.recurringEventId,
    visibility: g.visibility ?? 'default',
    status: g.status ?? 'confirmed',
    selfResponse: self && RESPONSES.includes(self) ? (self as ResponseStatus) : undefined,
    htmlLink: g.htmlLink,
    organizerEmail: g.organizer?.email?.toLowerCase(),
    organizerName: g.organizer?.displayName,
    organizerIsSelf: g.organizer?.self,
    creatorEmail: g.creator?.email?.toLowerCase(),
  };
}
