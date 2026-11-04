import type { CalendarEvent, CalendarInfo } from '../models';

/** Per-calendar sync bookkeeping. */
export interface CalendarSyncMeta {
  calendarId: string;
  /** Absent until a full sync has completed. */
  syncToken?: string;
  /** Which version of the sync/normalize logic produced the cache. A mismatch forces a full resync. */
  schema?: number;
  /** The window the last full sync covered (ISO). The sync token only reports changes inside it. */
  windowFrom: string;
  windowTo: string;
}

export interface EventCache {
  getAllEvents(): Promise<CalendarEvent[]>;
  getCalendars(): Promise<CalendarInfo[]>;
  putCalendars(calendars: CalendarInfo[]): Promise<void>;
  /** Drops these calendars along with their events and sync state. */
  removeCalendars(ids: string[]): Promise<void>;
  getMeta(calendarId: string): Promise<CalendarSyncMeta | undefined>;
  putMeta(meta: CalendarSyncMeta): Promise<void>;
  /** Replaces everything cached for a calendar (used by full syncs). */
  replaceEvents(calendarId: string, events: CalendarEvent[], meta: CalendarSyncMeta): Promise<void>;
  /** Applies an incremental change set atomically with its new sync token. */
  applyChanges(calendarId: string, upserts: CalendarEvent[], deletedIds: string[], meta: CalendarSyncMeta): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'dayflow';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const events = db.createObjectStore('events', { keyPath: ['calendarId', 'id'] });
      events.createIndex('byCalendar', 'calendarId');
      db.createObjectStore('calendars', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'calendarId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open the local event cache.'));
    };
  });
  return dbPromise;
}

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Cache transaction aborted.'));
  });

async function deleteCalendarEvents(tx: IDBTransaction, calendarId: string): Promise<void> {
  const index = tx.objectStore('events').index('byCalendar');
  const keys = await request(index.getAllKeys(IDBKeyRange.only(calendarId)));
  for (const key of keys) tx.objectStore('events').delete(key);
}

export const idbEventCache: EventCache = {
  async getAllEvents() {
    const db = await openDb();
    return request(db.transaction('events').objectStore('events').getAll());
  },
  async getCalendars() {
    const db = await openDb();
    return request(db.transaction('calendars').objectStore('calendars').getAll());
  },
  async putCalendars(calendars) {
    const db = await openDb();
    const tx = db.transaction('calendars', 'readwrite');
    for (const c of calendars) tx.objectStore('calendars').put(c);
    await done(tx);
  },
  async removeCalendars(ids) {
    if (ids.length === 0) return;
    const db = await openDb();
    const tx = db.transaction(['events', 'calendars', 'meta'], 'readwrite');
    for (const id of ids) {
      tx.objectStore('calendars').delete(id);
      tx.objectStore('meta').delete(id);
      await deleteCalendarEvents(tx, id);
    }
    await done(tx);
  },
  async getMeta(calendarId) {
    const db = await openDb();
    return request(db.transaction('meta').objectStore('meta').get(calendarId));
  },
  async putMeta(meta) {
    const db = await openDb();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(meta);
    await done(tx);
  },
  async replaceEvents(calendarId, events, meta) {
    const db = await openDb();
    const tx = db.transaction(['events', 'meta'], 'readwrite');
    await deleteCalendarEvents(tx, calendarId);
    for (const e of events) tx.objectStore('events').put(e);
    tx.objectStore('meta').put(meta);
    await done(tx);
  },
  async applyChanges(calendarId, upserts, deletedIds, meta) {
    const db = await openDb();
    const tx = db.transaction(['events', 'meta'], 'readwrite');
    for (const id of deletedIds) tx.objectStore('events').delete([calendarId, id]);
    for (const e of upserts) tx.objectStore('events').put(e);
    tx.objectStore('meta').put(meta);
    await done(tx);
  },
  async clear() {
    const db = await openDb();
    const tx = db.transaction(['events', 'calendars', 'meta'], 'readwrite');
    for (const name of ['events', 'calendars', 'meta']) tx.objectStore(name).clear();
    await done(tx);
  },
};
