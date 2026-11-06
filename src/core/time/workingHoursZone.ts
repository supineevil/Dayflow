import { addDays } from 'date-fns';
import type { WorkingHours } from '@/core/models';
import { dayFromKey, dayKeyIn, dayKeyOf, hhmm, minutesInZone, zonedTimeToDate } from './zones';

/**
 * Re-expresses working hours (wall-clock times) from one zone in another, keeping the same
 * moments in time. Uses the date `at` in `from` so daylight saving is the one in force now.
 * The result may run past midnight (for example 09:00 to 17:30 in Kolkata is 22:30 to 07:00 in New York).
 */
export function convertWorkingHours(hours: WorkingHours, from: string, to: string, at: Date): WorkingHours {
  if (from === to) return hours;
  const key = dayKeyIn(at, from);
  const start = zonedTimeToDate(key, hours.start, from);
  let end = zonedTimeToDate(key, hours.end, from);
  if (end <= start) end = zonedTimeToDate(dayKeyOf(addDays(dayFromKey(key), 1)), hours.end, from);
  return { start: hhmm(minutesInZone(start, to)), end: hhmm(minutesInZone(end, to)) };
}
