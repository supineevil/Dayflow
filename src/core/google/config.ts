/** An OAuth client ID is public by design (it is visible in every sign-in URL), so it lives in the build, not in a secret store. */
export const GOOGLE_CLIENT_ID: string = ((import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim();

/**
 * The narrowest scopes that cover what Dayflow does:
 * - calendar.calendarlist.readonly: list your calendars (names, colours)
 * - calendar.events.readonly: read events on those calendars
 * - calendar.events.owned: create, edit and delete events on calendars you own. Used only when you press
 *   "Create meeting", "Save", "Cancel meeting", or answer Yes/No/Maybe. Nothing is changed in the background.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.events.owned',
] as const;
