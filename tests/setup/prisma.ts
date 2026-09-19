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
