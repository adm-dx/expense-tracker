'use client';

import type { Tag } from '@expense-tracker/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { tagSchema, type TagFormValues } from '../model/schema';
import { useUpsertTag } from '../model/use-upsert-tag';

interface TagFormProps {
  tag?: Tag | undefined;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TagForm({ tag, onSuccess, onCancel }: TagFormProps) {
  const { submit, isPending } = useUpsertTag({ tag, onSuccess });
  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: tag?.name ?? '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Trip to Vienna"
                  autoComplete="off"
                  maxLength={50}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : tag ? 'Save changes' : 'Add'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
