import { useMemo } from 'react';
import { dayFromKey, dayKeyIn, resolveZone } from '@/core/time/zones';
import { usePrefs } from './usePrefs';

/** The zone that defines the user's day: the Home time zone from Settings, else this computer's zone. */
export function useHomeZone(): string {
  const { prefs } = usePrefs();
  return useMemo(() => resolveZone(prefs.homeTimezone), [prefs.homeTimezone]);
}

/** The home zone and today's date in it, as a day value that only changes when the date does. */
export function useToday(now: Date): { zone: string; today: Date } {
  const zone = useHomeZone();
  const key = dayKeyIn(now, zone);
  const today = useMemo(() => dayFromKey(key), [key]);
  return { zone, today };
}
