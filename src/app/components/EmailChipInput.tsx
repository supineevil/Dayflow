import { X } from 'lucide-react';
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { parseEmails } from '@/core/google/meeting';
import { cn } from '@/app/lib/cn';

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
  label: string;
  placeholder?: string;
}

/** One email per chip. Enter, comma, space or leaving the field adds what you typed. */
export function EmailChipInput({ emails, onChange, label, placeholder }: Props) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState<string[]>([]);

  /** Adds every valid address in `text`; anything invalid stays in the box so it can be fixed. */
  const commit = (text: string) => {
    const parsed = parseEmails(text);
    if (parsed.valid.length > 0) onChange([...emails, ...parsed.valid.filter((e) => !emails.includes(e))]);
    setDraft(parsed.invalid.join(' '));
    setInvalid(parsed.invalid);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      // Enter must not submit the surrounding form while someone is still adding people.
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === ' ' && draft.trim()) {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && !draft && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\s,;]/.test(text.trim())) return;
    e.preventDefault();
    commit(`${draft} ${text}`);
  };

  return (
    <div>
      <span className="mb-1 block text-xs text-subtle">{label}</span>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 rounded-md border bg-surface px-1.5 py-1 focus-within:border-accent',
          invalid.length > 0 ? 'border-danger/60' : 'border-border',
        )}
      >
        {emails.map((email) => (
          <span key={email} className="inline-flex max-w-full items-center gap-0.5 rounded bg-surface-2 py-0.5 pl-1.5 pr-0.5 text-xs">
            <span className="truncate">{email}</span>
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() => onChange(emails.filter((x) => x !== email))}
              className="inline-flex size-4 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="email"
          inputMode="email"
          autoComplete="off"
          aria-label={label}
          className="h-6 min-w-32 flex-1 bg-transparent px-1 text-[13px] outline-none"
          value={draft}
          placeholder={emails.length === 0 ? placeholder : 'Add another'}
          onChange={(e) => { setDraft(e.target.value); setInvalid([]); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>
      {invalid.length > 0 && <p role="alert" className="mt-1 text-xs text-danger">Not a valid email: {invalid.join(', ')}</p>}
      <p className="mt-1 text-xs text-subtle">Press Enter after each email.</p>
    </div>
  );
}
