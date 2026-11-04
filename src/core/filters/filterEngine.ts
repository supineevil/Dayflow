import type { CalendarEvent, ExclusionRule, UserPreferences } from '@/core/models';
import { eventEnd } from '@/core/time/eventTime';

export type HiddenReason =
  | { kind: 'instance' }
  | { kind: 'series' }
  | { kind: 'rule'; rule: ExclusionRule };

export interface FilterResult {
  visible: CalendarEvent[];
  hidden: { event: CalendarEvent; reason: HiddenReason }[];
}

export const instanceKey = (e: Pick<CalendarEvent, 'calendarId' | 'id'>) => `${e.calendarId}:${e.id}`;

/**
 * `value` is either a full address ("casework@assembled.com") or a domain ("@assembled.com" or "assembled.com").
 * Compared case-insensitively.
 */
export function senderMatches(value: string, emails: (string | undefined)[]): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  const domain = v.startsWith('@') ? v : v.includes('@') ? null : `@${v}`;
  return emails.some((raw) => {
    const email = raw?.toLowerCase();
    if (!email) return false;
    return domain ? email.endsWith(domain) : email === v;
  });
}

function matchesRule(e: CalendarEvent, rule: ExclusionRule, now: Date): boolean {
  const value = rule.value.trim().toLowerCase();
  switch (rule.kind) {
    case 'titleContains':
      return value !== '' && e.title.toLowerCase().includes(value);
    case 'titleEquals':
      return value !== '' && e.title.trim().toLowerCase() === value;
    case 'calendar':
      return e.calendarId === rule.value;
    case 'organizer':
      return senderMatches(rule.value, [e.organizerEmail, e.creatorEmail]);
    case 'declined':
      return e.selfResponse === 'declined';
    case 'past':
      return eventEnd(e) <= now;
  }
}

/**
 * Applies the user's local hiding choices. This only decides what the
 * extension shows; nothing here (or anywhere) writes to Google Calendar.
 * Events from disabled calendars are dropped outright and aren't listed as hidden.
 */
export function applyFilters(events: CalendarEvent[], prefs: UserPreferences, now: Date = new Date()): FilterResult {
  const disabled = new Set(prefs.disabledCalendarIds);
  const instances = new Set(prefs.hiddenInstances);
  const series = new Set(prefs.hiddenSeries);
  const rules = prefs.exclusionRules.filter((r) => r.enabled);
  const result: FilterResult = { visible: [], hidden: [] };

  for (const event of events) {
    if (disabled.has(event.calendarId) || event.status === 'cancelled') continue;

    let reason: HiddenReason | undefined;
    if (instances.has(instanceKey(event))) reason = { kind: 'instance' };
    else if (event.recurringEventId && series.has(event.recurringEventId)) reason = { kind: 'series' };
    else {
      const rule = rules.find((r) => matchesRule(event, r, now));
      if (rule) reason = { kind: 'rule', rule };
    }

    if (reason) result.hidden.push({ event, reason });
    else result.visible.push(event);
  }
  return result;
}
