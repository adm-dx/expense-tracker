'use client';

import type { Tag } from '@expense-tracker/types';
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
import { useDeleteTag } from '../model/use-delete-tag';

interface DeleteTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | undefined;
}

function pluralizeTransactions(count: number): string {
  return count === 1 ? '1 transaction' : `${count} transactions`;
}

export function DeleteTagDialog({
  open,
  onOpenChange,
  tag,
}: DeleteTagDialogProps) {
  const { remove, isPending } = useDeleteTag({
    onSuccess: () => onOpenChange(false),
  });
  const count = tag?.transactionCount ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete tag?</AlertDialogTitle>
          <AlertDialogDescription>
            {tag ? `“${tag.name}” will be permanently deleted. ` : ''}
            {count > 0
              ? `${pluralizeTransactions(count)} will keep their data but lose this tag.`
              : 'No transactions use it.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) keeps the dialog open until the request finishes. */}
          <Button
            variant="destructive"
            disabled={!tag || isPending}
            onClick={() => tag && void remove(tag.id)}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
