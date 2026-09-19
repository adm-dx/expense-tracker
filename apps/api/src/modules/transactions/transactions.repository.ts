import { Injectable } from '@nestjs/common';
import { Category, Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  type?: TransactionType;
  categoryId?: string;
}

export interface TransactionPagination {
  skip: number;
  take: number;
}

export interface TransactionSumRow {
  type: TransactionType;
  categoryId: string;
  amount: Prisma.Decimal;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUser(
    userId: string,
    filters: TransactionFilters,
    pagination: TransactionPagination
  ): Promise<{ items: Transaction[]; total: number }> {
    const where = this.buildWhere(userId, filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, total };
  }

  findByIdForUser(id: string, userId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where: { id, userId } });
  }

  findCategoryForUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  findCategoriesByIds(ids: string[]): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { id: { in: ids } } });
  }

  create(data: Prisma.TransactionUncheckedCreateInput): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  update(
    id: string,
    data: Prisma.TransactionUncheckedUpdateInput
  ): Promise<Transaction> {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id } });
  }

  async sumByTypeAndCategory(
    userId: string,
    filters: TransactionFilters
  ): Promise<TransactionSumRow[]> {
    // Same `where` as the list, so totals always match the rows on screen.
    const groups = await this.prisma.transaction.groupBy({
      by: ['type', 'categoryId'],
      where: this.buildWhere(userId, filters),
      _sum: { amount: true },
    });
    return groups.map((group) => ({
      type: group.type,
      categoryId: group.categoryId,
      amount: group._sum.amount ?? new Prisma.Decimal(0),
    }));
  }

  private buildWhere(
    userId: string,
    filters: TransactionFilters
  ): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.type) where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.dateFrom || filters.dateTo) {
      const date: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) date.gte = filters.dateFrom;
      if (filters.dateTo) date.lte = filters.dateTo;
      where.date = date;
    }
    return where;
  }
}
