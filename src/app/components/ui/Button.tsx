import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/app/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-border bg-surface text-fg hover:bg-hover',
  ghost: 'text-muted hover:bg-hover hover:text-fg',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export function IconButton({ label, className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
