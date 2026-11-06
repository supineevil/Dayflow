import { differenceInMinutes } from 'date-fns';
import { ChevronDown, Globe, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CalendarEvent, WorkingHours } from '@/core/models';
import { durationMinutes, eventStart } from '@/core/time/eventTime';
import { dayKeyOf, dayOffset, formatTimeIn, hhmm, inWorkingHours, zonedDayStart, zonedTimeToDate, zoneLabel, zoneTag } from '@/core/time/zones';
import { cn } from '@/app/lib/cn';
import { IconButton } from './ui/Button';

const STEP = 15;
const SEGMENTS = (24 * 60) / STEP;

interface RowProps {
  zone: string;
  /** The home zone: the row for you, and the zone the slider and the bar are measured in. */
  homeZone: string;
  isLocal: boolean;
  day: Date;
  at: Date;
  minutes: number;
  hours: WorkingHours;
}

/** The selected cell shows the verdict at the slider position at full strength. The rest show working time faintly. */
export function cellColour(isSelected: boolean, isWork: boolean, ok: boolean): string {
  if (isSelected) return ok ? 'bg-success' : 'bg-warning';
  return isWork ? 'bg-success/45' : 'bg-surface-2';
}

function ZoneRow({ zone, homeZone, isLocal, day, at, minutes, hours }: RowProps) {
  // One cell per 15 minutes of the viewed (home) day: is it working time in this zone?
  const working = useMemo(() => {
    const key = dayKeyOf(day);
    return Array.from({ length: SEGMENTS }, (_, i) => inWorkingHours(zonedTimeToDate(key, hhmm(i * STEP), homeZone), zone, hours));
  }, [day, zone, homeZone, hours]);

  const selected = Math.min(SEGMENTS - 1, Math.floor(minutes / STEP));
  const offset = dayOffset(at, zone, homeZone);
  const ok = inWorkingHours(at, zone, hours);

  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-xs">
          <span className="font-medium">{isLocal ? 'You' : zoneLabel(zone)}</span>
          <span className="text-subtle">
            {' '}
            · {zoneTag(at, zone)}
          </span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
          {offset !== 0 && (
            <span className="text-[11px] text-subtle" title={offset > 0 ? 'Next day there' : 'Previous day there'}>
              {offset > 0 ? `+${offset}d` : `−${Math.abs(offset)}d`}
            </span>
          )}
          <span className={cn('text-[13px] font-semibold', ok ? 'text-success' : 'text-warning')}>{formatTimeIn(at, zone)}</span>
        </div>
      </div>
      <div
        className="mt-1 flex h-2 gap-px overflow-hidden rounded-sm"
        role="img"
        aria-label={`${zoneLabel(zone)}: ${ok ? 'within' : 'outside'} working hours at the selected time`}
      >
        {working.map((isWork, i) => (
          <span
            key={i}
            // One background class per cell. Two competing bg-* classes are resolved by stylesheet order, not by
            // the order written here, which is how the selected cell used to end up the same colour as its neighbours.
            className={cn('h-full flex-1', cellColour(i === selected, isWork, ok))}
          />
        ))}
      </div>
    </li>
  );
}

interface Props {
  day: Date;
  /** Minutes after midnight of `day` in the home zone. */
  minutes: number;
  onChange: (minutes: number) => void;
  /** Set when the slider has been moved away from its default, to offer a reset. */
  onReset?: () => void;
  zones: string[];
  events: CalendarEvent[];
  hours: WorkingHours;
  /** The zone that defines the viewed day. */
  homeZone: string;
}

export function TimezonePlanner({ day, minutes, onChange, onReset, zones, events, hours, homeZone }: Props) {
  const [open, setOpen] = useState(true);
  const base = zonedDayStart(day, homeZone);
  const at = zonedTimeToDate(dayKeyOf(day), hhmm(minutes), homeZone);
  const local = homeZone;

  const busy = events
    .filter((e) => !e.isAllDay)
    .map((e) => {
      const start = Math.max(0, differenceInMinutes(eventStart(e), base));
      const end = Math.min(1440, start + durationMinutes(e));
      return { id: `${e.calendarId}:${e.id}`, left: (start / 1440) * 100, width: Math.max(0.5, ((end - start) / 1440) * 100) };
    });

  return (
    <section aria-label="Time zone planner" className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle hover:text-fg"
        >
          <Globe className="size-3" />
          Time zones
          <ChevronDown className={cn('size-3 transition-transform', !open && '-rotate-90')} />
        </button>
        {onReset && (
          <IconButton label="Reset slider" onClick={onReset} className="size-6">
            <RotateCcw className="size-3" />
          </IconButton>
        )}
      </div>

      {open && (
        <div className="px-3 pb-3">
          <input
            type="range"
            min={0}
            max={1440 - STEP}
            step={STEP}
            value={minutes}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Time of day to compare across time zones"
            aria-valuetext={formatTimeIn(at, local)}
            className="block h-5 w-full cursor-pointer accent-[var(--accent)]"
          />
          {/* Your events on this day, so conflicts are visible while sliding. */}
          <div className="relative mt-0.5 h-1.5 rounded-full bg-surface-2" aria-hidden>
            {busy.map((b) => (
              <span key={b.id} className="absolute inset-y-0 rounded-full bg-muted/60" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-subtle" aria-hidden>
            {['12a', '6a', '12p', '6p', '12a'].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>

          {zones.length === 0 ? (
            <p className="mt-2 text-xs text-subtle">Add time zones in Settings to compare them here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              <ZoneRow zone={local} homeZone={homeZone} isLocal day={day} at={at} minutes={minutes} hours={hours} />
              {zones
                .filter((z) => z !== local)
                .map((z) => (
                  <ZoneRow key={z} zone={z} homeZone={homeZone} isLocal={false} day={day} at={at} minutes={minutes} hours={hours} />
                ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-subtle">
            Green is working time ({hours.start}–{hours.end}) in each zone, and the time turns green when the slider is inside it. Amber means outside.
          </p>
        </div>
      )}
    </section>
  );
}
