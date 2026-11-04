export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'needsAction';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type EventVisibility = 'default' | 'public' | 'private' | 'confidential';

export interface CalendarInfo {
  id: string;
  name: string;
  /** Hex colour, e.g. #6366f1. */
  color: string;
  primary?: boolean;
}

export interface CalendarEvent {
  /** Unique within a calendar. Recurring events are expanded, so each instance has its own id. */
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  /** Plain text only. Never render as HTML. */
  description?: string;
  /**
   * Timed events: RFC 3339 with offset. All-day events: `yyyy-MM-dd`.
   * As in Google Calendar, an all-day `end` is exclusive.
   */
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
  meetingLink?: string;
  color: string;
  /** Set when this event is an instance of a recurring series. */
  recurringEventId?: string;
  visibility: EventVisibility;
  status: EventStatus;
  /** The signed-in user's own response, if they are an attendee. */
  selfResponse?: ResponseStatus;
  htmlLink?: string;
  /** Lower-cased email of the event's organizer (the calendar or person that owns it), when Google provides one. */
  organizerEmail?: string;
  organizerName?: string;
  /** True when you are the organizer. */
  organizerIsSelf?: boolean;
  /** Lower-cased email of whoever created the event, which can differ from the organizer for synced or imported events. */
  creatorEmail?: string;
}
