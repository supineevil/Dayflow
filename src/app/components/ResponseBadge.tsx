import type { ResponseStatus } from '@/core/models';

const BADGES: Partial<Record<ResponseStatus, { label: string; className: string }>> = {
  declined: { label: 'No', className: 'bg-surface-2 text-subtle' },
  tentative: { label: 'Maybe', className: 'bg-warning/15 text-warning' },
  needsAction: { label: 'Reply?', className: 'bg-accent-soft text-accent' },
};

/** Marks events where your answer isn't a plain "yes". Accepted events stay unadorned to cut noise. */
export function ResponseBadge({ response }: { response: ResponseStatus | undefined }) {
  const badge = response ? BADGES[response] : undefined;
  if (!badge) return null;
  return (
    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
      {badge.label}
    </span>
  );
}
