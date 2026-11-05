import { DEFAULT_PREFS, type UserPreferences } from '@/core/models';
import { clampLead } from '../notify/reminders';
import { normalizeTabOrder } from '../nav/tabOrder';
import { createStore } from './store';

export const prefsStore = createStore<UserPreferences>('dayflow:prefs', DEFAULT_PREFS, (stored) => ({
  ...DEFAULT_PREFS,
  ...stored,
  tabOrder: normalizeTabOrder(stored.tabOrder),
  remindersEnabled: stored.remindersEnabled !== false,
  reminderLeadMinutes: clampLead(stored.reminderLeadMinutes),
  workingHours: { ...DEFAULT_PREFS.workingHours, ...stored.workingHours },
}));
