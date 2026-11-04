import { addDays, endOfDay, isBefore, parseISO, startOfDay } from 'date-fns';
import type { CalendarEvent } from '@/core/models';

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

/** True if the event overlaps any part of the local calendar day containing `day`. */
export function occursOnDay(e: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const start = eventStart(e);
  const end = eventEnd(e);
  if (e.isAllDay) return !isBefore(dayStart, start) && isBefore(dayStart, end);
  // A zero-length event still belongs to the day it starts on.
  return start <= dayEnd && (end > dayStart || start >= dayStart);
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => occursOnDay(e, day)).sort(compareEvents);
}

/** All-day first, then by start time, then by title. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
  const diff = eventStart(a).getTime() - eventStart(b).getTime();
  return diff !== 0 ? diff : a.title.localeCompare(b.title);
}

export function groupByDay(events: CalendarEvent[], from: Date, days: number): { day: Date; events: CalendarEvent[] }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(startOfDay(from), i);
    return { day, events: eventsOnDay(events, day) };
  });
}
