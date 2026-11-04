import { format } from 'date-fns';
import type { CalendarEvent } from '@/core/models';
import { eventEnd, eventStart } from '@/core/time/eventTime';

export function formatTime(date: Date): string {
  return format(date, 'h:mm a').replace(':00 ', ' ').toLowerCase();
}

export function formatRange(e: CalendarEvent): string {
  if (e.isAllDay) return 'All day';
  return `${formatTime(eventStart(e))} – ${formatTime(eventEnd(e))}`;
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
