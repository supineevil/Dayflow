import { describe, expect, it } from 'vitest';
import { buildMeetingBody, fitsWorkingHours, parseEmails, zoneTimesText } from '../src/core/google/meeting';
import { gmtOffsetLabel, inWorkingHours, minuteInHours, zoneTag, zonedTimeToDate } from '../src/core/time/zones';

describe('zonedTimeToDate', () => {
  const iso = (d: string, t: string, z: string) => zonedTimeToDate(d, t, z).toISOString();
  it('converts wall-clock time to the right instant either side of daylight saving', () => {
    expect(iso('2026-01-15', '09:00', 'America/New_York')).toBe('2026-01-15T14:00:00.000Z');
    expect(iso('2026-07-15', '09:00', 'America/New_York')).toBe('2026-07-15T13:00:00.000Z');
    expect(iso('2026-07-15', '09:00', 'Europe/London')).toBe('2026-07-15T08:00:00.000Z');
  });
  it('handles the weeks when the US has changed its clocks and the UK has not', () => {
    expect(iso('2026-03-10', '09:00', 'America/New_York')).toBe('2026-03-10T13:00:00.000Z');
    expect(iso('2026-03-10', '09:00', 'Europe/London')).toBe('2026-03-10T09:00:00.000Z');
  });
  it('handles half-hour offsets and a date that differs from UTC', () => {
    expect(iso('2026-11-05', '10:00', 'Asia/Kolkata')).toBe('2026-11-05T04:30:00.000Z');
    expect(iso('2026-11-05', '07:00', 'Australia/Sydney')).toBe('2026-11-04T20:00:00.000Z');
  });
  it('round-trips the minute exactly', () => {
    const d = zonedTimeToDate('2026-11-05', '16:45', 'America/Los_Angeles');
    expect(d.toISOString()).toBe('2026-11-06T00:45:00.000Z');
  });
});

