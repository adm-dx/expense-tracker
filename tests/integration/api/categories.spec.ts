import { INestApplication } from '@nestjs/common';
import type { Category } from '@expense-tracker/types';
import { CategoriesRepository } from '@api/modules/categories/categories.repository';
import { DEFAULT_CATEGORIES } from '@api/modules/categories/default-categories';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson } from '@tests/setup/http';
import { disconnectDatabase, prisma, resetDatabase } from '@tests/setup/prisma';
import { seedTransaction } from '@tests/setup/seed';

let app: INestApplication;
let user: TestUser;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());
const as = (u: TestUser) => bearer(u);

function listCategories(u: TestUser, query = '') {
  return expectJson<Category[]>(
    server()
      .get(`/categories${query}`)
      .set(...as(u))
  );
}

describe('default categories', () => {
  it('are created for a new user, exactly as defined', async () => {
    const categories = await listCategories(user);

    expect(categories.map((c) => c.name).sort()).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.name).sort()
    );
    for (const expected of DEFAULT_CATEGORIES) {
      expect(categories.find((c) => c.name === expected.name)).toMatchObject({
        color: expected.color,
        icon: expected.icon,
      });
    }
  });

  it('are separate per user', async () => {
    const second = await registerUser(app);

    const first = await listCategories(user);
    const other = await listCategories(second);

    expect(first).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(other).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(first.filter((c) => other.some((o) => o.id === c.id))).toEqual([]);
  });

  it('are listed by name', async () => {
    const names = (await listCategories(user)).map((c) => c.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  describe('createMany', () => {
    const rows = (userId: string) =>
      DEFAULT_CATEGORIES.map((c) => ({ userId, ...c }));

    it('is idempotent: running it again adds nothing', async () => {
      const repository = app.get(CategoriesRepository, { strict: false });

      await repository.createMany(rows(user.id));
      await repository.createMany(rows(user.id));

      expect(await prisma.category.count({ where: { userId: user.id } })).toBe(
        DEFAULT_CATEGORIES.length
      );
    });

    it('fills in only what is missing and keeps what the user changed', async () => {
      const repository = app.get(CategoriesRepository, { strict: false });
      const food = (await listCategories(user)).find((c) => c.name === 'Food');
      await server()
        .patch(`/categories/${food?.id}`)
        .set(...as(user))
        .send({ color: '#000000' });
      await prisma.category.deleteMany({
        where: { userId: user.id, name: 'Other' },
      });

      await repository.createMany(rows(user.id));

      const after = await listCategories(user);
      expect(after).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(after.find((c) => c.name === 'Food')?.color).toBe('#000000');
      expect(after.some((c) => c.name === 'Other')).toBe(true);
    });
  });
});

describe('POST /categories', () => {
  const create = (u: TestUser, body: Record<string, unknown>) =>
    server()
      .post('/categories')
      .set(...as(u))
      .send(body);

  const valid = { name: 'Pets', color: '#a1b2c3', icon: 'paw-print' };

  it('creates a category and stores the color in upper case', async () => {
    const response = await create(user, valid);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Pets', color: '#A1B2C3' });
    expect(response.body).not.toHaveProperty('userId');
  });

  it('trims the name', async () => {
    const response = await create(user, { ...valid, name: '  Pets  ' });

    expect(response.body.name).toBe('Pets');
  });

  it('answers 409 for a duplicate name', async () => {
    await create(user, valid);

    const response = await create(user, valid);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Category with this name already exists'
    );
  });

  it('conflicts with a default category too', async () => {
    const response = await create(user, { ...valid, name: 'Food' });

    expect(response.status).toBe(409);
  });

  it('lets two users use the same name', async () => {
    const second = await registerUser(app);
    await create(user, valid);

    const response = await create(second, valid);

    expect(response.status).toBe(201);
  });

  it.each([
    ['a non-hex color', { color: '#GGGGGG' }],
    ['a color without #', { color: 'a1b2c3' }],
    ['a short color', { color: '#abc' }],
    ['a non-kebab icon', { icon: 'Paw Print' }],
    ['an empty name', { name: '' }],
    ['a name over 50 characters', { name: 'a'.repeat(51) }],
    ['an unknown field', { userId: 'someone-else' }],
  ])('rejects %s', async (_label, override) => {
    expect((await create(user, { ...valid, ...override })).status).toBe(400);
  });
});

describe('GET /categories', () => {
  it('searches by name, ignoring case', async () => {
    const found = await listCategories(user, '?search=fOo');

    expect(found.map((c) => c.name)).toEqual(['Food']);
  });

  it('returns nothing for a search that matches nothing', async () => {
    expect(await listCategories(user, '?search=zzz')).toEqual([]);
  });

  it('rejects a search term over 50 characters', async () => {
    const response = await server()
      .get(`/categories?search=${'a'.repeat(51)}`)
      .set(...as(user));

    expect(response.status).toBe(400);
  });
});

describe('PATCH /categories/:id', () => {
  it('answers 409 when renaming onto an existing name', async () => {
    const categories = await listCategories(user);
    const food = categories.find((c) => c.name === 'Food');

    const response = await server()
      .patch(`/categories/${food?.id}`)
      .set(...as(user))
      .send({ name: 'Health' });

    expect(response.status).toBe(409);
  });

  it('renaming a category to its own name is fine', async () => {
    const categories = await listCategories(user);
    const food = categories.find((c) => c.name === 'Food');

    const response = await server()
      .patch(`/categories/${food?.id}`)
      .set(...as(user))
      .send({ name: 'Food', color: '#123456' });

    expect(response.status).toBe(200);
    expect(response.body.color).toBe('#123456');
  });
});

describe('DELETE /categories/:id', () => {
  async function foodId() {
    return (await listCategories(user)).find((c) => c.name === 'Food')
      ?.id as string;
  }

  it('deletes a category that has no transactions', async () => {
    const id = await foodId();

    const response = await server()
      .delete(`/categories/${id}`)
      .set(...as(user));

    expect(response.status).toBe(204);
    expect((await listCategories(user)).some((c) => c.id === id)).toBe(false);
  });

  it('refuses to delete a category that has transactions (409) and keeps it', async () => {
    const id = await foodId();
    await seedTransaction({ userId: user.id, categoryId: id });

    const response = await server()
      .delete(`/categories/${id}`)
      .set(...as(user));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Category has transactions and cannot be deleted'
    );
    expect((await listCategories(user)).some((c) => c.id === id)).toBe(true);
  });

  it('can be deleted once its last transaction is gone', async () => {
    const id = await foodId();
    const transaction = await seedTransaction({
      userId: user.id,
      categoryId: id,
    });
    await server()
      .delete(`/transactions/${transaction.id}`)
      .set(...as(user))
      .expect(204);

    const response = await server()
      .delete(`/categories/${id}`)
      .set(...as(user));

    expect(response.status).toBe(204);
  });
});
