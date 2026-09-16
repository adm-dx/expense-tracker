import { ApiError } from '../api/http-client';

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages[0] ?? 'Something went wrong';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong';
}
