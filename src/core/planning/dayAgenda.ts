import type { CalendarEvent } from '../models';
import { eventsOnDay, eventStart } from '../time/eventTime';
import { isAttending } from './nextEvent';

/** What you're doing on `day`: all-day items and timed events in order, without anything you declined. */
export function dayAgenda(events: CalendarEvent[], day: Date): { allDay: CalendarEvent[]; timed: CalendarEvent[] } {
  const mine = eventsOnDay(events, day).filter(isAttending);
  return {
    allDay: mine.filter((e) => e.isAllDay),
    timed: mine.filter((e) => !e.isAllDay).sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()),
  };
}
