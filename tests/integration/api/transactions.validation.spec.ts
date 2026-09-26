import { INestApplication } from '@nestjs/common';
import type {
  Category,
  Transaction,
  TransactionsPage,
  TransactionSummary,
} from '@expense-tracker/types';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson } from '@tests/setup/http';
import {
  clearTransactions,
  disconnectDatabase,
  resetDatabase,
} from '@tests/setup/prisma';

let app: INestApplication;
let user: TestUser;
let categoryId: string;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase();
  // Registration hashes a password over HTTP; once per file is enough, since
  // these tests only ever add transactions.
  user = await registerUser(app);
  const categories = await expectJson<Category[]>(
    request(app.getHttpServer())
      .get('/categories')
      .set(...bearer(user))
  );
  categoryId = categories[0]!.id;
});

beforeEach(async () => {
  await clearTransactions();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());

/** ValidationPipe answers 400 with `message` as a list of violated rules. */
function expectRule(response: { status: number; body: unknown }, rule: string) {
  expect(response.status).toBe(400);
  const { message } = response.body as { message: string | string[] };
  const messages = Array.isArray(message) ? message : [message];
  expect(messages.some((m) => m.includes(rule))).toBe(true);
}

const validBody = () => ({
  amount: 12.5,
  currency: 'RSD',
  type: 'EXPENSE',
  date: '2026-09-10T00:00:00.000Z',
  categoryId,
});

describe('authentication', () => {
  it.each([
    ['GET', '/transactions'],
    ['GET', '/transactions/summary'],
    ['POST', '/transactions'],
    ['GET', '/categories'],
  ])('%s %s without a token is 401', async (method, url) => {
    const response =
      await server()[method.toLowerCase() as 'get' | 'post'](url);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Missing access token');
  });

  it('rejects a token that is not a valid access token', async () => {
    const response = await server()
      .get('/transactions')
      .set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid access token');
  });

  it('rejects a refresh token used as an access token', async () => {
    const response = await server()
      .get('/transactions')
      .set('Authorization', `Bearer ${user.refreshToken}`);

    expect(response.status).toBe(401);
  });

  it('rejects a non-Bearer scheme', async () => {
    const response = await server()
      .get('/transactions')
      .set('Authorization', `Basic ${user.accessToken}`);

    expect(response.status).toBe(401);
  });
});

describe('GET /transactions query validation', () => {
  const list = (query: string) =>
    server()
      .get(`/transactions${query}`)
      .set(...bearer(user));

  const listOk = (query: string) => expectJson<TransactionsPage>(list(query));

  it('returns a paginated envelope with defaults', async () => {
    expect(await listOk('')).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      currency: 'RSD',
      ratesDate: null,
    });
  });

  it.each(['RSD', 'EUR', 'HUF'])('accepts currency=%s', async (currency) => {
    expect((await listOk(`?currency=${currency}`)).currency).toBe(currency);
  });

  it.each(['USD', 'eur', ''])('rejects currency=%s', async (currency) => {
    expectRule(await list(`?currency=${currency}`), 'currency must be one of');
  });

  it.each([10, 20, 50])('accepts pageSize=%i', async (pageSize) => {
    expect((await listOk(`?pageSize=${pageSize}`)).pageSize).toBe(pageSize);
  });

  it.each(['15', '0', '100', 'abc', '-10'])(
    'rejects pageSize=%s',
    async (pageSize) => {
      expectRule(
        await list(`?pageSize=${pageSize}`),
        'pageSize must be one of'
      );
    }
  );

  it.each(['0', '-1', 'abc', '1.5'])('rejects page=%s', async (page) => {
    expect((await list(`?page=${page}`)).status).toBe(400);
  });

  it.each(['1000001', '99999999999'])(
    'rejects an oversized page (%s) instead of failing with a 500',
    async (page) => {
      expect((await list(`?page=${page}`)).status).toBe(400);
    }
  );

  it('accepts the last allowed page', async () => {
    expect((await listOk('?page=1000000')).items).toEqual([]);
  });

  it.each(['2026-02-30', 'yesterday', '09/10/2026'])(
    'rejects dateFrom=%s',
    async (date) => {
      expect((await list(`?dateFrom=${encodeURIComponent(date)}`)).status).toBe(
        400
      );
    }
  );

  it('rejects dateFrom after dateTo', async () => {
    const response = await list(
      '?dateFrom=2026-10-01T00:00:00.000Z&dateTo=2026-09-01T00:00:00.000Z'
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('dateFrom must not be after dateTo');
  });

  it('rejects an unknown type', async () => {
    expectRule(await list('?type=TRANSFER'), 'type must be one of');
  });

  it('rejects unknown query parameters', async () => {
    expectRule(await list('?sort=asc'), 'property sort should not exist');
  });
});

