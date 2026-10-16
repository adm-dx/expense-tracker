'use client';

import type { Tag, Transaction } from '@expense-tracker/types';
import { TagBadge } from '@/entities/tag';
import { useRemoveTransactionTag } from '../model/use-remove-transaction-tag';

/** A transaction's tag with a × that takes it off right away. */
export function TransactionTagBadge({
  transaction,
  tag,
}: {
  transaction: Transaction;
  tag: Tag;
}) {
  const { remove, isPending } = useRemoveTransactionTag();

  return (
    <TagBadge
      name={tag.name}
      onRemove={() => void remove(transaction, tag.id)}
      removeDisabled={isPending}
    />
  );
}
