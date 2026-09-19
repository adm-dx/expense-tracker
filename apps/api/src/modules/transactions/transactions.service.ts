import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';
import {
  PaginatedResponse,
  PublicTransaction,
  TransactionCategorySummary,
  TransactionSummary,
} from './types';
import {
  TransactionFilters,
  TransactionsRepository,
} from './transactions.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  DEFAULT_TRANSACTION_PAGE_SIZE,
  ListTransactionsQuery,
} from './dto/list-transactions.query';
import { SummaryQuery } from './dto/summary.query';

const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository
  ) {}

  async list(
    userId: string,
    query: ListTransactionsQuery
  ): Promise<PaginatedResponse<PublicTransaction>> {
    const filters: TransactionFilters = {};
    if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
    if (query.dateTo) filters.dateTo = new Date(query.dateTo);
    if (query.type) filters.type = query.type;
    if (query.categoryId) filters.categoryId = query.categoryId;

    this.assertRangeOrder(filters.dateFrom, filters.dateTo);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_TRANSACTION_PAGE_SIZE;
    const { items, total } = await this.transactionsRepository.findManyByUser(
      userId,
      filters,
      { skip: (page - 1) * pageSize, take: pageSize }
    );
    return {
      items: items.map((transaction) => this.toPublic(transaction)),
      total,
      page,
      pageSize,
    };
  }

  async get(userId: string, id: string): Promise<PublicTransaction> {
    return this.toPublic(await this.findOwned(userId, id));
  }

  async create(
    userId: string,
    dto: CreateTransactionDto
  ): Promise<PublicTransaction> {
    await this.assertCategoryOwned(userId, dto.categoryId);

    return this.withCategoryHandling(async () => {
      const transaction = await this.transactionsRepository.create({
        userId,
        amount: this.toDecimal(dto.amount),
        type: dto.type,
        description: this.normalizeDescription(dto.description),
        date: new Date(dto.date),
        categoryId: dto.categoryId,
      });
      return this.toPublic(transaction);
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto
  ): Promise<PublicTransaction> {
    await this.findOwned(userId, id);
    if (dto.categoryId !== undefined) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    const data: Prisma.TransactionUncheckedUpdateInput = {};
    if (dto.amount !== undefined) data.amount = this.toDecimal(dto.amount);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) {
      data.description = this.normalizeDescription(dto.description);
    }
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;

    return this.withCategoryHandling(async () => {
      const transaction = await this.transactionsRepository.update(id, data);
      return this.toPublic(transaction);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.transactionsRepository.delete(id);
  }

  async summary(
    userId: string,
    query: SummaryQuery
  ): Promise<TransactionSummary> {
    const { dateFrom, dateTo } = this.resolveSummaryPeriod(query);

    const rows = await this.transactionsRepository.sumByTypeAndCategory(
      userId,
      { dateFrom, dateTo }
    );
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const categories = categoryIds.length
      ? await this.transactionsRepository.findCategoriesByIds(categoryIds)
      : [];
    const categoriesById = new Map(categories.map((c) => [c.id, c]));

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    for (const row of rows) {
      if (row.type === TransactionType.INCOME) {
        totalIncome = totalIncome.plus(row.amount);
      } else {
        totalExpense = totalExpense.plus(row.amount);
      }
    }

    const byCategory = [...rows]
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((row): TransactionCategorySummary => {
        const category = categoriesById.get(row.categoryId);
        return {
          categoryId: row.categoryId,
          name: category?.name ?? '',
          color: category?.color ?? '',
          icon: category?.icon ?? '',
          type: row.type,
          total: row.amount.toFixed(2),
        };
      });

    return {
      dateFrom,
      dateTo,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: totalIncome.minus(totalExpense).toFixed(2),
      byCategory,
    };
  }

  toPublic(transaction: Transaction): PublicTransaction {
    return {
      id: transaction.id,
      amount: transaction.amount.toFixed(2),
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      categoryId: transaction.categoryId,
      createdAt: transaction.createdAt,
    };
  }

  private async findOwned(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findByIdForUser(
      id,
      userId
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  private async assertCategoryOwned(
    userId: string,
    categoryId: string
  ): Promise<void> {
    const category = await this.transactionsRepository.findCategoryForUser(
      categoryId,
      userId
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  // Either month+year or dateFrom/dateTo; defaults to the current UTC month.
  private resolveSummaryPeriod(query: SummaryQuery): {
    dateFrom: Date;
    dateTo: Date;
  } {
    const hasMonthOrYear = query.month !== undefined || query.year !== undefined;
    const hasRange = query.dateFrom !== undefined || query.dateTo !== undefined;

    if (hasMonthOrYear && hasRange) {
      throw new BadRequestException(
        'Use either month and year or dateFrom and dateTo, not both'
      );
    }

    if (hasMonthOrYear) {
      if (query.month === undefined || query.year === undefined) {
        throw new BadRequestException('month and year must be used together');
      }
      return this.monthRange(query.year, query.month);
    }

    if (!hasRange) {
      const now = new Date();
      return this.monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
    }

    if (query.dateFrom === undefined || query.dateTo === undefined) {
      throw new BadRequestException(
        'dateFrom and dateTo must be used together'
      );
    }
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);
    this.assertRangeOrder(dateFrom, dateTo);
    return { dateFrom, dateTo };
  }

  /** Whole UTC month with both bounds inclusive. */
  private monthRange(year: number, month: number): {
    dateFrom: Date;
    dateTo: Date;
  } {
    return {
      dateFrom: new Date(Date.UTC(year, month - 1, 1)),
      dateTo: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
    };
  }

  private assertRangeOrder(dateFrom?: Date, dateTo?: Date): void {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must not be after dateTo');
    }
  }

  private toDecimal(amount: number): Prisma.Decimal {
    return new Prisma.Decimal(amount.toFixed(2));
  }

  private normalizeDescription(
    description: string | null | undefined
  ): string | null {
    const trimmed = description?.trim();
    return trimmed ? trimmed : null;
  }

  // The category can be deleted between the ownership check and the write.
  private async withCategoryHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new NotFoundException('Category not found');
      }
      throw error;
    }
  }
}
