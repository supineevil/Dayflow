import { CalendarCheck, Clock, ListTodo, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DayStats } from '@/core/planning/dayPlan';
import { cn } from '@/app/lib/cn';
import { formatDuration } from '@/app/lib/format';

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface px-2.5 py-2">
      <div className="flex items-center gap-1 text-[11px] text-subtle [&>svg]:size-3">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

interface Props {
  stats: DayStats;
  taskCount: number;
}

export function DayStatsBar({ stats, taskCount }: Props) {
  const overloaded = stats.load > 0.7;
  return (
    <section aria-label="Day overview" className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={<CalendarCheck />} label="Events" value={String(stats.eventCount)} />
        <Stat icon={<ListTodo />} label="Tasks" value={String(taskCount)} />
        <Stat icon={<Clock />} label="Meetings" value={formatDuration(stats.meetingMinutes)} />
        <Stat icon={<Timer />} label="Free" value={formatDuration(stats.freeMinutes)} />
      </div>
      <div>
        <div
          role="progressbar"
          aria-label="Working day elapsed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(stats.progress * 100)}
          className="h-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${stats.progress * 100}%` }} />
        </div>
        {overloaded && (
          <p className={cn('mt-1.5 text-xs text-warning')}>
            Heavy day: {Math.round(stats.load * 100)}% of your working hours are booked.
          </p>
        )}
      </div>
    </section>
  );
}
