import { format } from 'date-fns';
import type { WorkingHours } from '../models';
import { minuteInHours } from '../time/zones';

export type DayPhase = 'early' | 'working' | 'late';

const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Where `now` falls relative to the working hours from Settings. The end of the day is exclusive, like the rest of the app. */
export function dayPhase(now: Date, hours: WorkingHours): DayPhase {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minuteInHours(minutes, hours)) return 'working';
  return minutes < toMinutes(hours.start) ? 'early' : 'late';
}

export const GREETINGS: Record<DayPhase, readonly string[]> = {
  early: ['Why so early?', 'Early bird mode', 'Coffee first, calendar second', 'Beat the inbox to it'],
  working: ['Grinding', 'In the zone', 'Let’s get through today', 'Heads down, calendar up'],
  late: ['Working late?', 'Overtime again?', 'Go home, the tasks will keep', 'After hours, are we?'],
};

/** Small stable hash so the line doesn't change every time the clock ticks. */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** One line per phase per day: stays put while you work, and changes tomorrow. */
export function greeting(now: Date, hours: WorkingHours): string {
  const phase = dayPhase(now, hours);
  const lines = GREETINGS[phase];
  return lines[hash(`${format(now, 'yyyy-MM-dd')}:${phase}`) % lines.length]!;
}
