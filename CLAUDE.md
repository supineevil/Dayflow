# Dayflow

Chrome MV3 extension: a calendar and task dashboard on top of Google Calendar. Local-first; the owner is the only user. See `README.md` and `docs/GOOGLE_SETUP.md` for setup.

## Commands

- `npm run typecheck` (strict TS), `npm test` (Vitest), `npm run build` (typecheck + Vite multi-entry build into `dist/`).
- After a build, the user reloads the extension at `chrome://extensions`. Finish changes by running all three.
- Test environment is Node (no `window`). Anything importing `createStore` / `kv` can't be imported in tests directly, so keep logic in pure modules and the persisted store in a separate file (see `bookmarks.ts` vs `bookmarkStore.ts`).

## Architecture

- `src/core/`: pure TypeScript, no React. `models`, `filters`, `google` (API, auth, meeting/edit helpers), `sync`, `storage`, `planning`, `time` (Intl time zones, DST-correct), `tasks`, `bookmarks`, `nav`.
- `src/app/`: React 19 UI. `components`, `views`, `hooks`. `AppShell.tsx` is the chrome (header, tab bar, view switch); views are Today, Agenda, Meet, Links (bookmarks), Settings.
- `src/entries/`: popup, side panel (primary), options page. `src/background/`: service worker.
- Persistence: `createStore(key, defaults, hydrate)` in `src/core/storage/store.ts` is an observable store over `chrome.storage.local` (localStorage fallback), synced across pages; `useStore` reads it via `useSyncExternalStore`. `hydrate` must sanitise whatever was stored (old versions, bad data).
- Stack: Vite, Tailwind v4 with CSS-variable tokens (`bg-surface`, `bg-surface-2`, `text-subtle`, `--accent`, `--fg-subtle`, `--success`, `--warning`, `--danger`), lucide-react, date-fns, clsx via `cn`. No other UI libraries. Match the surrounding code's style and comment density.

## Data and privacy

- Local only (never sent anywhere): tasks (`dayflow:tasks`), bookmarks (`dayflow:bookmarks`), prefs (`dayflow:prefs`, including hide rules, time zones, working hours, `tabOrder`).
- Google scopes: `calendar.calendarlist.readonly`, `calendar.events.readonly`, `calendar.events.owned` (restricted; used only when the user presses Create / Edit / Cancel / RSVP). Token is implicit-flow, kept in `chrome.storage.session`, no refresh token.
- Disconnecting from Google only revokes the token and clears the calendar event cache. Tasks, bookmarks and prefs are untouched.
- Google Cloud app stays in **Testing** mode (max 100 test users, authorisation expires every 7 days, so the user reconnects weekly). The user chose not to publish.
- Extension ID is fixed (`abjfmkledmjhlhaocplhlejceibpomnh`) via the key in `.keys`. Never commit or print the key, `.env.local` or the OAuth client secret. The client secret was pasted into chat once and the user was told to reset it. Remind them if it comes up.

## Features built

