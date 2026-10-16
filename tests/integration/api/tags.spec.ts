import { INestApplication } from '@nestjs/common';
import type {
  Category,
  Tag,
  TagHistoryReport,
  Transaction,
  TransactionTagReport,
} from '@expense-tracker/types';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson } from '@tests/setup/http';
import { disconnectDatabase, prisma, resetDatabase } from '@tests/setup/prisma';

let app: INestApplication;
let user: TestUser;
let categoryId: string;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser(app);
  const categories = await expectJson<Category[]>(
    server()
      .get('/categories')
      .set(...bearer(user))
  );
  categoryId = categories[0]!.id;
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());

function createTag(name: string, u: TestUser = user) {
  return expectJson<Tag>(
    server()
      .post('/tags')
      .set(...bearer(u))
      .send({ name }),
    201
  );
}

function listTags(u: TestUser = user) {
  return expectJson<Tag[]>(
    server()
      .get('/tags')
      .set(...bearer(u))
  );
}

function createTransaction(body: Record<string, unknown>) {
  return expectJson<Transaction>(
    server()
      .post('/transactions')
      .set(...bearer(user))
      .send({
        amount: 10,
        currency: 'EUR',
        type: 'EXPENSE',
        date: '2026-09-10T00:00:00.000Z',
        categoryId,
        ...body,
      }),
    201
  );
}

describe('tags CRUD', () => {
  it('a new user has none', async () => {
    expect(await listTags()).toEqual([]);
  });

  it('creates with a trimmed name and lists by name', async () => {
    await createTag('  Work ');
    await createTag('Trip');

    const tags = await listTags();

    expect(tags.map((t) => [t.name, t.transactionCount])).toEqual([
      ['Trip', 0],
      ['Work', 0],
    ]);
    expect(tags[0]).not.toHaveProperty('userId');
  });

  it('answers 409 for a duplicate name, on create and on rename', async () => {
    await createTag('Trip');
    const work = await createTag('Work');

    const duplicate = await server()
      .post('/tags')
      .set(...bearer(user))
      .send({ name: 'Trip' });
    const rename = await server()
      .patch(`/tags/${work.id}`)
      .set(...bearer(user))
      .send({ name: 'Trip' });

    expect(duplicate.status).toBe(409);
    expect(rename.status).toBe(409);
  });

  it('allows the same name for different users', async () => {
    const other = await registerUser(app);

    await createTag('Trip');
    await createTag('Trip', other);

    expect(await listTags(other)).toHaveLength(1);
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a name over 50 characters', { name: 'x'.repeat(51) }],
    ['a missing name', {}],
    ['an unknown field', { name: 'Trip', color: '#FFFFFF' }],
  ])('rejects %s', async (_label, body) => {
    const response = await server()
      .post('/tags')
      .set(...bearer(user))
      .send(body);

    expect(response.status).toBe(400);
  });

  it('renames a tag and keeps it on its transactions', async () => {
    const tag = await createTag('Trip');
    const transaction = await createTransaction({ tagIds: [tag.id] });

    const renamed = await expectJson<Tag>(
      server()
        .patch(`/tags/${tag.id}`)
        .set(...bearer(user))
        .send({ name: 'Holiday' })
    );

    expect(renamed).toMatchObject({ name: 'Holiday', transactionCount: 1 });
    const after = await expectJson<Transaction>(
      server()
        .get(`/transactions/${transaction.id}`)
        .set(...bearer(user))
    );
    expect(after.tagIds).toEqual([tag.id]);
  });
});

describe('tags on transactions', () => {
  it('stores a tag, counts it and clears it with an empty list', async () => {
    const tag = await createTag('Trip');

    const transaction = await createTransaction({ tagIds: [tag.id] });
    expect(transaction.tagIds).toEqual([tag.id]);
    expect((await listTags())[0]?.transactionCount).toBe(1);

    const cleared = await expectJson<Transaction>(
      server()
        .patch(`/transactions/${transaction.id}`)
        .set(...bearer(user))
        .send({ tagIds: [] })
    );
    expect(cleared.tagIds).toEqual([]);
    expect((await listTags())[0]?.transactionCount).toBe(0);
  });

  it('defaults to no tags', async () => {
    expect((await createTransaction({})).tagIds).toEqual([]);
  });

  it('deletes a tag in use and strips it from the transactions', async () => {
    const trip = await createTag('Trip');
    const work = await createTag('Work');
    const tripped = await createTransaction({ tagIds: [trip.id] });
    const worked = await createTransaction({ tagIds: [work.id] });

    await server()
      .delete(`/tags/${trip.id}`)
      .set(...bearer(user))
      .expect(204);

    expect((await listTags()).map((t) => t.name)).toEqual(['Work']);
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [tripped.id, worked.id] } },
    });
    expect(Object.fromEntries(rows.map((r) => [r.id, r.tagIds]))).toEqual({
      [tripped.id]: [],
      [worked.id]: [work.id],
    });
  });

  it('answers 404 when deleting an unknown tag', async () => {
    const response = await server()
      .delete('/tags/00000000-0000-4000-8000-000000000000')
      .set(...bearer(user));

    expect(response.status).toBe(404);
  });

  it('filters the list and the summary by tag', async () => {
    const tag = await createTag('Trip');
    const tagged = await createTransaction({ amount: 30, tagIds: [tag.id] });
    await createTransaction({ amount: 5 });
    const range =
      'dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-30T23:59:59.999Z';

    const page = await expectJson<{ items: Transaction[]; total: number }>(
      server()
        .get(`/transactions?${range}&tagId=${tag.id}`)
        .set(...bearer(user))
    );
    const summary = await expectJson<{ totalExpense: string }>(
      server()
        .get(`/transactions/summary?${range}&tagId=${tag.id}`)
        .set(...bearer(user))
    );

    expect(page.items.map((t) => t.id)).toEqual([tagged.id]);
    expect(page.total).toBe(1);
    expect(summary.totalExpense).toBe('30.00');
  });
});

