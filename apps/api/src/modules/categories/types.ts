import type { Category } from '../../generated/prisma/client';

export type CategoryWithCount = Category & {
  _count: { transactions: number };
};

export interface PublicCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}
