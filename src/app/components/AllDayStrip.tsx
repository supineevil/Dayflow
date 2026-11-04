import type { CalendarEvent } from '@/core/models';

export function AllDayStrip({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-label="All-day events" className="flex flex-wrap gap-1.5">
      {events.map((e) => (
        <span
          key={`${e.calendarId}:${e.id}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
        >
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
          <span className="truncate">{e.title}</span>
        </span>
      ))}
    </section>
  );
}
