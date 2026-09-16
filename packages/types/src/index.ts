export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
  icon: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  /** Decimal serialized as a string with two fraction digits, e.g. "12.50" */
  amount: string;
  type: TransactionType;
  description: string | null;
  date: Date;
  categoryId: string;
  createdAt: Date;
}

export interface CreateTransactionRequest {
  amount: number;
  type: TransactionType;
  description?: string;
  /** ISO 8601 date string */
  date: string;
  categoryId: string;
}

export interface UpdateTransactionRequest {
  amount?: number;
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
