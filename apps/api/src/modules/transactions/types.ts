import type { Currency } from '@expense-tracker/types';
import { TransactionType } from '../../generated/prisma/client';

export interface PublicTransaction {
  id: string;
  amount: string;
  currency: Currency;
  type: TransactionType;
  description: string | null;
  date: Date;
  categoryId: string;
  tagIds: string[];
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
  /** How many transactions make up `total`. */
  count: number;
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

export interface TransactionTagSummary {
  /** `null` for the transactions without a tag. */
  tagId: string | null;
  name: string | null;
  type: TransactionType;
  total: string;
  /** How many transactions make up `total`. */
  count: number;
}

export interface TransactionTagReport {
  /** Start of the period that was applied, inclusive. */
  dateFrom: Date;
  /** End of the period that was applied, inclusive. */
  dateTo: Date;
  byTag: TransactionTagSummary[];
  currency: Currency;
  /** Date of the rates used; null when no conversion was needed. */
  ratesDate: Date | null;
}

export interface TagMonthSummary {
  /** `YYYY-MM`, a UTC month. */
  month: string;
  income: string;
  expense: string;
  incomeCount: number;
  expenseCount: number;
}

export interface TagHistoryReport {
  tagId: string;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  /** From the first month with a transaction to the last, gaps as zeros. */
  byMonth: TagMonthSummary[];
  currency: Currency;
  /** Date of the rates used; null when no conversion was needed. */
  ratesDate: Date | null;
}
