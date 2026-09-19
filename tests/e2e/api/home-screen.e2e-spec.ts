import { INestApplication } from '@nestjs/common';
import { DEFAULT_CATEGORIES } from '@api/modules/categories/default-categories';
import { createTestApp, request } from '@tests/setup/app';
import {
  disconnectDatabase,
  resetDatabase,
  waitForLastLogin,
} from '@tests/setup/prisma';

/**
 * The whole home-screen journey over HTTP, the way the web app drives it:
 * sign up, get default categories, record transactions, page through them,
 * read the summary for a period, edit, delete, sign out and back in.
 *
 * Steps share state and run in order.
 */

interface Row {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
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

async function list(query: string) {
  const response = await server()
    .get(`/transactions${query}`)
    .set(auth())
    .expect(200);
  return response.body as {
    items: { id: string; amount: string; type: string; categoryId: string }[];
    total: number;
    page: number;
    pageSize: number;
  };
}

async function summary(query: string) {
  const response = await server()
    .get(`/transactions/summary${query}`)
    .set(auth())
    .expect(200);
  return response.body as {
    dateFrom: string;
    dateTo: string;
    totalIncome: string;
    totalExpense: string;
    balance: string;
    byCategory: { categoryId: string; type: string; total: string }[];
  };
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
    const response = await server()
      .post('/auth/register')
      .send({ name: 'Journey', email: EMAIL, password: PASSWORD })
      .expect(201);

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
    expect(response.body.user.email).toBe(EMAIL);
    await server().get('/auth/me').set(auth()).expect(200);
  });

  it('starts with the default categories and an empty table', async () => {
    const categories = await server()
      .get('/categories')
      .set(auth())
      .expect(200);
    categoryIds = categories.body.map((c: { id: string }) => c.id);

    expect(categories.body.map((c: { name: string }) => c.name).sort()).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.name).sort()
    );
    expect(await list('')).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
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
      const response = await server()
        .post('/transactions')
        .set(auth())
        .send({
          amount: draft.cents / 100,
          type: draft.type,
          date: draft.date,
          categoryId: draft.categoryId,
        })
        .expect(201);
      rows.push({ ...draft, id: response.body.id });
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

      const response = await server()
        .patch(`/transactions/${target.id}`)
        .set(auth())
        .send({ amount: 500, type: 'INCOME', categoryId: newCategory })
        .expect(200);

      expect(response.body).toMatchObject({
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

  describe('signing out and back in', () => {
    it('logging out ends the session', async () => {
      await server().post('/auth/logout').send({ refreshToken }).expect(204);

      await server().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logging back in shows the same data', async () => {
      const login = await server()
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(200);
      accessToken = login.body.accessToken;
      refreshToken = login.body.refreshToken;
      await waitForLastLogin(login.body.user.id);

      const table = await list('?pageSize=50');
      const expected = totals(rows);
      const cards = await summary(period(SEPTEMBER.dateFrom, SEPTEMBER.dateTo));

      expect(table.total).toBe(rows.length);
      expect(cards.balance).toBe(money(expected.balance));
      expect(
        (await server().get('/categories').set(auth()).expect(200)).body
      ).toHaveLength(DEFAULT_CATEGORIES.length);
    });
  });
});
