'use client';

import type { Transaction } from '@expense-tracker/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useCategoriesStore } from '@/entities/category';
import { todayDateInputValue, toDateInputValue } from '@/shared/lib/format';
import {
  Button,
  DialogFooter,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';
import { transactionSchema, type TransactionFormValues } from '../model/schema';
import { useUpsertTransaction } from '../model/use-upsert-transaction';

function toFormValues(transaction?: Transaction): TransactionFormValues {
  if (!transaction) {
    return {
      type: 'EXPENSE',
      categoryId: '',
      amount: '',
      date: todayDateInputValue(),
      description: '',
    };
  }
  return {
    type: transaction.type,
    categoryId: transaction.categoryId,
    amount: transaction.amount,
    date: toDateInputValue(transaction.date),
    description: transaction.description ?? '',
  };
}

interface TransactionFormProps {
  transaction?: Transaction | undefined;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionForm({
  transaction,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const categories = useCategoriesStore((state) => state.categories);
  const categoriesStatus = useCategoriesStore((state) => state.status);
  const noCategories =
    categoriesStatus !== 'loading' && categories.length === 0;
  const { submit, isPending } = useUpsertTransaction({
    transaction,
    onSuccess,
  });
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: toFormValues(transaction),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={categories.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        categoriesStatus === 'loading'
                          ? 'Loading categories…'
                          : 'Choose a category'
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noCategories && (
                <FormDescription>
                  {categoriesStatus === 'error'
                    ? 'Failed to load categories. Close the dialog and try again.'
                    : 'You have no categories yet. Create one on the Categories page.'}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Optional" autoComplete="off" {...field} />
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
            {isPending ? 'Saving…' : transaction ? 'Save changes' : 'Add'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
