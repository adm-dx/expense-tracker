import { INestApplication } from '@nestjs/common';
import type {
  AuthResponse,
  Category,
  Currency,
  Transaction,
  TransactionsPage,
  TransactionSummary,
} from '@expense-tracker/types';
import { DEFAULT_CATEGORIES } from '@api/modules/categories/default-categories';
import { createTestApp, request } from '@tests/setup/app';
import { TEST_RATES } from '@tests/setup/exchange-rates';
import { expectJson } from '@tests/setup/http';
import {
  disconnectDatabase,
  resetDatabase,
  waitForLastLogin,
} from '@tests/setup/prisma';

/**
 * The whole home-screen journey over HTTP, the way the web app drives it:
 * sign up, get default categories, record transactions, page through them,
 * read the summary for a period, edit, delete, record in other currencies
 * and view everything in each display currency, sign out and back in.
 *
 * Steps share state and run in order.
 */

interface Row {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  /** In RSD, the default display currency, whatever the row was entered in. */
  cents: number;
  date: string;
}

const EMAIL = 'journey@example.com';
const PASSWORD = 'journey-password';

const SEPTEMBER = {
  dateFrom: '2026-09-01T00:00:00.000Z',
  dateTo: '2026-09-30T23:59:59.999Z',
};

let app: INestApplication;
let accessToken: string;
let refreshToken: string;
let categoryIds: string[] = [];
const rows: Row[] = [];

