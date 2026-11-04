import { DEFAULT_PREFS, type UserPreferences } from '@/core/models';
import { normalizeTabOrder } from '../nav/tabOrder';
import { createStore } from './store';

export const prefsStore = createStore<UserPreferences>('dayflow:prefs', DEFAULT_PREFS, (stored) => ({
  ...DEFAULT_PREFS,
  ...stored,
  tabOrder: normalizeTabOrder(stored.tabOrder),
  workingHours: { ...DEFAULT_PREFS.workingHours, ...stored.workingHours },
}));
