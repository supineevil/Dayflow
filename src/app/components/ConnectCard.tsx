import { CalendarDays, Lock } from 'lucide-react';
import { GOOGLE_CLIENT_ID } from '@/core/google/config';
import { Button } from './ui/Button';

interface Props {
  onConnect: () => void;
  busy: boolean;
  error: string | null;
  /** The popup can't host Google's sign-in window; it sends people to the side panel instead. */
  canSignInHere?: boolean;
  onOpenFull?: () => void;
}

export function ConnectCard({ onConnect, busy, error, canSignInHere = true, onOpenFull }: Props) {
  const configured = GOOGLE_CLIENT_ID !== '';
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <CalendarDays className="size-5 text-accent" />
      <h2 className="mt-2 text-sm font-semibold">Connect Google Calendar</h2>
      <p className="mt-1 text-xs text-muted">
        Dayflow reads your events to build a calmer view of your day. It changes your calendar only when you press a button to create, edit, answer or cancel an event.
      </p>

      {!configured ? (
        <p role="alert" className="mt-3 rounded-md bg-surface-2 p-2 text-xs text-warning">
          No Google client ID is configured yet. Follow <code>docs/GOOGLE_SETUP.md</code>, then rebuild.
        </p>
      ) : canSignInHere ? (
        <Button variant="primary" className="mt-3 w-full" onClick={onConnect} disabled={busy}>
          {busy ? 'Waiting for Google…' : 'Connect with Google'}
        </Button>
      ) : (
        <Button variant="primary" className="mt-3 w-full" onClick={onOpenFull}>
          Open Dayflow to connect
        </Button>
      )}

      {error && (
        <p role="alert" className="mt-2 break-words text-xs text-danger">
          {error}
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-subtle">
        <Lock className="mt-px size-3 shrink-0" />
        Events stay on this computer. Nothing is sent anywhere except to Google to read your calendar.
      </p>
    </div>
  );
}
