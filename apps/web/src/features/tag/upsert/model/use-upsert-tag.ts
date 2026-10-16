'use client';

import type { Tag } from '@expense-tracker/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTagsStore } from '@/entities/tag';
import { tagsApi } from '@/shared/api/tags-api';
import { getErrorMessage } from '@/shared/lib/error';
import type { TagFormValues } from './schema';

export function useUpsertTag(options: {
  tag?: Tag | undefined;
  onSuccess?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  async function submit(values: TagFormValues) {
    setIsPending(true);
    try {
      const { tag } = options;
      if (tag) {
        if (values.name !== tag.name) {
          await tagsApi.update(tag.id, { name: values.name });
          toast.success('Tag renamed');
        }
      } else {
        await tagsApi.create({ name: values.name });
        toast.success('Tag added');
      }
      options.onSuccess?.();
      // The transactions table and the form read the names from this store.
      void useTagsStore.getState().load({ force: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return { submit, isPending };
}
