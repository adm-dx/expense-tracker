'use client';

import type {
  Transaction,
  UpdateTransactionRequest,
} from '@expense-tracker/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toDateInputValue, toIsoDate } from '@/shared/lib/format';
import type { TransactionFormValues } from './schema';

function buildUpdate(
  transaction: Transaction,
  values: TransactionFormValues
): UpdateTransactionRequest {
  const body: UpdateTransactionRequest = {};
  if (Number(values.amount) !== Number(transaction.amount)) {
    body.amount = Number(values.amount);
  }
  if (values.type !== transaction.type) body.type = values.type;
  if (values.categoryId !== transaction.categoryId) {
    body.categoryId = values.categoryId;
  }
  if (values.date !== toDateInputValue(transaction.date)) {
    body.date = toIsoDate(values.date);
  }
  const description = values.description || null;
  if (description !== transaction.description) body.description = description;
  return body;
}

export function useUpsertTransaction(options: {
  transaction?: Transaction | undefined;
  onSuccess?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  async function submit(values: TransactionFormValues) {
    setIsPending(true);
    try {
      const { transaction } = options;
      if (transaction) {
        const body = buildUpdate(transaction, values);
        if (Object.keys(body).length > 0) {
          await transactionsApi.update(transaction.id, body);
          toast.success('Transaction updated');
        }
      } else {
        await transactionsApi.create({
          type: values.type,
          categoryId: values.categoryId,
          amount: Number(values.amount),
          date: toIsoDate(values.date),
          ...(values.description ? { description: values.description } : {}),
        });
        toast.success('Transaction added');
      }
      options.onSuccess?.();
      void useTransactionsStore.getState().fetch();
      void useSummaryStore.getState().fetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return { submit, isPending };
}
