'use client';

import type { Currency, TagMonthSummary } from '@expense-tracker/types';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/shared/lib/format';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/shared/ui/chart';
import { formatMonth } from '../lib/month';

// The same green and red as the amounts everywhere else.
const CHART_CONFIG = {
  income: { label: 'Income', color: '#16a34a' },
  expense: { label: 'Expenses', color: '#dc2626' },
} satisfies ChartConfig;

// Axis ticks only: the exact amounts are in the tooltip and the table.
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface ChartRow {
  month: string;
  label: string;
  income: number;
  expense: number;
  summary: TagMonthSummary;
}

interface TagReportChartProps {
  months: readonly TagMonthSummary[];
  currency: Currency;
}

/** Income and expense side by side, one pair of bars per month. */
export function TagReportChart({ months, currency }: TagReportChartProps) {
  const data = months.map((month): ChartRow => ({
    month: month.month,
    label: formatMonth(month.month),
    income: Number(month.income),
    expense: Number(month.expense),
    summary: month,
  }));

  return (
    <ChartContainer
      config={CHART_CONFIG}
      className="aspect-auto h-72 w-full"
      aria-hidden="true"
    >
      <BarChart data={data} margin={{ left: 8, right: 8 }} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => compactFormatter.format(value)}
        />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as ChartRow | undefined;
            if (!active || !row) return null;
            return (
              <div className="grid min-w-[11rem] gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="font-medium">{row.label}</p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Income ({row.summary.incomeCount})
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(row.summary.income, currency)}
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Expenses ({row.summary.expenseCount})
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(row.summary.expense, currency)}
                  </span>
                </p>
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
          isAnimationActive={false}
        />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
