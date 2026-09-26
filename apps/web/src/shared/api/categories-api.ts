import type {
  Category,
  CreateCategoryRequest,
  DeleteCategoryOptions,
  UpdateCategoryRequest,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const categoriesApi = {
  list: () => httpClient.get<Category[]>('/categories'),
  create: (body: CreateCategoryRequest) =>
    httpClient.post<Category>('/categories', body),
  update: (id: string, body: UpdateCategoryRequest) =>
    httpClient.patch<Category>(`/categories/${id}`, body),
  remove: (id: string, options: DeleteCategoryOptions = {}) =>
    httpClient.delete<void>(`/categories/${id}`, {
      params: { reassignTo: options.reassignTo },
    }),
};
