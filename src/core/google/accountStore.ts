import { createStore } from '../storage/store';

export interface AccountState {
  /** True once the user has connected. The access token itself is never persisted (see auth.ts). */
  signedIn: boolean;
  email: string | null;
}

export const accountStore = createStore<AccountState>('dayflow:account', { signedIn: false, email: null });
