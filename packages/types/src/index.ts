// Dates are ISO 8601 strings: this is the JSON wire format of the API.
export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// lucide icon names (kebab-case), grouped by meaning. The API accepts only these,
// and the web maps each one to its lucide component.
export const CATEGORY_ICONS = [
  // Food
  'utensils',
  'coffee',
  'pizza',
  'shopping-cart',
  'apple',
  // Transport
  'car',
  'bus',
  'train-front',
  'fuel',
  'plane',
  // Home and bills
  'house',
  'lightbulb',
  'wifi',
  'smartphone',
  'receipt',
  // Health
  'heart-pulse',
  'pill',
  'stethoscope',
  // Leisure
  'clapperboard',
  'gamepad-2',
  'music',
  'tv',
  // Shopping
  'shopping-bag',
  'shirt',
  'gift',
  'scissors',
  // Money
  'banknote',
  'wallet',
  'piggy-bank',
  'credit-card',
  'trending-up',
  'hand-coins',
  'landmark',
  'briefcase',
  // Other
  'graduation-cap',
  'book-open',
  'baby',
  'paw-print',
  'dumbbell',
  'wrench',
  'circle-ellipsis',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: CategoryIcon;
  /** How many transactions use this category. */
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  icon: CategoryIcon;
  /** Assigned by the server when omitted. */
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: CategoryIcon;
}

export interface DeleteCategoryOptions {
  /** Move the category's transactions here before deleting it. */
  reassignTo?: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export const CURRENCIES = ['RSD', 'EUR', 'HUF'] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'RSD';

export interface Transaction {
  id: string;
  /** Decimal serialized as a string with two fraction digits, e.g. "12.50" */
  amount: string;
  /** The currency `amount` was entered in. */
  currency: Currency;
  type: TransactionType;
  description: string | null;
  date: string;
  categoryId: string;
  createdAt: string;
}

export interface TransactionListItem extends Transaction {
  /** `amount` converted to the requested display currency, two fraction digits. */
  convertedAmount: string;
}

export interface TransactionsPage extends PaginatedResponse<TransactionListItem> {
  /** The currency of every `convertedAmount`. */
  currency: Currency;
  /** Date of the exchange rates used; null when no conversion was needed. */
  ratesDate: string | null;
}

export interface CreateTransactionRequest {
  amount: number;
  currency: Currency;
  type: TransactionType;
  description?: string;
  /** ISO 8601 date string */
  date: string;
  categoryId: string;
}

export interface UpdateTransactionRequest {
  amount?: number;
  currency?: Currency;
  type?: TransactionType;
  description?: string | null;
  date?: string;
  categoryId?: string;
}

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType;
  categoryId?: string;
}

export const TRANSACTION_PAGE_SIZES = [10, 20, 50] as const;

export type TransactionPageSize = (typeof TRANSACTION_PAGE_SIZES)[number];

export interface ListTransactionsParams extends TransactionFilters {
  page?: number;
  pageSize?: TransactionPageSize;
  /** Display currency for `convertedAmount`; defaults to RSD. */
  currency?: Currency;
}

export interface TransactionCategorySummary {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  type: TransactionType;
  total: string;
}

export interface SummaryParams {
  /** Whole UTC month; must be paired with `year` and not mixed with the range. */
  month?: number;
  year?: number;
  /** ISO 8601; both bounds are inclusive. */
  dateFrom?: string;
  dateTo?: string;
  /** Currency of the totals; defaults to RSD. */
  currency?: Currency;
}

export interface TransactionSummary {
  /** The period that was actually applied, both bounds inclusive. */
  dateFrom: string;
  dateTo: string;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  byCategory: TransactionCategorySummary[];
  /** The currency of every total. */
  currency: Currency;
  /** Date of the exchange rates used; null when no conversion was needed. */
  ratesDate: string | null;
}

/** Today's rates: one `base` unit costs `rates[code]` of each currency. */
export interface ExchangeRates {
  base: Currency;
  date: string;
  rates: Record<Currency, string>;
}

/** Coordinates for `GET /weather`, in decimal degrees. */
export interface WeatherParams {
  lat: number;
  lon: number;
}

/** Weather at the requested place right now. */
export interface CurrentWeather {
  /** Air temperature 2 m above ground, °C. */
  temperature: number;
  /** WMO weather interpretation code (0 clear sky … 99 thunderstorm with hail). */
  weatherCode: number;
  isDay: boolean;
  /** "Belgrade, RS"; null when the place could not be named. */
  location: string | null;
  /** When the provider measured it. */
  observedAt: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface JwtPayload {
  sub: string;
  email: string;
}
