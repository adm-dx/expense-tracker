import type {
  TransactionCategorySummary,
  TransactionType,
} from '@expense-tracker/types';

export type ReportMetric = 'amount' | 'count';

/** One category of the report for one type. */
export interface ReportItem {
  key: string;
  name: string;
  icon: string;
  type: TransactionType;
  total: string;
  count: number;
}

export interface ReportRow {
  key: string;
  name: string;
  icon: string;
  /** Converted total, as a number for the chart; `total` keeps the exact string. */
  amount: number;
  total: string;
  count: number;
  /** Share of the type's total amount, 0–100. */
  share: number;
}

export interface ReportTotals {
  amount: number;
  count: number;
}

export function categoryReportItems(
  byCategory: readonly TransactionCategorySummary[]
): ReportItem[] {
  return byCategory.map((item) => ({
    key: item.categoryId,
    name: item.name,
    icon: item.icon,
    type: item.type,
    total: item.total,
    count: item.count,
  }));
}

/**
 * The categories of one type, largest first by `metric` (ties by name, so the
 * order is stable), each with its share of the type's total amount.
 */
export function buildReportRows(
  items: readonly ReportItem[],
  type: TransactionType,
  metric: ReportMetric
): { rows: ReportRow[]; totals: ReportTotals } {
  const ofType = items.filter((item) => item.type === type);
  // Summed in cents: floats would drift over many groups.
  const totalCents = ofType.reduce(
    (sum, item) => sum + Math.round(Number(item.total) * 100),
    0
  );
  const totals: ReportTotals = {
    amount: totalCents / 100,
    count: ofType.reduce((sum, item) => sum + item.count, 0),
  };

  const rows = ofType
    .map((item): ReportRow => {
      const amount = Number(item.total);
      return {
        key: item.key,
        name: item.name,
        icon: item.icon,
        amount,
        total: item.total,
        count: item.count,
        share: totalCents === 0 ? 0 : (amount * 10000) / totalCents,
      };
    })
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name));

  return { rows, totals };
}
