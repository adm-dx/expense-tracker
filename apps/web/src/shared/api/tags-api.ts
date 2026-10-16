import type {
  CreateTagRequest,
  Tag,
  UpdateTagRequest,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const tagsApi = {
  list: () => httpClient.get<Tag[]>('/tags'),
  create: (body: CreateTagRequest) => httpClient.post<Tag>('/tags', body),
  update: (id: string, body: UpdateTagRequest) =>
    httpClient.patch<Tag>(`/tags/${id}`, body),
  remove: (id: string) => httpClient.delete<void>(`/tags/${id}`),
};
