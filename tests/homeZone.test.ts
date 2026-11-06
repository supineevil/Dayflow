import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../src/core/models';
import { dayPhase, greeting } from '../src/core/planning/greeting';
import { dayAgenda } from '../src/core/planning/dayAgenda';
import { workingInterval } from '../src/core/planning/dayPlan';
import { convertWorkingHours } from '../src/core/time/workingHoursZone';
import { daySpill, eventsOnDay, groupByDay, occursOnDay } from '../src/core/time/eventTime';
import { dayFromKey, dayKeyIn, dayKeyOf, hhmm, resolveZone, systemZone, todayIn, zonedDayEnd, zonedDayStart } from '../src/core/time/zones';

const EST = 'America/New_York';
const IST = 'Asia/Kolkata';

const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ id, calendarId: 'c', calendarName: 'Cal', title: id, color: '#000', isAllDay: false, start, end, ...extra }) as CalendarEvent;

// 5 Nov 2026 is standard time in New York (EST, UTC-5) and India is UTC+5:30.
const nov5 = dayFromKey('2026-11-05');

describe('day values', () => {
  it('round-trips a date key and reads the date on a wall clock in a zone', () => {
    expect(dayKeyOf(dayFromKey('2026-11-05'))).toBe('2026-11-05');
    // 02:00 UTC on 6 Nov is still the evening of 5 Nov in New York, but already the 6th in India.
    const instant = new Date('2026-11-06T02:00:00Z');
    expect(dayKeyIn(instant, EST)).toBe('2026-11-05');
    expect(dayKeyIn(instant, IST)).toBe('2026-11-06');
    expect(dayKeyOf(todayIn(instant, EST))).toBe('2026-11-05');
  });
  it('finds the real start and end of a day in a zone', () => {
    expect(zonedDayStart(nov5, EST).toISOString()).toBe('2026-11-05T05:00:00.000Z');
    expect(zonedDayEnd(nov5, EST).toISOString()).toBe('2026-11-06T05:00:00.000Z');
    expect(zonedDayStart(nov5, IST).toISOString()).toBe('2026-11-04T18:30:00.000Z');
  });
  it('handles a 25-hour day when clocks go back (1 Nov 2026 in New York)', () => {
    const day = dayFromKey('2026-11-01');
    const hours = (zonedDayEnd(day, EST).getTime() - zonedDayStart(day, EST).getTime()) / 3_600_000;
    expect(hours).toBe(25);
  });
  it('formats minutes as HH:mm and falls back to this computer when the zone is empty or invalid', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(9 * 60 + 5)).toBe('09:05');
    expect(resolveZone('')).toBe(systemZone());
    expect(resolveZone('Not/AZone')).toBe(systemZone());
    expect(resolveZone(EST)).toBe(EST);
  });
});

describe('which day an event belongs to', () => {
  // 9pm New York on 5 Nov = 7:30am India on 6 Nov.
  const evening = ev('evening', '2026-11-06T02:00:00Z', '2026-11-06T03:00:00Z');
  it('depends on the zone the day is read in', () => {
    expect(occursOnDay(evening, nov5, EST)).toBe(true);
    expect(occursOnDay(evening, nov5, IST)).toBe(false);
    expect(occursOnDay(evening, dayFromKey('2026-11-06'), IST)).toBe(true);
    expect(occursOnDay(evening, dayFromKey('2026-11-06'), EST)).toBe(false);
  });
  it('keeps a whole US working day on one page, even though it crosses midnight in India', () => {
    // 9am to 8:30pm New York on 5 Nov is 7:30pm on the 5th to 7am on the 6th in India, so India splits it across two days.
    const events = [
      ev('morning', '2026-11-05T14:00:00Z', '2026-11-05T15:00:00Z'),
      ev('afternoon', '2026-11-05T19:00:00Z', '2026-11-05T20:00:00Z'),
      ev('night', '2026-11-06T00:30:00Z', '2026-11-06T01:30:00Z'),
    ];
    expect(eventsOnDay(events, nov5, EST).map((e) => e.id)).toEqual(['morning', 'afternoon', 'night']);
    expect(eventsOnDay(events, nov5, IST).map((e) => e.id)).toEqual(['morning']);
  });
  it('treats an event that ends exactly at midnight as belonging to the earlier day only', () => {
    const e = ev('late', '2026-11-06T04:00:00Z', '2026-11-06T05:00:00Z'); // 11pm to midnight New York
    expect(occursOnDay(e, nov5, EST)).toBe(true);
    expect(occursOnDay(e, dayFromKey('2026-11-06'), EST)).toBe(false);
  });
  it('puts all-day events on the same date in every zone', () => {
    const holiday = ev('holiday', '2026-11-05', '2026-11-06', { isAllDay: true });
    expect(occursOnDay(holiday, nov5, EST)).toBe(true);
    expect(occursOnDay(holiday, nov5, IST)).toBe(true);
    expect(occursOnDay(holiday, dayFromKey('2026-11-06'), IST)).toBe(false);
  });
  it('groups an agenda and a popup day by the zone too', () => {
    const events = [ev('evening', '2026-11-06T02:00:00Z', '2026-11-06T03:00:00Z', { selfResponse: 'accepted' })];
    const groups = groupByDay(events, nov5, 2, EST);
    expect(groups.map((g) => g.events.length)).toEqual([1, 0]);
    expect(dayAgenda(events, nov5, EST).timed).toHaveLength(1);
    expect(dayAgenda(events, nov5, IST).timed).toHaveLength(0);
  });
});

