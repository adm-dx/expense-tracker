import { INestApplication } from '@nestjs/common';
import {
  Currency,
  Prisma,
  TransactionType,
} from '@api/generated/prisma/client';
import { TransactionsRepository } from '@api/modules/transactions/transactions.repository';
import type { TransactionFilters } from '@api/modules/transactions/transactions.repository';
import { createTestApp } from '@tests/setup/app';
import { disconnectDatabase, resetDatabase } from '@tests/setup/prisma';
import { seedCategory, seedTransaction, seedUser } from '@tests/setup/seed';

let app: INestApplication;
let repository: TransactionsRepository;

beforeAll(async () => {
  app = await createTestApp();
  repository = app.get(TransactionsRepository, { strict: false });
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const ALL = { skip: 0, take: 1000 };
const ids = (items: { id: string }[]) => items.map((i) => i.id);

/** A user with one category and the boundary-heavy September fixture. */
async function seedSeptember() {
  const user = await seedUser();
  const category = await seedCategory(user.id);
  const base = { userId: user.id, categoryId: category.id };
  const rows = {
    firstMs: await seedTransaction({
      ...base,
      amount: '0.10',
      date: '2026-09-01T00:00:00.000Z',
    }),
    evening: await seedTransaction({
      ...base,
      amount: '0.20',
      date: '2026-09-10T18:45:00.000Z',
      createdAt: '2026-09-10T18:45:00.000Z',
    }),
    eveningIncome: await seedTransaction({
      ...base,
      amount: '1000.00',
      type: TransactionType.INCOME,
      date: '2026-09-10T18:45:00.000Z',
      createdAt: '2026-09-10T18:50:00.000Z',
    }),
    lastMs: await seedTransaction({
      ...base,
      amount: '5.00',
      date: '2026-09-30T23:59:59.999Z',
    }),
    nextMonth: await seedTransaction({
      ...base,
      amount: '7.00',
      date: '2026-10-01T00:00:00.000Z',
    }),
    prevMonth: await seedTransaction({
      ...base,
      amount: '9.00',
      date: '2026-08-31T23:59:59.999Z',
    }),
  };
  return { user, category, rows };
}

const SEPTEMBER: TransactionFilters = {
  dateFrom: new Date('2026-09-01T00:00:00.000Z'),
  dateTo: new Date('2026-09-30T23:59:59.999Z'),
};

describe('findManyByUser', () => {
  it('sorts by date, newest first, then by creation time, newest first', async () => {
    const { user, rows } = await seedSeptember();

    const { items } = await repository.findManyByUser(user.id, {}, ALL);

    expect(ids(items)).toEqual(
      ids([
        rows.nextMonth,
        rows.lastMs,
        rows.eveningIncome, // same date as `evening`, created later
        rows.evening,
        rows.firstMs,
        rows.prevMonth,
      ])
    );
  });

  it('includes rows exactly on both bounds and excludes the ones just outside', async () => {
    const { user, rows } = await seedSeptember();

    const { items, total } = await repository.findManyByUser(
      user.id,
      SEPTEMBER,
      ALL
    );

    expect(total).toBe(4);
    expect(new Set(ids(items))).toEqual(
      new Set(
        ids([rows.firstMs, rows.evening, rows.eveningIncome, rows.lastMs])
      )
    );
  });

  it('keeps a transaction from the evening of the last day inside the period', async () => {
    // Regression: a period end sent as midnight dropped everything later that day.
    const user = await seedUser();
    const category = await seedCategory(user.id);
    const evening = await seedTransaction({
      userId: user.id,
      categoryId: category.id,
      date: '2026-09-30T18:45:00.000Z',
    });

    const midnightEnd = await repository.findManyByUser(
      user.id,
      { dateTo: new Date('2026-09-30T00:00:00.000Z') },
      ALL
    );
    const endOfDay = await repository.findManyByUser(
      user.id,
      { dateTo: new Date('2026-09-30T23:59:59.999Z') },
      ALL
    );

    expect(midnightEnd.items).toEqual([]);
    expect(ids(endOfDay.items)).toEqual([evening.id]);
  });

  it('supports an open-ended range', async () => {
    const { user, rows } = await seedSeptember();

    const from = await repository.findManyByUser(
      user.id,
      { dateFrom: new Date('2026-09-30T23:59:59.999Z') },
      ALL
    );
    const to = await repository.findManyByUser(
      user.id,
      { dateTo: new Date('2026-08-31T23:59:59.999Z') },
      ALL
    );

    expect(new Set(ids(from.items))).toEqual(
      new Set(ids([rows.lastMs, rows.nextMonth]))
    );
    expect(ids(to.items)).toEqual(ids([rows.prevMonth]));
  });

  it('filters by type', async () => {
    const { user, rows } = await seedSeptember();

    const { items } = await repository.findManyByUser(
      user.id,
      { type: TransactionType.INCOME },
      ALL
    );

    expect(ids(items)).toEqual([rows.eveningIncome.id]);
  });

  it('filters by category and combines filters', async () => {
    const { user, category, rows } = await seedSeptember();
    const other = await seedCategory(user.id, 'Transport');
    const transport = await seedTransaction({
      userId: user.id,
      categoryId: other.id,
      date: '2026-09-15T00:00:00.000Z',
    });

    const byCategory = await repository.findManyByUser(
      user.id,
      { categoryId: other.id },
      ALL
    );
    const combined = await repository.findManyByUser(
      user.id,
      { ...SEPTEMBER, categoryId: category.id, type: TransactionType.INCOME },
      ALL
    );

    expect(ids(byCategory.items)).toEqual([transport.id]);
    expect(ids(combined.items)).toEqual([rows.eveningIncome.id]);
  });

  it("never returns another user's rows", async () => {
    const { user } = await seedSeptember();
    const stranger = await seedUser();
    const strangerCategory = await seedCategory(stranger.id);
    await seedTransaction({
      userId: stranger.id,
      categoryId: strangerCategory.id,
    });

    const mine = await repository.findManyByUser(user.id, {}, ALL);
    const theirs = await repository.findManyByUser(stranger.id, {}, ALL);

    expect(mine.total).toBe(6);
    expect(theirs.total).toBe(1);
  });

  describe('pagination', () => {
    async function seedMany(count: number) {
      const user = await seedUser();
      const category = await seedCategory(user.id);
      for (let day = 1; day <= count; day++) {
        await seedTransaction({
          userId: user.id,
          categoryId: category.id,
          amount: `${day}.00`,
          date: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`,
        });
      }
      return user;
    }

    it('returns the same total on every page', async () => {
      const user = await seedMany(25);

      const pages = await Promise.all(
        [0, 10, 20].map((skip) =>
          repository.findManyByUser(user.id, {}, { skip, take: 10 })
        )
      );

      expect(pages.map((p) => p.items.length)).toEqual([10, 10, 5]);
      expect(pages.map((p) => p.total)).toEqual([25, 25, 25]);
    });

    it('pages are disjoint and together cover every row, newest first', async () => {
      const user = await seedMany(25);

      const collected: string[] = [];
      for (const skip of [0, 10, 20]) {
        const { items } = await repository.findManyByUser(
          user.id,
          {},
          { skip, take: 10 }
        );
        collected.push(...ids(items));
      }
      const everything = await repository.findManyByUser(user.id, {}, ALL);

      expect(new Set(collected).size).toBe(25);
      expect(collected).toEqual(ids(everything.items));
    });

    it('a page past the end is empty but still reports the total', async () => {
      const user = await seedMany(12);

      const { items, total } = await repository.findManyByUser(
        user.id,
        {},
        { skip: 50, take: 10 }
      );

      expect(items).toEqual([]);
      expect(total).toBe(12);
    });

    it('total respects the filters, not just the page', async () => {
      const user = await seedMany(25);

      const { items, total } = await repository.findManyByUser(
        user.id,
        {
          dateFrom: new Date('2026-09-11T00:00:00.000Z'),
          dateTo: new Date('2026-09-20T23:59:59.999Z'),
        },
        { skip: 0, take: 5 }
      );

      expect(items).toHaveLength(5);
      expect(total).toBe(10);
    });
  });
});

describe('sumByTypeAndCategory', () => {
  it('groups by type and category and adds decimals exactly', async () => {
    const { user, category } = await seedSeptember();

    const rows = await repository.sumByTypeAndCategory(user.id, SEPTEMBER);

    const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
    expect(rows).toHaveLength(2);
    // 0.10 + 0.20 + 5.00, with no floating-point drift.
    expect(byType[TransactionType.EXPENSE]?.amount.toFixed(2)).toBe('5.30');
    expect(byType[TransactionType.INCOME]?.amount.toFixed(2)).toBe('1000.00');
    expect(rows.every((r) => r.categoryId === category.id)).toBe(true);
  });

  it('returns one row per category', async () => {
    const { user } = await seedSeptember();
    const other = await seedCategory(user.id, 'Transport');
    await seedTransaction({
      userId: user.id,
      categoryId: other.id,
      amount: '3.00',
      date: '2026-09-15T00:00:00.000Z',
    });

    const rows = await repository.sumByTypeAndCategory(user.id, SEPTEMBER);

    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.categoryId === other.id)?.amount.toFixed(2)).toBe(
      '3.00'
    );
  });

  it('keeps each currency in its own row', async () => {
    const { user, category } = await seedSeptember();
    await seedTransaction({
      userId: user.id,
      categoryId: category.id,
      amount: '7.00',
      currency: Currency.EUR,
      date: '2026-09-15T00:00:00.000Z',
    });

    const rows = await repository.sumByTypeAndCategory(user.id, SEPTEMBER);

    const expenses = rows.filter((r) => r.type === TransactionType.EXPENSE);
    expect(
      expenses
        .map((r) => [r.currency, r.amount.toFixed(2)])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    ).toEqual([
      [Currency.EUR, '7.00'],
      [Currency.RSD, '5.30'],
    ]);
  });

  it('is empty when nothing matches', async () => {
    const { user } = await seedSeptember();

    const rows = await repository.sumByTypeAndCategory(user.id, {
      dateFrom: new Date('2030-01-01T00:00:00.000Z'),
      dateTo: new Date('2030-01-31T23:59:59.999Z'),
    });

    expect(rows).toEqual([]);
  });

  it("ignores another user's rows", async () => {
    const { user } = await seedSeptember();
    const stranger = await seedUser();
    const strangerCategory = await seedCategory(stranger.id);
    await seedTransaction({
      userId: stranger.id,
      categoryId: strangerCategory.id,
      amount: '999.00',
      date: '2026-09-15T00:00:00.000Z',
    });

    const rows = await repository.sumByTypeAndCategory(user.id, SEPTEMBER);

    expect(
      rows
        .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0))
        .toFixed(2)
    ).toBe('1005.30');
  });

  it.each<[string, TransactionFilters]>([
    ['no filters', {}],
    ['a full month', SEPTEMBER],
    ['an open-ended range', { dateFrom: new Date('2026-09-10T00:00:00.000Z') }],
    ['expenses only', { type: TransactionType.EXPENSE }],
    ['income only', { type: TransactionType.INCOME }],
  ])(
    'adds up to exactly the rows the list returns (%s)',
    async (_label, filters) => {
      // The summary cards and the table must never disagree.
      const { user } = await seedSeptember();

      const { items } = await repository.findManyByUser(user.id, filters, ALL);
      const sums = await repository.sumByTypeAndCategory(user.id, filters);

      const signed = (type: TransactionType, amount: Prisma.Decimal) =>
        type === TransactionType.INCOME ? amount : amount.negated();
      const fromList = items.reduce(
        (sum, t) => sum.plus(signed(t.type, t.amount)),
        new Prisma.Decimal(0)
      );
      const fromSummary = sums.reduce(
        (sum, r) => sum.plus(signed(r.type, r.amount)),
        new Prisma.Decimal(0)
      );
      expect(fromSummary.toFixed(2)).toBe(fromList.toFixed(2));
    }
  );
});
