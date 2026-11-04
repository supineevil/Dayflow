import { Video } from 'lucide-react';
import type { CalendarEvent } from '@/core/models';
import { eventEnd, eventStart } from '@/core/time/eventTime';
import { countdown, formatRange } from '@/app/lib/format';

/** The event in progress, or else the soonest upcoming timed event. */
export function pickNextEvent(events: CalendarEvent[], now: Date): CalendarEvent | undefined {
  return events
    .filter((e) => !e.isAllDay && eventEnd(e) > now)
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0];
}

export function NextEventCard({ event, now }: { event: CalendarEvent | undefined; now: Date }) {
  if (!event) {
    return (
      <section className="rounded-lg border border-border bg-surface p-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">Next up</div>
        <p className="mt-1 text-[13px] text-muted">Nothing else scheduled. Enjoy the quiet.</p>
      </section>
    );
  }

  const inProgress = eventStart(event) <= now;
  const when = inProgress ? `ends ${countdown(eventEnd(event).getTime() - now.getTime())}` : countdown(eventStart(event).getTime() - now.getTime());

  return (
    <section className="rounded-lg border border-border bg-surface p-3" aria-label="Next event">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">
          {inProgress ? 'Happening now' : 'Next up'}
        </div>
        <div className="text-xs font-medium tabular-nums text-accent">{when}</div>
      </div>
      <div className="mt-1.5 flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 h-9 w-[3px] shrink-0 rounded-full" style={{ background: event.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{event.title}</div>
          <div className="truncate text-xs text-muted">{formatRange(event)}</div>
        </div>
        {event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:opacity-90"
          >
            <Video className="size-3.5" /> Join
          </a>
        )}
      </div>
    </section>
  );
}
