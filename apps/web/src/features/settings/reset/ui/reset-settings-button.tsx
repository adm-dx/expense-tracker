'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { getErrorMessage } from '@/shared/lib/error';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@/shared/ui';

export function ResetSettingsButton() {
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function confirm() {
    setIsPending(true);
    try {
      await resetToDefaults();
      toast.success('Settings reset to defaults');
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw />
        Reset settings
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
            <AlertDialogDescription>
              The theme, currency and location go back to their defaults (system
              theme in slate, EUR, weather for Belgrade). Your password, your
              currencies and your data stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void confirm()}
              disabled={isPending}
            >
              {isPending ? 'Resetting…' : 'Reset'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
