import { DEFAULT_PREFS, type UserPreferences } from '@/core/models';
import { clampLead } from '../notify/reminders';
import { normalizeTabOrder } from '../nav/tabOrder';
import { isValidZone } from '../time/zones';
import { createStore } from './store';

export const prefsStore = createStore<UserPreferences>('dayflow:prefs', DEFAULT_PREFS, (stored) => ({
  ...DEFAULT_PREFS,
  ...stored,
  tabOrder: normalizeTabOrder(stored.tabOrder),
  homeTimezone: typeof stored.homeTimezone === 'string' && isValidZone(stored.homeTimezone) ? stored.homeTimezone : '',
  edgeTabEnabled: stored.edgeTabEnabled !== false,
  remindersEnabled: stored.remindersEnabled !== false,
  reminderLeadMinutes: clampLead(stored.reminderLeadMinutes),
  workingHours: { ...DEFAULT_PREFS.workingHours, ...stored.workingHours },
}));
