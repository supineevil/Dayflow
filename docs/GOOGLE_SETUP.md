# Google Cloud setup for Dayflow

Dayflow signs in with Google's OAuth 2.0 implicit flow through `chrome.identity.launchWebAuthFlow`. You create one OAuth client, put its ID in `.env.local`, and rebuild. Client IDs are public by design; there is no client secret anywhere in this project.

**Your extension ID is fixed:** `abjfmkledmjhlhaocplhlejceibpomnh`
(It comes from the `key` in `public/manifest.json`, so it is the same on every machine. After loading the extension, confirm the same ID appears on `chrome://extensions`. If it differs, tell me before continuing.)

## 1. Create the project (use a personal Google account)

1. Go to https://console.cloud.google.com/ signed in with a **personal** Google account (not your managed Workspace one).
2. Project picker, then **New project**, and name it `Dayflow`.

## 2. Enable the Calendar API

**APIs & Services, then Library, then "Google Calendar API", then Enable.**

## 3. Configure the consent screen

**APIs & Services, then OAuth consent screen** (the console may call this "Google Auth Platform").

1. User type: **External**. An Internal screen would only admit users from one Workspace organisation, which defeats "works with any account".
2. App name `Dayflow`, plus a support email and developer contact email.
3. **Scopes**, then add exactly these three:
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (list your calendars)
   - `https://www.googleapis.com/auth/calendar.events.readonly` (read events)
   - `https://www.googleapis.com/auth/calendar.events.owned` (create, edit and delete events on calendars you own; used only when you press a button)
4. **Audience / Test users**: while the app is in *Testing*, add every Google account that will sign in (including your work address), up to the console's test-user limit.

Publishing to *In production* removes the test-user list, but unverified apps show a "Google hasn't verified this app" warning and Google applies a user cap. I haven't confirmed the cap or whether it applies to Calendar scopes. For personal use, stay in *Testing*.

## 4. Create the OAuth client

1. **Credentials, then Create credentials, then OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs**, then add exactly (trailing slash included):

   `https://abjfmkledmjhlhaocplhlejceibpomnh.chromiumapp.org/`

4. Create, then copy the **Client ID**. Ignore the client secret; Dayflow never uses it.

## 5. Build with the client ID

```bash
cp .env.example .env.local
# edit .env.local:  VITE_GOOGLE_CLIENT_ID=<your client id>.apps.googleusercontent.com
npm run build
```

Reload the extension on `chrome://extensions`, open the side panel, and click **Connect with Google**.

## What each permission is for

| Permission | Why |
|---|---|
| `identity` | Opens Google's sign-in window |
| `storage` | Saves your preferences and tasks locally |
| `alarms` | Wakes the background worker to refresh (default every 15 min) |
| `sidePanel` | The main Dayflow panel |
| Calendar scope: calendarlist.readonly | See which calendars you have |
| Calendar scope: events.readonly | Read events |
| Calendar scope: events.owned | Create, edit or delete an event only when you press the matching button. Google classes this scope as restricted. Nothing is changed in the background |

## If sign-in fails

| Symptom | Likely cause |
|---|---|
| `redirect_uri_mismatch` | The redirect URI in step 4 doesn't exactly match; check the extension ID and the trailing slash |
| `access_denied` / "app not verified" with no way forward | Your account isn't in the Test users list |
| Admin message about blocked access (Workspace accounts) | Your organisation's admin restricts third-party apps. Dayflow can't work around this; ask the admin to allow the client ID, or use a personal account |
| "Calendar access was not fully granted" | You unticked a permission on the consent screen; reconnect and keep both ticked |
| Sign-in expires about every hour | Expected: the implicit flow issues no refresh tokens. Dayflow renews silently when Google allows it and otherwise shows **Reconnect** |
