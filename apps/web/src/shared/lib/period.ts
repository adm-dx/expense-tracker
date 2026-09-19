import { formatDate, todayDateInputValue } from './format';

/** Both bounds inclusive, in `YYYY-MM-DD` (the `<input type="date">` format). */
export interface Period {
  dateFrom: string;
  dateTo: string;
}

export const PERIOD_PRESETS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'this-year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value'];

export const DEFAULT_PERIOD_PRESET: PeriodPreset = 'this-month';

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses `YYYY-MM-DD` as a UTC date, so arithmetic never shifts the day. */
function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  const date = parseDateInput(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInput(date);
}

export function getPresetPeriod(preset: PeriodPreset): Period {
  const today = todayDateInputValue();
  const date = parseDateInput(today);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  switch (preset) {
    case 'last-month':
      return {
        dateFrom: toDateInput(new Date(Date.UTC(year, month - 1, 1))),
        dateTo: toDateInput(new Date(Date.UTC(year, month, 0))),
      };
    case 'last-30-days':
      return { dateFrom: addDays(today, -29), dateTo: today };
    case 'this-year':
      return {
        dateFrom: toDateInput(new Date(Date.UTC(year, 0, 1))),
        dateTo: toDateInput(new Date(Date.UTC(year, 11, 31))),
      };
    case 'this-month':
    case 'custom':
    default:
      return {
        dateFrom: toDateInput(new Date(Date.UTC(year, month, 1))),
        dateTo: toDateInput(new Date(Date.UTC(year, month + 1, 0))),
      };
  }
}

export const DEFAULT_PERIOD: Period = getPresetPeriod(DEFAULT_PERIOD_PRESET);

/** "Sep 1 – Sep 30, 2026" */
export function formatPeriod(period: Period): string {
  const from = formatDate(`${period.dateFrom}T00:00:00.000Z`);
  const to = formatDate(`${period.dateTo}T00:00:00.000Z`);
  return from === to ? from : `${from} – ${to}`;
}
