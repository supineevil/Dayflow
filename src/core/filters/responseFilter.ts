import type { CalendarEvent, ResponseFilter, ResponseStatus } from '@/core/models';

/**
 * Events with no invitation (ones you made yourself, holidays, birthdays) have no
 * `selfResponse`. They sit on your calendar unconditionally, so they count as "Yes".
 */
export const effectiveResponse = (e: CalendarEvent): ResponseStatus => e.selfResponse ?? 'accepted';

/** Display-only filter on your own RSVP. Never touches Google Calendar. */
export function filterByResponse(events: CalendarEvent[], filter: ResponseFilter): CalendarEvent[] {
  return filter === 'all' ? events : events.filter((e) => effectiveResponse(e) === filter);
}
