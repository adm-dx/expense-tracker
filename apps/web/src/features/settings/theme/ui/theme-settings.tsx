'use client';

import type { Theme } from '@expense-tracker/types';
import { COLOR_SCHEME_LABELS } from '@/shared/lib/color-schemes';
import { resolveMode, type ThemeSelection } from '@/shared/lib/theme';
import { Button } from '@/shared/ui';
import { useThemeDraft } from '../model/use-theme-draft';
import { ThemeDialog } from './theme-dialog';
import { ThemePreview } from './theme-preview';

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Same as the system',
};

interface ThemeSettingsProps {
  saved: ThemeSelection;
}

/** The saved theme with a button that opens the picker. */
export function ThemeSettings({ saved }: ThemeSettingsProps) {
  const { open, setOpen, draft, choose, save, isSaving } = useThemeDraft(saved);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ThemePreview
        colorScheme={saved.colorScheme}
        mode={resolveMode(saved.theme)}
        className="w-28 rounded-md border"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{COLOR_SCHEME_LABELS[saved.colorScheme]}</p>
        <p className="text-sm text-muted-foreground">
          {THEME_LABELS[saved.theme]}
        </p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Change
      </Button>
      <ThemeDialog
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        onChoose={choose}
        onSave={() => void save()}
        isSaving={isSaving}
      />
    </div>
  );
}
