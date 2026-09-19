'use client';

import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';
import { PeriodFilter } from '@/features/transaction/period-filter';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { formatCurrency } from '@/shared/lib/format';
import { formatPeriod } from '@/shared/lib/period';
import { Alert, AlertDescription, Button } from '@/shared/ui';
import { SummaryCard } from './summary-card';

export function TransactionsSummary() {
  const period = useTransactionsStore((state) => state.period);
  const summary = useSummaryStore((state) => state.summary);
  const status = useSummaryStore((state) => state.status);
  const error = useSummaryStore((state) => state.error);
  const fetchSummary = useSummaryStore((state) => state.fetch);

  useEffect(() => {
    void fetchSummary();
  }, [period, fetchSummary]);

  const isLoading = status === 'loading' || status === 'idle';
  const caption = formatPeriod(period);
  const balance = summary ? Number(summary.balance) : 0;

  return (
    <section className="space-y-4">
      <PeriodFilter />
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load summary'}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchSummary()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Income"
          icon={TrendingUp}
          amount={summary ? formatCurrency(summary.totalIncome) : null}
          caption={caption}
          isLoading={isLoading}
          amountClassName="text-green-600"
        />
        <SummaryCard
          title="Expenses"
          icon={TrendingDown}
          amount={summary ? formatCurrency(summary.totalExpense) : null}
          caption={caption}
          isLoading={isLoading}
          amountClassName="text-red-600"
        />
        <SummaryCard
          title="Balance"
          icon={Scale}
          amount={summary ? formatCurrency(summary.balance) : null}
          caption={caption}
          isLoading={isLoading}
          amountClassName={balance < 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>
    </section>
  );
}
