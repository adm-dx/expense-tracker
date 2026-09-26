'use client';

import type { Category } from '@expense-tracker/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';
import { CategoryForm } from './category-form';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this category; omit to create a new one. */
  category?: Category | undefined;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: CategoryDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit category' : 'Add category'}
          </DialogTitle>
          <DialogDescription>
            {category
              ? 'Change the name or the icon of this category.'
              : 'Name the category and pick an icon for it.'}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so the form resets for each opening. */}
        <CategoryForm category={category} onSuccess={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}
