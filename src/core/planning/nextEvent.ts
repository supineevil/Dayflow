import type { CalendarEvent } from '../models';
import { effectiveResponse } from '../filters/responseFilter';
import { eventEnd, eventStart } from '../time/eventTime';

/** You're expected at it: Yes, Maybe, or not answered yet. Events you declined are not. */
export const isAttending = (e: CalendarEvent): boolean => effectiveResponse(e) !== 'declined';

/** Events you still need to answer. */
export const needsReply = (e: CalendarEvent): boolean => e.selfResponse === 'needsAction';

/** Timed events still to come today that you haven't declined, soonest first. */
export function upcomingAttending(events: CalendarEvent[], now: Date): CalendarEvent[] {
  return events
    .filter((e) => !e.isAllDay && isAttending(e) && eventEnd(e) > now)
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());
}

/** The event in progress, or else the soonest upcoming one, ignoring anything you declined. */
export const pickNextEvent = (events: CalendarEvent[], now: Date): CalendarEvent | undefined => upcomingAttending(events, now)[0];
