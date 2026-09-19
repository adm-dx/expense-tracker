import { INestApplication } from '@nestjs/common';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { disconnectDatabase, prisma, resetDatabase } from '@tests/setup/prisma';

let app: INestApplication;
let alice: TestUser;
let bob: TestUser;
let aliceCategoryId: string;
let aliceTransactionId: string;
// Snapshots taken before each attack, to prove nothing changed.
let aliceCategoryBefore: Awaited<ReturnType<typeof prisma.category.findUnique>>;
let aliceTransactionBefore: Awaited<
  ReturnType<typeof prisma.transaction.findUnique>
>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  alice = await registerUser(app);
  bob = await registerUser(app);
  aliceCategoryId = (
    await prisma.category.findFirstOrThrow({ where: { userId: alice.id } })
  ).id;
  const created = await server()
    .post('/transactions')
    .set(...bearer(alice))
    .send({
      amount: 250,
      type: 'EXPENSE',
      date: '2026-09-10T00:00:00.000Z',
      categoryId: aliceCategoryId,
    })
    .expect(201);
  aliceTransactionId = created.body.id;
  aliceCategoryBefore = await prisma.category.findUniqueOrThrow({
    where: { id: aliceCategoryId },
  });
  aliceTransactionBefore = await prisma.transaction.findUniqueOrThrow({
    where: { id: aliceTransactionId },
  });
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());

type Verb = 'get' | 'patch' | 'delete';

/** Sends `verb` to `url` as Bob, with a body only where one makes sense. */
function attempt(verb: Verb, url: string, body?: Record<string, unknown>) {
  const agent = server();
  const test = agent[verb](url).set(...bearer(bob));
  return body ? test.send(body) : test;
}

describe("one user can't reach another user's data", () => {
  it("doesn't list it", async () => {
    const transactions = await server()
      .get('/transactions')
      .set(...bearer(bob));
    const categories = await server()
      .get('/categories')
      .set(...bearer(bob));

    expect(transactions.body).toMatchObject({ items: [], total: 0 });
    expect(
      categories.body.some((c: { id: string }) => c.id === aliceCategoryId)
    ).toBe(false);
  });

  it("doesn't count it in the summary", async () => {
    const response = await server()
      .get('/transactions/summary?month=9&year=2026')
      .set(...bearer(bob));

    expect(response.body).toMatchObject({
      totalExpense: '0.00',
      balance: '0.00',
      byCategory: [],
    });
  });

  it.each([
    ['reading', 'get'],
    ['updating', 'patch'],
    ['deleting', 'delete'],
  ] as const)(
    "answers 404 (not 403) when %s someone else's transaction",
    async (_label, method) => {
      // 404 rather than 403, so the id's existence isn't revealed.
      const response = await attempt(
        method,
        `/transactions/${aliceTransactionId}`,
        method === 'patch' ? { amount: 1 } : undefined
      );

      expect(response.status).toBe(404);
      // The row must be byte-for-byte what it was: a 404 that still wrote
      // (or deleted) would otherwise slip through.
      const after = await prisma.transaction.findUnique({
        where: { id: aliceTransactionId },
      });
      expect(after).not.toBeNull();
      expect(after).toEqual(aliceTransactionBefore);
    }
  );

  it.each([
    ['reading', 'get'],
    ['updating', 'patch'],
    ['deleting', 'delete'],
  ] as const)(
    "answers 404 when %s someone else's category",
    async (_label, method) => {
      const response = await attempt(
        method,
        `/categories/${aliceCategoryId}`,
        method === 'patch' ? { name: 'Hijacked' } : undefined
      );

      expect(response.status).toBe(404);
      const after = await prisma.category.findUnique({
        where: { id: aliceCategoryId },
      });
      expect(after).not.toBeNull();
      expect(after).toEqual(aliceCategoryBefore);
    }
  );

  it("can't file a transaction under someone else's category", async () => {
    const response = await server()
      .post('/transactions')
      .set(...bearer(bob))
      .send({
        amount: 1,
        type: 'EXPENSE',
        date: '2026-09-10T00:00:00.000Z',
        categoryId: aliceCategoryId,
      });

    expect(response.status).toBe(404);
  });

  it("can't move their own transaction into someone else's category", async () => {
    const bobCategoryId = (
      await prisma.category.findFirstOrThrow({ where: { userId: bob.id } })
    ).id;
    const own = await server()
      .post('/transactions')
      .set(...bearer(bob))
      .send({
        amount: 1,
        type: 'EXPENSE',
        date: '2026-09-10T00:00:00.000Z',
        categoryId: bobCategoryId,
      })
      .expect(201);

    const response = await server()
      .patch(`/transactions/${own.body.id}`)
      .set(...bearer(bob))
      .send({ categoryId: aliceCategoryId });

    expect(response.status).toBe(404);
  });

  it("leaves the owner's data untouched", async () => {
    const response = await server()
      .get('/transactions')
      .set(...bearer(alice));

    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      id: aliceTransactionId,
      amount: '250.00',
    });
  });
});
