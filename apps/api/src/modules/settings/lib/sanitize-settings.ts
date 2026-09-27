import {
  COLOR_SCHEMES,
  CURRENCIES,
  DEFAULT_CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_USER_SETTINGS,
  THEMES,
  type Currency,
  type LocationSetting,
  type UserSettings,
} from '@expense-tracker/types';

/** Two decimals ≈ 1.1 km: a town, not a street address. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (values as readonly unknown[]).includes(value);
}

function isWithin(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLocation(value: unknown): LocationSetting | undefined {
  if (!isRecord(value)) return undefined;
  if (value.mode === 'auto') return { mode: 'auto' };
  if (
    value.mode === 'manual' &&
    typeof value.name === 'string' &&
    value.name.trim() !== '' &&
    isWithin(value.lat, 90) &&
    isWithin(value.lon, 180)
  ) {
    return {
      mode: 'manual',
      name: value.name.trim(),
      lat: roundCoordinate(value.lat),
      lon: roundCoordinate(value.lon),
    };
  }
  return undefined;
}

/**
 * Reads a stored settings document key by key. Anything missing, unknown or
 * no longer valid (a removed color scheme, a hand-edited row) falls back to
 * its default, so an old document never breaks the response.
 */
/**
 * Known codes in their stored order, without repeats, always with RSD (first
 * if it had to be added back). Not an array at all: the default list.
 */
function readCurrencies(value: unknown): Currency[] {
  if (!Array.isArray(value)) return [...DEFAULT_CURRENCIES];
  const currencies = [
    ...new Set(value.filter((code) => isOneOf(CURRENCIES, code))),
  ];
  return currencies.includes(DEFAULT_CURRENCY)
    ? currencies
    : [DEFAULT_CURRENCY, ...currencies];
}

export function sanitizeSettings(stored: unknown): UserSettings {
  const source = isRecord(stored) ? stored : {};
  const defaults = DEFAULT_USER_SETTINGS;
  const currencies = readCurrencies(source.currencies);
  return {
    theme: isOneOf(THEMES, source.theme) ? source.theme : defaults.theme,
    colorScheme: isOneOf(COLOR_SCHEMES, source.colorScheme)
      ? source.colorScheme
      : defaults.colorScheme,
    // Only an enabled currency can be the display one.
    currency: isOneOf(currencies, source.currency)
      ? source.currency
      : defaults.currency,
    currencies,
    location: readLocation(source.location) ?? { ...defaults.location },
  };
}