describe('parseEmails', () => {
  it('splits, lower-cases, de-duplicates and reports invalid entries', () => {
    expect(parseEmails('A@x.com, b@y.org;a@x.com  nope <c@z.io>')).toEqual({ valid: ['a@x.com', 'b@y.org', 'c@z.io'], invalid: ['nope'] });
  });
  it('ignores empty input', () => {
    expect(parseEmails('  , ; ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('buildMeetingBody', () => {
  const start = zonedTimeToDate('2026-11-05', '15:00', 'Europe/London');
  const base = { title: '  Customer sync ', start, durationMinutes: 30, attendees: ['a@x.com'], timeZone: 'Europe/London', requestId: 'req-1' };

  it('asks Google to create a Meet and invites the attendees', () => {
    const b = buildMeetingBody(base);
    expect(b.summary).toBe('Customer sync');
    expect(b.attendees).toEqual([{ email: 'a@x.com' }]);
    expect(b.conferenceData.createRequest).toEqual({ requestId: 'req-1', conferenceSolutionKey: { type: 'hangoutsMeet' } });
    expect(b.start).toEqual({ dateTime: '2026-11-05T15:00:00.000Z', timeZone: 'Europe/London' });
    expect(b.end.dateTime).toBe('2026-11-05T15:30:00.000Z');
    expect('description' in b).toBe(false);
  });
  it('writes each selected zone into the description after your notes', () => {
    const b = buildMeetingBody({ ...base, notes: 'Agenda: renewal', zones: ['America/New_York', 'America/Los_Angeles'] });
    expect(b.description).toBe(
      'Agenda: renewal\n\nMeeting time\nNew York: Thu 5 Nov, 10 am – 10:30 am EST\nLos Angeles: Thu 5 Nov, 7 am – 7:30 am PST',
    );
  });
});

describe('zones and working hours', () => {
  const hours = { start: '09:00', end: '17:00' };
  it('flags a meeting that spills past the end of the day in a zone', () => {
    const start = zonedTimeToDate('2026-11-05', '16:45', 'America/New_York');
    expect(fitsWorkingHours(start, 15, 'America/New_York', hours)).toBe(true);
    expect(fitsWorkingHours(start, 30, 'America/New_York', hours)).toBe(false);
  });
  it('formats times per zone', () => {
    const s = zonedTimeToDate('2026-11-05', '09:00', 'America/New_York');
    expect(zoneTimesText(s, new Date(s.getTime() + 3_600_000), ['Europe/London'])).toBe('London: Thu 5 Nov, 2 pm – 3 pm GMT');
  });
});

describe('gmtOffsetLabel', () => {
  const at = (iso: string) => new Date(iso);
  it('shows whole-hour offsets with a minus sign, and follows daylight saving', () => {
    expect(gmtOffsetLabel(at('2026-01-15T12:00:00Z'), 'America/New_York')).toBe('GMT−5');
    expect(gmtOffsetLabel(at('2026-07-15T12:00:00Z'), 'America/New_York')).toBe('GMT−4');
    expect(gmtOffsetLabel(at('2026-01-15T12:00:00Z'), 'America/Los_Angeles')).toBe('GMT−8');
    expect(gmtOffsetLabel(at('2026-07-15T12:00:00Z'), 'America/Los_Angeles')).toBe('GMT−7');
  });
  it('shows plain GMT at zero, and the UK summer hour', () => {
    expect(gmtOffsetLabel(at('2026-01-15T12:00:00Z'), 'Europe/London')).toBe('GMT');
    expect(gmtOffsetLabel(at('2026-07-15T12:00:00Z'), 'Europe/London')).toBe('GMT+1');
  });
  it('handles half-hour and quarter-hour zones, and ignores seconds', () => {
    expect(gmtOffsetLabel(at('2026-11-05T04:30:45Z'), 'Asia/Kolkata')).toBe('GMT+5:30');
    expect(gmtOffsetLabel(at('2026-11-05T04:30:00Z'), 'Asia/Kathmandu')).toBe('GMT+5:45');
  });
  it('differs between the US and UK in the weeks their clock changes are apart', () => {
    expect(gmtOffsetLabel(at('2026-03-10T12:00:00Z'), 'America/New_York')).toBe('GMT−4');
    expect(gmtOffsetLabel(at('2026-03-10T12:00:00Z'), 'Europe/London')).toBe('GMT');
  });
});

describe('zoneTag', () => {
  it('shows the abbreviation and offset, without repeating itself', () => {
    expect(zoneTag(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe('EST · GMT−5');
    expect(zoneTag(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe('EDT · GMT−4');
    expect(zoneTag(new Date('2026-01-15T12:00:00Z'), 'Europe/London')).toBe('GMT');
    expect(zoneTag(new Date('2026-07-15T12:00:00Z'), 'Europe/London')).toBe('BST · GMT+1');
    expect(zoneTag(new Date('2026-11-05T04:30:00Z'), 'Asia/Kolkata')).toBe('GMT+5:30');
  });
});

describe('working hours that run past midnight', () => {
  const night = { start: '18:00', end: '03:00' };
  it('counts the evening and the small hours, not the daytime', () => {
    expect(minuteInHours(18 * 60, night)).toBe(true);
    expect(minuteInHours(23 * 60 + 59, night)).toBe(true);
    expect(minuteInHours(0, night)).toBe(true);
    expect(minuteInHours(2 * 60 + 59, night)).toBe(true);
    expect(minuteInHours(3 * 60, night)).toBe(false);
    expect(minuteInHours(12 * 60, night)).toBe(false);
    expect(minuteInHours(17 * 60 + 59, night)).toBe(false);
  });
  it('still handles an ordinary day, and treats equal start and end as no hours', () => {
    expect(minuteInHours(9 * 60, { start: '09:00', end: '17:00' })).toBe(true);
    expect(minuteInHours(17 * 60, { start: '09:00', end: '17:00' })).toBe(false);
    expect(minuteInHours(9 * 60, { start: '09:00', end: '09:00' })).toBe(false);
  });
  it('applies per zone: 18:00-03:00 in New York is a different instant than in India', () => {
    const ny = zonedTimeToDate('2026-11-05', '21:00', 'America/New_York');
    expect(inWorkingHours(ny, 'America/New_York', night)).toBe(true);
    expect(inWorkingHours(ny, 'Asia/Kolkata', night)).toBe(false);
  });
});
