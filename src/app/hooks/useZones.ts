import { useMemo } from 'react';
import { isValidZone, systemZone } from '@/core/time/zones';
import { useHomeZone } from './useHomeZone';
import { usePrefs } from './usePrefs';

/** The user's extra comparison zones, with invalid ids dropped and the home zone left out (it is already "You"). */
export function useZones(): string[] {
  const { prefs } = usePrefs();
  const home = useHomeZone();
  return useMemo(() => prefs.extraTimezones.filter((z) => isValidZone(z) && z !== home), [prefs.extraTimezones, home]);
}

/**
 * Zones to compare against the home zone: this computer's zone first when it differs (so your Google Calendar time
 * stays visible), then the extra zones.
 */
export function useCompareZones(): string[] {
  const extras = useZones();
  const home = useHomeZone();
  return useMemo(() => {
    const local = systemZone();
    return local === home ? extras : [local, ...extras.filter((z) => z !== local)];
  }, [extras, home]);
}
