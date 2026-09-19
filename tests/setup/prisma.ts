import { PrismaClient } from '@prisma/client';
import { assertTestDatabase, TEST_DATABASE_URL } from './env';

assertTestDatabase(TEST_DATABASE_URL);

export const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

/** Empties every table so each test starts from a blank database. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "transactions", "categories", "refresh_tokens", "users" RESTART IDENTITY CASCADE'
  );
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * A successful login updates `lastLoginAt` from an event handler, after the
 * response has been sent. Waiting for it keeps the update from landing after
 * the next test has already emptied the tables.
 */
export async function waitForLastLogin(
  userId: string,
  timeoutMs = 2000
): Promise<Date> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });
    if (user?.lastLoginAt) return user.lastLoginAt;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `lastLoginAt was not set for ${userId} within ${timeoutMs}ms`
  );
}
