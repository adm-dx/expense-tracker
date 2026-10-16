'use client';

import Link from 'next/link';
import { useEffect, useId } from 'react';
import { useCurrencyStore } from '@/entities/currency';
import { useTagReportStore } from '@/entities/report';
import { useTagsStore } from '@/entities/tag';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';
import { formatMonth } from '../lib/month';
import { TagReportChart } from './tag-report-chart';

/** Income and expense of one tag per month, over all time. */
export function TagReport() {
  const id = useId();
  const currency = useCurrencyStore((state) => state.currency);
  const currencyHydrated = useCurrencyStore((state) => state.hasHydrated);
  const tags = useTagsStore((state) => state.tags);
  const tagsStatus = useTagsStore((state) => state.status);
  const loadTags = useTagsStore((state) => state.load);
  const tagId = useTagReportStore((state) => state.tagId);
  const report = useTagReportStore((state) => state.report);
  const status = useTagReportStore((state) => state.status);
  const error = useTagReportStore((state) => state.error);
  const setTagId = useTagReportStore((state) => state.setTagId);
  const fetchReport = useTagReportStore((state) => state.fetch);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // A tag deleted since it was chosen: back to the prompt, not a 404.
  const tag = tags.find((item) => item.id === tagId) ?? null;
  useEffect(() => {
    if (tagsStatus === 'success' && tagId !== null && tag === null) {
      setTagId(null);
    }
  }, [tagsStatus, tagId, tag, setTagId]);

  // Wait for the stored display currency, so nothing loads in EUR first.
  const selectedId = tag?.id ?? null;
  useEffect(() => {
    if (currencyHydrated && selectedId !== null) void fetchReport(currency);
  }, [selectedId, currency, currencyHydrated, fetchReport]);

  if (tagsStatus === 'success' && tags.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No tags yet.{' '}
          <Link href="/settings" className="underline underline-offset-4">
            Add them in the settings
          </Link>{' '}
          and put them on transactions to see a report here.
        </CardContent>
      </Card>
    );
  }

  const isLoading = status === 'loading' || status === 'idle';
  const balance = report ? Number(report.balance) : 0;
  const months = report
    ? report.byMonth
        .filter((month) => month.incomeCount + month.expenseCount > 0)
        .reverse()
    : [];

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-tag`}>Tag</Label>
        <Select value={selectedId ?? ''} onValueChange={setTagId}>
          <SelectTrigger id={`${id}-tag`} className="w-[220px]">
            <SelectValue placeholder="Choose a tag" />
          </SelectTrigger>
          <SelectContent>
            {tags.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
      {tag === null ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Choose a tag to see its income and expenses over all time.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{tag.name}</CardTitle>
            <CardDescription>
              {report?.ratesDate
                ? `All time · rate of ${formatDate(report.ratesDate)}`
                : 'All time'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading && !report ? (
              <div
                role="status"
                aria-label="Loading the report"
                className="h-72 animate-pulse rounded-md bg-muted"
              />
            ) : !report || report.byMonth.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No transactions with this tag yet.
              </p>
            ) : (
              <>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <Total
                    label="Income"
                    value={formatMoney(report.totalIncome, report.currency)}
                    className="text-green-600"
                  />
                  <Total
                    label="Expenses"
                    value={formatMoney(report.totalExpense, report.currency)}
                    className="text-red-600"
                  />
                  <Total
                    label="Balance"
                    value={formatMoney(report.balance, report.currency)}
                    className={balance < 0 ? 'text-red-600' : 'text-green-600'}
                  />
                </dl>
                <TagReportChart
                  months={report.byMonth}
                  currency={report.currency}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {months.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell>{formatMonth(month.month)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(month.income, report.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(month.expense, report.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Total({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-xl font-semibold tabular-nums', className)}>
        {value}
      </dd>
    </div>
  );
}
