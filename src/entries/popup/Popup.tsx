import { format, isSameDay } from 'date-fns';
import { useState } from 'react';
import { Loader2, PanelRight, RefreshCw, Settings } from 'lucide-react';
import { AllDayStrip } from '@/app/components/AllDayStrip';
import { ConnectCard } from '@/app/components/ConnectCard';
import { PopupLinks } from '@/app/components/PopupLinks';
import { Segmented } from '@/app/components/ui/Segmented';
import { DayStepper } from '@/app/components/DayStepper';
import { EventRow } from '@/app/components/EventRow';
import { NextEventCard } from '@/app/components/NextEventCard';
import { Button, IconButton } from '@/app/components/ui/Button';
import { useCalendarData } from '@/app/hooks/useCalendarData';
import { useToday } from '@/app/hooks/useHomeZone';
import { useNow } from '@/app/hooks/useNow';
import { usePrefs } from '@/app/hooks/usePrefs';
import { useTheme } from '@/app/hooks/useTheme';
import { dayAgenda } from '@/core/planning/dayAgenda';
import { greeting } from '@/core/planning/greeting';
import { pickNextEvent, upcomingAttending } from '@/core/planning/nextEvent';
import { eventsOnDay } from '@/core/time/eventTime';

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

  const [tab, setTab] = useState<'day' | 'links'>('day');
  const { zone: home, today: todayDate } = useToday(now);
  // null follows today in the home zone, so the popup rolls over at midnight there.
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const picked = pickedDay ?? todayDate;
  const isToday = isSameDay(picked, todayDate);
  const today = eventsOnDay(filtered.visible, todayDate, home);
  // Events you declined don't belong in a bar meant to show what's coming up for you.
  const remaining = upcomingAttending(today, now).slice(0, 4);
  const other = dayAgenda(filtered.visible, picked, home);

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{greeting(now, prefs.workingHours, home)}</div>
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

      <Segmented
        label="Popup section"
        className="mb-2 w-full [&>button]:flex-1"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'links', label: 'Links' },
        ]}
      />

      {tab === 'links' ? (
        <PopupLinks onOpenFull={() => void openSidePanel()} />
      ) : (
        <>
      {account.signedIn && (
        <div className="-mt-1 mb-2 flex items-center justify-between">
          <div className="text-xs text-muted">{format(picked, 'EEEE, d MMMM')}</div>
          <DayStepper day={picked} today={todayDate} onChange={(d) => setPickedDay(isSameDay(d, todayDate) ? null : d)} />
        </div>
      )}

      {!account.signedIn ? (
        // Google's sign-in window would close the popup mid-flow, so connecting happens in the side panel.
        <ConnectCard onConnect={() => undefined} busy={false} error={null} canSignInHere={false} onOpenFull={() => void openSidePanel()} />
      ) : loading ? (
        <p className="py-6 text-center text-xs text-subtle">Loading…</p>
      ) : (
        <div className="space-y-3">
          {syncError && <p className="text-xs text-warning">{syncError.code === 'expired' ? 'Sign-in expired. Open Dayflow to reconnect.' : 'Showing your last synced events.'}</p>}
          {isToday ? (
            <>
              <NextEventCard event={pickNextEvent(today, now)} now={now} />
              {remaining.length > 1 && (
                <div>
                  <h2 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Later today</h2>
                  {remaining.slice(1).map((e) => (
                    <EventRow key={`${e.calendarId}:${e.id}`} event={e} now={now} day={picked} showActions={false} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div>
              <AllDayStrip events={other.allDay} />
              {other.timed.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface p-3 text-[13px] text-muted">Nothing scheduled this day.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {other.timed.map((e) => (
                    <EventRow key={`${e.calendarId}:${e.id}`} event={e} now={now} day={picked} showActions={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

        </>
      )}

      {account.signedIn && (
        <Button variant="primary" className="mt-3 w-full" onClick={() => void openSidePanel()}>
          <PanelRight className="size-4" /> Open side panel
        </Button>
      )}
    </div>
  );
}
