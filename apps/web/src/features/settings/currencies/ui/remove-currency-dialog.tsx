'use client';

import { DEFAULT_CURRENCY, type Currency } from '@expense-tracker/types';
import { formatCurrency } from '@/shared/lib/format';
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
import { useRemoveCurrency } from '../model/use-remove-currency';

interface RemoveCurrencyDialogProps {
  /** The currency to remove; the dialog is open while it is set. */
  currency: Currency | null;
  onOpenChange: (open: boolean) => void;
}

export function RemoveCurrencyDialog({
  currency,
  onOpenChange,
}: RemoveCurrencyDialogProps) {
  const { remove, isPending } = useRemoveCurrency({
    onSuccess: () => onOpenChange(false),
  });

  return (
    <AlertDialog
      open={currency !== null}
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {currency ? formatCurrency(currency) : 'currency'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Transactions in {currency} will be converted to{' '}
            {formatCurrency(DEFAULT_CURRENCY)} at today&apos;s exchange rate.
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: it stays open until the
              request is done. */}
          <Button
            variant="destructive"
            onClick={() => {
              if (currency) void remove(currency);
            }}
            disabled={isPending}
          >
            {isPending ? 'Removing…' : 'Remove'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
