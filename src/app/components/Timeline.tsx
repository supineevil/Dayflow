import { Fragment } from 'react';
import type { CalendarEvent } from '@/core/models';
import { eventStart } from '@/core/time/eventTime';
import { formatTimeIn } from '@/core/time/zones';
import { useHomeZone } from '@/app/hooks/useHomeZone';
import { EventRow } from './EventRow';

function NowLine({ now, zone }: { now: Date; zone: string }) {
  const label = formatTimeIn(now, zone);
  return (
    <div className="flex items-center gap-3 px-2 py-1" role="separator" aria-label={`Current time ${label}`}>
      <span className="w-[60px] whitespace-nowrap shrink-0 text-xs font-medium tabular-nums text-now">{label}</span>
      <span aria-hidden className="size-1.5 rounded-full bg-now" />
      <span aria-hidden className="h-px flex-1 bg-now/60" />
    </div>
  );
}

interface Props {
  events: CalendarEvent[];
  now: Date;
  onCompare?: (event: CalendarEvent) => void;
  /** Show the current-time marker (only when viewing today). */
  showNow: boolean;
  /** The day being listed, so events that cross midnight can say so. */
  day: Date;
}

export function Timeline({ events, now, showNow, day, onCompare }: Props) {
  const zone = useHomeZone();
  const timed = events.filter((e) => !e.isAllDay);
  if (timed.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
        <p className="text-[13px] font-medium">No events scheduled</p>
        <p className="mt-0.5 text-xs text-subtle">A clear day. Use it well.</p>
      </div>
    );
  }

  const nowIndex = showNow ? timed.findIndex((e) => eventStart(e) > now) : -1;
  const nowLineAtEnd = showNow && nowIndex === -1;

  return (
    <div className="space-y-px">
      {timed.map((e, i) => (
        <Fragment key={`${e.calendarId}:${e.id}`}>
          {showNow && nowIndex === i && <NowLine now={now} zone={zone} />}
          <EventRow event={e} now={now} day={day} onCompare={onCompare} />
        </Fragment>
      ))}
      {nowLineAtEnd && <NowLine now={now} zone={zone} />}
    </div>
  );
}
