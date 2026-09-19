'use client';

import type { Transaction } from '@expense-tracker/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';
import { TransactionForm } from './transaction-form';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this transaction; omit to create a new one. */
  transaction?: Transaction | undefined;
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Edit transaction' : 'Add transaction'}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? 'Update the details of this transaction.'
              : 'Record a new income or expense.'}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so the form resets for each opening. */}
        <TransactionForm
          transaction={transaction}
          onSuccess={close}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}
