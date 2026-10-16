import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  DEFAULT_CURRENCY,
  type Currency,
  type UserSettings,
} from '@expense-tracker/types';
import {
  Prisma,
  Transaction,
  TransactionType,
} from '../../generated/prisma/client';
import {
  convertAmount,
  ExchangeRatesSnapshot,
  GetExchangeRatesQuery,
} from '../exchange-rates/contracts';
import { GetUserSettingsQuery } from '../settings/contracts';
import { GetUserTagsQuery, type UserTag } from '../tags/contracts';
import {
  PublicTransaction,
  TagHistoryReport,
  TagMonthSummary,
  TransactionCategorySummary,
  TransactionSummary,
  TransactionTagReport,
  TransactionTagSummary,
  TransactionsPage,
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
import {
  SummaryPeriodQuery,
  SummaryQuery,
  TagHistoryQuery,
} from './dto/summary.query';

const FOREIGN_KEY_VIOLATION = 'P2003';

// The column is TEXT, but only validated codes are ever written to it.
function storedCurrency(transaction: Transaction): Currency {
  return transaction.currency as Currency;
}

// The column is JSON; anything but an array of strings reads as no tags.
function storedTagIds(transaction: Transaction): string[] {
  const value = transaction.tagIds;
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : [];
}

/** Every `YYYY-MM` from `first` to `last`, both included. */
function monthsBetween(first: string, last: string): string[] {
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];
  let [year, month] = first.split('-').map(Number) as [number, number];
  const result: string[] = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly queryBus: QueryBus
  ) {}

  async list(
    userId: string,
    query: ListTransactionsQuery
  ): Promise<TransactionsPage> {
    const filters: TransactionFilters = {};
    if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
    if (query.dateTo) filters.dateTo = new Date(query.dateTo);
    if (query.type) filters.type = query.type;
    if (query.categoryId) filters.categoryId = query.categoryId;
    if (query.tagId) filters.tagId = query.tagId;

    this.assertRangeOrder(filters.dateFrom, filters.dateTo);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_TRANSACTION_PAGE_SIZE;
    const { items, total } = await this.transactionsRepository.findManyByUser(
      userId,
      filters,
      { skip: (page - 1) * pageSize, take: pageSize }
    );
    const currency = query.currency ?? DEFAULT_CURRENCY;
    const rates = await this.loadRatesIfNeeded(
      items.map(storedCurrency),
      currency
    );
    return {
      items: items.map((transaction) => ({
        ...this.toPublic(transaction),
        convertedAmount: this.convert(
          transaction.amount,
          storedCurrency(transaction),
          currency,
          rates
        ).toFixed(2),
      })),
      total,
      page,
      pageSize,
      currency,
      ratesDate: rates?.date ?? null,
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
    await this.assertCurrencyEnabled(userId, dto.currency);
    const tagIds = dto.tagIds ?? [];
    await this.assertTagsOwned(userId, tagIds);

    return this.withCategoryHandling(async () => {
      const transaction = await this.transactionsRepository.create({
        userId,
        amount: this.toDecimal(dto.amount),
        currency: dto.currency,
        type: dto.type,
        description: this.normalizeDescription(dto.description),
        date: new Date(dto.date),
        categoryId: dto.categoryId,
        tagIds,
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
    if (dto.currency !== undefined) {
      await this.assertCurrencyEnabled(userId, dto.currency);
    }
    if (dto.tagIds !== undefined) {
      await this.assertTagsOwned(userId, dto.tagIds);
    }

    const data: Prisma.TransactionUncheckedUpdateInput = {};
    if (dto.amount !== undefined) data.amount = this.toDecimal(dto.amount);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) {
      data.description = this.normalizeDescription(dto.description);
    }
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.tagIds !== undefined) data.tagIds = dto.tagIds;

    return this.withCategoryHandling(async () => {
      const transaction = await this.transactionsRepository.update(id, data);
      return this.toPublic(transaction);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.transactionsRepository.delete(id);
  }

  /**
   * Converts the user's transactions in `from` to `to` at today's rates; see
   * `ConvertTransactionsCurrencyCommand`. Returns how many were converted.
   */
  async convertCurrency(
    userId: string,
    from: Currency,
    to: Currency
  ): Promise<number> {
    if (from === to) return 0;
    // Nothing to convert: don't fail on a rates outage for nothing.
    const count = await this.transactionsRepository.countByCurrency(
      userId,
      from
    );
    if (count === 0) return 0;

    const rates = await this.queryBus.execute<
      GetExchangeRatesQuery,
      ExchangeRatesSnapshot
    >(new GetExchangeRatesQuery());
    const fromRate = rates.rates.get(from);
    const toRate = rates.rates.get(to);
    if (!fromRate || !toRate) {
      throw new ServiceUnavailableException(
        `No exchange rate for ${fromRate ? to : from}`
      );
    }
    return this.transactionsRepository.convertCurrency(
      userId,
      from,
      to,
      fromRate,
      toRate
    );
  }

  async summary(
    userId: string,
    query: SummaryQuery
  ): Promise<TransactionSummary> {
    const { dateFrom, dateTo } = this.resolveSummaryPeriod(query);
    const currency = query.currency ?? DEFAULT_CURRENCY;

    const rows = await this.transactionsRepository.sumByTypeAndCategory(
      userId,
      { dateFrom, dateTo, ...(query.tagId ? { tagId: query.tagId } : {}) }
    );
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const categories = categoryIds.length
      ? await this.transactionsRepository.findCategoriesByIds(categoryIds)
      : [];
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const rates = await this.loadRatesIfNeeded(
      rows.map((row) => row.currency),
      currency
    );

    // Rows come per currency: convert, then merge by (type, category).
    // Rounded only at the end, so the totals don't drift.
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    const groups = new Map<
      string,
      {
        type: TransactionType;
        categoryId: string;
        amount: Prisma.Decimal;
        count: number;
      }
    >();
    for (const row of rows) {
      const amount = this.convert(row.amount, row.currency, currency, rates);
      if (row.type === TransactionType.INCOME) {
        totalIncome = totalIncome.plus(amount);
      } else {
        totalExpense = totalExpense.plus(amount);
      }
      const key = `${row.type}:${row.categoryId}`;
      const group = groups.get(key);
      if (group) {
        group.amount = group.amount.plus(amount);
        group.count += row.count;
      } else {
        groups.set(key, {
          type: row.type,
          categoryId: row.categoryId,
          amount,
          count: row.count,
        });
      }
    }

    const byCategory = [...groups.values()]
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((group): TransactionCategorySummary => {
        const category = categoriesById.get(group.categoryId);
        return {
          categoryId: group.categoryId,
          name: category?.name ?? '',
          color: category?.color ?? '',
          icon: category?.icon ?? '',
          type: group.type,
          total: group.amount.toFixed(2),
          count: group.count,
        };
      });

    return {
      dateFrom,
      dateTo,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: totalIncome.minus(totalExpense).toFixed(2),
      byCategory,
      currency,
      ratesDate: rates?.date ?? null,
    };
  }

  /**
   * Income and expense per tag over the period, converted like `summary`. A
   * transaction without a tag, or with one that no longer exists, goes under
   * `tagId: null`.
   */
  async tagSummary(
    userId: string,
    query: SummaryPeriodQuery
  ): Promise<TransactionTagReport> {
    const { dateFrom, dateTo } = this.resolveSummaryPeriod(query);
    const currency = query.currency ?? DEFAULT_CURRENCY;

    const rows = await this.transactionsRepository.sumByTypeAndTag(userId, {
      dateFrom,
      dateTo,
    });
    const tags = rows.some((row) => row.tagId !== null)
      ? await this.queryBus.execute<GetUserTagsQuery, UserTag[]>(
          new GetUserTagsQuery(userId)
        )
      : [];
    const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
    const rates = await this.loadRatesIfNeeded(
      rows.map((row) => row.currency),
      currency
    );

    const groups = new Map<
      string,
      {
        type: TransactionType;
        tag: UserTag | null;
        amount: Prisma.Decimal;
        count: number;
      }
    >();
    for (const row of rows) {
      const amount = this.convert(row.amount, row.currency, currency, rates);
      const tag = (row.tagId && tagsById.get(row.tagId)) || null;
      const key = `${row.type}:${tag?.id ?? ''}`;
      const group = groups.get(key);
      if (group) {
        group.amount = group.amount.plus(amount);
        group.count += row.count;
      } else {
        groups.set(key, { type: row.type, tag, amount, count: row.count });
      }
    }

    const byTag = [...groups.values()]
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((group): TransactionTagSummary => ({
        tagId: group.tag?.id ?? null,
        name: group.tag?.name ?? null,
        type: group.type,
        total: group.amount.toFixed(2),
        count: group.count,
      }));

    return {
      dateFrom,
      dateTo,
      byTag,
      currency,
      ratesDate: rates?.date ?? null,
    };
  }

  /**
   * Income and expense of one tag per UTC month over all time, converted like
   * `summary`. Months between the first and the last without transactions
   * are zeros, so the chart shows the gaps.
   */
  async tagHistory(
    userId: string,
    query: TagHistoryQuery
  ): Promise<TagHistoryReport> {
    await this.assertTagsOwned(userId, [query.tagId]);
    const currency = query.currency ?? DEFAULT_CURRENCY;

    const rows = await this.transactionsRepository.sumByMonthForTag(
      userId,
      query.tagId
    );
    const rates = await this.loadRatesIfNeeded(
      rows.map((row) => row.currency),
      currency
    );

    // Rounded only at the end, so the totals don't drift.
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    const months = new Map<
      string,
      {
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
        incomeCount: number;
        expenseCount: number;
      }
    >();
    for (const row of rows) {
      const amount = this.convert(row.amount, row.currency, currency, rates);
      let month = months.get(row.month);
      if (!month) {
        month = {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
          incomeCount: 0,
          expenseCount: 0,
        };
        months.set(row.month, month);
      }
      if (row.type === TransactionType.INCOME) {
        totalIncome = totalIncome.plus(amount);
        month.income = month.income.plus(amount);
        month.incomeCount += row.count;
      } else {
        totalExpense = totalExpense.plus(amount);
        month.expense = month.expense.plus(amount);
        month.expenseCount += row.count;
      }
    }

    const keys = [...months.keys()].sort();
    const byMonth =
      keys.length === 0
        ? []
        : monthsBetween(keys[0]!, keys[keys.length - 1]!).map(
            (key): TagMonthSummary => {
              const month = months.get(key);
              return {
                month: key,
                income: (month?.income ?? new Prisma.Decimal(0)).toFixed(2),
                expense: (month?.expense ?? new Prisma.Decimal(0)).toFixed(2),
                incomeCount: month?.incomeCount ?? 0,
                expenseCount: month?.expenseCount ?? 0,
              };
            }
          );

    return {
      tagId: query.tagId,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: totalIncome.minus(totalExpense).toFixed(2),
      byMonth,
      currency,
      ratesDate: rates?.date ?? null,
    };
  }

  toPublic(transaction: Transaction): PublicTransaction {
    return {
      id: transaction.id,
      amount: transaction.amount.toFixed(2),
      currency: storedCurrency(transaction),
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      categoryId: transaction.categoryId,
      tagIds: storedTagIds(transaction),
      createdAt: transaction.createdAt,
    };
  }

  /** A transaction can only be written in one of the user's currencies. */
  private async assertCurrencyEnabled(
    userId: string,
    currency: Currency
  ): Promise<void> {
    const settings = await this.queryBus.execute<
      GetUserSettingsQuery,
      UserSettings
    >(new GetUserSettingsQuery(userId));
    if (!settings.currencies.includes(currency)) {
      throw new BadRequestException(
        `${currency} is not one of your currencies; add it in the settings first`
      );
    }
  }

  private async assertTagsOwned(
    userId: string,
    tagIds: string[]
  ): Promise<void> {
    if (tagIds.length === 0) return;
    const tags = await this.queryBus.execute<GetUserTagsQuery, UserTag[]>(
      new GetUserTagsQuery(userId)
    );
    const owned = new Set(tags.map((tag) => tag.id));
    if (!tagIds.every((id) => owned.has(id))) {
      throw new NotFoundException('Tag not found');
    }
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
  private resolveSummaryPeriod(query: SummaryPeriodQuery): {
    dateFrom: Date;
    dateTo: Date;
  } {
    const hasMonthOrYear =
      query.month !== undefined || query.year !== undefined;
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
  private monthRange(
    year: number,
    month: number
  ): {
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

  /**
   * Rates are only needed when something is not already in `target`, so a
   * single-currency view keeps working while the rates provider is down.
   */
  private async loadRatesIfNeeded(
    currencies: Currency[],
    target: Currency
  ): Promise<ExchangeRatesSnapshot | null> {
    if (currencies.every((currency) => currency === target)) return null;
    return this.queryBus.execute<GetExchangeRatesQuery, ExchangeRatesSnapshot>(
      new GetExchangeRatesQuery()
    );
  }

  private convert(
    amount: Prisma.Decimal,
    from: Currency,
    to: Currency,
    rates: ExchangeRatesSnapshot | null
  ): Prisma.Decimal {
    // `rates` is null only when every amount is already in `to`.
    return rates ? convertAmount(amount, from, to, rates) : amount;
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
