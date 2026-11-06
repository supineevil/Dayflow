import type { CalendarEvent } from '@/core/models';
import { eventEnd, eventStart } from '@/core/time/eventTime';
import { formatTimeIn } from '@/core/time/zones';

/** Clock time of an instant as it reads in `zone`. */
export function formatTime(date: Date, zone: string): string {
  return formatTimeIn(date, zone);
}

export function formatRange(e: CalendarEvent, zone: string): string {
  if (e.isAllDay) return 'All day';
  return `${formatTime(eventStart(e), zone)} – ${formatTime(eventEnd(e), zone)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "in 12 min", "in 1h 5m", "now" */
export function countdown(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins === 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  return `in ${formatDuration(mins)}`;
}
