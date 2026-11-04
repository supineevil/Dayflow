import { format, startOfDay } from 'date-fns';
import { Loader2, PanelRight, RefreshCw, Settings } from 'lucide-react';
import { ConnectCard } from '@/app/components/ConnectCard';
import { EventRow } from '@/app/components/EventRow';
import { NextEventCard, pickNextEvent } from '@/app/components/NextEventCard';
import { Button, IconButton } from '@/app/components/ui/Button';
import { useCalendarData } from '@/app/hooks/useCalendarData';
import { useNow } from '@/app/hooks/useNow';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useTheme } from '@/app/hooks/useTheme';
import { greeting } from '@/core/planning/greeting';
import { eventEnd, eventsOnDay } from '@/core/time/eventTime';

async function openSidePanel() {
  // sidePanel.open() requires a user gesture. The only await before it is a fast local lookup of the
  // window id. I haven't verified in a real Chrome profile that this keeps the gesture alive.
  const win = await chrome.windows.getCurrent();
  if (win.id === undefined) return;
  await chrome.sidePanel.open({ windowId: win.id });
  window.close();
}

export function Popup() {
  useTheme();
  const now = useNow();
  const { prefs } = usePrefs();
  const { filtered, loading, account, syncError, syncing, refresh } = useCalendarData(now);

  const today = eventsOnDay(filtered.visible, startOfDay(now));
  const remaining = today.filter((e) => !e.isAllDay && eventEnd(e) > now).slice(0, 4);

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{greeting(now, prefs.workingHours)}</div>
          <div className="text-xs text-muted">{format(now, 'EEEE, d MMMM')}</div>
        </div>
        <div className="flex items-center gap-0.5">
          {account.signedIn && (
            <IconButton label={syncing ? 'Syncing…' : 'Refresh'} onClick={() => void refresh()} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </IconButton>
          )}
          <IconButton label="Open settings" onClick={() => void chrome.runtime.openOptionsPage()}>
            <Settings className="size-4" />
          </IconButton>
        </div>
      </div>

      {!account.signedIn ? (
        // Google's sign-in window would close the popup mid-flow, so connecting happens in the side panel.
        <ConnectCard onConnect={() => undefined} busy={false} error={null} canSignInHere={false} onOpenFull={() => void openSidePanel()} />
      ) : loading ? (
        <p className="py-6 text-center text-xs text-subtle">Loading…</p>
      ) : (
        <div className="space-y-3">
          {syncError && <p className="text-xs text-warning">{syncError.code === 'expired' ? 'Sign-in expired. Open Dayflow to reconnect.' : 'Showing your last synced events.'}</p>}
          <NextEventCard event={pickNextEvent(today, now)} now={now} />
          {remaining.length > 1 && (
            <div>
              <h2 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Later today</h2>
              {remaining.slice(1).map((e) => (
                <EventRow key={`${e.calendarId}:${e.id}`} event={e} now={now} showActions={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {account.signedIn && (
        <Button variant="primary" className="mt-3 w-full" onClick={() => void openSidePanel()}>
          <PanelRight className="size-4" /> Open side panel
        </Button>
      )}
    </div>
  );
}
