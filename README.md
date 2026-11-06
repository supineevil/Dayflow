# Dayflow

A calm calendar and task dashboard for Chrome, built on Google Calendar. It lives in the browser side panel, so your day is one click away.

Dayflow is **local-first**. Your tasks, bookmarks and settings are stored only in your browser. Nothing is sent to any server other than Google's own Calendar API, and there is no Dayflow backend.

> **Status:** personal project, version 0.1.0. The logic is covered by unit tests, but several features that talk to Google or rely on browser interactions have **not yet been tried against a real account** (see [Known limitations](#known-limitations)).

## Features

**Calendar**
- **Today**: your tasks on top, a "Next up" card, then a timeline of the day's events and free time within your working hours. Step to the previous or next day, or jump back to today.
- **Agenda**: upcoming events grouped by day.
- **Built around your replies:** events you declined never show as "Next up" and don't count as busy time. Invites you haven't answered are highlighted in yellow, so they are hard to miss.
- Filter the lists by your response (accepted, maybe, declined, not answered).
- Works offline from a local cache, with incremental sync in the background.

**Tasks**
- A simple to-do list on the Today tab: add a task, tick it off, delete it. Overdue tasks are flagged in red.
- Tasks are local only. They are never written to Google Calendar.

**Meeting reminders**
- A desktop notification appears 5 minutes before each meeting, with a **Join meeting** button when the event has a video link. Clicking the notification opens the side panel. It stays on screen until you dismiss it.
- Only meetings you accepted trigger one (events you organise yourself count too; an event with no reply from you that someone else owns does not). Maybe, unanswered and declined invites, cancelled events, all-day events and anything you've hidden never do. You can change the lead time (1 to 30 minutes) or turn reminders off in Settings → Meeting reminders.
- Checked about once a minute from the local cache, so no extra Google access is needed. Your operating system's "Do not disturb" and Chrome's notification settings still apply.

**Meetings that cross midnight**
- A meeting that starts one day and ends after midnight is listed on both days. An amber tag on each row says which side you are looking at: "← Started Thu 5 Nov, 11:00 pm" on the second day, and "Ends Fri 6 Nov, 12:15 am →" on the first.

**Hide the noise**
- Hide a single event, a whole recurring series, or everything from a sender (an email or `@domain`).
- Rules by title, organizer, calendar, declined events, or past events. Hidden items can be restored from Settings.

**Meet**
- Create a Google Meet with a title, time, length and attendees. Add attendees one at a time: type an email and press Enter.
- Pick several customer time zones. The invitation lists the meeting time in each one, and the slider shows GMT offsets (DST-correct) and turns green inside your working hours, including overnight hours.
- Edit, cancel or respond (RSVP) to events from the event list.

**Links (bookmarks)**
- Save web pages in your own sections. Every link has a label and a colour. Sections fold away with one click (and remember it), so only the ones you need are open.
- Drag and drop to reorder links, move them between sections, and reorder sections. Up/down buttons do the same from the keyboard.
- Search, and export/import as a JSON file to move bookmarks to another device (merge or replace).

**Toolbar popup**
Click the toolbar icon for a small window with two parts, switched at the top:
- **Day**: your next event (never one you declined, with unanswered invites in yellow), then the rest of today. Use the arrows to check any other day, and **Today** to come back. It has a refresh button and a button to open the side panel.
- **Links**: your bookmarks, grouped and colour-coded as in the side panel. Search, fold sections, and click to open. Adding and editing stay in the side panel.

**Edge tab**
- A slim purple handle peeks from the right edge of every web page. Hover to pull it out, click to open the side panel directly, without going through the toolbar window. While the panel is open the arrow flips to point right, and clicking it closes the panel. Turn it off in Settings → Edge tab.

**Make it yours**
- Drag the top-bar tabs (Today, Agenda, Meet, Links, Settings) to reorder them, or use Settings → Tab order. The bar scrolls sideways when it is narrow.
- Light, dark or system theme; working hours; week start; extra time zones.
- **My time zone** (Settings → Time zones): the zone your day runs in. If your Google Calendar is in one zone (say IST) but you work in another (say US Eastern), pick it here and "today", the timeline, the day stepper, working hours, the greeting, reminders and the planner all follow it, so a whole working day stays on one page. Changing it also converts your working hours to the same moments in the new zone. Your Google Calendar itself is not changed, and events keep their real times. Leave it on "This computer" for the old behaviour.
- The header greeting follows your working hours, not the system clock.
- The same app is also available as a full-page options screen.

## Install

You need Node.js 22.12 or newer (Vite needs 20.19+, the test runner needs 22.12+), Chrome 114 or newer, and a Google account.

```bash
git clone <this repository's URL>
cd Dayflow
npm install
cp .env.example .env.local        # then add your Google OAuth client ID (next section)
npm run build
```

Then in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist/` folder.
3. Click the Dayflow toolbar icon, then **Open side panel**.

After changing code, run `npm run build` and press the reload icon on the extension's card.

## Connect Google Calendar

Dayflow needs your own Google Cloud OAuth client, because Google ties sign-in to a client ID. This is a one-time setup of about ten minutes. It does not need a domain or a server.

Follow [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md). In short: create a project, enable the Calendar API, configure the consent screen, create a **Web application** OAuth client with this extension's redirect URI, and put the client ID in `.env.local` as `VITE_GOOGLE_CLIENT_ID`.

A client ID is not a secret, but `.env.local` is git-ignored anyway. Dayflow never uses a client secret.

If you run the app in **Testing** mode (the right choice for personal use), Google lets only listed test users sign in (up to 100) and expires their authorisation after about 7 days, so you will be asked to reconnect weekly.

### Google permissions

| Scope | Used for |
|---|---|
| `calendar.calendarlist.readonly` | See which calendars you have |
| `calendar.events.readonly` | Read events |
| `calendar.events.owned` | Create, edit, cancel or answer an event, **only when you press the matching button** |

Chrome permissions: `storage` (save settings locally), `sidePanel`, `identity` (Google sign-in), `alarms` (periodic refresh and the reminder check), `notifications` (meeting reminders). The edge tab is a content script that runs on all websites, so Chrome shows "Read and change all your data on all websites" when you install or reload. The script only draws the handle and sends one message to open the side panel; it never reads page content, and it does not run on `chrome://` pages or the Chrome Web Store. Switch it off in Settings → Edge tab (the permission warning stays until the extension is rebuilt without it).

Sign-in uses the OAuth implicit flow, so there are no refresh tokens: the token lasts about an hour and Dayflow renews it silently when Google allows it, otherwise it shows **Reconnect**. Disconnecting revokes the token and clears the cached calendar data. Tasks, bookmarks and settings are kept.

## Your data

| Data | Where it lives |
|---|---|
| Calendar events (cache) | IndexedDB in your browser |
| Tasks, bookmarks, settings | `chrome.storage.local` in your browser |
| Sign-in token, and which reminders have been shown | `chrome.storage.session` (cleared when the browser closes) |

Uninstalling the extension deletes all of it. Export your bookmarks first (Links → Backup &amp; transfer) if you want to keep them. Tasks and settings are not included in that export, and neither is which sections are folded.

## Development

```bash
npm run dev         # Vite dev server (UI only; Chrome APIs fall back to localStorage)
npm run typecheck   # TypeScript, strict
npm test            # Vitest
npm run build       # typecheck + production build into dist/
npm run icons       # regenerate public/icons (only if missing)
```

**Stack:** React 19, TypeScript (strict), Vite, Tailwind CSS v4, date-fns, lucide-react, Vitest. Chrome Manifest V3.

**Layout**

```
src/core/         Pure TypeScript, no React: models, storage, filters, Google API and auth,
                  sync, planning, time zones, tasks, bookmarks, tab order
src/app/          React hooks, components and views
src/entries/      Side panel, popup and options entry points
src/background/   Service worker (periodic and on-demand sync)
tests/            Unit tests
docs/             Google Cloud setup guide
```

Keep logic that needs testing in `src/core` and out of modules that import the persisted store, because tests run in Node (no `window`). `bookmarks.ts` / `bookmarkStore.ts` show the split.

### The extension ID

`public/manifest.json` contains a `key`, which gives the extension the same ID on every machine: `abjfmkledmjhlhaocplhlejceibpomnh`. The Google redirect URI is derived from it. The key in the manifest is the *public* half and is safe to commit. The matching private key lives in `.keys/` and is git-ignored; keep it out of the repository.

If you fork this project, generate your own key (and ID), update the manifest, and use the new ID in your OAuth redirect URI.

## Known limitations

- **Not yet verified against a real Google account or in a live browser:** Meet creation, editing, cancelling and RSVP (these send real invitation emails; test with a throwaway meeting first), the popup's "Open side panel" button, the popup's Day and Links views, meeting reminders (the notification, its Join button and the click-to-open behaviour), narrow-width layout, and all drag-and-drop interactions. Typecheck, build and the unit tests pass.
- Reminders are only as fresh as the last sync (every 15 minutes by default), so a meeting added at the last minute may not trigger one. They also need Chrome to be running.
- Sign-in lasts about an hour per token; expect an occasional Reconnect. In Testing mode you must also reconnect about weekly.
- Workspace accounts may be blocked by your organisation's admin policy for third-party apps.
- Only a window of 30 days back and 120 days forward is synced.
- Bookmarks do not sync between devices on their own; use export and import.
- Drag and drop does not work on touch screens (the arrow buttons do). Dragging is turned off while searching bookmarks.
- The popup shows bookmarks and days but cannot add or edit them; use the side panel for that.
- Not built yet: Week and Month views, editing a task after it is created (due date, priority, estimate, time blocks), keyboard shortcuts and an accessibility pass.

## License

No license has been chosen yet. Until one is added, all rights are reserved. Add a `LICENSE` file (for example MIT) before inviting contributions.
