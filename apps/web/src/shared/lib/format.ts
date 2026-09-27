import {
  CURRENCY_DETAILS,
  type Currency,
  type TransactionType,
} from '@expense-tracker/types';

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

/** The code with its symbol, e.g. `EUR (€)`, `RSD (дин.)`. */
export function formatCurrency(currency: Currency): string {
  return `${currency} (${CURRENCY_DETAILS[currency].symbol})`;
}

// The currency goes after the number: `€`, `Ft` and `дин.` alone would look
// uneven side by side, and a leading sign reads better next to digits.
/** Signed by transaction type, e.g. `+12.50 EUR (€)`, `−1,200.00 RSD (дин.)`. */
export function formatAmount(
  amount: string,
  type: TransactionType,
  currency: Currency
): string {
  const sign = type === 'INCOME' ? '+' : '−';
  return `${sign}${amountFormatter.format(Number(amount))} ${formatCurrency(currency)}`;
}

/** Plain amount with its currency, signed only when negative (balances). */
export function formatMoney(amount: string, currency: Currency): string {
  return `${amountFormatter.format(Number(amount))} ${formatCurrency(currency)}`;
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

// In the viewer's timezone, unlike `formatDate`: this is a moment, not a day.
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/** ISO timestamp → local time of day, e.g. `2:05 PM`. */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** Whole degrees Celsius, e.g. `18°C`, `−3°C`; never `-0°C`. */
export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  // `-0.3` rounds to -0, which prints as "0" and is not below zero.
  return rounded < 0 ? `−${-rounded}°C` : `${rounded}°C`;
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
