import { useMemo } from 'react';
import { isValidZone } from '@/core/time/zones';
import { usePrefs } from './usePrefs';

/** The user's extra comparison zones, with any invalid ids dropped. */
export function useZones(): string[] {
  const { prefs } = usePrefs();
  return useMemo(() => prefs.extraTimezones.filter(isValidZone), [prefs.extraTimezones]);
}
