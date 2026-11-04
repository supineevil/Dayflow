import { describe, expect, it } from 'vitest';
import type { CalendarEvent, ResponseStatus } from '../src/core/models';
import { isAttending, needsReply, pickNextEvent, upcomingAttending } from '../src/core/planning/nextEvent';

const now = new Date('2026-11-04T10:00:00Z');
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 4, h, m)).toISOString();

function ev(id: string, startH: number, endH: number, selfResponse?: ResponseStatus, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id, calendarId: 'c', calendarName: 'Cal', title: id, color: '#000', isAllDay: false,
    start: at(startH), end: at(endH), selfResponse, ...extra,
  } as CalendarEvent;
}

describe('next up ignores events you declined', () => {
  it('skips a declined event even when it is the soonest', () => {
    const events = [ev('declined', 11, 12, 'declined'), ev('yes', 13, 14, 'accepted')];
    expect(pickNextEvent(events, now)?.id).toBe('yes');
  });
  it('skips a declined event that is in progress', () => {
    const events = [ev('declined', 9, 11, 'declined'), ev('later', 12, 13, 'tentative')];
    expect(pickNextEvent(events, now)?.id).toBe('later');
  });
  it('returns nothing when everything left is declined', () => {
    expect(pickNextEvent([ev('a', 11, 12, 'declined')], now)).toBeUndefined();
  });
  it('keeps yes, maybe, unanswered and your own events (no invite)', () => {
    const events = [ev('own', 11, 12, undefined), ev('maybe', 12, 13, 'tentative'), ev('new', 13, 14, 'needsAction'), ev('yes', 14, 15, 'accepted')];
    expect(upcomingAttending(events, now).map((e) => e.id)).toEqual(['own', 'maybe', 'new', 'yes']);
  });
  it('orders by start time and drops finished and all-day events', () => {
    const events = [ev('late', 15, 16, 'accepted'), ev('over', 8, 9, 'accepted'), ev('soon', 11, 12, 'accepted'), ev('allday', 0, 24, 'accepted', { isAllDay: true })];
    expect(upcomingAttending(events, now).map((e) => e.id)).toEqual(['soon', 'late']);
  });
  it('flags only unanswered invites', () => {
    expect(needsReply(ev('a', 11, 12, 'needsAction'))).toBe(true);
    for (const r of ['accepted', 'tentative', 'declined'] as const) expect(needsReply(ev('a', 11, 12, r))).toBe(false);
    expect(needsReply(ev('own', 11, 12))).toBe(false);
    expect(isAttending(ev('a', 11, 12, 'declined'))).toBe(false);
  });
});
