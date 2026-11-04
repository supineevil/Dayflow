import { useCallback } from 'react';
import type { UserPreferences } from '@/core/models';
import { prefsStore } from '@/core/storage/prefsStore';
import { useStore } from './useStore';

export function usePrefs() {
  const prefs = useStore(prefsStore);
  const setPrefs = useCallback(
    (patch: Partial<UserPreferences> | ((p: UserPreferences) => Partial<UserPreferences>)) =>
      prefsStore.update((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })),
    [],
  );
  return { prefs, setPrefs };
}
