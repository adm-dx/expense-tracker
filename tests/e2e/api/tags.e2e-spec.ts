import { INestApplication } from '@nestjs/common';
import type {
  Category,
  Tag,
  Transaction,
  TransactionsPage,
  TransactionSummary,
  TransactionTagReport,
} from '@expense-tracker/types';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson, expectStatus } from '@tests/setup/http';
import { disconnectDatabase, resetDatabase } from '@tests/setup/prisma';

/**
 * A tag's whole life, the way the web app drives it: create tags in the
 * settings, tag transactions, filter the table and the cards by a tag, read
 * the report by tag, rename a tag and delete it. At every step the table, the
 * cards and the report must agree.
 *
 * Steps share state and run in order.
 */

const PERIOD =
  'dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-30T23:59:59.999Z&currency=EUR';

let app: INestApplication;
let user: TestUser;
let categoryId: string;
let trip: Tag;
let work: Tag;

const server = () => request(app.getHttpServer());

const get = <T>(url: string) =>
  expectJson<T>(
    server()
      .get(url)
      .set(...bearer(user))
  );

function record(amount: number, type: 'INCOME' | 'EXPENSE', tag?: Tag) {
  return expectJson<Transaction>(
    server()
      .post('/transactions')
      .set(...bearer(user))
      .send({
        amount,
        currency: 'EUR',
        type,
        date: '2026-09-10T00:00:00.000Z',
        categoryId,
        ...(tag ? { tagIds: [tag.id] } : {}),
      }),
    201
  );
}

/** Sums one type of the report, as the web's footer row does. */
function reportTotal(report: TransactionTagReport, type: 'INCOME' | 'EXPENSE') {
  const cents = report.byTag
    .filter((row) => row.type === type)
    .reduce((sum, row) => sum + Math.round(Number(row.total) * 100), 0);
  return (cents / 100).toFixed(2);
}

const byTag = (report: TransactionTagReport) =>
  Object.fromEntries(
    report.byTag.map((row) => [`${row.type}:${row.name ?? '-'}`, row.total])
  );

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase();
  user = await registerUser(app);
  categoryId = (await get<Category[]>('/categories'))[0]!.id;
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

describe('tags journey', () => {
  it('creates two tags in the settings', async () => {
    trip = await expectJson<Tag>(
      server()
        .post('/tags')
        .set(...bearer(user))
        .send({ name: 'Trip' }),
      201
    );
    work = await expectJson<Tag>(
      server()
        .post('/tags')
        .set(...bearer(user))
        .send({ name: 'Work' }),
      201
    );

    expect((await get<Tag[]>('/tags')).map((t) => t.name)).toEqual([
      'Trip',
      'Work',
    ]);
  });

  it('records tagged and untagged transactions', async () => {
    await record(120.5, 'EXPENSE', trip);
    await record(30, 'EXPENSE', trip);
    await record(15.25, 'EXPENSE');
    await record(2000, 'INCOME', work);
    await record(40, 'EXPENSE', work);

    const tags = await get<Tag[]>('/tags');
    expect(tags.map((t) => [t.name, t.transactionCount])).toEqual([
      ['Trip', 2],
      ['Work', 2],
    ]);
  });

  it('the table and the cards agree under a tag filter', async () => {
    const page = await get<TransactionsPage>(
      `/transactions?${PERIOD}&tagId=${trip.id}`
    );
    const summary = await get<TransactionSummary>(
      `/transactions/summary?${PERIOD}&tagId=${trip.id}`
    );

    expect(page.total).toBe(2);
    expect(page.items.every((t) => t.tagIds[0] === trip.id)).toBe(true);
    expect(summary.totalExpense).toBe('150.50');
    expect(summary.totalIncome).toBe('0.00');
  });

  it('the report by tag adds up to the unfiltered cards', async () => {
    const report = await get<TransactionTagReport>(
      `/transactions/summary/by-tag?${PERIOD}`
    );
    const summary = await get<TransactionSummary>(
      `/transactions/summary?${PERIOD}`
    );

    expect(byTag(report)).toEqual({
      'EXPENSE:Trip': '150.50',
      'EXPENSE:Work': '40.00',
      'EXPENSE:-': '15.25',
      'INCOME:Work': '2000.00',
    });
    expect(reportTotal(report, 'EXPENSE')).toBe(summary.totalExpense);
    expect(reportTotal(report, 'INCOME')).toBe(summary.totalIncome);
  });

  it('a renamed tag shows its new name in the report', async () => {
    await expectJson<Tag>(
      server()
        .patch(`/tags/${trip.id}`)
        .set(...bearer(user))
        .send({ name: 'Vienna trip' })
    );

    const report = await get<TransactionTagReport>(
      `/transactions/summary/by-tag?${PERIOD}`
    );
    expect(byTag(report)['EXPENSE:Vienna trip']).toBe('150.50');
  });

  it('a deleted tag moves its transactions to "no tag", totals unchanged', async () => {
    await expectStatus(
      server()
        .delete(`/tags/${trip.id}`)
        .set(...bearer(user)),
      204
    );

    const report = await get<TransactionTagReport>(
      `/transactions/summary/by-tag?${PERIOD}`
    );
    const summary = await get<TransactionSummary>(
      `/transactions/summary?${PERIOD}`
    );
    const filtered = await get<TransactionsPage>(
      `/transactions?${PERIOD}&tagId=${trip.id}`
    );

    expect(byTag(report)).toEqual({
      'EXPENSE:-': '165.75',
      'EXPENSE:Work': '40.00',
      'INCOME:Work': '2000.00',
    });
    expect(reportTotal(report, 'EXPENSE')).toBe(summary.totalExpense);
    expect(filtered.total).toBe(0);
    expect((await get<Tag[]>('/tags')).map((t) => t.name)).toEqual(['Work']);
  });
});
