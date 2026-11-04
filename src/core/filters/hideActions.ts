import type { CalendarEvent, CalendarInfo, ExclusionRule, ExclusionRuleKind, UserPreferences } from '../models';
import { instanceKey, senderMatches, type HiddenReason } from './filterEngine';

/**
 * Pure helpers that turn a "hide" or "restore" click into a preference patch.
 * Hiding is local to Dayflow; none of this touches Google Calendar.
 */

export const RULE_KIND_LABELS: Record<ExclusionRuleKind, string> = {
  titleContains: 'Title contains',
  titleEquals: 'Title is exactly',
  organizer: 'Sender / organizer',
  calendar: 'Calendar',
  declined: 'Events I declined',
  past: 'Past events',
};

const add = (list: string[], value: string) => (list.includes(value) ? list : [...list, value]);

/** Who "sent" the event: its organizer, else its creator. Undefined for your own events. */
export function senderOf(e: CalendarEvent): string | undefined {
  if (e.organizerIsSelf) return undefined;
  return e.organizerEmail ?? e.creatorEmail;
}

export function ruleSummary(rule: ExclusionRule, calendars: CalendarInfo[]): string {
  switch (rule.kind) {
    case 'calendar':
      return `Calendar: ${calendars.find((c) => c.id === rule.value)?.name ?? rule.value}`;
    case 'declined':
    case 'past':
      return RULE_KIND_LABELS[rule.kind];
    default:
      return `${RULE_KIND_LABELS[rule.kind]}: ${rule.value}`;
  }
}

export function hideInstancePatch(p: UserPreferences, e: CalendarEvent): Partial<UserPreferences> {
  return { hiddenInstances: add(p.hiddenInstances, instanceKey(e)) };
}

export function hideSeriesPatch(p: UserPreferences, e: CalendarEvent): Partial<UserPreferences> {
  return e.recurringEventId ? { hiddenSeries: add(p.hiddenSeries, e.recurringEventId) } : {};
}

/** Adds a rule unless an identical one exists; an identical disabled one is switched back on. */
export function addRulePatch(p: UserPreferences, kind: ExclusionRuleKind, value = ''): Partial<UserPreferences> {
  const v = value.trim();
  const same = (r: ExclusionRule) => r.kind === kind && r.value.trim().toLowerCase() === v.toLowerCase();
  if (p.exclusionRules.some(same)) {
    return { exclusionRules: p.exclusionRules.map((r) => (same(r) ? { ...r, enabled: true } : r)) };
  }
  return { exclusionRules: [...p.exclusionRules, { id: crypto.randomUUID(), kind, value: v, enabled: true }] };
}

export function hideSenderPatch(p: UserPreferences, email: string): Partial<UserPreferences> {
  return addRulePatch(p, 'organizer', email);
}

/** Undo for whatever hid the event. For a rule that means switching the rule off, not deleting it. */
export function restorePatch(p: UserPreferences, e: CalendarEvent, reason: HiddenReason): Partial<UserPreferences> {
  switch (reason.kind) {
    case 'instance':
      return { hiddenInstances: p.hiddenInstances.filter((k) => k !== instanceKey(e)) };
    case 'series':
      return { hiddenSeries: p.hiddenSeries.filter((s) => s !== e.recurringEventId) };
    case 'rule':
      return { exclusionRules: p.exclusionRules.map((r) => (r.id === reason.rule.id ? { ...r, enabled: false } : r)) };
  }
}

export interface SenderCount {
  email: string;
  name?: string;
  count: number;
}

/** Most frequent senders among these events, excluding you and any already covered by an active rule. */
export function senderCounts(events: CalendarEvent[], rules: ExclusionRule[]): SenderCount[] {
  const active = rules.filter((r) => r.enabled && r.kind === 'organizer');
  const counts = new Map<string, SenderCount>();
  for (const e of events) {
    const email = senderOf(e);
    if (!email || active.some((r) => senderMatches(r.value, [email]))) continue;
    const entry = counts.get(email) ?? { email, name: e.organizerName, count: 0 };
    entry.count++;
    counts.set(email, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.email.localeCompare(b.email));
}
