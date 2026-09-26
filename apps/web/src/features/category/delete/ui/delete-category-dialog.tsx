'use client';

import type { Category } from '@expense-tracker/types';
import { useState } from 'react';
import { CategoryIcon, useCategoriesStore } from '@/entities/category';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';
import { useDeleteCategory } from '../model/use-delete-category';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | undefined;
}

function pluralizeTransactions(count: number): string {
  return count === 1 ? '1 transaction' : `${count} transactions`;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
}: DeleteCategoryDialogProps) {
  const categories = useCategoriesStore((state) => state.categories);
  // Keyed by category, so a new one starts with nothing chosen.
  const [target, setTarget] = useState<{ for: string; id: string }>();
  const { remove, isPending } = useDeleteCategory({
    onSuccess: () => onOpenChange(false),
  });

  // Read the count from the store: it is refreshed after a 409.
  const current = categories.find((c) => c.id === category?.id) ?? category;
  const transactionCount = current?.transactionCount ?? 0;
  const needsTarget = transactionCount > 0;
  const targets = categories.filter((c) => c.id !== category?.id);
  const reassignTo =
    target &&
    target.for === category?.id &&
    targets.some((c) => c.id === target.id)
      ? target.id
      : undefined;
  const canDelete =
    !!category && !isPending && (!needsTarget || reassignTo !== undefined);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete category?</AlertDialogTitle>
          <AlertDialogDescription>
            {category ? `“${category.name}” will be permanently deleted. ` : ''}
            {needsTarget
              ? `Its ${pluralizeTransactions(transactionCount)} will be moved to the category you choose.`
              : 'It has no transactions.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsTarget &&
          (targets.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="reassign-to">Move transactions to</Label>
              <Select
                value={reassignTo ?? ''}
                onValueChange={(id) =>
                  category && setTarget({ for: category.id, id })
                }
                disabled={isPending}
              >
                <SelectTrigger id="reassign-to">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={c.icon} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              This is your only category, so its transactions have nowhere to
              go. Add another category first.
            </p>
          ))}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) keeps the dialog open until the request finishes. */}
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={() => category && void remove(category.id, reassignTo)}
          >
            {isPending
              ? 'Deleting…'
              : needsTarget
                ? 'Move and delete'
                : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
