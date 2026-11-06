import { differenceInMinutes, format, isSameDay } from 'date-fns';
import { useMemo, useState } from 'react';
import type { CalendarEvent } from '@/core/models';
import { eventsOnDay } from '@/core/time/eventTime';
import { dayKeyOf, minutesInZone, zonedDayStart } from '@/core/time/zones';
import { dayStats } from '@/core/planning/dayPlan';
import { compareTasks, isDueOn, isOverdue } from '@/core/tasks/taskStore';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useCompareZones } from '@/app/hooks/useZones';
import { useToday } from '@/app/hooks/useHomeZone';
import { useTasks } from '@/app/hooks/useTasks';
import { AllDayStrip } from '@/app/components/AllDayStrip';
import { DayStepper } from '@/app/components/DayStepper';
import { DayStatsBar } from '@/app/components/DayStatsBar';
import { NextEventCard } from '@/app/components/NextEventCard';
import { pickNextEvent } from '@/core/planning/nextEvent';
import { TaskList } from '@/app/components/TaskList';
import { TimezonePlanner } from '@/app/components/TimezonePlanner';
import { Timeline } from '@/app/components/Timeline';

interface Props {
  events: CalendarEvent[];
  now: Date;
  /** The day being viewed, as a date in the home time zone. */
  day: Date;
  onDayChange: (day: Date) => void;
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{children}</h2>;
}

const SLIDER_STEP = 15;
const snap = (minutes: number) => Math.min(1440 - SLIDER_STEP, Math.max(0, Math.round(minutes / SLIDER_STEP) * SLIDER_STEP));

export function TodayView({ events, now, day, onDayChange }: Props) {
  const { prefs } = usePrefs();
  const zones = useCompareZones();
  const { zone: home, today } = useToday(now);
  // The user's slider position, valid only for the day it was set on. Otherwise we fall back to a default.
  const [picked, setPicked] = useState<{ dayKey: string; minutes: number } | null>(null);
  const allTasks = useTasks();
  const isToday = isSameDay(day, today);

  const dayEvents = useMemo(() => eventsOnDay(events, day, home), [events, day, home]);
  const allDay = dayEvents.filter((e) => e.isAllDay);
  // Meetings you declined aren't commitments, so they don't count as busy time.
  const attending = useMemo(() => dayEvents.filter((e) => e.selfResponse !== 'declined'), [dayEvents]);
  const stats = dayStats(attending, day, prefs.workingHours, now, home);

  const tasks = useMemo(
    () =>
      allTasks
        .filter((t) => (t.status !== 'done' || isDueOn(t, day)) && (isDueOn(t, day) || (isToday && (isOverdue(t, today) || !t.dueDate))))
        .sort(compareTasks),
    [allTasks, day, isToday, today],
  );
  const openTaskCount = tasks.filter((t) => t.status !== 'done').length;

  const dayKey = dayKeyOf(day);
  const [wh, wm] = prefs.workingHours.start.split(':').map(Number) as [number, number];
  const defaultMinutes = snap(isToday ? minutesInZone(now, home) : wh * 60 + wm);
  const sliderMinutes = picked?.dayKey === dayKey ? picked.minutes : defaultMinutes;
  const compareEvent = (e: CalendarEvent) =>
    setPicked({ dayKey, minutes: snap(differenceInMinutes(new Date(e.start), zonedDayStart(day, home))) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">{isToday ? 'Today' : format(day, 'EEEE')}</h1>
          <p className="text-xs text-muted">{format(day, 'EEEE, d MMMM yyyy')}</p>
        </div>
        <DayStepper day={day} today={today} onChange={onDayChange} />
      </div>

      <DayStatsBar stats={stats} taskCount={openTaskCount} />

      <section aria-label="Tasks">
        <SectionTitle>Tasks</SectionTitle>
        <TaskList tasks={tasks} today={today} defaultDueDate={dayKey} />
      </section>

      {isToday && <NextEventCard event={pickNextEvent(dayEvents, now)} now={now} />}
      <AllDayStrip events={allDay} />

      <TimezonePlanner
        day={day}
        minutes={sliderMinutes}
        onChange={(minutes) => setPicked({ dayKey, minutes })}
        onReset={picked?.dayKey === dayKey ? () => setPicked(null) : undefined}
        zones={zones}
        events={attending}
        hours={prefs.workingHours}
        homeZone={home}
      />

      <section aria-label="Schedule">
        <SectionTitle>Schedule</SectionTitle>
        <Timeline events={dayEvents} now={now} showNow={isToday} day={day} onCompare={compareEvent} />
      </section>
    </div>
  );
}
