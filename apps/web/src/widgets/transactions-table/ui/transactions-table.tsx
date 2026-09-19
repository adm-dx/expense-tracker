'use client';

import type { Transaction } from '@expense-tracker/types';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeleteTransactionDialog } from '@/features/transaction/delete';
import { TransactionDialog } from '@/features/transaction/upsert';
import { useCategoriesStore, useCategoryMap } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { cn } from '@/shared/lib/utils';
import { formatAmount, formatDate } from '@/shared/lib/format';
import {
  Alert,
  AlertDescription,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';
import { TransactionsPagination } from './transactions-pagination';

const COLUMN_COUNT = 6;

type RowAction = { kind: 'edit' | 'delete'; transaction: Transaction } | null;

export function TransactionsTable() {
  const items = useTransactionsStore((state) => state.items);
  const status = useTransactionsStore((state) => state.status);
  const error = useTransactionsStore((state) => state.error);
  const page = useTransactionsStore((state) => state.page);
  const pageSize = useTransactionsStore((state) => state.pageSize);
  const period = useTransactionsStore((state) => state.period);
  const fetchTransactions = useTransactionsStore((state) => state.fetch);
  const loadCategories = useCategoriesStore((state) => state.load);
  const categoryMap = useCategoryMap();
  const [action, setAction] = useState<RowAction>(null);
  // Kept separately so dialog content doesn't vanish during the close animation.
  const [selected, setSelected] = useState<Transaction>();

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void fetchTransactions();
  }, [page, pageSize, period, fetchTransactions]);

  function openAction(kind: 'edit' | 'delete', transaction: Transaction) {
    setSelected(transaction);
    setAction({ kind, transaction });
  }

  function handleOpenChange(open: boolean) {
    if (!open) setAction(null);
  }

  const isInitialLoading = status === 'loading' && items.length === 0;

  return (
    <div className="space-y-4">
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load transactions'}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchTransactions()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div
        className={cn(
          'rounded-md border transition-opacity',
          status === 'loading' && items.length > 0 && 'opacity-60'
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[52px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <div className="h-5 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}
            {status === 'success' && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-24 text-center text-muted-foreground"
                >
                  No transactions yet
                </TableCell>
              </TableRow>
            )}
            {items.map((transaction) => {
              const category = categoryMap.get(transaction.categoryId);
              const isIncome = transaction.type === 'INCOME';
              return (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full bg-muted"
                        style={
                          category
                            ? { backgroundColor: category.color }
                            : undefined
                        }
                      />
                      {category?.name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">
                    {transaction.description ?? '—'}
                  </TableCell>
                  <TableCell>{isIncome ? 'Income' : 'Expense'}</TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap text-right font-medium tabular-nums',
                      isIncome ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {formatAmount(transaction.amount, transaction.type)}
                  </TableCell>
                  <TableCell>
                    {/* Non-modal so opening a dialog from it doesn't leave the page inert. */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Transaction actions"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => openAction('edit', transaction)}
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => openAction('delete', transaction)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TransactionsPagination />
      <TransactionDialog
        open={action?.kind === 'edit'}
        onOpenChange={handleOpenChange}
        transaction={selected}
      />
      <DeleteTransactionDialog
        open={action?.kind === 'delete'}
        onOpenChange={handleOpenChange}
        transaction={selected}
      />
    </div>
  );
}
