import { createStore } from '../storage/store';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  /** epoch ms of the last sync that finished without a fatal error */
  lastSyncedAt: number | null;
  error: { code: string; message: string } | null;
  /** Bumped whenever the cache changes, so open pages know to re-read it. */
  version: number;
}

export const syncStore = createStore<SyncStatus>('dayflow:sync', {
  state: 'idle',
  lastSyncedAt: null,
  error: null,
  version: 0,
});
