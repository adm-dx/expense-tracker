'use client';

import { COLOR_SCHEMES, type Theme } from '@expense-tracker/types';
import { Monitor, Moon, Sun } from 'lucide-react';
import { COLOR_SCHEME_LABELS } from '@/shared/lib/color-schemes';
import { cn } from '@/shared/lib/utils';
import { resolveMode, type ThemeSelection } from '@/shared/lib/theme';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  type SegmentedControlOption,
} from '@/shared/ui';
import { ThemePreview } from './theme-preview';

const THEME_OPTIONS: readonly SegmentedControlOption<Theme>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ThemeSelection;
  onChoose: (patch: Partial<ThemeSelection>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function ThemeDialog({
  open,
  onOpenChange,
  draft,
  onChoose,
  onSave,
  isSaving,
}: ThemeDialogProps) {
  const mode = resolveMode(draft.theme);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            Pick a mode and a color scheme. The app shows your choice right
            away; nothing is saved until you apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Mode</p>
          <SegmentedControl
            name="theme-mode"
            aria-label="Mode"
            value={draft.theme}
            options={THEME_OPTIONS}
            onValueChange={(theme) => onChoose({ theme })}
          />
        </div>

        <div className="space-y-2">
          <p id="color-scheme-label" className="text-sm font-medium leading-none">
            Color scheme
          </p>
          <div
            role="radiogroup"
            aria-labelledby="color-scheme-label"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {COLOR_SCHEMES.map((scheme) => (
              <label key={scheme} className="relative">
                <input
                  type="radio"
                  name="color-scheme"
                  value={scheme}
                  checked={draft.colorScheme === scheme}
                  onChange={() => onChoose({ colorScheme: scheme })}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'block cursor-pointer overflow-hidden rounded-lg border-2 border-transparent ring-offset-background transition-colors',
                    'hover:border-muted-foreground/40 peer-checked:border-primary',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2'
                  )}
                >
                  <ThemePreview colorScheme={scheme} mode={mode} />
                  <span className="block border-t px-2 py-1 text-xs font-medium">
                    {COLOR_SCHEME_LABELS[scheme]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Applying…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
