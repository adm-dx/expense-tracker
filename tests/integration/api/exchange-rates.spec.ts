import { INestApplication } from '@nestjs/common';
import type {
  Category,
  ExchangeRates,
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
import {
  FakeExchangeRatesProvider,
  TEST_RATES,
  TEST_RATES_DATE,
} from '@tests/setup/exchange-rates';
import { expectJson } from '@tests/setup/http';
import {
  clearTransactions,
  disconnectDatabase,
  resetDatabase,
} from '@tests/setup/prisma';

let app: INestApplication;
let provider: FakeExchangeRatesProvider;
let user: TestUser;
let categoryId: string;

beforeAll(async () => {
  provider = new FakeExchangeRatesProvider();
  app = await createTestApp(provider);
  await resetDatabase();
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

function create(amount: number, currency: string, type = 'EXPENSE') {
  return expectJson(
    server()
      .post('/transactions')
      .set(...bearer(user))
      .send({
        amount,
        currency,
        type,
        date: '2026-09-10T00:00:00.000Z',
        categoryId,
      }),
    201
  );
}

const SEPTEMBER =
  '&dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-30T23:59:59.999Z';

describe('GET /exchange-rates', () => {
  it('requires a token', async () => {
    expect((await server().get('/exchange-rates')).status).toBe(401);
  });

  it("returns the provider's rates as decimal strings", async () => {
    const rates = await expectJson<ExchangeRates>(
      server()
        .get('/exchange-rates')
        .set(...bearer(user))
    );

    expect(rates).toEqual({
      base: 'EUR',
      date: TEST_RATES_DATE,
      rates: TEST_RATES,
    });
  });
});

describe('conversion', () => {
  it('converts the table and the summary with the same rates', async () => {
    await create(10, 'EUR'); // 1000 RSD
    await create(400, 'HUF'); // 100 RSD
    await create(50, 'RSD');
    await create(2, 'EUR', 'INCOME'); // 200 RSD

    const page = await expectJson<TransactionsPage>(
      server()
        .get(`/transactions?currency=RSD${SEPTEMBER}`)
        .set(...bearer(user))
    );
    const summary = await expectJson<TransactionSummary>(
      server()
        .get(`/transactions/summary?currency=RSD${SEPTEMBER}`)
        .set(...bearer(user))
    );

    expect(page.ratesDate).toBe(TEST_RATES_DATE);
    expect(
      page.items
        .map((item) => [item.amount, item.currency, item.convertedAmount])
        .sort()
    ).toEqual([
      ['10.00', 'EUR', '1000.00'],
      ['2.00', 'EUR', '200.00'],
      ['400.00', 'HUF', '100.00'],
      ['50.00', 'RSD', '50.00'],
    ]);
    expect(summary).toMatchObject({
      currency: 'RSD',
      ratesDate: TEST_RATES_DATE,
      totalIncome: '200.00',
      totalExpense: '1150.00',
      balance: '-950.00',
    });
  });

  it('converts between two non-base currencies', async () => {
    await create(100, 'RSD'); // 1 EUR = 400 HUF

    const summary = await expectJson<TransactionSummary>(
      server()
        .get(`/transactions/summary?currency=HUF${SEPTEMBER}`)
        .set(...bearer(user))
    );

    expect(summary.totalExpense).toBe('400.00');
  });
});

describe('when the rates provider is down', () => {
  let downApp: INestApplication;

  beforeAll(async () => {
    const down = new FakeExchangeRatesProvider();
    down.failing = true;
    // A fresh app, so there are no rates cached from earlier tests.
    downApp = await createTestApp(down);
  });

  afterAll(async () => {
    await downApp.close();
  });

  const get = (url: string) =>
    request(downApp.getHttpServer())
      .get(url)
      .set(...bearer(user));

  it('still serves a view that needs no conversion', async () => {
    await create(10, 'EUR');

    const page = await expectJson<TransactionsPage>(
      get('/transactions?currency=EUR')
    );

    expect(page).toMatchObject({ total: 1, ratesDate: null });
  });

  it('answers 503 when a conversion is needed', async () => {
    await create(10, 'EUR');

    for (const url of [
      '/transactions?currency=RSD',
      `/transactions/summary?currency=RSD${SEPTEMBER}`,
      '/exchange-rates',
    ]) {
      const response = await get(url);
      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Exchange rates are unavailable');
    }
  });
});
