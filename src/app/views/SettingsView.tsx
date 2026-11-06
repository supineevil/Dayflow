import { ArrowDown, ArrowUp, Eye, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import type { FilterResult } from '@/core/filters/filterEngine';
import { RULE_KIND_LABELS, addRulePatch, hideSenderPatch, restorePatch, ruleSummary, senderCounts } from '@/core/filters/hideActions';
import { DEFAULT_TAB_ORDER, type CalendarInfo, type ExclusionRuleKind } from '@/core/models';
import { nudgeTab } from '@/core/nav/tabOrder';
import { REMINDER_LEAD_OPTIONS } from '@/core/notify/reminders';
import { MAX_EXTRA_ZONES, ZONE_PRESETS, allZoneIds, formatTimeIn, resolveZone, systemZone, zoneAbbr, zoneLabel } from '@/core/time/zones';
import { usePrefs } from '@/app/hooks/usePrefs';
import { convertWorkingHours } from '@/core/time/workingHoursZone';
import { useHomeZone } from '@/app/hooks/useHomeZone';
import { useReminderStatus } from '@/app/hooks/useReminderStatus';
import { TAB_META } from '@/app/components/tabMeta';
import { Button, IconButton } from '@/app/components/ui/Button';
import { Segmented } from '@/app/components/ui/Segmented';
import { Switch } from '@/app/components/ui/Switch';

function ReminderCheck() {
  const status = useReminderStatus();
  const home = useHomeZone();
  const at = (ms: number | string) => formatTimeIn(new Date(ms), home);
  const [testResult, setTestResult] = useState('');

  const sendTest = async () => {
    setTestResult('');
    try {
      if (!chrome.notifications) throw new Error('Notifications permission is missing. Reload the extension at chrome://extensions and approve it.');
      await chrome.notifications.create(`dayflow-test:${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Dayflow test reminder',
        message: 'If you can see this, reminders can reach your screen.',
      });
      setTestResult('Sent. If nothing appeared, check Chrome and system notification settings (macOS: System Settings → Notifications → Google Chrome; also turn off Focus / Do Not Disturb).');
    } catch (err) {
      setTestResult(`Could not send: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const checked = status.lastCheckedAt ? at(status.lastCheckedAt) : null;
  return (
    <div className="space-y-1 pb-3 text-xs text-subtle">
      <div>
        {checked ? `Last checked at ${checked}, looking at ${status.considered} event(s).` : 'The background check has not run yet. It runs every minute while Chrome is open.'}
      </div>
      {status.next ? <div>Next reminder: {status.next.title} at {at(status.next.start)} ({status.next.reason}).</div> : status.lastCheckedAt && <div>No upcoming meetings you accepted.</div>}
      {status.lastShownAt && <div>Last reminder shown at {at(status.lastShownAt)}.</div>}
      {status.lastError && <div role="alert" className="text-danger">Problem: {status.lastError}</div>}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="secondary" onClick={() => void sendTest()}>Send test notification</Button>
      </div>
      {testResult && <div role="status">{testResult}</div>}
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {hint && <div className="text-xs text-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const inputClass =
  'h-8 rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent';

interface Props {
  calendars: CalendarInfo[];
  filtered: FilterResult;
  signedIn: boolean;
  email: string | null;
  onDisconnect: () => void;
  busy: boolean;
}

export function SettingsView({ calendars, filtered, signedIn, email, onDisconnect, busy }: Props) {
  const home = useHomeZone();
  const { prefs, setPrefs } = usePrefs();
  const [ruleKind, setRuleKind] = useState<ExclusionRuleKind>('organizer');
  const [ruleValue, setRuleValue] = useState('');
  const needsValue = ruleKind !== 'declined' && ruleKind !== 'past';
  const canAdd = !needsValue || ruleValue.trim().length > 0;
  const senders = senderCounts(filtered.visible, prefs.exclusionRules).slice(0, 5);

  const addRule = () => {
    if (!canAdd) return;
    setPrefs((p) => addRulePatch(p, ruleKind, needsValue ? ruleValue : ''));
    setRuleValue('');
  };

  const toggleCalendar = (id: string, enabled: boolean) =>
    setPrefs((p) => ({
      disabledCalendarIds: enabled ? p.disabledCalendarIds.filter((c) => c !== id) : [...p.disabledCalendarIds, id],
    }));

  return (
    <div>
      <h1 className="mb-2 text-base font-semibold">Settings</h1>
      <div className="divide-y divide-border">
        <Row title="Theme">
          <Segmented
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row title="Default view" hint="What opens first in the side panel.">
          <Segmented
            label="Default view"
            value={prefs.defaultView}
            onChange={(defaultView) => setPrefs({ defaultView })}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'agenda', label: 'Agenda' },
            ]}
          />
        </Row>
        <div className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13px] font-medium">Tab order</div>
              <div className="text-xs text-subtle">Drag the tabs at the top, or use the arrows here.</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPrefs({ tabOrder: DEFAULT_TAB_ORDER })} disabled={prefs.tabOrder.join() === DEFAULT_TAB_ORDER.join()}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          </div>
          <ol className="mt-2 space-y-1">
            {prefs.tabOrder.map((id, i) => {
              const { label, icon: Icon } = TAB_META[id];
              return (
                <li key={id} className="flex items-center gap-2 rounded-md bg-surface px-2 py-1 text-[13px]">
                  <Icon aria-hidden className="size-3.5 text-muted" />
                  <span className="flex-1">{label}</span>
                  <IconButton label={`Move ${label} earlier`} disabled={i === 0} onClick={() => setPrefs((p) => ({ tabOrder: nudgeTab(p.tabOrder, id, -1) }))}>
                    <ArrowUp className="size-3.5" />
                  </IconButton>
                  <IconButton label={`Move ${label} later`} disabled={i === prefs.tabOrder.length - 1} onClick={() => setPrefs((p) => ({ tabOrder: nudgeTab(p.tabOrder, id, 1) }))}>
                    <ArrowDown className="size-3.5" />
                  </IconButton>
                </li>
              );
            })}
          </ol>
        </div>
        <Row title="Working hours" hint={`Used for free time and day progress. Times are in ${zoneLabel(home)}.`}>
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              aria-label="Working day start"
              className={inputClass}
              value={prefs.workingHours.start}
              onChange={(e) => e.target.value && setPrefs({ workingHours: { ...prefs.workingHours, start: e.target.value } })}
            />
            <span className="text-subtle">to</span>
            <input
              type="time"
              aria-label="Working day end"
              className={inputClass}
              value={prefs.workingHours.end}
              onChange={(e) => e.target.value && setPrefs({ workingHours: { ...prefs.workingHours, end: e.target.value } })}
            />
          </div>
        </Row>
        <Row title="Edge tab" hint="A slim handle on the right edge of web pages. Click it to open the side panel. Takes effect on pages as you open or refresh them.">
          <Switch label="Edge tab" checked={prefs.edgeTabEnabled} onChange={(on) => setPrefs({ edgeTabEnabled: on })} />
        </Row>
        <Row title="Meeting reminders" hint="A desktop notification with a Join button, only for meetings you accepted.">
          <div className="flex items-center gap-2">
            {prefs.remindersEnabled && (
              <select
                aria-label="Remind me before a meeting"
                className={inputClass}
                value={prefs.reminderLeadMinutes}
                onChange={(e) => setPrefs({ reminderLeadMinutes: Number(e.target.value) })}
              >
                {[...new Set([...REMINDER_LEAD_OPTIONS, prefs.reminderLeadMinutes])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>{m} min before</option>
                ))}
              </select>
            )}
            <Switch label="Meeting reminders" checked={prefs.remindersEnabled} onChange={(on) => setPrefs({ remindersEnabled: on })} />
          </div>
        </Row>
        {prefs.remindersEnabled && <ReminderCheck />}
        <Row title="Week starts on">
          <select
            aria-label="Week starts on"
            className={inputClass}
            value={prefs.startOfWeek}
            onChange={(e) => setPrefs({ startOfWeek: Number(e.target.value) as typeof prefs.startOfWeek })}
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
            <option value={6}>Saturday</option>
          </select>
        </Row>
      </div>

      <h2 className="mb-1 mt-6 text-[13px] font-semibold">Time zones</h2>
      <Row
        title="My time zone"
        hint={`Sets what "today" means and the clock used everywhere in Dayflow. Your Google Calendar is not changed. This computer is on ${zoneLabel(systemZone())}.`}
      >
        <select
          aria-label="My time zone"
          className={inputClass}
          value={prefs.homeTimezone}
          onChange={(e) =>
            // Carry working hours across so they stay the same moments in time, now written in the new zone.
            setPrefs({
              homeTimezone: e.target.value,
              workingHours: convertWorkingHours(prefs.workingHours, home, resolveZone(e.target.value), new Date()),
            })
          }
        >
          <option value="">This computer ({zoneLabel(systemZone())})</option>
          <optgroup label="Common">
            {ZONE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="All time zones">
            {allZoneIds()
              .filter((id) => !ZONE_PRESETS.some((p) => p.id === id))
              .map((id) => (
                <option key={id} value={id}>{id.replace(/_/g, ' ')}</option>
              ))}
          </optgroup>
        </select>
      </Row>
      <p className="mb-2 text-xs text-subtle">
        Now in {zoneLabel(resolveZone(prefs.homeTimezone))}: {formatTimeIn(new Date(), resolveZone(prefs.homeTimezone))} {zoneAbbr(new Date(), resolveZone(prefs.homeTimezone))}.
        Working hours, reminders and the day shown are all read in this zone. Changing it converts your working hours to the same moments in the new zone; adjust them above if you work different hours there.
      </p>
      <p className="mb-1 text-xs text-subtle">
        Compare your time with your customers' on the Today slider and in each event. Your computer's zone is included automatically when it
        differs. Daylight saving is handled automatically.
      </p>
      <ul className="divide-y divide-border">
        {prefs.extraTimezones.map((z) => (
          <li key={z} className="flex items-center justify-between gap-3 py-2">
            <span className="text-[13px]">
              {zoneLabel(z)} <span className="text-subtle">{zoneAbbr(new Date(), z)}</span>
            </span>
            <IconButton label={`Remove ${zoneLabel(z)}`} onClick={() => setPrefs((p) => ({ extraTimezones: p.extraTimezones.filter((x) => x !== z) }))}>
              <X className="size-3.5" />
            </IconButton>
          </li>
        ))}
      </ul>
      {prefs.extraTimezones.length < MAX_EXTRA_ZONES ? (
        <select
          aria-label="Add a time zone"
          className={`${inputClass} mt-2 w-full`}
          value=""
          onChange={(e) => {
            const zone = e.target.value;
            if (zone) setPrefs((p) => ({ extraTimezones: [...p.extraTimezones, zone] }));
          }}
        >
          <option value="">Add a time zone…</option>
          <optgroup label="Common">
            {ZONE_PRESETS.filter((p) => p.id !== home && !prefs.extraTimezones.includes(p.id)).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="All time zones">
            {allZoneIds()
              .filter((id) => id !== home && !prefs.extraTimezones.includes(id) && !ZONE_PRESETS.some((p) => p.id === id))
              .map((id) => (
                <option key={id} value={id}>
                  {id.replace(/_/g, ' ')}
                </option>
              ))}
          </optgroup>
        </select>
      ) : (
        <p className="mt-2 text-xs text-subtle">Up to {MAX_EXTRA_ZONES} extra time zones.</p>
      )}

      <h2 className="mb-1 mt-6 text-[13px] font-semibold">Google account</h2>
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0 truncate text-[13px] text-muted">{signedIn ? (email ?? 'Connected') : 'Not connected'}</span>
        {signedIn && (
          <Button size="sm" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </Button>
        )}
      </div>
      {signedIn && <p className="text-xs text-subtle">Disconnecting revokes Dayflow's access and deletes the events saved on this computer.</p>}

      <h2 className="mb-1 mt-6 text-[13px] font-semibold">Hide events</h2>
      <p className="mb-1 text-xs text-subtle">
        Hidden events stay in Google Calendar; Dayflow just doesn't show them. Use a sender address (casework@example.com) or a whole domain
        (@example.com).
      </p>
      <ul className="divide-y divide-border">
        {prefs.exclusionRules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            <span className={`min-w-0 truncate text-[13px] ${r.enabled ? '' : 'text-subtle line-through'}`}>{ruleSummary(r, calendars)}</span>
            <span className="flex shrink-0 items-center gap-1">
              <Switch
                label={`Apply rule: ${ruleSummary(r, calendars)}`}
                checked={r.enabled}
                onChange={(enabled) => setPrefs((p) => ({ exclusionRules: p.exclusionRules.map((x) => (x.id === r.id ? { ...x, enabled } : x)) }))}
              />
              <IconButton label={`Delete rule: ${ruleSummary(r, calendars)}`} onClick={() => setPrefs((p) => ({ exclusionRules: p.exclusionRules.filter((x) => x.id !== r.id) }))}>
                <X className="size-3.5" />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          addRule();
        }}
      >
        <select aria-label="Rule type" className={inputClass} value={ruleKind} onChange={(e) => setRuleKind(e.target.value as ExclusionRuleKind)}>
          {(['organizer', 'titleContains', 'titleEquals', 'declined', 'past'] as const).map((k) => (
            <option key={k} value={k}>
              {RULE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {needsValue && (
          <input
            aria-label="Rule value"
            className={`${inputClass} min-w-0 flex-1`}
            placeholder={ruleKind === 'organizer' ? 'name@example.com or @example.com' : 'e.g. CASEWORK'}
            value={ruleValue}
            onChange={(e) => setRuleValue(e.target.value)}
          />
        )}
        <Button type="submit" disabled={!canAdd}>
          Add
        </Button>
      </form>
      {senders.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-subtle">Senders in your calendar</div>
          <ul className="divide-y divide-border">
            {senders.map((s) => (
              <li key={s.email} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate text-[13px]" title={s.email}>
                  {s.name ? `${s.name} · ` : ''}
                  {s.email} <span className="text-subtle">({s.count})</span>
                </span>
                <Button size="sm" onClick={() => setPrefs((p) => hideSenderPatch(p, s.email))}>
                  Hide
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {filtered.hidden.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-subtle">Currently hidden ({filtered.hidden.length})</div>
          <ul className="divide-y divide-border">
            {filtered.hidden.slice(0, 50).map(({ event, reason }) => (
              <li key={`${event.calendarId}:${event.id}`} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{event.title}</span>
                  <span className="block truncate text-xs text-subtle">
                    {reason.kind === 'instance' ? 'Hidden event' : reason.kind === 'series' ? 'Hidden series' : ruleSummary(reason.rule, calendars)}
                  </span>
                </span>
                <IconButton label={`Show ${event.title} again`} onClick={() => setPrefs((p) => restorePatch(p, event, reason))}>
                  <Eye className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
          {filtered.hidden.length > 50 && <p className="py-1 text-xs text-subtle">Showing the first 50.</p>}
        </div>
      )}

      <h2 className="mb-1 mt-6 text-[13px] font-semibold">Calendars</h2>
      <p className="mb-1 text-xs text-subtle">Turn a calendar off to remove all of its events from Dayflow. Nothing changes in Google Calendar.</p>
      {calendars.length === 0 && <p className="py-2 text-xs text-subtle">Your calendars appear here after the first sync.</p>}
      <ul className="divide-y divide-border">
        {calendars.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </span>
            <Switch
              label={`Show ${c.name}`}
              checked={!prefs.disabledCalendarIds.includes(c.id)}
              onChange={(on) => toggleCalendar(c.id, on)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
