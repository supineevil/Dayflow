/** The subset of Google Calendar API v3 fields Dayflow reads. */
export interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  deleted?: boolean;
}

export interface GoogleEventTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
  organizer?: boolean;
  resource?: boolean;
  optional?: boolean;
  comment?: string;
  additionalGuests?: number;
}

export interface GoogleEvent {
  id?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  recurringEventId?: string;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  attendees?: GoogleAttendee[];
  /** True when Google trimmed the attendee list, so it must not be written back. */
  attendeesOmitted?: boolean;
  htmlLink?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  creator?: { email?: string; self?: boolean };
}
