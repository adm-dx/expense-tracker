import { PrismaClient } from '@prisma/client';
import { assertTestDatabase, TEST_DATABASE_URL } from './env';

assertTestDatabase(TEST_DATABASE_URL);

export const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

/**
 * Empties every table so each test starts from a blank database. The list is
 * read from the database rather than hard-coded, so a new model can't quietly
 * leak rows from one test into the next.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const quoted = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );
}

/** Clears transactions only, for suites that keep one user for the whole file. */
export async function clearTransactions(): Promise<void> {
  await prisma.transaction.deleteMany();
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
