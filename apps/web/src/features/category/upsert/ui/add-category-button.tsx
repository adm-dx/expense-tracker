'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui';
import { CategoryDialog } from './category-dialog';

export function AddCategoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add category
      </Button>
      <CategoryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
