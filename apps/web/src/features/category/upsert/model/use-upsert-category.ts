'use client';

import type { Category, UpdateCategoryRequest } from '@expense-tracker/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCategoriesStore } from '@/entities/category';
import { categoriesApi } from '@/shared/api/categories-api';
import { getErrorMessage } from '@/shared/lib/error';
import type { CategoryFormValues } from './schema';

function buildUpdate(
  category: Category,
  values: CategoryFormValues
): UpdateCategoryRequest {
  const body: UpdateCategoryRequest = {};
  if (values.name !== category.name) body.name = values.name;
  if (values.icon !== category.icon) body.icon = values.icon;
  return body;
}

export function useUpsertCategory(options: {
  category?: Category | undefined;
  onSuccess?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  async function submit(values: CategoryFormValues) {
    setIsPending(true);
    try {
      const { category } = options;
      if (category) {
        const body = buildUpdate(category, values);
        if (Object.keys(body).length > 0) {
          await categoriesApi.update(category.id, body);
          toast.success('Category updated');
        }
      } else {
        await categoriesApi.create({ name: values.name, icon: values.icon });
        toast.success('Category added');
      }
      options.onSuccess?.();
      // The transactions table reads names and icons from this store.
      void useCategoriesStore.getState().load({ force: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return { submit, isPending };
}
