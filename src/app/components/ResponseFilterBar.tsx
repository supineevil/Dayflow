import type { ResponseFilter } from '@/core/models';
import { usePrefs } from '@/app/hooks/usePrefs';
import { Segmented } from './ui/Segmented';

const OPTIONS: { value: ResponseFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'accepted', label: 'Yes' },
  { value: 'tentative', label: 'Maybe' },
  { value: 'declined', label: 'No' },
  { value: 'needsAction', label: 'Pending' },
];

export function ResponseFilterBar() {
  const { prefs, setPrefs } = usePrefs();
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">Your reply</span>
      <Segmented
        label="Filter events by your reply"
        value={prefs.responseFilter}
        options={OPTIONS}
        onChange={(responseFilter) => setPrefs({ responseFilter })}
      />
    </div>
  );
}
