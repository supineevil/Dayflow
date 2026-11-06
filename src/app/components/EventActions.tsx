import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { deleteEvent, getEventDetails, patchEvent } from '@/core/google/calendarApi';
import {
  buildEditPatch,
  canCancelEvent,
  canEditEvent,
  canRespond,
  changeAttendees,
  describeWriteError,
  isGuest,
  withResponse,
  type WriteFailure,
} from '@/core/google/eventEdit';
import { parseEmails } from '@/core/google/meeting';
import type { GoogleAttendee } from '@/core/google/types';
import type { CalendarEvent, ResponseStatus } from '@/core/models';
import { dropFromCache } from '@/core/sync/localEdits';
import { requestSync } from '@/core/sync/requestSync';
import { eventEnd, eventStart } from '@/core/time/eventTime';
import { dayKeyIn, minutesInZone, hhmm, systemZone, zonedTimeToDate } from '@/core/time/zones';
import { useHomeZone } from '@/app/hooks/useHomeZone';
import { useAccount } from '@/app/hooks/useAccount';
import { cn } from '@/app/lib/cn';
import { Button } from './ui/Button';

const inputClass = 'h-8 rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent';
const DURATIONS = [15, 30, 45, 60, 90];

type Mode = 'idle' | 'edit' | 'cancel' | 'remove';

/** Live guest list from Google. Null while loading; `error` set if it could not be read. */
function useGuests(event: CalendarEvent, enabled: boolean) {
  const [state, setState] = useState<{ attendees: GoogleAttendee[]; omitted: boolean } | null>(null);
  const [error, setError] = useState<WriteFailure | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getEventDetails(event.calendarId, event.id)
      .then((d) => !cancelled && setState({ attendees: d.attendees ?? [], omitted: !!d.attendeesOmitted }))
      .catch((err: unknown) => !cancelled && setError(describeWriteError(err)));
    return () => {
      cancelled = true;
    };
  }, [event.calendarId, event.id, enabled]);
  return { state, error };
}

