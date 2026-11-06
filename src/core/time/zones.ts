/**
 * Time zone helpers built on Intl, so DST is handled by the platform.
 * Zones are IANA ids (e.g. "America/New_York"), never fixed offsets.
 */

export interface ZonePreset {
  id: string;
  label: string;
}

/** Offered first in Settings. The first three are the defaults. */
export const ZONE_PRESETS: ZonePreset[] = [
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'Europe/London', label: 'London' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Kolkata', label: 'India' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Australia/Sydney', label: 'Sydney' },
];

export const DEFAULT_EXTRA_ZONES = ['America/New_York', 'America/Los_Angeles', 'Europe/London'];
export const MAX_EXTRA_ZONES = 5;

export const systemZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Your chosen home zone, or this computer's zone when none is set (or the saved one is no longer valid). */
export function resolveZone(pref: string | undefined): string {
  return pref && isValidZone(pref) ? pref : systemZone();
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function allZoneIds(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
}

export function zoneLabel(zone: string): string {
  const preset = ZONE_PRESETS.find((p) => p.id === zone);
  if (preset) return preset.label;
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

const partsFormats = new Map<string, Intl.DateTimeFormat>();

function wallClock(date: Date, zone: string) {
  let fmt = partsFormats.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormats.set(zone, fmt);
  }
  const get = (type: string) => Number(fmt.formatToParts(date).find((p) => p.type === type)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/**
 * The instant at which the wall clock in `zone` reads `date` (yyyy-MM-dd) `time` (HH:mm).
 * DST-safe. A time that doesn't exist (the hour skipped when clocks go forward) lands on a nearby valid instant.
 */
export function zonedTimeToDate(date: string, time: string, zone: string): Date {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, mi = 0] = time.split(':').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const w = wallClock(new Date(guess), zone);
    const diff = wanted - Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** "Thu 5 Nov" on the calendar in `zone`. */
export function formatDayIn(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(date).replace(',', '');
}

/** Minutes since local midnight in `zone` at the instant `date`. */
export function minutesInZone(date: Date, zone: string): number {
  const { h, mi } = wallClock(date, zone);
  return h * 60 + mi;
}

/**
 * Calendar-day difference between `zone` and `relativeTo` (the viewer's own zone by default) at this instant (-1, 0, +1...).
 */
export function dayOffset(date: Date, zone: string, relativeTo: string = systemZone()): number {
  const a = wallClock(date, zone);
  const b = wallClock(date, relativeTo);
  return Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 86_400_000);
}

/**
 * Offset from GMT at this instant, e.g. "GMT−5", "GMT+5:30", or "GMT" at zero.
 * Worked out per date, so it changes by an hour across daylight saving (New York is GMT−5 in January, GMT−4 in July).
 */
export function gmtOffsetLabel(date: Date, zone: string): string {
  const w = wallClock(date, zone);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  const minuteStart = Math.floor(date.getTime() / 60_000) * 60_000;
  const offset = Math.round((asUtc - minuteStart) / 60_000);
  if (offset === 0) return 'GMT';
  const abs = Math.abs(offset);
  const mins = abs % 60;
  return `GMT${offset < 0 ? '−' : '+'}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`;
}

/** "EST · GMT−5", or just "GMT+5:30" / "GMT" where the abbreviation would repeat the offset. */
export function zoneTag(date: Date, zone: string): string {
  const abbr = zoneAbbr(date, zone);
  const gmt = gmtOffsetLabel(date, zone);
  const same = (s: string) => s.replace('−', '-');
  return same(abbr) === same(gmt) ? gmt : `${abbr} · ${gmt}`;
}

/** "EST"/"EDT", "PST"/"PDT", "GMT"/"BST". Falls back to "GMT+5:30" style where no abbreviation exists. */
export function zoneAbbr(date: Date, zone: string): string {
  const read = (locale: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? zone;
  const us = read('en-US');
  return /^GMT[+-]/.test(us) ? read('en-GB') : us;
}

export function formatTimeIn(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(date)
    .replace(/\s/g, ' ')
    .replace(':00 ', ' ')
    .toLowerCase();
}

const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Is this minute of the day inside `hours`? The end is exclusive. Hours that run past midnight
 * (18:00 to 03:00) are supported: the day then counts as working from the start onwards and again until the end.
 * Equal start and end means no working hours.
 */
export function minuteInHours(minute: number, hours: { start: string; end: string }): boolean {
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Is the wall-clock time in `zone` at `date` inside the given `HH:mm` working hours? */
export function inWorkingHours(date: Date, zone: string, hours: { start: string; end: string }): boolean {
  return minuteInHours(minutesInZone(date, zone), hours);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/**
 * A "day" in the app is a plain Date at local midnight that stands for a calendar date, whatever zone the day is read in.
 * These helpers turn instants into such dates, and dates into the real start and end of that day in a zone.
 */

/** `yyyy-MM-dd` of a day value (read from its local fields). */
export const dayKeyOf = (day: Date): string => `${pad(day.getFullYear(), 4)}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

/** `yyyy-MM-dd` on the wall clock in `zone` at this instant. */
export function dayKeyIn(date: Date, zone: string): string {
  const w = wallClock(date, zone);
  return `${pad(w.y, 4)}-${pad(w.mo)}-${pad(w.d)}`;
}

export function dayFromKey(key: string): Date {
  const [y = 1970, mo = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

/** The calendar date it is right now in `zone`, as a day value. */
export const todayIn = (now: Date, zone: string): Date => dayFromKey(dayKeyIn(now, zone));

/** When this day starts in `zone`. */
export const zonedDayStart = (day: Date, zone: string): Date => zonedTimeToDate(dayKeyOf(day), '00:00', zone);

/** When the day after this one starts in `zone`, which is when this day ends. */
export function zonedDayEnd(day: Date, zone: string): Date {
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return zonedTimeToDate(dayKeyOf(next), '00:00', zone);
}

/** `HH:mm` for a count of minutes after midnight. */
export const hhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
