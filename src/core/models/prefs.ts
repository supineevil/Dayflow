export type ThemePreference = 'light' | 'dark' | 'system';
/** Every tab in the top bar. */
export const TAB_IDS = ['today', 'agenda', 'meet', 'links', 'settings'] as const;
export type TabId = (typeof TAB_IDS)[number];
export const DEFAULT_TAB_ORDER: TabId[] = [...TAB_IDS];
export type CalendarViewId = 'today' | 'agenda';
/** Which of your RSVPs to show: everything, or only events you answered Yes / Maybe / No / haven't answered. */
export type ResponseFilter = 'all' | 'accepted' | 'tentative' | 'declined' | 'needsAction';

export interface WorkingHours {
  /** `HH:mm` */
  start: string;
  end: string;
}

export type ExclusionRuleKind = 'titleContains' | 'titleEquals' | 'organizer' | 'calendar' | 'declined' | 'past';

export interface ExclusionRule {
  id: string;
  kind: ExclusionRuleKind;
  /** Keyword, title, sender email or domain ("@example.com"), or calendar id. Unused for `declined` and `past`. */
  value: string;
  enabled: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  defaultView: CalendarViewId;
  /** Left-to-right order of the top bar tabs. */
  tabOrder: TabId[];
  /** Calendars the user switched off. New calendars default to on. */
  disabledCalendarIds: string[];
  /** 0 = Sunday ... 6 = Saturday */
  startOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  workingHours: WorkingHours;
  refreshIntervalMinutes: number;
  /** Hidden single events, as `calendarId:eventId`. Local only. */
  hiddenInstances: string[];
  /** Hidden recurring series, by `recurringEventId`. Local only. */
  hiddenSeries: string[];
  exclusionRules: ExclusionRule[];
  responseFilter: ResponseFilter;
  /** IANA zones (e.g. "America/New_York") shown alongside your own time for comparison. */
  extraTimezones: string[];
  /** Show a desktop notification shortly before each meeting you're attending. */
  remindersEnabled: boolean;
  /** How many minutes before the start the reminder appears. */
  reminderLeadMinutes: number;
}

export const DEFAULT_PREFS: UserPreferences = {
  theme: 'system',
  defaultView: 'today',
  tabOrder: DEFAULT_TAB_ORDER,
  disabledCalendarIds: [],
  startOfWeek: 1,
  workingHours: { start: '09:00', end: '17:30' },
  refreshIntervalMinutes: 15,
  hiddenInstances: [],
  hiddenSeries: [],
  exclusionRules: [],
  responseFilter: 'all',
  extraTimezones: ['America/New_York', 'America/Los_Angeles', 'Europe/London'],
  remindersEnabled: true,
  reminderLeadMinutes: 5,
};
