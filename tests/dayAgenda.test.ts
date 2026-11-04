import { describe, expect, it } from 'vitest';
import type { CalendarEvent, ResponseStatus } from '../src/core/models';
import { dayAgenda } from '../src/core/planning/dayAgenda';

const day = new Date(2026, 10, 5, 0, 0);
const local = (h: number, m = 0) => new Date(2026, 10, 5, h, m).toISOString();

const ev = (id: string, h: number, selfResponse?: ResponseStatus, extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ id, calendarId: 'c', calendarName: 'Cal', title: id, color: '#000', isAllDay: false, start: local(h), end: local(h + 1), selfResponse, ...extra }) as CalendarEvent;

describe('dayAgenda', () => {
  it('lists timed events in order, hides declined, and splits out all-day', () => {
    const events = [
      ev('late', 15, 'accepted'),
      ev('no', 9, 'declined'),
      ev('early', 8, 'tentative'),
      ev('new', 11, 'needsAction'),
      ev('holiday', 0, undefined, { isAllDay: true, start: '2026-11-05', end: '2026-11-06' }),
    ];
    const r = dayAgenda(events, day);
    expect(r.timed.map((e) => e.id)).toEqual(['early', 'new', 'late']);
    expect(r.allDay.map((e) => e.id)).toEqual(['holiday']);
  });
  it('ignores other days', () => {
    const other = { ...ev('x', 10, 'accepted'), start: new Date(2026, 10, 6, 10).toISOString(), end: new Date(2026, 10, 6, 11).toISOString() } as CalendarEvent;
    expect(dayAgenda([other], day)).toEqual({ allDay: [], timed: [] });
  });
});
