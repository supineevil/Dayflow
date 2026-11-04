import { addDays, differenceInMinutes, format, isSameDay, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CalendarEvent } from '@/core/models';
import { eventsOnDay } from '@/core/time/eventTime';
import { dayStats } from '@/core/planning/dayPlan';
import { compareTasks, isDueOn, isOverdue } from '@/core/tasks/taskStore';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useZones } from '@/app/hooks/useZones';
import { useTasks } from '@/app/hooks/useTasks';
import { AllDayStrip } from '@/app/components/AllDayStrip';
import { DayStatsBar } from '@/app/components/DayStatsBar';
import { NextEventCard, pickNextEvent } from '@/app/components/NextEventCard';
import { TaskList } from '@/app/components/TaskList';
import { TimezonePlanner } from '@/app/components/TimezonePlanner';
import { Timeline } from '@/app/components/Timeline';
import { Button, IconButton } from '@/app/components/ui/Button';

interface Props {
  events: CalendarEvent[];
  now: Date;
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
  const zones = useZones();
  // The user's slider position, valid only for the day it was set on. Otherwise we fall back to a default.
  const [picked, setPicked] = useState<{ dayKey: string; minutes: number } | null>(null);
  const allTasks = useTasks();
  const isToday = isSameDay(day, now);

  const dayEvents = useMemo(() => eventsOnDay(events, day), [events, day]);
  const allDay = dayEvents.filter((e) => e.isAllDay);
  // Meetings you declined aren't commitments, so they don't count as busy time.
  const attending = useMemo(() => dayEvents.filter((e) => e.selfResponse !== 'declined'), [dayEvents]);
  const stats = dayStats(attending, day, prefs.workingHours, now);

  const tasks = useMemo(
    () =>
      allTasks
        .filter((t) => (t.status !== 'done' || isDueOn(t, day)) && (isDueOn(t, day) || (isToday && (isOverdue(t, now) || !t.dueDate))))
        .sort(compareTasks),
    [allTasks, day, isToday, now],
  );
  const openTaskCount = tasks.filter((t) => t.status !== 'done').length;

  const dayKey = format(day, 'yyyy-MM-dd');
  const [wh, wm] = prefs.workingHours.start.split(':').map(Number) as [number, number];
  const defaultMinutes = snap(isToday ? differenceInMinutes(now, startOfDay(now)) : wh * 60 + wm);
  const sliderMinutes = picked?.dayKey === dayKey ? picked.minutes : defaultMinutes;
  const compareEvent = (e: CalendarEvent) =>
    setPicked({ dayKey, minutes: snap(differenceInMinutes(new Date(e.start), startOfDay(day))) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">{isToday ? 'Today' : format(day, 'EEEE')}</h1>
          <p className="text-xs text-muted">{format(day, 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Previous day" onClick={() => onDayChange(addDays(day, -1))}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <Button size="sm" variant="ghost" disabled={isToday} onClick={() => onDayChange(startOfDay(now))}>
            Today
          </Button>
          <IconButton label="Next day" onClick={() => onDayChange(addDays(day, 1))}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>

      <DayStatsBar stats={stats} taskCount={openTaskCount} />

      <section aria-label="Tasks">
        <SectionTitle>Tasks</SectionTitle>
        <TaskList tasks={tasks} today={now} defaultDueDate={format(day, 'yyyy-MM-dd')} />
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
      />

      <section aria-label="Schedule">
        <SectionTitle>Schedule</SectionTitle>
        <Timeline events={dayEvents} now={now} showNow={isToday} onCompare={compareEvent} />
      </section>
    </div>
  );
}
