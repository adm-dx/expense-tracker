import type { Test } from 'supertest';

/**
 * Awaits a supertest request, asserts the status and returns the body typed
 * as `T`. Response bodies are `any` otherwise, so a typo in a field name
 * would compile and the test would silently assert `undefined`.
 */
export async function expectJson<T>(test: Test, status = 200): Promise<T> {
  const response = await test.expect(status);
  return response.body as T;
}

/** Awaits a request and asserts only its status (for 204s and failures). */
export async function expectStatus(test: Test, status: number): Promise<void> {
  await test.expect(status);
}
