import { Prisma, TransactionType } from '@api/generated/prisma/client';
import { prisma } from './prisma';

let counter = 0;

export async function seedUser(email?: string) {
  counter += 1;
  return prisma.user.create({
    data: {
      email: email ?? `seed${counter}-${Date.now()}@example.com`,
      name: `Seed User ${counter}`,
      passwordHash: 'not-a-real-hash',
    },
  });
}

export function seedCategory(userId: string, name = 'Groceries') {
  return prisma.category.create({
    data: { userId, name, color: '#22C55E', icon: 'shopping-cart' },
  });
}

export function seedTransaction(input: {
  userId: string;
  categoryId: string;
  amount?: string;
  type?: TransactionType;
  date?: string;
  createdAt?: string;
  description?: string;
}) {
  return prisma.transaction.create({
    data: {
      userId: input.userId,
      categoryId: input.categoryId,
      amount: new Prisma.Decimal(input.amount ?? '10.00'),
      type: input.type ?? TransactionType.EXPENSE,
      date: new Date(input.date ?? '2026-09-10T00:00:00.000Z'),
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
      ...(input.description ? { description: input.description } : {}),
    },
  });
}
