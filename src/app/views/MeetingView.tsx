import { format } from 'date-fns';
import { AlertTriangle, Check, Copy, ExternalLink, Video } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AuthError } from '@/core/google/auth';
import { ApiError, findMeetLink, insertEvent } from '@/core/google/calendarApi';
import { buildMeetingBody, fitsWorkingHours } from '@/core/google/meeting';
import { requestSync } from '@/core/sync/requestSync';
import { dayOffset, formatDayIn, formatTimeIn, systemZone, zoneAbbr, zoneLabel, zonedTimeToDate } from '@/core/time/zones';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useZones } from '@/app/hooks/useZones';
import { EmailChipInput } from '@/app/components/EmailChipInput';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';

const DURATIONS = [15, 30, 45, 60, 90];
const inputClass = 'h-8 rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent';

function nextHalfHour(now: Date): string {
  const m = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30;
  return format(new Date(2000, 0, 1, 0, Math.min(m, 23 * 60 + 30)), 'HH:mm');
}

interface Created {
  meetLink?: string;
  htmlLink?: string;
  invited: number;
}

interface Props {
  now: Date;
  signedIn: boolean;
  onReconnect: () => void;
  busy: boolean;
}

export function MeetingView({ now, signedIn, onReconnect, busy: authBusy }: Props) {
  const { prefs } = usePrefs();
  const mine = systemZone();
  const zones = useZones().filter((z) => z !== mine);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => format(now, 'yyyy-MM-dd'));
  const [time, setTime] = useState(() => nextHalfHour(now));
  const [entryZone, setEntryZone] = useState(mine);
  const [duration, setDuration] = useState(30);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  // Zones the user has switched off. Everything else in their list is on by default.
  const [off, setOff] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; needsReconnect: boolean } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = zones.filter((z) => !off.includes(z));
  const valid = attendees;
  const start = useMemo(() => (date && time ? zonedTimeToDate(date, time, entryZone) : null), [date, time, entryZone]);
  const inPast = !!start && start.getTime() < now.getTime();
  const canCreate = !!title.trim() && !!start && !saving;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate || !start) return;
    setSaving(true);
    setError(null);
    try {
      const event = await insertEvent(
        buildMeetingBody({
          title,
          start,
          durationMinutes: duration,
          attendees: valid,
          notes,
          zones: selected,
          timeZone: mine,
          requestId: crypto.randomUUID(),
        }),
      );
      setCreated({ meetLink: findMeetLink(event), htmlLink: event.htmlLink, invited: valid.length });
      void requestSync();
    } catch (err) {
      if (err instanceof AuthError || (err instanceof ApiError && err.isInsufficientScope)) {
        setError({ message: 'Dayflow needs your permission to create meetings. Reconnect Google and approve the new permission.', needsReconnect: true });
      } else {
        setError({ message: err instanceof Error ? err.message : 'Could not create the meeting.', needsReconnect: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is still shown and selectable.
    }
  };

  if (!signedIn) return <p className="py-10 text-center text-xs text-subtle">Connect Google Calendar to schedule meetings.</p>;

  if (created) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">Meeting created</h1>
        <div className="rounded-lg border border-border bg-surface p-3 text-[13px]">
          <p className="font-medium">{title.trim()}</p>
          <p className="mt-0.5 text-xs text-muted">
            {created.invited > 0 ? `Invitations were emailed to ${created.invited} ${created.invited === 1 ? 'person' : 'people'}.` : 'No attendees were invited.'}
          </p>
          {created.meetLink ? (
            <div className="mt-3 flex items-center gap-2">
              <a href={created.meetLink} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate font-medium text-accent hover:underline">
                {created.meetLink}
              </a>
              <Button size="sm" onClick={() => void copy(created.meetLink!)}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-warning">Google hasn't attached the Meet link yet. Open the event in Google Calendar to see it.</p>
          )}
          {created.htmlLink && (
            <a href={created.htmlLink} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg hover:underline">
              <ExternalLink className="size-3" /> Open in Google Calendar
            </a>
          )}
        </div>
        <Button
          onClick={() => {
            setCreated(null);
            setTitle('');
            setAttendees([]);
            setNotes('');
          }}
        >
          Schedule another
        </Button>
      </div>
    );
  }

  const rows = [mine, ...selected];
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">New Google Meet</h1>
        <p className="text-xs text-muted">Creates an event on your primary calendar with a Meet link and emails the invitations.</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-subtle">Title</span>
        <input className={`${inputClass} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Case 00123 review" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-subtle">Date</span>
          <input type="date" className={`${inputClass} w-full`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-subtle">Start</span>
          <input type="time" step={300} className={`${inputClass} w-full`} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-subtle">Time is in</span>
          <select className={`${inputClass} w-full`} value={entryZone} onChange={(e) => setEntryZone(e.target.value)}>
            <option value={mine}>Your time ({zoneLabel(mine)})</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {zoneLabel(z)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-subtle">Length</span>
          <select className={`${inputClass} w-full`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>

      {start && (
        <section aria-label="Meeting time in each zone">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-subtle">Time for everyone</h2>
            <span className="text-[11px] text-subtle">Tick a zone to include it in the invite</span>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {rows.map((z) => {
              const isMine = z === mine;
              const ok = fitsWorkingHours(start, duration, z, prefs.workingHours);
              const offset = dayOffset(start, z);
              return (
                <li key={z} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                  {isMine ? (
                    <span aria-hidden className="size-4 shrink-0" />
                  ) : (
                    <input
                      type="checkbox"
                      aria-label={`Include ${zoneLabel(z)} time in the invite`}
                      checked={!off.includes(z)}
                      onChange={(e) => setOff((o) => (e.target.checked ? o.filter((x) => x !== z) : [...o, z]))}
                      className="size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {isMine ? 'You' : zoneLabel(z)} <span className="text-subtle">{zoneAbbr(start, z)}</span>
                  </span>
                  <span className={cn('shrink-0 tabular-nums', ok ? 'text-fg' : 'text-warning')} title={ok ? undefined : 'Outside working hours there'}>
                    {offset !== 0 && <span className="mr-1 text-[11px] text-subtle">{formatDayIn(start, z)}</span>}
                    {formatTimeIn(start, z)}
                  </span>
                  {!ok && <AlertTriangle aria-label="Outside working hours" className="size-3.5 shrink-0 text-warning" />}
                </li>
              );
            })}
          </ul>
          {inPast && <p className="mt-1 text-xs text-warning">This start time has already passed.</p>}
          {zones.length === 0 && <p className="mt-1 text-xs text-subtle">Add customer time zones in Settings to see them here.</p>}
        </section>
      )}

      <EmailChipInput label="Attendees" emails={attendees} onChange={setAttendees} placeholder="customer@example.com" />

      <label className="block">
        <span className="mb-1 block text-xs text-subtle">Notes (optional)</span>
        <textarea
          className="min-h-12 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-danger/40 bg-surface p-3 text-xs text-danger">
          {error.message}
          {error.needsReconnect && (
            <Button type="button" className="mt-2 block" onClick={onReconnect} disabled={authBusy}>
              {authBusy ? 'Waiting for Google…' : 'Reconnect Google'}
            </Button>
          )}
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={!canCreate}>
        <Video className="size-4" />
        {saving ? 'Creating…' : valid.length > 0 ? `Create meeting and email ${valid.length} ${valid.length === 1 ? 'invite' : 'invites'}` : 'Create meeting'}
      </Button>
    </form>
  );
}