describe('working hours and the greeting in a zone', () => {
  it('reads working hours as wall-clock time in the zone', () => {
    const w = workingInterval(nov5, { start: '09:00', end: '17:30' }, EST);
    expect(w.start.toISOString()).toBe('2026-11-05T14:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-05T22:30:00.000Z');
  });
  it('lets an overnight shift run into the next day in that zone', () => {
    const w = workingInterval(nov5, { start: '18:00', end: '03:00' }, EST);
    expect(w.start.toISOString()).toBe('2026-11-05T23:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-06T08:00:00.000Z');
  });
  it('judges the time of day in the zone, not on this computer', () => {
    const hours = { start: '09:00', end: '17:00' };
    const instant = new Date('2026-11-05T15:00:00Z'); // 10am New York, 8:30pm India
    expect(dayPhase(instant, hours, EST)).toBe('working');
    expect(dayPhase(instant, hours, IST)).toBe('late');
    expect(typeof greeting(instant, hours, EST)).toBe('string');
  });
});

describe('converting working hours to a new zone', () => {
  const at = new Date('2026-11-05T12:00:00Z');
  it('keeps the same moments in time', () => {
    expect(convertWorkingHours({ start: '09:00', end: '17:30' }, IST, EST, at)).toEqual({ start: '22:30', end: '07:00' });
    expect(convertWorkingHours({ start: '22:30', end: '07:00' }, EST, IST, at)).toEqual({ start: '09:00', end: '17:30' });
  });
  it('leaves the hours alone when the zone is the same', () => {
    const h = { start: '09:00', end: '17:30' };
    expect(convertWorkingHours(h, EST, EST, at)).toBe(h);
  });
  it('converts an overnight shift', () => {
    expect(convertWorkingHours({ start: '18:00', end: '03:00' }, EST, IST, at)).toEqual({ start: '04:30', end: '13:30' });
  });
});

describe('meetings that cross midnight', () => {
  // 11pm to 12:15am New York: 5 Nov 23:00 to 6 Nov 00:15 local, i.e. 04:00 to 05:15 UTC on the 6th.
  const late = ev('late', '2026-11-06T04:00:00Z', '2026-11-06T05:15:00Z');
  it('says it carries on past midnight on the day it starts', () => {
    expect(daySpill(late, nov5, EST)).toEqual({ fromEarlier: false, intoLater: true });
  });
  it('says it began the day before on the day it ends', () => {
    expect(daySpill(late, dayFromKey('2026-11-06'), EST)).toEqual({ fromEarlier: true, intoLater: false });
  });
  it('says nothing for an ordinary or all-day event', () => {
    const noon = ev('noon', '2026-11-05T17:00:00Z', '2026-11-05T18:00:00Z');
    expect(daySpill(noon, nov5, EST)).toEqual({ fromEarlier: false, intoLater: false });
    expect(daySpill(ev('hol', '2026-11-05', '2026-11-07', { isAllDay: true }), nov5, EST)).toEqual({ fromEarlier: false, intoLater: false });
  });
  it('depends on the zone the day is read in', () => {
    // The same meeting is 9:30am to 10:45am on the 6th in India, so it crosses nothing there.
    expect(daySpill(late, dayFromKey('2026-11-06'), IST)).toEqual({ fromEarlier: false, intoLater: false });
  });
});
