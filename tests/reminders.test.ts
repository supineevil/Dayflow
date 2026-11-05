import { describe, expect, it } from 'vitest';
import type { CalendarEvent, ResponseStatus } from '../src/core/models';
import {
  clampLead, dueReminders, markNotified, notificationId, parseNotificationId, pruneNotified, reminderKey, reminderText, safeLink,
} from '../src/core/notify/reminders';

const now = new Date('2026-11-04T10:00:00Z');
const inMin = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();

function ev(id: string, startInMin: number, selfResponse?: ResponseStatus, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id, calendarId: 'c', calendarName: 'Cal', title: id, color: '#000', isAllDay: false,
    start: inMin(startInMin), end: inMin(startInMin + 30), selfResponse, ...extra,
  } as CalendarEvent;
}

describe('dueReminders', () => {
  it('picks meetings starting within the lead time, soonest first', () => {
    const events = [ev('b', 4, 'accepted'), ev('a', 2, 'accepted'), ev('far', 20, 'accepted')];
    expect(dueReminders(events, now, 5, {}).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('includes a meeting exactly at the lead time but not one that already started', () => {
    expect(dueReminders([ev('edge', 5, 'accepted'), ev('started', 0, 'accepted'), ev('past', -3, 'accepted')], now, 5, {}).map((e) => e.id)).toEqual(['edge']);
  });
  it('only reminds for meetings you accepted', () => {
    const events = [ev('no', 1, 'declined'), ev('maybe', 2, 'tentative'), ev('new', 3, 'needsAction'), ev('yes', 4, 'accepted')];
    expect(dueReminders(events, now, 5, {}).map((e) => e.id)).toEqual(['yes']);
  });
  it('reminds for events you organise, but not for ones with no response from you that someone else owns', () => {
    const events = [ev('own', 3, undefined, { organizerIsSelf: true }), ev('list', 3, undefined, { organizerIsSelf: false }), ev('unknown', 4)];
    expect(dueReminders(events, now, 5, {}).map((e) => e.id)).toEqual(['own']);
  });
  it('skips declined, cancelled and all-day events', () => {
    const events = [ev('no', 3, 'declined'), ev('gone', 3, 'accepted', { status: 'cancelled' }), ev('day', 3, 'accepted', { isAllDay: true })];
    expect(dueReminders(events, now, 5, {})).toEqual([]);
  });
  it('does not repeat a reminder once marked, but reminds again if the event moves', () => {
    const e = ev('a', 3, 'accepted');
    const notified = markNotified({}, [e]);
    expect(dueReminders([e], now, 5, notified)).toEqual([]);
    expect(dueReminders([{ ...e, start: inMin(4) }], now, 5, notified)).toHaveLength(1);
  });
  it('uses a longer lead time when asked', () => {
    expect(dueReminders([ev('a', 10, 'accepted')], now, 15, {})).toHaveLength(1);
  });
});

describe('notified bookkeeping', () => {
  it('forgets reminders for events that started over an hour ago', () => {
    const old = ev('old', -90);
    const recent = ev('recent', -10);
    const pruned = pruneNotified(markNotified({}, [old, recent]), now);
    expect(Object.keys(pruned)).toEqual([reminderKey(recent)]);
  });
});

describe('clampLead', () => {
  it('keeps sensible values and repairs bad ones', () => {
    expect(clampLead(10)).toBe(10);
    expect(clampLead(0)).toBe(1);
    expect(clampLead(500)).toBe(60);
    expect(clampLead(undefined)).toBe(5);
    expect(clampLead('x')).toBe(5);
    expect(clampLead(NaN)).toBe(5);
    expect(clampLead(2.6)).toBe(3);
  });
});

describe('notification ids and links', () => {
  it('round-trips ids that contain colons and symbols', () => {
    const id = notificationId({ calendarId: 'me@example.com', id: 'abc:123_x' });
    expect(parseNotificationId(id)).toEqual({ calendarId: 'me@example.com', id: 'abc:123_x' });
  });
  it('rejects ids that are not ours or are malformed', () => {
    expect(parseNotificationId('something-else')).toBeNull();
    expect(parseNotificationId('dayflow-reminder:only-one')).toBeNull();
    expect(parseNotificationId('dayflow-reminder:%E0%A4%A:x')).toBeNull();
  });
  it('only opens https links', () => {
    expect(safeLink('https://meet.google.com/abc')).toBe('https://meet.google.com/abc');
    expect(safeLink('javascript:alert(1)')).toBeUndefined();
    expect(safeLink('http://example.com')).toBeUndefined();
    expect(safeLink(undefined)).toBeUndefined();
  });
});

describe('reminderText', () => {
  it('says how many minutes are left and falls back for untitled events', () => {
    expect(reminderText(ev('Standup', 4), now).message).toMatch(/^Starts in 4 min/);
    expect(reminderText(ev('x', 4, undefined, { title: '' }), now).title).toBe('(No title)');
  });
  it('rounds partial minutes up and adds the location', () => {
    const e = ev('a', 4, undefined, { start: new Date(now.getTime() + 150_000).toISOString(), location: 'Room 5' });
    expect(reminderText(e, now).message).toMatch(/^Starts in 3 min .* · Room 5$/);
  });
});