describe('GET /transactions/summary/by-tag/history', () => {
  function history(tagId: string, u: TestUser = user) {
    return server()
      .get(`/transactions/summary/by-tag/history?tagId=${tagId}`)
      .set(...bearer(u));
  }

  it("sums the tag's transactions per UTC month over all time, gaps as zeros", async () => {
    const trip = await createTag('Trip');
    const other = await createTag('Other');
    await createTransaction({
      amount: 10.1,
      date: '2025-12-31T23:59:59.000Z',
      tagIds: [trip.id],
    });
    await createTransaction({
      amount: 0.2,
      date: '2025-12-01T00:00:00.000Z',
      tagIds: [trip.id],
    });
    await createTransaction({
      amount: 500,
      type: 'INCOME',
      date: '2026-02-01T00:00:00.000Z',
      tagIds: [trip.id],
    });
    // Neither counts: another tag, no tag.
    await createTransaction({ amount: 7, tagIds: [other.id] });
    await createTransaction({ amount: 8 });

    const result = await expectJson<TagHistoryReport>(history(trip.id));

    expect(result).toEqual({
      tagId: trip.id,
      totalIncome: '500.00',
      totalExpense: '10.30',
      balance: '489.70',
      byMonth: [
        {
          month: '2025-12',
          income: '0.00',
          expense: '10.30',
          incomeCount: 0,
          expenseCount: 2,
        },
        {
          month: '2026-01',
          income: '0.00',
          expense: '0.00',
          incomeCount: 0,
          expenseCount: 0,
        },
        {
          month: '2026-02',
          income: '500.00',
          expense: '0.00',
          incomeCount: 1,
          expenseCount: 0,
        },
      ],
      currency: 'EUR',
      ratesDate: null,
    });
  });

  it('is empty for a tag without transactions', async () => {
    const trip = await createTag('Trip');

    const result = await expectJson<TagHistoryReport>(history(trip.id));

    expect(result.byMonth).toEqual([]);
    expect(result.totalExpense).toBe('0.00');
  });

  it("answers 404 for another user's tag", async () => {
    const stranger = await registerUser(app);
    const theirs = await createTag('Theirs', stranger);

    expect((await history(theirs.id)).status).toBe(404);
  });

  it('answers 400 without a tag', async () => {
    const response = await server()
      .get('/transactions/summary/by-tag/history')
      .set(...bearer(user));

    expect(response.status).toBe(400);
  });
});

describe('GET /transactions/summary/by-tag', () => {
  const range =
    'dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-30T23:59:59.999Z';

  function report(query = range) {
    return expectJson<TransactionTagReport>(
      server()
        .get(`/transactions/summary/by-tag?${query}`)
        .set(...bearer(user))
    );
  }

  it('sums income and expense per tag, untagged under null', async () => {
    const trip = await createTag('Trip');
    const work = await createTag('Work');
    await createTransaction({ amount: 10.1, tagIds: [trip.id] });
    await createTransaction({ amount: 0.2, tagIds: [trip.id] });
    await createTransaction({ amount: 4 });
    await createTransaction({ amount: 900, type: 'INCOME', tagIds: [work.id] });
    // Outside the period.
    await createTransaction({
      amount: 1,
      date: '2026-10-01T00:00:00.000Z',
      tagIds: [trip.id],
    });

    const result = await report();

    expect(result).toMatchObject({ currency: 'EUR', ratesDate: null });
    expect(result.byTag).toEqual([
      {
        tagId: work.id,
        name: 'Work',
        type: 'INCOME',
        total: '900.00',
        count: 1,
      },
      {
        tagId: trip.id,
        name: 'Trip',
        type: 'EXPENSE',
        total: '10.30',
        count: 2,
      },
      { tagId: null, name: null, type: 'EXPENSE', total: '4.00', count: 1 },
    ]);
  });

  it('is empty for a period without transactions', async () => {
    expect((await report()).byTag).toEqual([]);
  });

  it('rejects a tag filter, which would make every row that tag', async () => {
    const response = await server()
      .get(`/transactions/summary/by-tag?${range}&tagId=x`)
      .set(...bearer(user));

    expect(response.status).toBe(400);
  });
});
