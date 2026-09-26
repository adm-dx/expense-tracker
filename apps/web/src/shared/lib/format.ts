import type { Currency, TransactionType } from '@expense-tracker/types';

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Transaction dates are stored as UTC midnight, so they are read back in UTC
// to show the same calendar day regardless of the viewer's timezone.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

// The code goes after the number: `€`, `Ft` and `дин.` would look uneven
// side by side, and a leading sign reads better next to digits.
/** Signed by transaction type, e.g. `+12.50 EUR`, `−1,200.00 RSD`. */
export function formatAmount(
  amount: string,
  type: TransactionType,
  currency: Currency
): string {
  const sign = type === 'INCOME' ? '+' : '−';
  return `${sign}${amountFormatter.format(Number(amount))} ${currency}`;
}

/** Plain amount with its currency, signed only when negative (balances). */
export function formatMoney(amount: string, currency: Currency): string {
  return `${amountFormatter.format(Number(amount))} ${currency}`;
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** `2026-09-16` → `2026-09-16T00:00:00.000Z` */
export function toIsoDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/** `2026-09-16` → `2026-09-16T23:59:59.999Z`, the inclusive end of that day. */
export function toIsoEndOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/** ISO timestamp → `YYYY-MM-DD` (UTC), the value format of `<input type="date">`. */
export function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function todayDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Up to two initials for an avatar, e.g. "Ada Lovelace" → "AL". */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