describe('GET /transactions/summary query validation', () => {
  const summary = (query: string) =>
    server()
      .get(`/transactions/summary${query}`)
      .set(...bearer(user));

  const summaryOk = (query: string) =>
    expectJson<TransactionSummary>(summary(query));

  it('defaults to the whole current UTC month', async () => {
    const before = new Date();
    const response = await summary('');
    const after = new Date();

    expect(response.status).toBe(200);
    const dateFrom = new Date(response.body.dateFrom);
    const dateTo = new Date(response.body.dateTo);
    // Asserted against the response itself, so a run that crosses midnight on
    // the 1st can't fail: "now" must simply fall inside the month returned.
    expect(dateFrom.toISOString()).toBe(
      new Date(
        Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1)
      ).toISOString()
    );
    expect(dateTo.toISOString()).toBe(
      new Date(
        Date.UTC(
          dateFrom.getUTCFullYear(),
          dateFrom.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      ).toISOString()
    );
    expect(dateFrom.getTime()).toBeLessThanOrEqual(before.getTime());
    expect(dateTo.getTime()).toBeGreaterThanOrEqual(after.getTime());
    expect(response.body).toMatchObject({
      totalIncome: '0.00',
      totalExpense: '0.00',
      balance: '0.00',
      byCategory: [],
    });
  });

  it('accepts month with year', async () => {
    expect(await summaryOk('?month=9&year=2026')).toMatchObject({
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
    });
  });

  it('accepts an explicit date range', async () => {
    const result = await summaryOk(
      '?dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-10T23:59:59.999Z'
    );

    expect(result.dateTo).toBe('2026-09-10T23:59:59.999Z');
  });

  it.each([
    ['month without year', '?month=9'],
    ['year without month', '?year=2026'],
    ['month out of range', '?month=13&year=2026'],
    [
      'month/year mixed with a range',
      '?month=9&year=2026&dateFrom=2026-09-01T00:00:00.000Z',
    ],
    ['a one-sided range (dateFrom only)', '?dateFrom=2026-09-01T00:00:00.000Z'],
    ['a one-sided range (dateTo only)', '?dateTo=2026-09-30T00:00:00.000Z'],
    [
      'an inverted range',
      '?dateFrom=2026-10-01T00:00:00.000Z&dateTo=2026-09-01T00:00:00.000Z',
    ],
    ['an unknown parameter', '?foo=1'],
    ['an unsupported currency', '?currency=USD'],
  ])('rejects %s', async (_label, query) => {
    expect((await summary(query)).status).toBe(400);
  });
});

describe('POST /transactions body validation', () => {
  const create = (body: Record<string, unknown>) =>
    server()
      .post('/transactions')
      .set(...bearer(user))
      .send(body);

  it('creates a transaction and returns it without internal fields', async () => {
    const response = await create(validBody());

    expect(response.status).toBe(201);
    expect(response.body as Transaction).toMatchObject({
      amount: '12.50',
      currency: 'RSD',
      type: 'EXPENSE',
      description: null,
      categoryId,
    });
    expect(response.body).not.toHaveProperty('userId');
  });

  it('requires a currency', async () => {
    const { currency: _omitted, ...withoutCurrency } = validBody();

    expectRule(await create(withoutCurrency), 'currency must be one of');
  });

  it.each(['USD', 'eur', 42])('rejects currency=%s', async (currency) => {
    expectRule(
      await create({ ...validBody(), currency }),
      'currency must be one of'
    );
  });

  it.each(['EUR', 'HUF'])('stores currency=%s as sent', async (currency) => {
    const response = await create({ ...validBody(), currency });

    expect(response.status).toBe(201);
    expect(response.body.currency).toBe(currency);
  });

  it('rejects an amount sent as a string', async () => {
    expectRule(
      await create({ ...validBody(), amount: '12.50' }),
      'amount must be a number'
    );
  });

  it.each([0, -5, 1.234, 10_000_000_000])(
    'rejects amount=%s',
    async (amount) => {
      expect((await create({ ...validBody(), amount })).status).toBe(400);
    }
  );

  it('accepts the largest allowed amount', async () => {
    const response = await create({ ...validBody(), amount: 9_999_999_999.99 });

    expect(response.status).toBe(201);
    expect(response.body.amount).toBe('9999999999.99');
  });

  it('rejects an unknown type', async () => {
    expect((await create({ ...validBody(), type: 'TRANSFER' })).status).toBe(
      400
    );
  });

  it.each(['2026-02-30', 'tomorrow', ''])('rejects date=%s', async (date) => {
    expect((await create({ ...validBody(), date })).status).toBe(400);
  });

  it('requires a category', async () => {
    const { categoryId: _omitted, ...withoutCategory } = validBody();

    expect((await create(withoutCategory)).status).toBe(400);
  });

  it('rejects a description over 255 characters', async () => {
    const response = await create({
      ...validBody(),
      description: 'a'.repeat(256),
    });

    expect(response.status).toBe(400);
  });

  it('rejects fields the API does not know', async () => {
    expectRule(
      await create({ ...validBody(), userId: 'someone-else' }),
      'property userId should not exist'
    );
  });

  it('answers 404 for a category that does not exist', async () => {
    const response = await create({ ...validBody(), categoryId: 'missing' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Category not found');
  });
});

describe('PATCH /transactions/:id body validation', () => {
  async function createOne() {
    const response = await server()
      .post('/transactions')
      .set(...bearer(user))
      .send({ ...validBody(), description: 'Lunch' });
    return response.body.id as string;
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    server()
      .patch(`/transactions/${id}`)
      .set(...bearer(user))
      .send(body);

  it('updates only the fields that are sent', async () => {
    const id = await createOne();

    const response = await patch(id, { amount: 99.99 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      amount: '99.99',
      description: 'Lunch',
    });
  });

  it('clears the description with null', async () => {
    const id = await createOne();

    const response = await patch(id, { description: null });

    expect(response.status).toBe(200);
    expect(response.body.description).toBeNull();
  });

  it('changes the currency without converting the amount', async () => {
    const id = await createOne();

    const response = await patch(id, { currency: 'EUR' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ amount: '12.50', currency: 'EUR' });
  });

  it.each(['amount', 'currency', 'type', 'date', 'categoryId'])(
    'rejects null for %s',
    async (field) => {
      const id = await createOne();

      expect((await patch(id, { [field]: null })).status).toBe(400);
    }
  );

  it('answers 404 for an unknown id', async () => {
    expect(
      (await patch('00000000-0000-4000-8000-000000000000', { amount: 1 }))
        .status
    ).toBe(404);
  });
});
