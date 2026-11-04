import { cn } from '@/app/lib/cn';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left]',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  );
}
