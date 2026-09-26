import { Currency, TransactionType } from '../../generated/prisma/client';

export interface PublicTransaction {
  id: string;
  amount: string;
  currency: Currency;
  type: TransactionType;
  description: string | null;
  date: Date;
  categoryId: string;
  createdAt: Date;
}

export interface PublicTransactionListItem extends PublicTransaction {
  /** `amount` in the requested display currency, two fraction digits. */
  convertedAmount: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionsPage extends PaginatedResponse<PublicTransactionListItem> {
  currency: Currency;
  /** Date of the rates used; null when no conversion was needed. */
  ratesDate: Date | null;
}

export interface TransactionCategorySummary {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  type: TransactionType;
  total: string;
}

export interface TransactionSummary {
  /** Start of the period that was applied, inclusive. */
  dateFrom: Date;
  /** End of the period that was applied, inclusive. */
  dateTo: Date;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  byCategory: TransactionCategorySummary[];
  currency: Currency;
  /** Date of the rates used; null when no conversion was needed. */
  ratesDate: Date | null;
}
