import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@api/app.module';
import { configureApp } from '@api/app.config';
import { assertTestDatabase } from './env';

/**
 * Boots the real application (guards, pipes, controllers, repositories) with
 * the same global configuration as `main.ts`.
 */
export async function createTestApp(): Promise<INestApplication> {
  // Last line of defence: the app's own Prisma client reads DATABASE_URL.
  assertTestDatabase(process.env.DATABASE_URL ?? '');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  // Listen once on a fixed ephemeral port. Otherwise supertest would bind a
  // new port for every request, and a request can then hit whatever else
  // happens to be listening on a recycled port.
  await app.listen(0, '127.0.0.1');
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export const DEFAULT_PASSWORD = 'password123';

let counter = 0;

/** Registers a fresh user through the public API. */
export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
): Promise<TestUser> {
  counter += 1;
  const body = {
    name: overrides.name ?? `Test User ${counter}`,
    email: overrides.email ?? `user${counter}-${Date.now()}@example.com`,
    password: overrides.password ?? DEFAULT_PASSWORD,
  };
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send(body)
    .expect(201);

  return {
    id: response.body.user.id,
    email: body.email,
    name: body.name,
    password: body.password,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

export function bearer(user: Pick<TestUser, 'accessToken'>): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}

export { request };
