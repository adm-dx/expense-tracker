'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui';
import { TagDialog } from './tag-dialog';

export function AddTagButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add tag
      </Button>
      <TagDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
