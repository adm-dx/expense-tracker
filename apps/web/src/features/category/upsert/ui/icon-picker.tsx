'use client';

import { CATEGORY_ICONS, type CategoryIcon } from '@expense-tracker/types';
import { forwardRef, useState } from 'react';
import {
  CategoryIcon as CategoryIconView,
  getCategoryIconLabel,
} from '@/entities/category';
import { cn } from '@/shared/lib/utils';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/shared/ui';

interface IconPickerProps {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
  disabled?: boolean;
}

/** A button showing the current icon; opens a grid of every category icon. */
export const IconPicker = forwardRef<HTMLButtonElement, IconPickerProps>(
  function IconPicker({ value, onChange, disabled, ...props }, ref) {
    const [open, setOpen] = useState(false);

    function select(icon: CategoryIcon) {
      onChange(icon);
      setOpen(false);
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={`Icon: ${getCategoryIconLabel(value)}. Change icon`}
            {...props}
          >
            <CategoryIconView icon={value} className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div
            role="group"
            aria-label="Category icons"
            className="grid grid-cols-6 gap-1 sm:grid-cols-8"
          >
            {CATEGORY_ICONS.map((icon) => {
              const label = getCategoryIconLabel(icon);
              const selected = icon === value;
              return (
                <Button
                  key={icon}
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  className={cn(
                    'size-9',
                    selected &&
                      'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  )}
                  onClick={() => select(icon)}
                >
                  <CategoryIconView icon={icon} className="size-5" />
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);
