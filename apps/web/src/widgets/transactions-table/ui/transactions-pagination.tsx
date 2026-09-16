'use client';

import {
  TRANSACTION_PAGE_SIZES,
  type TransactionPageSize,
} from '@expense-tracker/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransactionsStore } from '@/entities/transaction';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';

export function TransactionsPagination() {
  const page = useTransactionsStore((state) => state.page);
  const pageSize = useTransactionsStore((state) => state.pageSize);
  const total = useTransactionsStore((state) => state.total);
  const setPage = useTransactionsStore((state) => state.setPage);
  const setPageSize = useTransactionsStore((state) => state.setPageSize);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            setPageSize(Number(value) as TransactionPageSize)
          }
        >
          <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground">
          Page {page} of {pageCount} · {total} total
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
