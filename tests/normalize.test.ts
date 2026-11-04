import { describe, expect, it } from 'vitest';
import { findMeetingLink, htmlToText, normalizeEvent } from '../src/core/google/normalize';

const cal = { id: 'primary', name: 'Work', color: '#123456' };

describe('normalizeEvent', () => {
  it('keeps date-only values for all-day events', () => {
    const e = normalizeEvent({ id: '1', summary: 'Holiday', start: { date: '2026-12-25' }, end: { date: '2026-12-26' } }, cal)!;
    expect(e.isAllDay).toBe(true);
    expect(e.start).toBe('2026-12-25');
    expect(e.end).toBe('2026-12-26');
  });

  it('keeps the RFC3339 offset on timed events', () => {
    const e = normalizeEvent({ id: '1', start: { dateTime: '2026-11-04T09:00:00-05:00' }, end: { dateTime: '2026-11-04T10:00:00-05:00' } }, cal)!;
    expect(e.isAllDay).toBe(false);
    expect(e.start).toBe('2026-11-04T09:00:00-05:00');
  });

  it('titles untitled (busy-only) events "Busy"', () => {
    const e = normalizeEvent({ id: '1', start: { dateTime: '2026-11-04T09:00:00Z' }, end: { dateTime: '2026-11-04T10:00:00Z' } }, cal)!;
    expect(e.title).toBe('Busy');
  });

  it('reads only your own RSVP', () => {
    const e = normalizeEvent(
      { id: '1', start: { dateTime: '2026-11-04T09:00:00Z' }, end: { dateTime: '2026-11-04T10:00:00Z' },
        attendees: [{ responseStatus: 'accepted' }, { self: true, responseStatus: 'declined' }] }, cal)!;
    expect(e.selfResponse).toBe('declined');
  });

  it('leaves selfResponse unset when you are not an attendee, and ignores unknown values', () => {
    const base = { id: '1', start: { dateTime: '2026-11-04T09:00:00Z' }, end: { dateTime: '2026-11-04T10:00:00Z' } };
    expect(normalizeEvent(base, cal)!.selfResponse).toBeUndefined();
    expect(normalizeEvent({ ...base, attendees: [{ self: true, responseStatus: 'weird' }] }, cal)!.selfResponse).toBeUndefined();
  });

  it('returns a cancelled tombstone for id-only cancelled entries and null for junk', () => {
    expect(normalizeEvent({ id: 'x', status: 'cancelled' }, cal)).toMatchObject({ id: 'x', status: 'cancelled' });
    expect(normalizeEvent({ summary: 'no id' }, cal)).toBeNull();
    expect(normalizeEvent({ id: 'x' }, cal)).toBeNull();
  });
});

describe('findMeetingLink', () => {
  const g = { id: '1' };
  it('prefers conference video entry points, then hangoutLink, then text', () => {
    expect(findMeetingLink({ ...g, conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:1' }, { entryPointType: 'video', uri: 'https://v' }] }, hangoutLink: 'https://h' })).toBe('https://v');
    expect(findMeetingLink({ ...g, hangoutLink: 'https://h' })).toBe('https://h');
    expect(findMeetingLink({ ...g, description: 'Join: https://acme.zoom.us/j/123?pwd=x thanks' })).toBe('https://acme.zoom.us/j/123?pwd=x');
    expect(findMeetingLink({ ...g, location: 'https://example.com/not-a-meeting' })).toBeUndefined();
  });
});

describe('htmlToText', () => {
  it('strips tags and decodes entities without keeping markup', () => {
    expect(htmlToText('<p>Hi <b>there</b> &amp; welcome</p><script>alert(1)</script>')).toBe('Hi there & welcome\nalert(1)');
  });
});
