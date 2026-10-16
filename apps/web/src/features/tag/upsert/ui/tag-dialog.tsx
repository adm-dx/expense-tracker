'use client';

import type { Tag } from '@expense-tracker/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';
import { TagForm } from './tag-form';

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rename this tag; omit to create a new one. */
  tag?: Tag | undefined;
}

export function TagDialog({ open, onOpenChange, tag }: TagDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tag ? 'Rename tag' : 'Add tag'}</DialogTitle>
          <DialogDescription>
            {tag
              ? 'The new name shows on every transaction with this tag.'
              : 'Tags group transactions across categories, e.g. a trip or a project.'}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so the form resets for each opening. */}
        <TagForm tag={tag} onSuccess={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}
