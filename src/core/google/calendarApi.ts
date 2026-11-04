import { backoffDelay, sleep } from '../sync/backoff';
import { AuthError, discardToken, getAccessToken } from './auth';
import type { GoogleCalendarListEntry, GoogleEvent } from './types';

const BASE = 'https://www.googleapis.com/calendar/v3';
const MAX_RETRIES = 4;
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded'];

export class ApiError extends Error {
  constructor(public status: number, public reason: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
  }
  /** 0 means the request never reached Google (offline, DNS, blocked). */
  get isNetwork() {
    return this.status === 0;
  }
  /** The saved token predates a scope Dayflow now asks for; reconnecting fixes it. */
  get isInsufficientScope() {
    return this.status === 403 && (this.reason === 'insufficientPermissions' || /insufficient|scope/i.test(this.message));
  }
  get isRateLimit() {
    return this.status === 429 || (this.status === 403 && !!this.reason && RATE_LIMIT_REASONS.includes(this.reason));
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function readError(res: Response): Promise<{ reason?: string; message: string }> {
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[] } };
    return { reason: body.error?.errors?.[0]?.reason, message: body.error?.message ?? res.statusText };
  } catch {
    return { message: res.statusText };
  }
}

/**
 * Authenticated request with one token refresh on 401 and backoff on rate limits.
 * 5xx is retried for GET only: a write that failed midway may have been applied, and repeating it could duplicate or double-notify.
 */
async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, params: Params, loginHint?: string, body?: unknown): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));

  let refreshedAuth = false;
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken(loginHint);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, undefined, 'Could not reach Google. Check your connection.');
    }
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

    if (res.status === 401 && !refreshedAuth) {
      refreshedAuth = true;
      await discardToken();
      continue;
    }
    if (res.status === 401) throw new AuthError('expired', 'Google rejected the saved sign-in.');

    const { reason, message } = await readError(res);
    const error = new ApiError(res.status, reason, message);
    if ((error.isRateLimit || (method === 'GET' && res.status >= 500)) && attempt < MAX_RETRIES) {
      await sleep(backoffDelay(attempt));
      continue;
    }
    throw error;
  }
}

const get = <T>(path: string, params: Params, loginHint?: string) => request<T>('GET', path, params, loginHint);

interface ListPage<T> {
  items?: T[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export async function listCalendars(loginHint?: string): Promise<GoogleCalendarListEntry[]> {
  const all: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const page = await get<ListPage<GoogleCalendarListEntry>>(
      '/users/me/calendarList',
      { fields: 'items(id,summary,summaryOverride,backgroundColor,primary,deleted),nextPageToken', maxResults: 250, pageToken },
      loginHint,
    );
    all.push(...(page.items ?? []).filter((c) => !c.deleted));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

export interface ListEventsOptions {
  /** Incremental sync. Per Google, timeMin/timeMax/updatedMin/q/orderBy cannot accompany a syncToken. */
  syncToken?: string;
  /** Initial full sync only. */
  timeMin?: string;
  timeMax?: string;
}

export interface ListEventsResult {
  events: GoogleEvent[];
  nextSyncToken?: string;
}

/** Fetches every page. Throws ApiError(410) when the sync token is no longer valid. */
export async function listEvents(calendarId: string, opts: ListEventsOptions, loginHint?: string): Promise<ListEventsResult> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const page = await get<ListPage<GoogleEvent>>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        singleEvents: true,
        maxResults: 2500,
        pageToken,
        syncToken: opts.syncToken,
        timeMin: opts.syncToken ? undefined : opts.timeMin,
        timeMax: opts.syncToken ? undefined : opts.timeMax,
        fields:
          'items(id,status,summary,description,location,start,end,hangoutLink,conferenceData/entryPoints(entryPointType,uri),' +
          'recurringEventId,visibility,attendees(self,responseStatus),organizer(email,displayName,self),creator(email),htmlLink),nextPageToken,nextSyncToken',
      },
      loginHint,
    );
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken };
}

const CREATED_FIELDS = 'id,htmlLink,hangoutLink,conferenceData(entryPoints(entryPointType,uri))';

/**
 * Creates an event on your primary calendar with a Google Meet link and emails the attendees.
 * `body` comes from buildMeetingBody. Google may fill in the Meet link a moment after the insert returns,
 * so if it's missing we look the event up again a few times.
 */
export async function insertEvent(body: unknown, loginHint?: string): Promise<GoogleEvent> {
  const created = await request<GoogleEvent>(
    'POST',
    '/calendars/primary/events',
    { conferenceDataVersion: 1, sendUpdates: 'all', fields: CREATED_FIELDS },
    loginHint,
    body,
  );
  let event = created;
  for (let i = 0; i < 4 && event.id && !findMeetLink(event); i++) {
    await sleep(750);
    event = await get<GoogleEvent>(`/calendars/primary/events/${encodeURIComponent(event.id)}`, { fields: CREATED_FIELDS }, loginHint);
  }
  return event;
}

export function findMeetLink(e: GoogleEvent): string | undefined {
  return e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri;
}

const eventPath = (calendarId: string, eventId: string) => `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

/** The live copy of an event, including every guest, for edits that must send the full guest list back. */
export function getEventDetails(calendarId: string, eventId: string): Promise<GoogleEvent> {
  return get<GoogleEvent>(eventPath(calendarId, eventId), {
    fields: 'id,summary,start,end,recurringEventId,attendeesOmitted,attendees(email,displayName,responseStatus,self,organizer,resource,optional,comment,additionalGuests)',
  });
}

/** Changes only the fields in `body`. `notify` decides whether Google emails the guests. */
export async function patchEvent(calendarId: string, eventId: string, body: unknown, notify: boolean): Promise<void> {
  await request<unknown>('PATCH', eventPath(calendarId, eventId), { sendUpdates: notify ? 'all' : 'none', fields: 'id' }, undefined, body);
}

/** Deletes the event. Already gone (410) counts as success. */
export async function deleteEvent(calendarId: string, eventId: string, notify: boolean): Promise<void> {
  try {
    await request<unknown>('DELETE', eventPath(calendarId, eventId), { sendUpdates: notify ? 'all' : 'none' });
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 410)) throw err;
  }
}
