'use client';

import type { TransactionType } from '@expense-tracker/types';
import { useEffect, useState } from 'react';
import { CategoryIcon } from '@/entities/category';
import { useCurrencyStore } from '@/entities/currency';
import { useCategoryReportStore } from '@/entities/report';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { formatPeriod } from '@/shared/lib/period';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PeriodPicker,
  SegmentedControl,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type SegmentedControlOption,
} from '@/shared/ui';
import { buildReportRows, type ReportMetric } from '../lib/report-rows';
import { CategoryReportChart } from './category-report-chart';

const TYPE_OPTIONS: readonly SegmentedControlOption<TransactionType>[] = [
  { value: 'EXPENSE', label: 'Expenses' },
  { value: 'INCOME', label: 'Income' },
];

const METRIC_OPTIONS: readonly SegmentedControlOption<ReportMetric>[] = [
  { value: 'amount', label: 'Amount' },
  { value: 'count', label: 'Count' },
];

const shareFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

/** Count and total of transactions per category for a period of its own. */
export function CategoryReport() {
  const currency = useCurrencyStore((state) => state.currency);
  const currencyHydrated = useCurrencyStore((state) => state.hasHydrated);
  const period = useCategoryReportStore((state) => state.period);
  const periodHydrated = useCategoryReportStore((state) => state.hasHydrated);
  const preset = useCategoryReportStore((state) => state.preset);
  const report = useCategoryReportStore((state) => state.report);
  const status = useCategoryReportStore((state) => state.status);
  const error = useCategoryReportStore((state) => state.error);
  const setPeriod = useCategoryReportStore((state) => state.setPeriod);
  const fetchReport = useCategoryReportStore((state) => state.fetch);
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [metric, setMetric] = useState<ReportMetric>('amount');

  // Wait for the stored display currency, so nothing loads in EUR first; the
  // store itself waits for the stored period, hence the extra dependency.
  useEffect(() => {
    if (currencyHydrated) void fetchReport(currency);
  }, [period, periodHydrated, currency, currencyHydrated, fetchReport]);

  const isLoading = status === 'loading' || status === 'idle';
  const { rows, totals } = report
    ? buildReportRows(report.byCategory, type, metric)
    : { rows: [], totals: { amount: 0, count: 0 } };
  const caption = report?.ratesDate
    ? `${formatPeriod(period)} · rate of ${formatDate(report.ratesDate)}`
    : formatPeriod(period);
  const typeLabel = type === 'EXPENSE' ? 'expenses' : 'income';

  return (
    <section className="space-y-4">
      <PeriodPicker period={period} preset={preset} onChange={setPeriod} />
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load the report'}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchReport(currency)}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>By category</CardTitle>
            <CardDescription>{caption}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              name="report-type"
              aria-label="Transaction type"
              value={type}
              options={TYPE_OPTIONS}
              onValueChange={setType}
            />
            <SegmentedControl
              name="report-metric"
              aria-label="Chart by"
              value={metric}
              options={METRIC_OPTIONS}
              onValueChange={setMetric}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && !report ? (
            <div
              role="status"
              aria-label="Loading the report"
              className="h-48 animate-pulse rounded-md bg-muted"
            />
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No {typeLabel} in this period.
            </p>
          ) : (
            report && (
              <>
                <CategoryReportChart
                  rows={rows}
                  metric={metric}
                  currency={report.currency}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.categoryId}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <CategoryIcon
                              icon={row.icon}
                              className="text-muted-foreground"
                            />
                            {row.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.total, report.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {shareFormatter.format(row.share)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(totals.amount.toFixed(2), report.currency)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </>
            )
          )}
        </CardContent>
      </Card>
    </section>
  );
}
