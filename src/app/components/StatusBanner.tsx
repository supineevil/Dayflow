import { AlertTriangle, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/Button';

interface Props {
  error: { code: string; message: string };
  onReconnect: () => void;
  onRetry: () => void;
  busy: boolean;
}

export function StatusBanner({ error, onReconnect, onRetry, busy }: Props) {
  const needsSignIn = error.code === 'expired';
  const offline = error.code === 'offline';
  let action: ReactNode;
  if (needsSignIn) {
    action = (
      <Button size="sm" variant="primary" onClick={onReconnect} disabled={busy}>
        Reconnect
      </Button>
    );
  } else {
    action = (
      <Button size="sm" onClick={onRetry} disabled={busy}>
        Try again
      </Button>
    );
  }
  return (
    <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3">
      {offline ? <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">
          {needsSignIn ? 'Google sign-in expired' : offline ? "You're offline" : "Couldn't sync your calendar"}
        </div>
        <p className="mt-0.5 break-words text-xs text-muted">
          {offline ? 'Showing your last synced events.' : error.message}
        </p>
      </div>
      {action}
    </div>
  );
}
