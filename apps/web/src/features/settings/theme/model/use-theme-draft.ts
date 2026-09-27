import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { getErrorMessage } from '@/shared/lib/error';
import { applyTheme, type ThemeSelection } from '@/shared/lib/theme';

/**
 * The theme dialog's state. While it's open, every choice is tried on the
 * whole app at once; saving keeps it, closing any other way puts the saved
 * theme back.
 */
export function useThemeDraft(saved: ThemeSelection) {
  const update = useSettingsStore((state) => state.update);
  const [open, setOpenState] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  // What to repaint if the page goes away mid-preview (e.g. browser back).
  const restoreOnUnmount = useRef<ThemeSelection | null>(null);

  useEffect(
    () => () => {
      if (restoreOnUnmount.current) applyTheme(restoreOnUnmount.current);
    },
    []
  );

  function setOpen(next: boolean) {
    if (next) {
      setDraft(saved);
      restoreOnUnmount.current = saved;
    } else {
      applyTheme(saved);
      restoreOnUnmount.current = null;
    }
    setOpenState(next);
  }

  function choose(patch: Partial<ThemeSelection>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    applyTheme(next);
  }

  async function save() {
    setIsSaving(true);
    try {
      // `features/settings/sync` paints and caches the saved theme.
      await update(draft);
      restoreOnUnmount.current = null;
      setOpenState(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
      // The store rolled back and repainted the old theme; keep the preview.
      applyTheme(draft);
    } finally {
      setIsSaving(false);
    }
  }

  return { open, setOpen, draft, choose, save, isSaving };
}
