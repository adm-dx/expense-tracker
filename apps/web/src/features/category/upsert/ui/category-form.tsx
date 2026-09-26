'use client';

import type { Category } from '@expense-tracker/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FALLBACK_CATEGORY_ICON, isCategoryIcon } from '@/entities/category';
import {
  Button,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/shared/ui';
import { categorySchema, type CategoryFormValues } from '../model/schema';
import { useUpsertCategory } from '../model/use-upsert-category';
import { IconPicker } from './icon-picker';

function toFormValues(category?: Category): CategoryFormValues {
  return {
    name: category?.name ?? '',
    icon:
      category && isCategoryIcon(category.icon)
        ? category.icon
        : FALLBACK_CATEGORY_ICON,
  };
}

interface CategoryFormProps {
  category?: Category | undefined;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({
  category,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const { submit, isPending } = useUpsertCategory({ category, onSuccess });
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: toFormValues(category),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <div className="flex items-start gap-3">
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <FormControl>
                  <IconPicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Groceries"
                    autoComplete="off"
                    maxLength={50}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : category ? 'Save changes' : 'Add'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
