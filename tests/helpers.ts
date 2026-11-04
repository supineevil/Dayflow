import type { CalendarEvent, CalendarInfo } from '../src/core/models';
import type { CalendarSyncMeta, EventCache } from '../src/core/storage/eventCache';

export function memoryCache(): EventCache & { events: Map<string, CalendarEvent>; metas: Map<string, CalendarSyncMeta>; cals: Map<string, CalendarInfo> } {
  const events = new Map<string, CalendarEvent>();
  const metas = new Map<string, CalendarSyncMeta>();
  const cals = new Map<string, CalendarInfo>();
  const key = (cid: string, id: string) => `${cid}\u0000${id}`;
  const dropCal = (cid: string) => [...events.keys()].filter((k) => k.startsWith(`${cid}\u0000`)).forEach((k) => events.delete(k));
  return {
    events, metas, cals,
    async getAllEvents() { return [...events.values()]; },
    async getCalendars() { return [...cals.values()]; },
    async putCalendars(list) { list.forEach((c) => cals.set(c.id, c)); },
    async removeCalendars(ids) { ids.forEach((id) => { cals.delete(id); metas.delete(id); dropCal(id); }); },
    async getMeta(id) { return metas.get(id); },
    async putMeta(m) { metas.set(m.calendarId, m); },
    async replaceEvents(cid, list, meta) { dropCal(cid); list.forEach((e) => events.set(key(cid, e.id), e)); metas.set(cid, meta); },
    async applyChanges(cid, up, del, meta) { del.forEach((id) => events.delete(key(cid, id))); up.forEach((e) => events.set(key(cid, e.id), e)); metas.set(cid, meta); },
    async clear() { events.clear(); metas.clear(); cals.clear(); },
  };
}