- Today (Tasks section on top, Next up card, timeline, time zone planner, day stepping), Agenda, response (RSVP) filter. Declined events are excluded from Next up and busy time; unanswered invites are yellow.
- Hide events: by title, sender/organizer (email or `@domain`), calendar, declined, past; hide one instance or a whole series.
- Meet: quick Google Meet with attendees (chip email input, Enter adds one), multiple time zones written into the invite, warns outside working hours.
- Edit / cancel / RSVP on events you own or are invited to (these send real emails; tests used pure helpers only).
- Time zone slider: GMT offsets, DST via Intl, turns green inside the user's working hours (overnight hours supported).
- Header greeting depends on the working hours set in Settings (not the system clock).
- Popup has a Day/Links switch (`PopupLinks`: search, fold sections, open links; adding/editing stays in the side panel), a refresh button and previous/next/Today day stepping (`DayStepper`, `dayAgenda`). Next up skips declined events (`nextEvent.ts`); invites you have not answered are highlighted yellow.
- Links tab (bookmarks): sections with colours, labelled colour-coded links, collapsible sections (state in `dayflow:bookmarks-ui`, logic in `collapse.ts`, deliberately not exported), search, edit/delete, drag-and-drop for links (reorder / move between sections) and sections, up/down buttons as a keyboard route, export/import JSON (merge or replace; unsafe URLs dropped, only http/https allowed).
- Meeting reminders (only `selfResponse === 'accepted'` or events you organise with no invite; events with no response that someone else owns never qualify, so don't use `effectiveResponse` here): service worker alarm `dayflow-remind` (every minute) reads the IndexedDB cache, applies `applyFilters`, and shows a `chrome.notifications` notification (Join button opens `meetingLink`, click opens side panel or falls back to the event page). Pure logic in `src/core/notify/reminders.ts` (`dueReminders`, dedupe by calendar+id+start kept in `chrome.storage.session`). Prefs `remindersEnabled`, `reminderLeadMinutes` (default 5); Settings → Meeting reminders. Needs the `notifications` permission (user must approve on reload).
- Home time zone (`prefs.homeTimezone`, IANA id, empty = this computer's zone; always read through `resolveZone` / `useHomeZone()`): defines which instant is "today" and the boundaries of a day. A "day" value is still a plain local-midnight `Date` standing for a calendar date; real start/end come from `zonedDayStart/End(day, zone)`, `eventsOnDay/groupByDay/dayAgenda/dayStats/workingInterval/greeting` all take a zone, and times are shown with `formatTimeIn`. `useToday(now)` gives `{zone, today}`; AppShell/Popup keep `picked: Date|null` (null = follow today). Writes to Google still use `systemZone()` as the calendar zone (form fields are read/written in the home zone). Tasks' due dates are plain `yyyy-MM-dd` compared with the home-zone today. Changing the zone in Settings converts `prefs.workingHours` to the same moments in the new zone (`convertWorkingHours`, `src/core/time/workingHoursZone.ts`). Tests in `tests/homeZone.test.ts`.
- Meetings that cross midnight in the home zone appear under both days; `EventRow` takes the listed `day` and uses `daySpill` (`eventTime.ts`) to show an amber tag ("← Started Thu 5 Nov, 11:00 pm" / "Ends Fri 6 Nov, 12:15 am →"). Any new list of events should pass `day` to `EventRow`.
- Edge tab: `public/edge-tab.js` is a plain (non-module, copied verbatim) content script on `<all_urls>` (top frame only) that draws a closed-shadow-DOM handle and sends `{type:'dayflow:toggle-panel'}`. The side panel announces itself over a long-lived port (`src/entries/sidepanel/presence.ts`, port `dayflow-panel`); the service worker keeps `panelPorts` by window, tells every tab in that window `{type:'dayflow:panel-state', open}` so the arrow flips, and on toggle either calls `chrome.sidePanel.open({windowId})` (nothing awaited before it) or closes the panel (`sidePanel.close` if present, else a `close` message to the panel). It reads `prefs.edgeTabEnabled` straight from `chrome.storage.local` (key `dayflow:prefs`) and reacts to changes. The all-sites host match shows an install warning, which the user approved. Not verified in a real browser; does not run on chrome:// pages or the Web Store.
- Tab bar scrolls sideways and the tabs can be reordered by drag or from Settings → Tab order (`prefs.tabOrder`, logic in `src/core/nav/tabOrder.ts`).

## Not verified against real Google or a browser

Meet creation, event edit, cancel, RSVP, the popup's "Open side panel" button, meeting reminders (notification, Join button, click behaviour), narrow-width layouts, and all drag-and-drop interactions. Only typecheck, build and unit tests (154) have run. Test anything that sends email with a throwaway meeting.

## Ideas not built

Week and Month views; task editing (due date, priority, estimate, time blocks); keyboard shortcuts and an accessibility pass; widening "Default view" beyond Today/Agenda; including tasks/prefs in the export file; a read-only mode for sharing copies; bookmarks in the popup; "add current tab" bookmark (needs the `tabs` permission, a manifest change to confirm with the user first).

## Working agreements

- The user is a non-specialist owner; explain results plainly, say what was and wasn't verified, and ask before adding permissions or changing the manifest.
- Temporary test harness files must be removed afterwards (`harness.html`, `harness.tsx`, `vite.harness.config.ts`), and stray dev servers killed.
- Writes to Google are not retried on 5xx, and a patch replaces arrays, so the full attendee list must be sent.
