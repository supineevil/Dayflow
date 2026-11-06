import { addDays, format, isSameDay } from 'date-fns';
import { useMemo } from 'react';
import type { CalendarEvent } from '@/core/models';
import { groupByDay } from '@/core/time/eventTime';
import { useToday } from '@/app/hooks/useHomeZone';
import { AllDayStrip } from '@/app/components/AllDayStrip';
import { EventRow } from '@/app/components/EventRow';

const DAYS_AHEAD = 14;

function dayLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return 'Today';
  if (isSameDay(day, addDays(today, 1))) return 'Tomorrow';
  return format(day, 'EEEE');
}

export function AgendaView({ events, now }: { events: CalendarEvent[]; now: Date }) {
  const { zone, today } = useToday(now);
  const groups = useMemo(
    () => groupByDay(events, today, DAYS_AHEAD, zone).filter((g) => g.events.length > 0),
    [events, today, zone],
  );

  if (groups.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted">Nothing in the next {DAYS_AHEAD} days.</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-base font-semibold">Agenda</h1>
      {groups.map(({ day, events: dayEvents }) => (
        <section key={day.toISOString()} aria-label={format(day, 'EEEE d MMMM')}>
          <h2 className="mb-1.5 flex items-baseline gap-2 px-2">
            <span className="text-[13px] font-semibold">{dayLabel(day, today)}</span>
            <span className="text-xs text-subtle">{format(day, 'd MMM')}</span>
          </h2>
          <div className="space-y-1">
            <div className="px-2">
              <AllDayStrip events={dayEvents.filter((e) => e.isAllDay)} />
            </div>
            {dayEvents
              .filter((e) => !e.isAllDay)
              .map((e) => (
                <EventRow key={`${e.calendarId}:${e.id}`} event={e} now={now} day={day} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
