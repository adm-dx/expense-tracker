import type { Currency } from '@expense-tracker/types';
import { Injectable } from '@nestjs/common';
import {
  Category,
  Prisma,
  Transaction,
  TransactionType,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  type?: TransactionType;
  categoryId?: string;
  tagId?: string;
}

export interface TransactionPagination {
  skip: number;
  take: number;
}

export interface TransactionTagSumRow {
  type: TransactionType;
  /** `null` for the transactions without a tag. */
  tagId: string | null;
  currency: Currency;
  amount: Prisma.Decimal;
  count: number;
}

export interface TransactionMonthSumRow {
  /** `YYYY-MM`, a UTC month. */
  month: string;
  type: TransactionType;
  currency: Currency;
  amount: Prisma.Decimal;
  count: number;
}

export interface TransactionSumRow {
  type: TransactionType;
  categoryId: string;
  currency: Currency;
  amount: Prisma.Decimal;
  count: number;
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
      by: ['type', 'categoryId', 'currency'],
      where: this.buildWhere(userId, filters),
      _sum: { amount: true },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      type: group.type,
      categoryId: group.categoryId,
      // The column is TEXT, but only validated codes are ever written to it.
      currency: group.currency as Currency,
      amount: group._sum.amount ?? new Prisma.Decimal(0),
      count: group._count._all,
    }));
  }

  /**
   * Sums per (type, tag, currency). A transaction counts once under each of
   * its tags (it has at most one today), and under `null` without any.
   */
  async sumByTypeAndTag(
    userId: string,
    filters: Pick<TransactionFilters, 'dateFrom' | 'dateTo'>
  ): Promise<TransactionTagSumRow[]> {
    const conditions = [Prisma.sql`t."userId" = ${userId}`];
    if (filters.dateFrom) {
      conditions.push(Prisma.sql`t."date" >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(Prisma.sql`t."date" <= ${filters.dateTo}`);
    }
    const rows = await this.prisma.$queryRaw<
      {
        type: TransactionType;
        tagId: string | null;
        currency: string;
        amount: Prisma.Decimal;
        count: number;
      }[]
    >`
      SELECT t."type", tag."tagId", t."currency",
             SUM(t."amount") AS "amount", COUNT(*)::int AS "count"
      FROM "transactions" t
      LEFT JOIN LATERAL jsonb_array_elements_text(t."tagIds") AS tag("tagId") ON TRUE
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY t."type", tag."tagId", t."currency"
    `;
    return rows.map((row) => ({
      type: row.type,
      tagId: row.tagId,
      // The column is TEXT, but only validated codes are ever written to it.
      currency: row.currency as Currency,
      amount: new Prisma.Decimal(row.amount),
      count: row.count,
    }));
  }

  /**
   * Sums per (UTC month, type, currency) of the user's transactions that
   * carry the tag, whenever they were.
   */
  async sumByMonthForTag(
    userId: string,
    tagId: string
  ): Promise<TransactionMonthSumRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        type: TransactionType;
        currency: string;
        amount: Prisma.Decimal;
        count: number;
      }[]
    >`
      SELECT to_char(t."date", 'YYYY-MM') AS "month", t."type", t."currency",
             SUM(t."amount") AS "amount", COUNT(*)::int AS "count"
      FROM "transactions" t
      WHERE t."userId" = ${userId}
        AND t."tagIds" @> ${JSON.stringify([tagId])}::jsonb
      GROUP BY 1, t."type", t."currency"
    `;
    return rows.map((row) => ({
      month: row.month,
      type: row.type,
      // The column is TEXT, but only validated codes are ever written to it.
      currency: row.currency as Currency,
      amount: new Prisma.Decimal(row.amount),
      count: row.count,
    }));
  }

  /** How many of the user's transactions carry each tag. */
  async countByTag(userId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<
      { tagId: string; count: number }[]
    >`
      SELECT tag."tagId", COUNT(*)::int AS "count"
      FROM "transactions" t, jsonb_array_elements_text(t."tagIds") AS tag("tagId")
      WHERE t."userId" = ${userId}
      GROUP BY tag."tagId"
    `;
    return Object.fromEntries(rows.map((row) => [row.tagId, row.count]));
  }

  /** Strips the tag from the user's transactions; returns how many changed. */
  async removeTag(userId: string, tagId: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "transactions"
      SET "tagIds" = "tagIds" - ${tagId}::text
      WHERE "userId" = ${userId}
        AND "tagIds" @> ${JSON.stringify([tagId])}::jsonb
    `;
  }

  async countByCurrency(userId: string, currency: Currency): Promise<number> {
    return this.prisma.transaction.count({ where: { userId, currency } });
  }

  /**
   * Moves every transaction of the user from one currency to another in one
   * statement, with the same formula as `convertAmount`, rounded to cents.
   * Returns how many rows changed.
   */
  async convertCurrency(
    userId: string,
    from: Currency,
    to: Currency,
    fromRate: Prisma.Decimal,
    toRate: Prisma.Decimal
  ): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "transactions"
      SET "amount" = ROUND("amount" * ${toRate.toString()}::numeric / ${fromRate.toString()}::numeric, 2),
          "currency" = ${to}
      WHERE "userId" = ${userId} AND "currency" = ${from}
    `;
  }

  private buildWhere(
    userId: string,
    filters: TransactionFilters
  ): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.type) where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.tagId) where.tagIds = { array_contains: [filters.tagId] };
    if (filters.dateFrom || filters.dateTo) {
      const date: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) date.gte = filters.dateFrom;
      if (filters.dateTo) date.lte = filters.dateTo;
      where.date = date;
    }
    return where;
  }
}
