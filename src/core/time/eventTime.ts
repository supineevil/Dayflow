import { addDays, isBefore, parseISO, startOfDay } from 'date-fns';
import type { CalendarEvent } from '@/core/models';
import { systemZone, zonedDayEnd, zonedDayStart } from './zones';

/** All-day values are `yyyy-MM-dd`; parseISO reads those as local midnight, which is what we want. */
export function eventStart(e: CalendarEvent): Date {
  return parseISO(e.start);
}

/** For all-day events this is the exclusive end (local midnight of the day after the last day). */
export function eventEnd(e: CalendarEvent): Date {
  return parseISO(e.end);
}

export function durationMinutes(e: CalendarEvent): number {
  return Math.max(0, Math.round((eventEnd(e).getTime() - eventStart(e).getTime()) / 60_000));
}

/**
 * True if the event overlaps any part of the calendar day `day`, read in `zone`. All-day events are dates, not
 * moments, so they belong to the same day in every zone.
 */
export function occursOnDay(e: CalendarEvent, day: Date, zone: string = systemZone()): boolean {
  return overlapsDay(e, day, e.isAllDay ? null : { start: zonedDayStart(day, zone), end: zonedDayEnd(day, zone) });
}

function overlapsDay(e: CalendarEvent, day: Date, bounds: { start: Date; end: Date } | null): boolean {
  const start = eventStart(e);
  const end = eventEnd(e);
  if (e.isAllDay || !bounds) {
    const dayStart = startOfDay(day);
    return !isBefore(dayStart, start) && isBefore(dayStart, end);
  }
  // A zero-length event still belongs to the day it starts on.
  return start < bounds.end && (end > bounds.start || start >= bounds.start);
}

export function eventsOnDay(events: CalendarEvent[], day: Date, zone: string = systemZone()): CalendarEvent[] {
  const bounds = { start: zonedDayStart(day, zone), end: zonedDayEnd(day, zone) };
  return events.filter((e) => overlapsDay(e, day, e.isAllDay ? null : bounds)).sort(compareEvents);
}

/** All-day first, then by start time, then by title. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
  const diff = eventStart(a).getTime() - eventStart(b).getTime();
  return diff !== 0 ? diff : a.title.localeCompare(b.title);
}

export function groupByDay(events: CalendarEvent[], from: Date, days: number, zone: string = systemZone()): { day: Date; events: CalendarEvent[] }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(startOfDay(from), i);
    return { day, events: eventsOnDay(events, day, zone) };
  });
}

/**
 * How a timed event meets the calendar day `day` (read in `zone`): did it begin on an earlier day, and does it run
 * on into a later one? Lets a view say "started yesterday" instead of showing an unexplained row.
 */
export function daySpill(e: CalendarEvent, day: Date, zone: string = systemZone()): { fromEarlier: boolean; intoLater: boolean } {
  if (e.isAllDay) return { fromEarlier: false, intoLater: false };
  return { fromEarlier: eventStart(e) < zonedDayStart(day, zone), intoLater: eventEnd(e) > zonedDayEnd(day, zone) };
}