const server = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${accessToken}` });
const money = (cents: number) => (cents / 100).toFixed(2);

function totals(subset: Row[]) {
  const income = subset
    .filter((r) => r.type === 'INCOME')
    .reduce((sum, r) => sum + r.cents, 0);
  const expense = subset
    .filter((r) => r.type === 'EXPENSE')
    .reduce((sum, r) => sum + r.cents, 0);
  return { income, expense, balance: income - expense };
}

const inRange = (row: Row, from: string, to: string) => {
  const time = new Date(row.date).getTime();
  return time >= new Date(from).getTime() && time <= new Date(to).getTime();
};

function list(query: string) {
  return expectJson<TransactionsPage>(
    server().get(`/transactions${query}`).set(auth())
  );
}

function summary(query: string) {
  return expectJson<TransactionSummary>(
    server().get(`/transactions/summary${query}`).set(auth())
  );
}

const period = (from: string, to: string) =>
  `?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}`;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

describe('home screen journey', () => {
  it('signs up and lands with a session', async () => {
    const registered = await expectJson<AuthResponse>(
      server()
        .post('/auth/register')
        .send({ name: 'Journey', email: EMAIL, password: PASSWORD }),
      201
    );

    accessToken = registered.accessToken;
    refreshToken = registered.refreshToken;
    expect(registered.user.email).toBe(EMAIL);
    await server().get('/auth/me').set(auth()).expect(200);
  });

  it('starts with the default categories and an empty table', async () => {
    const categories = await expectJson<Category[]>(
      server().get('/categories').set(auth())
    );
    categoryIds = categories.map((c) => c.id);

    expect(categories.map((c) => c.name).sort()).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.name).sort()
    );
    expect(await list('')).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      currency: 'RSD',
      ratesDate: null,
    });
    expect(
      await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo))
    ).toMatchObject({
      totalIncome: '0.00',
      totalExpense: '0.00',
      balance: '0.00',
      byCategory: [],
    });
  });

  it('records 25 transactions across September, the last one late on the 30th', async () => {
    const drafts: Omit<Row, 'id'>[] = [];
    for (let day = 1; day <= 24; day++) {
      drafts.push({
        type: day % 5 === 0 ? 'INCOME' : 'EXPENSE',
        categoryId: categoryIds[day % 3] as string,
        cents: day * 300 + 50,
        date: `2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`,
      });
    }
    drafts.push({
      type: 'EXPENSE',
      categoryId: categoryIds[0] as string,
      cents: 10_000,
      date: '2026-09-30T18:45:00.000Z',
    });

    for (const draft of drafts) {
      const created = await expectJson<Transaction>(
        server()
          .post('/transactions')
          .set(auth())
          .send({
            amount: draft.cents / 100,
            currency: 'RSD',
            type: draft.type,
            date: draft.date,
            categoryId: draft.categoryId,
          }),
        201
      );
      rows.push({ ...draft, id: created.id });
    }

    expect(rows).toHaveLength(25);
    expect((await list('')).total).toBe(25);
  });

  describe('paging', () => {
    it('shows 10 per page by default, newest first', async () => {
      const first = await list('');

      expect(first).toMatchObject({ page: 1, pageSize: 10, total: 25 });
      expect(first.items).toHaveLength(10);
      // The evening of the 30th is the newest row.
      expect(first.items[0]?.id).toBe(rows[24]?.id);
    });

    it.each([
      [10, [10, 10, 5]],
      [20, [20, 5]],
      [50, [25]],
    ])('pages by %i', async (pageSize, expectedLengths) => {
      for (const [index, length] of expectedLengths.entries()) {
        const page = await list(`?page=${index + 1}&pageSize=${pageSize}`);

        expect(page.items).toHaveLength(length);
        expect(page.total).toBe(25);
        expect(page.pageSize).toBe(pageSize);
      }
    });

    it('every page together holds each transaction exactly once', async () => {
      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        seen.push(
          ...(await list(`?page=${page}&pageSize=10`)).items.map((i) => i.id)
        );
      }

      expect(new Set(seen).size).toBe(25);
      expect(new Set(seen)).toEqual(new Set(rows.map((r) => r.id)));
    });

    it('a page past the end is empty and still reports the total', async () => {
      expect(await list('?page=4&pageSize=10')).toMatchObject({
        items: [],
        total: 25,
      });
    });
  });

  describe('period and summary', () => {
    it('the summary for September matches what was recorded', async () => {
      const expected = totals(rows);

      const result = await summary(
        period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo)
      );

      expect(result).toMatchObject({
        dateFrom: SEPTEMBER.dateFrom,
        dateTo: SEPTEMBER.dateTo,
        totalIncome: money(expected.income),
        totalExpense: money(expected.expense),
        balance: money(expected.balance),
      });
      const categoryTotal = result.byCategory.reduce(
        (sum, c) => sum + Math.round(Number(c.total) * 100),
        0
      );
      expect(categoryTotal).toBe(expected.income + expected.expense);
    });

    it('month/year is the same September', async () => {
      expect(await summary('?month=9&year=2026')).toEqual(
        await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo))
      );
    });

    it.each([
      [
        'the first ten days',
        '2026-09-01T00:00:00.000Z',
        '2026-09-10T23:59:59.999Z',
      ],
      ['a single day', '2026-09-15T00:00:00.000Z', '2026-09-15T23:59:59.999Z'],
      [
        'a range with no transactions',
        '2026-08-01T00:00:00.000Z',
        '2026-08-31T23:59:59.999Z',
      ],
    ])('the cards and the table agree for %s', async (_label, from, to) => {
      const inPeriod = rows.filter((r) => inRange(r, from, to));
      const expected = totals(inPeriod);

      const table = await list(`${period(from, to)}&pageSize=50`);
      const cards = await summary(period(from, to));

      expect(table.total).toBe(inPeriod.length);
      expect(cards).toMatchObject({
        totalIncome: money(expected.income),
        totalExpense: money(expected.expense),
        balance: money(expected.balance),
      });
    });

    it('counts a transaction from the evening of the last day', async () => {
      // Regression: a period end at midnight silently dropped it.
      const endOfDay = await list(
        `${period('2026-09-30T00:00:00.000Z', '2026-09-30T23:59:59.999Z')}`
      );
      const midnight = await list(
        `${period('2026-09-30T00:00:00.000Z', '2026-09-30T00:00:00.000Z')}`
      );
      const cards = await summary(
        period('2026-09-30T00:00:00.000Z', '2026-09-30T23:59:59.999Z')
      );

      expect(endOfDay.items.map((i) => i.id)).toEqual([rows[24]?.id]);
      expect(midnight.items).toEqual([]);
      expect(cards.totalExpense).toBe('100.00');
    });

    it('the table follows the period across pages', async () => {
      const from = '2026-09-01T00:00:00.000Z';
      const to = '2026-09-20T23:59:59.999Z';

      const second = await list(`${period(from, to)}&page=2&pageSize=10`);

      expect(second.total).toBe(20);
      expect(second.items).toHaveLength(10);
    });
  });

  describe('editing', () => {
    it('changes the amount, type and category of a transaction', async () => {
      const target = rows[1] as Row; // day 2: an expense
      const newCategory = categoryIds[5] as string;

      const updated = await expectJson<Transaction>(
        server()
          .patch(`/transactions/${target.id}`)
          .set(auth())
          .send({ amount: 500, type: 'INCOME', categoryId: newCategory })
      );

      expect(updated).toMatchObject({
        id: target.id,
        amount: '500.00',
        type: 'INCOME',
        categoryId: newCategory,
      });
      target.cents = 50_000;
      target.type = 'INCOME';
      target.categoryId = newCategory;
    });

    it('the table and the summary both reflect the edit', async () => {
      const expected = totals(rows);

      const table = await list('?pageSize=50');
      const cards = await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo));

      expect(table.items.find((i) => i.id === rows[1]?.id)).toMatchObject({
        amount: '500.00',
        type: 'INCOME',
      });
      expect(cards).toMatchObject({
        totalIncome: money(expected.income),
        totalExpense: money(expected.expense),
        balance: money(expected.balance),
      });
      expect(table.total).toBe(25);
    });
  });

  describe('deleting', () => {
    it('removes the transaction from the table and the totals', async () => {
      const target = rows.pop() as Row; // the evening of the 30th

      await server()
        .delete(`/transactions/${target.id}`)
        .set(auth())
        .expect(204);

      await server().get(`/transactions/${target.id}`).set(auth()).expect(404);
      const expected = totals(rows);
      const cards = await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo));
      expect((await list('')).total).toBe(24);
      expect(cards.totalExpense).toBe(money(expected.expense));
      expect(cards.balance).toBe(money(expected.balance));
    });

    it('deleting the same transaction twice is a 404 the second time', async () => {
      const target = rows.shift() as Row;

      await server()
        .delete(`/transactions/${target.id}`)
        .set(auth())
        .expect(204);
      const again = await server()
        .delete(`/transactions/${target.id}`)
        .set(auth());

      expect(again.status).toBe(404);
      expect((await list('')).total).toBe(rows.length);
    });

    it('the summary stays in step with the table after every delete', async () => {
      const expected = totals(rows);

      const cards = await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo));

      expect(cards).toMatchObject({
        totalIncome: money(expected.income),
        totalExpense: money(expected.expense),
        balance: money(expected.balance),
      });
    });
  });

  describe('other currencies', () => {
    const CURRENCIES: Currency[] = ['RSD', 'EUR', 'HUF'];
    /** Units of `currency` per 1 RSD, from the fake provider's rates. */
    const perRsd = (currency: Currency) =>
      Number(TEST_RATES[currency]) / Number(TEST_RATES.RSD);

    it('records transactions in euros and forints as entered', async () => {
      const drafts = [
        { amount: 12.34, currency: 'EUR', type: 'EXPENSE' },
        { amount: 555, currency: 'HUF', type: 'INCOME' },
        { amount: 0.01, currency: 'EUR', type: 'EXPENSE' },
      ] as const;

      for (const draft of drafts) {
        const created = await expectJson<Transaction>(
          server()
            .post('/transactions')
            .set(auth())
            .send({
              ...draft,
              date: '2026-09-20T00:00:00.000Z',
              categoryId: categoryIds[0],
            }),
          201
        );
        expect(created).toMatchObject({
          amount: draft.amount.toFixed(2),
          currency: draft.currency,
        });
        rows.push({
          id: created.id,
          type: draft.type,
          categoryId: categoryIds[0]!,
          cents: Math.round((draft.amount * 100) / perRsd(draft.currency)),
          date: '2026-09-20T00:00:00.000Z',
        });
      }
    });

    it('in RSD, the cards add up to exactly the rows', async () => {
      const expected = totals(rows);

      const cards = await summary(
        `${period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo)}&currency=RSD`
      );

      expect(cards).toMatchObject({
        currency: 'RSD',
        totalIncome: money(expected.income),
        totalExpense: money(expected.expense),
        balance: money(expected.balance),
      });
    });

    it.each(CURRENCIES)(
      'in %s, the table and the cards agree and show the same rates',
      async (currency) => {
        const query = `${period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo)}&currency=${currency}`;
        const table = await list(`${query}&pageSize=50`);
        const cards = await summary(query);

        expect(table.total).toBe(rows.length);
        expect(table.currency).toBe(currency);
        expect(cards.currency).toBe(currency);
        expect(table.ratesDate).toBe(cards.ratesDate);

        // Rows are rounded one by one and the cards only once, so they may
        // drift apart by at most half a cent per row.
        const tolerance = table.items.length * 0.005;
        for (const type of ['INCOME', 'EXPENSE'] as const) {
          const fromRows = table.items
            .filter((item) => item.type === type)
            .reduce((sum, item) => sum + Number(item.convertedAmount), 0);
          const card = Number(
            type === 'INCOME' ? cards.totalIncome : cards.totalExpense
          );
          expect(Math.abs(fromRows - card)).toBeLessThanOrEqual(tolerance);
        }

        // The totals themselves follow the rates.
        const expected = totals(rows);
        expect(Number(cards.balance)).toBeCloseTo(
          (expected.balance / 100) * perRsd(currency),
          2
        );
      }
    );

    it('keeps what was entered, whatever the display currency', async () => {
      const inHuf = await list(
        `${period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo)}&currency=HUF&pageSize=50`
      );

      const euros = inHuf.items.filter((item) => item.currency === 'EUR');
      expect(euros.map((item) => [item.amount, item.convertedAmount])).toEqual(
        expect.arrayContaining([
          ['12.34', '4936.00'],
          ['0.01', '4.00'],
        ])
      );
    });
  });

  describe('signing out and back in', () => {
    it('logging out ends the session', async () => {
      await server().post('/auth/logout').send({ refreshToken }).expect(204);

      await server().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logging back in shows the same data', async () => {
      const login = await expectJson<AuthResponse>(
        server().post('/auth/login').send({ email: EMAIL, password: PASSWORD })
      );
      accessToken = login.accessToken;
      refreshToken = login.refreshToken;
      await waitForLastLogin(login.user.id);

      const table = await list('?pageSize=50');
      const expected = totals(rows);
      const cards = await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo));

      expect(table.total).toBe(rows.length);
      expect(cards.balance).toBe(money(expected.balance));
      expect(
        await expectJson<Category[]>(server().get('/categories').set(auth()))
      ).toHaveLength(DEFAULT_CATEGORIES.length);
    });
  });
});
