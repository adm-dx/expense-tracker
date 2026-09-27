'use client';

import type { Currency } from '@expense-tracker/types';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/shared/lib/format';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/shared/ui/chart';
import type { ReportMetric, ReportRow } from '../lib/report-rows';

const BAR_SIZE = 20;
const ROW_HEIGHT = 36;
const AXIS_HEIGHT = 32;

const CHART_CONFIG = {
  amount: { label: 'Amount', color: 'hsl(var(--primary))' },
  count: { label: 'Transactions', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const countFormatter = new Intl.NumberFormat('en-US');
// Axis ticks only: the exact amounts are in the tooltip and the table.
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface CategoryReportChartProps {
  rows: readonly ReportRow[];
  metric: ReportMetric;
  currency: Currency;
}

/** One horizontal bar per category; the table below carries the same data. */
export function CategoryReportChart({
  rows,
  metric,
  currency,
}: CategoryReportChartProps) {
  return (
    <ChartContainer
      config={CHART_CONFIG}
      // Grows with the categories, so bars keep their thickness.
      style={{ height: rows.length * ROW_HEIGHT + AXIS_HEIGHT }}
      className="aspect-auto w-full"
      aria-hidden="true"
    >
      <BarChart
        data={[...rows]}
        layout="vertical"
        margin={{ left: 8, right: 16 }}
        barSize={BAR_SIZE}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          dataKey={metric}
          allowDecimals={metric === 'amount'}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => compactFormatter.format(value)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) =>
            value.length > 16 ? `${value.slice(0, 15)}…` : value
          }
        />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as ReportRow | undefined;
            if (!active || !row) return null;
            return (
              <div className="grid min-w-[10rem] gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="font-medium">{row.name}</p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(row.total, currency)}
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-mono tabular-nums">
                    {countFormatter.format(row.count)}
                  </span>
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey={metric}
          fill={`var(--color-${metric})`}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
