import { addMinutes } from 'date-fns';
import { useState } from 'react';
import { ChevronRight, EyeOff, ExternalLink, Globe, MapPin, Video } from 'lucide-react';
import { hideInstancePatch, hideSenderPatch, hideSeriesPatch, senderOf } from '@/core/filters/hideActions';
import type { CalendarEvent } from '@/core/models';
import { durationMinutes, eventEnd, eventStart } from '@/core/time/eventTime';
import { dayOffset, formatTimeIn, inWorkingHours, systemZone, zoneAbbr, zoneLabel } from '@/core/time/zones';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useZones } from '@/app/hooks/useZones';
import { cn } from '@/app/lib/cn';
import { formatDuration, formatTime } from '@/app/lib/format';
import { EventActions } from './EventActions';
import { ResponseBadge } from './ResponseBadge';

interface Props {
  event: CalendarEvent;
  now: Date;
  /** When set, the expanded row offers a button that moves the time zone slider to this event. */
  onCompare?: (event: CalendarEvent) => void;
  /** Edit, cancel and RSVP controls. Off in the popup, which can't host Google's reconnect window. */
  showActions?: boolean;
}

export function EventRow({ event, now, onCompare, showActions = true }: Props) {
  const [open, setOpen] = useState(false);
  const { prefs, setPrefs } = usePrefs();
  const zones = useZones().filter((z) => z !== systemZone());
  const showZones = zones.length > 0 && !event.isAllDay;
  const start = eventStart(event);
  const end = eventEnd(event);
  const isPast = end <= now;
  const isNow = start <= now && now < end;
  const declined = event.selfResponse === 'declined';
  const sender = senderOf(event);
  // Every row expands, because the hide actions live in the expanded panel.
  const hasDetails = true;

  return (
    <div className={cn('rounded-md', isNow && 'bg-accent-soft')}>
      <button
        type="button"
        aria-expanded={hasDetails ? open : undefined}
        onClick={() => hasDetails && setOpen((o) => !o)}
        className={cn(
          'group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left',
          hasDetails ? 'hover:bg-hover' : 'cursor-default',
          isNow && 'hover:bg-transparent',
        )}
      >
        <div className={cn('w-[60px] whitespace-nowrap shrink-0 pt-px text-xs tabular-nums', isPast ? 'text-subtle' : 'text-muted')}>
          <div className="font-medium">{formatTime(start)}</div>
          <div className="text-subtle">{formatDuration(durationMinutes(event))}</div>
        </div>
        <span
          aria-hidden
          className={cn('mt-0.5 h-8 w-[3px] shrink-0 rounded-full', (isPast || declined) && 'opacity-40')}
          style={{ background: event.color }}
        />
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[13px] font-medium', declined ? 'text-muted line-through' : isPast ? 'text-muted' : 'text-fg')}>
            {event.title}
          </div>
          <div className="flex items-center gap-2 truncate text-xs text-subtle">
            <span className="truncate">{event.calendarName}</span>
            {event.meetingLink && <Video className="size-3 shrink-0" aria-label="Has video link" />}
            {event.location && <MapPin className="size-3 shrink-0" aria-label="Has location" />}
          </div>
        </div>
        <ResponseBadge response={event.selfResponse} />
        {isNow && !declined && <span className="mt-0.5 rounded bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-fg">Now</span>}
        {hasDetails && (
          <ChevronRight className={cn('mt-1 size-3.5 shrink-0 text-subtle transition-transform', open && 'rotate-90')} />
        )}
      </button>

      {open && (
        <div className="space-y-2 pb-2 pl-[calc(60px+12px+3px+12px+8px)] pr-2 text-xs text-muted">
          <div className="text-subtle">
            {formatTime(start)} – {formatTime(end)}
          </div>
          {event.location && (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          {sender && (
            <div className="truncate text-subtle" title={sender}>
              From {event.organizerName ? `${event.organizerName} · ` : ''}
              {sender}
            </div>
          )}
          {event.description && <p className="whitespace-pre-wrap break-words">{event.description}</p>}
          {showZones && (
            <ul aria-label="Event time in other time zones" className="space-y-0.5 rounded-md bg-surface-2 px-2 py-1.5">
              {zones.map((z) => {
                const ok =
                  inWorkingHours(start, z, prefs.workingHours) && inWorkingHours(addMinutes(end, -1), z, prefs.workingHours);
                const offset = dayOffset(start, z);
                return (
                  <li key={z} className="flex items-baseline justify-between gap-2 tabular-nums">
                    <span className="truncate">
                      {zoneLabel(z)} <span className="text-subtle">{zoneAbbr(start, z)}</span>
                    </span>
                    <span className={cn('shrink-0', ok ? 'text-fg' : 'text-warning')} title={ok ? undefined : 'Outside working hours there'}>
                      {offset !== 0 && <span className="mr-1 text-[11px] text-subtle">{offset > 0 ? `+${offset}d` : `−${Math.abs(offset)}d`}</span>}
                      {formatTimeIn(start, z)} – {formatTimeIn(end, z)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            {event.meetingLink && (
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <Video className="size-3" /> Join meeting
              </a>
            )}
            {showZones && onCompare && (
              <button
                type="button"
                onClick={() => onCompare(event)}
                className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline"
              >
                <Globe className="size-3" /> Compare time zones
              </button>
            )}
            <button type="button" onClick={() => setPrefs((p) => hideInstancePatch(p, event))} className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline">
              <EyeOff className="size-3" /> Hide this event
            </button>
            {event.recurringEventId && (
              <button type="button" onClick={() => setPrefs((p) => hideSeriesPatch(p, event))} className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline">
                <EyeOff className="size-3" /> Hide whole series
              </button>
            )}
            {sender && (
              <button type="button" onClick={() => setPrefs((p) => hideSenderPatch(p, sender))} className="inline-flex max-w-full items-center gap-1 text-muted hover:text-fg hover:underline">
                <EyeOff className="size-3 shrink-0" /> <span className="truncate">Hide all from {sender}</span>
              </button>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline"
              >
                <ExternalLink className="size-3" /> Open in Google Calendar
              </a>
            )}
          </div>
          {showActions && <EventActions event={event} />}
        </div>
      )}
    </div>
  );
}
