'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  /** Groups the radios; unique on the page. */
  name: string;
  value: T | null;
  options: readonly SegmentedControlOption<T>[];
  onValueChange: (value: T) => void;
  'aria-label': string;
  disabled?: boolean;
  className?: string;
}

/**
 * A row of mutually exclusive buttons. Native radio inputs underneath, so
 * arrow keys, focus and screen readers behave like any radio group.
 */
export function SegmentedControl<T extends string>({
  name,
  value,
  options,
  onValueChange,
  'aria-label': ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-md border bg-background p-1',
        className
      )}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <label key={optionValue} className="relative">
          <input
            type="radio"
            name={name}
            value={optionValue}
            checked={value === optionValue}
            disabled={disabled}
            onChange={() => onValueChange(optionValue)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm text-muted-foreground transition-colors',
              'hover:text-foreground peer-checked:bg-secondary peer-checked:text-secondary-foreground',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50'
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
