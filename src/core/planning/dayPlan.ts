import { addDays, addMinutes, differenceInMinutes, max as maxDate, min as minDate } from 'date-fns';
import type { CalendarEvent, Task, WorkingHours } from '@/core/models';
import { durationMinutes, eventEnd, eventStart } from '@/core/time/eventTime';
import { dayKeyOf, systemZone, zonedTimeToDate } from '@/core/time/zones';

export interface Interval {
  start: Date;
  end: Date;
}

/** Working hours on `day`, with the hours read as wall-clock time in `zone`. */
export function workingInterval(day: Date, hours: WorkingHours, zone: string = systemZone()): Interval {
  const start = zonedTimeToDate(dayKeyOf(day), hours.start, zone);
  const end = zonedTimeToDate(dayKeyOf(day), hours.end, zone);
  // A shift that ends after midnight belongs to the day it starts on.
  return { start, end: end <= start ? zonedTimeToDate(dayKeyOf(addDays(day, 1)), hours.end, zone) : end };
}

/** Merges overlapping or touching intervals. Input need not be sorted. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = maxDate([last.end, iv.end]);
    else merged.push({ start: iv.start, end: iv.end });
  }
  return merged;
}

function timedBusy(events: CalendarEvent[]): Interval[] {
  return mergeIntervals(
    events.filter((e) => !e.isAllDay).map((e) => ({ start: eventStart(e), end: eventEnd(e) })),
  );
}

/** Free gaps inside working hours, ignoring gaps shorter than `minMinutes`. */
export function freeSlots(events: CalendarEvent[], day: Date, hours: WorkingHours, minMinutes = 15, zone: string = systemZone()): Interval[] {
  const work = workingInterval(day, hours, zone);
  const slots: Interval[] = [];
  let cursor = work.start;
  for (const busy of timedBusy(events)) {
    if (busy.end <= work.start || busy.start >= work.end) continue;
    if (busy.start > cursor) slots.push({ start: cursor, end: minDate([busy.start, work.end]) });
    cursor = maxDate([cursor, busy.end]);
  }
  if (cursor < work.end) slots.push({ start: cursor, end: work.end });
  return slots.filter((s) => differenceInMinutes(s.end, s.start) >= minMinutes);
}

export interface DayStats {
  eventCount: number;
  meetingMinutes: number;
  freeMinutes: number;
  /** 0..1 share of working hours that has elapsed. */
  progress: number;
  /** Booked share of working hours, 0..1+ */
  load: number;
}

/** Pass only visible (non-hidden) events: hidden events don't count towards any metric. */
export function dayStats(events: CalendarEvent[], day: Date, hours: WorkingHours, now: Date, zone: string = systemZone()): DayStats {
  const work = workingInterval(day, hours, zone);
  const workMinutes = Math.max(1, differenceInMinutes(work.end, work.start));
  const timed = events.filter((e) => !e.isAllDay);
  const meetingMinutes = timed.reduce((sum, e) => sum + durationMinutes(e), 0);

  // Busy time clipped to working hours, so a 7am call doesn't shrink free time.
  const busyInWork = timedBusy(events).reduce((sum, iv) => {
    const s = maxDate([iv.start, work.start]);
    const e = minDate([iv.end, work.end]);
    return sum + Math.max(0, differenceInMinutes(e, s));
  }, 0);

  const elapsed = Math.min(workMinutes, Math.max(0, differenceInMinutes(now, work.start)));
  return {
    eventCount: events.length,
    meetingMinutes,
    freeMinutes: Math.max(0, workMinutes - busyInWork),
    progress: elapsed / workMinutes,
    load: busyInWork / workMinutes,
  };
}

/** Back-to-back meetings with no gap, or more than `thresholdMinutes` booked in a row. */
export function overloadedBlocks(events: CalendarEvent[], thresholdMinutes = 180): Interval[] {
  return timedBusy(events).filter((iv) => differenceInMinutes(iv.end, iv.start) >= thresholdMinutes);
}

export function plannedInterval(task: Task): Interval | null {
  if (!task.plannedStart) return null;
  const start = new Date(task.plannedStart);
  return { start, end: addMinutes(start, task.estimatedMinutes ?? 30) };
}
