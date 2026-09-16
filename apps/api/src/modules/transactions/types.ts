import { TransactionType } from '@prisma/client';

export interface PublicTransaction {
  id: string;
  amount: string;
  type: TransactionType;
  description: string | null;
  date: Date;
  categoryId: string;
  createdAt: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
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
  month: number;
  year: number;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  byCategory: TransactionCategorySummary[];
}
