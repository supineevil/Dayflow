import { describe, expect, it } from 'vitest';
import { applyFilters, senderMatches } from '../src/core/filters/filterEngine';
import { addRulePatch, hideInstancePatch, hideSenderPatch, hideSeriesPatch, restorePatch, senderCounts, senderOf } from '../src/core/filters/hideActions';
import { DEFAULT_PREFS, type CalendarEvent, type UserPreferences } from '../src/core/models';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e', calendarId: 'c', calendarName: 'C', title: 'Standup', start: '2026-11-05T09:00:00Z', end: '2026-11-05T09:15:00Z',
  isAllDay: false, color: '#000', visibility: 'default', status: 'confirmed', ...over,
});
const prefs = (over: Partial<UserPreferences> = {}): UserPreferences => ({ ...DEFAULT_PREFS, ...over });
const apply = (events: CalendarEvent[], p: UserPreferences) => applyFilters(events, p, new Date('2026-11-04T00:00:00Z'));

describe('senderMatches', () => {
  it('matches full addresses exactly and domains by suffix, ignoring case', () => {
    expect(senderMatches('Casework@Assembled.com', ['casework@assembled.com'])).toBe(true);
    expect(senderMatches('casework@assembled.com', ['other@assembled.com'])).toBe(false);
    expect(senderMatches('@assembled.com', ['anyone@assembled.com'])).toBe(true);
    expect(senderMatches('assembled.com', ['anyone@assembled.com'])).toBe(true);
  });
  it('does not match look-alike domains or empty input', () => {
    expect(senderMatches('assembled.com', ['x@notassembled.com'])).toBe(false);
    expect(senderMatches('assembled.com', ['x@assembled.com.evil.io'])).toBe(false);
    expect(senderMatches('', ['x@y.com'])).toBe(false);
    expect(senderMatches('x@y.com', [undefined])).toBe(false);
  });
});

describe('organizer rule', () => {
  it('hides events by organizer or creator, and reports the rule as the reason', () => {
    const rule = { id: 'r1', kind: 'organizer' as const, value: '@assembled.com', enabled: true };
    const events = [
      ev({ id: '1', title: 'CASEWORK', organizerEmail: 'bot@assembled.com' }),
      ev({ id: '2', title: 'Imported', organizerEmail: 'me@x.com', creatorEmail: 'sync@assembled.com' }),
      ev({ id: '3', title: 'Keep', organizerEmail: 'boss@x.com' }),
    ];
    const r = apply(events, prefs({ exclusionRules: [rule] }));
    expect(r.visible.map((e) => e.id)).toEqual(['3']);
    expect(r.hidden.map((h) => h.event.id).sort()).toEqual(['1', '2']);
    expect(r.hidden[0]!.reason).toEqual({ kind: 'rule', rule });
  });
  it('ignores a disabled rule', () => {
    const rule = { id: 'r1', kind: 'organizer' as const, value: '@assembled.com', enabled: false };
    expect(apply([ev({ organizerEmail: 'bot@assembled.com' })], prefs({ exclusionRules: [rule] })).visible).toHaveLength(1);
  });
});

describe('hide and restore', () => {
  it('hides one instance, then restores it', () => {
    const e = ev({});
    let p = prefs();
    p = { ...p, ...hideInstancePatch(p, e) };
    expect(apply([e], p).hidden[0]!.reason.kind).toBe('instance');
    const reason = apply([e], p).hidden[0]!.reason;
    p = { ...p, ...restorePatch(p, e, reason) };
    expect(apply([e], p).visible).toHaveLength(1);
  });
  it('hides a whole series and does nothing for a non-recurring event', () => {
    const a = ev({ id: 'a', recurringEventId: 'S' });
    const b = ev({ id: 'b', recurringEventId: 'S' });
    let p = prefs();
    p = { ...p, ...hideSeriesPatch(p, a) };
    expect(apply([a, b], p).visible).toHaveLength(0);
    expect(hideSeriesPatch(prefs(), ev({}))).toEqual({});
  });
  it('restoring a rule-hidden event switches the rule off instead of deleting it', () => {
    const e = ev({ organizerEmail: 'bot@assembled.com' });
    let p = prefs();
    p = { ...p, ...hideSenderPatch(p, 'bot@assembled.com') };
    const reason = apply([e], p).hidden[0]!.reason;
    p = { ...p, ...restorePatch(p, e, reason) };
    expect(p.exclusionRules).toHaveLength(1);
    expect(p.exclusionRules[0]!.enabled).toBe(false);
    expect(apply([e], p).visible).toHaveLength(1);
  });
  it('does not duplicate a rule and re-enables an identical disabled one', () => {
    let p = prefs();
    p = { ...p, ...addRulePatch(p, 'organizer', 'A@B.com') };
    p = { ...p, exclusionRules: p.exclusionRules.map((r) => ({ ...r, enabled: false })) };
    p = { ...p, ...addRulePatch(p, 'organizer', 'a@b.com') };
    expect(p.exclusionRules).toHaveLength(1);
    expect(p.exclusionRules[0]!.enabled).toBe(true);
  });
});

describe('senders', () => {
  it('ignores your own events and counts the rest, skipping senders already hidden by a rule', () => {
    const events = [
      ev({ id: '1', organizerEmail: 'me@x.com', organizerIsSelf: true }),
      ev({ id: '2', organizerEmail: 'bot@assembled.com' }),
      ev({ id: '3', organizerEmail: 'bot@assembled.com' }),
      ev({ id: '4', organizerEmail: 'boss@x.com' }),
    ];
    expect(senderOf(events[0]!)).toBeUndefined();
    expect(senderCounts(events, []).map((s) => [s.email, s.count])).toEqual([['bot@assembled.com', 2], ['boss@x.com', 1]]);
    const rule = { id: 'r', kind: 'organizer' as const, value: '@assembled.com', enabled: true };
    expect(senderCounts(events, [rule]).map((s) => s.email)).toEqual(['boss@x.com']);
  });
});
