'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useCategoriesStore } from '@/entities/category';
import { Button } from '@/shared/ui';
import { TransactionDialog } from './transaction-dialog';

export function AddTransactionButton() {
  const [open, setOpen] = useState(false);

  function handleOpen() {
    // Refetch if the list is empty: categories may have been created since the last load.
    const { categories, load } = useCategoriesStore.getState();
    void load({ force: categories.length === 0 });
    setOpen(true);
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus />
        Add transaction
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
