'use client';

import type { Currency, Transaction } from '@expense-tracker/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { CategoryIcon, useCategoriesStore } from '@/entities/category';
import { TagBadge, useTagsStore } from '@/entities/tag';
import { useCurrencyStore } from '@/entities/currency';
import { useEnabledCurrencies } from '@/entities/settings';
import {
  formatCurrency,
  todayDateInputValue,
  toDateInputValue,
} from '@/shared/lib/format';
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

// Radix Select can't hold an empty value, so "no tag" gets a sentinel.
const NO_TAG = 'none';

/** A new transaction starts in the user's currency setting. */
function toFormValues(
  transaction: Transaction | undefined,
  defaultCurrency: Currency
): TransactionFormValues {
  if (!transaction) {
    return {
      type: 'EXPENSE',
      categoryId: '',
      tagId: '',
      amount: '',
      currency: defaultCurrency,
      date: todayDateInputValue(),
      description: '',
    };
  }
  return {
    type: transaction.type,
    categoryId: transaction.categoryId,
    tagId: transaction.tagIds[0] ?? '',
    amount: transaction.amount,
    currency: transaction.currency,
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
  const defaultCurrency = useCurrencyStore((state) => state.currency);
  const enabledCurrencies = useEnabledCurrencies();
  // A transaction keeps its currency even if it is no longer enabled.
  const currencies =
    transaction && !enabledCurrencies.includes(transaction.currency)
      ? [...enabledCurrencies, transaction.currency]
      : enabledCurrencies;
  const categoriesStatus = useCategoriesStore((state) => state.status);
  const tags = useTagsStore((state) => state.tags);
  const loadTags = useTagsStore((state) => state.load);
  const noCategories =
    categoriesStatus !== 'loading' && categories.length === 0;
  const { submit, isPending } = useUpsertTransaction({
    transaction,
    onSuccess,
  });
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: toFormValues(transaction, defaultCurrency),
  });

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_130px]">
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
          {/* Changing it relabels the amount; it doesn't convert it. */}
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {formatCurrency(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        <CategoryIcon icon={category.icon} />
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
          name="tagId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tag</FormLabel>
              <div className="flex gap-2">
                <Select
                  value={field.value || NO_TAG}
                  onValueChange={(value) =>
                    field.onChange(value === NO_TAG ? '' : value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_TAG}>No tag</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <TagBadge name={tag.name} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.value && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Remove tag"
                    onClick={() => field.onChange('')}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </div>
              {tags.length === 0 && (
                <FormDescription>
                  Tags are optional; add them in the settings.
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
