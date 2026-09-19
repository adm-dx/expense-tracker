import type {
  CreateTransactionRequest,
  ListTransactionsParams,
  PaginatedResponse,
  SummaryParams,
  Transaction,
  TransactionSummary,
  UpdateTransactionRequest,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const transactionsApi = {
  list: (params: ListTransactionsParams = {}) =>
    httpClient.get<PaginatedResponse<Transaction>>('/transactions', {
      params: { ...params },
    }),
  summary: (params: SummaryParams = {}) =>
    httpClient.get<TransactionSummary>('/transactions/summary', {
      params: { ...params },
    }),
  create: (body: CreateTransactionRequest) =>
    httpClient.post<Transaction>('/transactions', body),
  update: (id: string, body: UpdateTransactionRequest) =>
    httpClient.patch<Transaction>(`/transactions/${id}`, body),
  remove: (id: string) => httpClient.delete<void>(`/transactions/${id}`),
};