export function EventActions({ event }: { event: CalendarEvent }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { connect, busy: authBusy } = useAccount();

  const edit = canEditEvent(event);
  const cancel = canCancelEvent(event);
  const respond = canRespond(event);
  if (!edit && !cancel && !respond) return null;

  /** Runs a write, then re-syncs. Shows what went wrong instead of throwing. */
  const run = async (message: string, work: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      setDone(message);
      setMode('idle');
      await requestSync();
    } catch (err) {
      setFailure(describeWriteError(err));
    } finally {
      setBusy(false);
    }
  };

  const answer = (response: ResponseStatus) =>
    run('Your response was sent.', async () => {
      const live = await getEventDetails(event.calendarId, event.id);
      // Patching replaces the whole guest list, so we refuse rather than write back a trimmed one.
      if (live.attendeesOmitted) throw new Error('This event has too many guests to answer from Dayflow. Use Google Calendar.');
      const next = withResponse(live.attendees ?? [], response);
      if (!next) throw new Error('You are not on this event’s guest list.');
      await patchEvent(event.calendarId, event.id, { attendees: next }, true);
    });

  return (
    <div className="space-y-2 border-t border-border pt-2">
      {respond && mode === 'idle' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-subtle">Going?</span>
          {(
            [
              ['accepted', 'Yes'],
              ['tentative', 'Maybe'],
              ['declined', 'No'],
            ] as const
          ).map(([value, label]) => (
            <Button key={value} size="sm" variant={event.selfResponse === value ? 'primary' : 'secondary'} disabled={busy} onClick={() => void answer(value)}>
              {label}
            </Button>
          ))}
        </div>
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-3">
          {edit && (
            <button type="button" onClick={() => { setDone(null); setMode('edit'); }} className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline">
              <Pencil className="size-3" /> Edit
            </button>
          )}
          {cancel && (
            <button type="button" onClick={() => { setDone(null); setMode('cancel'); }} className="inline-flex items-center gap-1 text-danger hover:underline">
              <Trash2 className="size-3" /> Cancel meeting
            </button>
          )}
          {respond && (
            <button type="button" onClick={() => { setDone(null); setMode('remove'); }} className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline">
              <Trash2 className="size-3" /> Remove from my calendar
            </button>
          )}
        </div>
      )}

      {mode === 'edit' && <EditForm event={event} busy={busy} onClose={() => setMode('idle')} run={run} />}
      {mode === 'cancel' && <CancelPanel event={event} busy={busy} onClose={() => setMode('idle')} run={run} />}
      {mode === 'remove' && (
        <div className="space-y-2 rounded-md bg-surface-2 p-2">
          <p>
            Removes <strong className="font-medium text-fg">{event.title}</strong> from your Google Calendar. To tell the organizer you can't make it, answer “No” instead.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run('Removed from your calendar.', async () => {
                  await deleteEvent(event.calendarId, event.id, false);
                  await dropFromCache(event.calendarId, { ids: [event.id] });
                })
              }
            >
              {busy ? 'Removing…' : 'Remove'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode('idle')}>
              Keep
            </Button>
          </div>
        </div>
      )}

      {done && (
        <p role="status" className="flex items-center gap-1 text-success">
          <Check className="size-3" /> {done}
        </p>
      )}
      {failure && (
        <div role="alert" className="rounded-md border border-danger/40 p-2 text-danger">
          {failure.message}
          {failure.needsReconnect && (
            <Button size="sm" className="mt-2 block" disabled={authBusy} onClick={() => void connect()}>
              {authBusy ? 'Waiting for Google…' : 'Reconnect Google'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

type Run = (message: string, work: () => Promise<void>) => Promise<void>;

function CancelPanel({ event, busy, onClose, run }: { event: CalendarEvent; busy: boolean; onClose: () => void; run: Run }) {
  const { state, error } = useGuests(event, true);
  const [notify, setNotify] = useState(true);
  const [scope, setScope] = useState<'one' | 'series'>('one');
  const others = state?.attendees.filter(isGuest).length ?? 0;

  const confirm = () =>
    void run('Meeting cancelled.', async () => {
      if (scope === 'series' && event.recurringEventId) {
        await deleteEvent(event.calendarId, event.recurringEventId, notify);
        await dropFromCache(event.calendarId, { seriesId: event.recurringEventId });
      } else {
        await deleteEvent(event.calendarId, event.id, notify);
        await dropFromCache(event.calendarId, { ids: [event.id] });
      }
    });

  return (
    <div className="space-y-2 rounded-md bg-surface-2 p-2">
      <p>
        Cancel <strong className="font-medium text-fg">{event.title}</strong> in Google Calendar? This deletes it for everyone.
      </p>
      {event.recurringEventId && (
        <fieldset className="space-y-1">
          <legend className="sr-only">What to cancel</legend>
          {(
            [
              ['one', 'Only this one'],
              ['series', 'The whole series'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="cancel-scope" checked={scope === value} onChange={() => setScope(value)} /> {label}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        {state
          ? others > 0
            ? `Email a cancellation to ${others} ${others === 1 ? 'guest' : 'guests'}`
            : 'No guests to notify'
          : error
            ? 'Email a cancellation to guests'
            : 'Checking guests…'}
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" className="bg-danger text-white" disabled={busy} onClick={confirm}>
          {busy ? 'Cancelling…' : scope === 'series' ? 'Cancel series' : 'Cancel meeting'}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Keep meeting
        </Button>
      </div>
    </div>
  );
}

function EditForm({ event, busy, onClose, run }: { event: CalendarEvent; busy: boolean; onClose: () => void; run: Run }) {
  // The form shows and reads times in the home zone; Google stores them in the calendar's (this computer's) zone.
  const home = useHomeZone();
  const calendarZone = systemZone();
  const start0 = eventStart(event);
  const minutes0 = Math.round((eventEnd(event).getTime() - start0.getTime()) / 60_000);
  const { state, error } = useGuests(event, true);

  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(dayKeyIn(start0, home));
  const [time, setTime] = useState(hhmm(minutesInZone(start0, home)));
  const [duration, setDuration] = useState(minutes0);
  const [addText, setAddText] = useState('');
  const [removed, setRemoved] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);

  const { valid: toAdd, invalid } = useMemo(() => parseEmails(addText), [addText]);
  const guests = (state?.attendees ?? []).filter(isGuest);
  const start = date && time ? zonedTimeToDate(date, time, home) : null;
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);
  const guestsChanged = toAdd.length > 0 || removed.length > 0;
  // Never write the guest list back if Google trimmed it, or we could not read it.
  const guestsBlocked = !!state?.omitted || (!state && guestsChanged);

  const patch = start && !guestsBlocked
    ? buildEditPatch(event, {
        title,
        start,
        durationMinutes: duration,
        timeZone: calendarZone,
        attendees: guestsChanged && state ? changeAttendees(state.attendees, toAdd, removed) : undefined,
      })
    : {};
  const changed = Object.keys(patch).length > 0;
  const canSave = changed && invalid.length === 0 && !busy && !!title.trim();

  return (
    <form
      className="space-y-2 rounded-md bg-surface-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) void run('Saved.', () => patchEvent(event.calendarId, event.id, patch, notify));
      }}
    >
      <label className="block">
        <span className="mb-0.5 block text-subtle">Title</span>
        <input className={`${inputClass} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-subtle">Date</span>
          <input type="date" className={`${inputClass} w-full`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-subtle">Start</span>
          <input type="time" className={`${inputClass} w-full`} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-subtle">Length</span>
          <select className={`${inputClass} w-full`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>
      {event.recurringEventId && <p className="text-subtle">Changes apply to this occurrence only.</p>}

      <div>
        <span className="mb-0.5 block text-subtle">Guests</span>
        {error && <p className="text-warning">Couldn't load the guest list, so guests can't be changed right now.</p>}
        {!state && !error && <p className="text-subtle">Loading guests…</p>}
        {state?.omitted && <p className="text-warning">This event has too many guests to change from Dayflow. Use Google Calendar for guests.</p>}
        {state && !state.omitted && (
          <>
            <ul className="space-y-0.5">
              {guests.map((g) => {
                const gone = removed.includes(g.email!);
                return (
                  <li key={g.email} className="flex items-center justify-between gap-2">
                    <span className={cn('min-w-0 truncate', gone && 'text-subtle line-through')} title={g.email}>
                      {g.displayName ? `${g.displayName} · ` : ''}
                      {g.email}
                    </span>
                    <button
                      type="button"
                      aria-label={gone ? `Keep ${g.email}` : `Remove ${g.email}`}
                      onClick={() => setRemoved((r) => (gone ? r.filter((x) => x !== g.email) : [...r, g.email!]))}
                      className="shrink-0 text-muted hover:text-fg"
                    >
                      {gone ? <span className="underline">Undo</span> : <X className="size-3.5" />}
                    </button>
                  </li>
                );
              })}
              {guests.length === 0 && <li className="text-subtle">No other guests.</li>}
            </ul>
            <textarea
              aria-label="Add guests"
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] outline-none focus:border-accent"
              placeholder="Add emails, separated by commas or spaces"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
            />
            {invalid.length > 0 && <p className="text-danger">Not a valid email: {invalid.join(', ')}</p>}
          </>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email guests about this change
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!canSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}
