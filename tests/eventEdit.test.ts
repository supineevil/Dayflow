import { describe, expect, it } from 'vitest';
import { buildEditPatch, canCancelEvent, canEditEvent, canRespond, changeAttendees, withResponse } from '../src/core/google/eventEdit';
import type { GoogleAttendee } from '../src/core/google/types';
import type { CalendarEvent } from '../src/core/models';

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e', calendarId: 'c', calendarName: 'C', title: 'Sync', start: '2026-11-05T09:00:00Z', end: '2026-11-05T09:30:00Z',
  isAllDay: false, color: '#000', visibility: 'default', status: 'confirmed', ...over,
});

const me: GoogleAttendee = { email: 'me@x.com', organizer: true, self: true, responseStatus: 'accepted' };
const bob: GoogleAttendee = { email: 'bob@y.com', responseStatus: 'accepted', optional: true, comment: 'maybe late' };
const room: GoogleAttendee = { email: 'room@resource.calendar.google.com', resource: true, responseStatus: 'accepted' };

describe('permissions', () => {
  it('lets organizers edit and cancel, but not edit all-day events', () => {
    expect(canEditEvent(ev({ organizerIsSelf: true }))).toBe(true);
    expect(canEditEvent(ev({ organizerIsSelf: true, isAllDay: true }))).toBe(false);
    expect(canCancelEvent(ev({ organizerIsSelf: true, isAllDay: true }))).toBe(true);
    expect(canEditEvent(ev({ organizerIsSelf: false }))).toBe(false);
  });
  it('lets invited guests respond, but not people who only follow the calendar', () => {
    expect(canRespond(ev({ organizerIsSelf: false, selfResponse: 'needsAction' }))).toBe(true);
    expect(canRespond(ev({ organizerIsSelf: false }))).toBe(false);
    expect(canRespond(ev({ organizerIsSelf: true, selfResponse: 'accepted' }))).toBe(false);
  });
});

describe('changeAttendees', () => {
  it('keeps everyone else untouched, including their flags and rooms', () => {
    const out = changeAttendees([me, bob, room], ['New@Z.com'], []);
    expect(out).toEqual([me, bob, room, { email: 'new@z.com' }]);
  });
  it('removes only the named guests, never the organizer or a room', () => {
    expect(changeAttendees([me, bob, room], [], ['bob@y.com', 'me@x.com', room.email!])).toEqual([me, room]);
  });
  it('does not duplicate someone already invited', () => {
    expect(changeAttendees([me, bob], ['BOB@y.com', 'c@z.com', 'c@z.com'], [])).toEqual([me, bob, { email: 'c@z.com' }]);
  });
});

describe('withResponse', () => {
  it('changes only your own answer', () => {
    const mine: GoogleAttendee = { email: 'me@x.com', self: true, responseStatus: 'needsAction' };
    expect(withResponse([bob, mine], 'declined')).toEqual([bob, { ...mine, responseStatus: 'declined' }]);
  });
  it('returns null when you are not on the list', () => {
    expect(withResponse([bob], 'accepted')).toBeNull();
  });
});

describe('buildEditPatch', () => {
  const orig = ev();
  const same = { title: 'Sync', start: new Date('2026-11-05T09:00:00Z'), durationMinutes: 30, timeZone: 'Europe/London' };
  it('sends nothing when nothing changed', () => {
    expect(buildEditPatch(orig, same)).toEqual({});
  });
  it('sends only the title when only the title changed', () => {
    expect(buildEditPatch(orig, { ...same, title: ' Renewal ' })).toEqual({ summary: 'Renewal' });
  });
  it('sends start and end together when the time or length changed', () => {
    expect(buildEditPatch(orig, { ...same, durationMinutes: 45 })).toEqual({
      start: { dateTime: '2026-11-05T09:00:00.000Z', timeZone: 'Europe/London' },
      end: { dateTime: '2026-11-05T09:45:00.000Z', timeZone: 'Europe/London' },
    });
  });
  it('includes guests only when a new list is supplied', () => {
    expect(buildEditPatch(orig, { ...same, attendees: [me, bob] })).toEqual({ attendees: [me, bob] });
  });
  it('ignores a blank title', () => {
    expect(buildEditPatch(orig, { ...same, title: '   ' })).toEqual({});
  });
});
