import { useCallback, useState } from 'react';
import { accountStore } from '@/core/google/accountStore';
import { AuthError, signIn, signOut } from '@/core/google/auth';
import { idbEventCache } from '@/core/storage/eventCache';
import { requestSync } from '@/core/sync/requestSync';
import { syncStore } from '@/core/sync/syncStatus';
import { useStore } from './useStore';

export function useAccount() {
  const account = useStore(accountStore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Must be called from a visible page (side panel or options), never the popup: the popup closes when Google's window opens. */
  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      accountStore.update(() => ({ signedIn: true, email: null }));
      syncStore.update((s) => ({ ...s, error: null }));
      await requestSync();
    } catch (err) {
      // Closing the Google window is not an error worth shouting about.
      if (!(err instanceof AuthError && err.code === 'cancelled')) {
        setError(err instanceof Error ? err.message : 'Could not connect to Google.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await signOut();
      await idbEventCache.clear();
      accountStore.update(() => ({ signedIn: false, email: null }));
      syncStore.update((s) => ({ ...s, state: 'idle', lastSyncedAt: null, error: null, version: s.version + 1 }));
    } finally {
      setBusy(false);
    }
  }, []);

  return { account, busy, error, connect, disconnect };
}
