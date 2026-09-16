import type { Category } from '@expense-tracker/types';
import { httpClient } from './http-client';

export const categoriesApi = {
  list: () => httpClient.get<Category[]>('/categories'),
};
