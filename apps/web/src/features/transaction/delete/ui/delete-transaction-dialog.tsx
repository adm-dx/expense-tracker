'use client';

import type { Transaction } from '@expense-tracker/types';
import { formatAmount, formatDate } from '@/shared/lib/format';
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
import { useDeleteTransaction } from '../model/use-delete-transaction';

interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | undefined;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  transaction,
}: DeleteTransactionDialogProps) {
  const { remove, isPending } = useDeleteTransaction({
    onSuccess: () => onOpenChange(false),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction
              ? `${formatAmount(transaction.amount, transaction.type, transaction.currency)} on ${formatDate(transaction.date)} will be permanently deleted. `
              : ''}
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) keeps the dialog open until the request finishes. */}
          <Button
            variant="destructive"
            disabled={isPending || !transaction}
            onClick={() => transaction && void remove(transaction.id)}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
