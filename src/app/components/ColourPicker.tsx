import { Check } from 'lucide-react';
import { BOOKMARK_COLOURS, type BookmarkColour } from '@/core/bookmarks/bookmarks';
import { cn } from '@/app/lib/cn';

export function ColourPicker({ value, onChange, label }: { value: BookmarkColour; onChange: (c: BookmarkColour) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {BOOKMARK_COLOURS.map((c) => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={value === c.key}
          aria-label={c.name}
          title={c.name}
          onClick={() => onChange(c.key)}
          style={{ backgroundColor: c.hex }}
          className={cn('inline-flex size-5 items-center justify-center rounded-full ring-offset-1 ring-offset-bg', value === c.key && 'ring-2 ring-fg')}
        >
          {value === c.key && <Check className="size-3 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
