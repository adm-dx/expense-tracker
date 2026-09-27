import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_USER_SETTINGS,
  type RemoveCurrencyResult,
  type ReplaceUserSettingsRequest,
  type TransactionsPage,
  type UserSettings,
} from '@expense-tracker/types';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson, expectStatus } from '@tests/setup/http';
import { disconnectDatabase, prisma, resetDatabase } from '@tests/setup/prisma';
import { seedCategory, seedTransaction } from '@tests/setup/seed';

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

// A `PUT` body: `currencies` has its own endpoints.
const CUSTOM: ReplaceUserSettingsRequest = {
  theme: 'dark',
  colorScheme: 'violet',
  currency: 'EUR',
  location: { mode: 'manual', name: 'Novi Sad, RS', lat: 45.25, lon: 19.84 },
};

const CUSTOM_SETTINGS: UserSettings = {
  ...CUSTOM,
  currencies: [...DEFAULT_CURRENCIES],
};

function getSettings(u: TestUser = user) {
  return expectJson<UserSettings>(
    server()
      .get('/settings')
      .set(...bearer(u))
  );
}

function patchSettings(body: object, status = 200) {
  return expectJson<UserSettings>(
    server()
      .patch('/settings')
      .set(...bearer(user))
      .send(body),
    status
  );
}

function putSettings(body: object, status = 200) {
  return expectJson<UserSettings>(
    server()
      .put('/settings')
      .set(...bearer(user))
      .send(body),
    status
  );
}

function storedDocument(userId = user.id) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

async function storedSettings(userId = user.id) {
  return (await storedDocument(userId))?.settings;
}

describe('/settings', () => {
  it.each(['get', 'put', 'patch', 'delete'] as const)(
    '%s requires a token',
    async (method) => {
      await expectStatus(server()[method]('/settings'), 401);
    }
  );
});

describe('default settings', () => {
  it('are stored for every new user on registration', async () => {
    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
    await expect(getSettings()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it('are system theme, RSD and the weather for Belgrade', () => {
    expect(DEFAULT_USER_SETTINGS).toEqual({
      theme: 'system',
      colorScheme: 'slate',
      currency: 'RSD',
      currencies: ['RSD', 'EUR', 'HUF'],
      location: {
        mode: 'manual',
        name: 'Belgrade, RS',
        lat: 44.82,
        lon: 20.46,
      },
    });
  });

  it('are still returned for a user whose row is missing', async () => {
    await prisma.userSettings.delete({ where: { userId: user.id } });

    await expect(getSettings()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  describe('backfill migration', () => {
    const backfill = readFileSync(
      join(
        __dirname,
        '../../../apps/api/prisma/migrations/20260927181113_backfill_default_settings/migration.sql'
      ),
      'utf8'
    );

    it('gives existing users without settings the defaults', async () => {
      const other = await registerUser(app);
      await prisma.userSettings.deleteMany();

      await prisma.$executeRawUnsafe(backfill);

      // It predates `currencies`, which a missing key reads as the default.
      const { currencies: _currencies, ...backfilled } = DEFAULT_USER_SETTINGS;
      expect(await storedSettings()).toEqual(backfilled);
      expect(await storedSettings(other.id)).toEqual(backfilled);
      await expect(getSettings(other)).resolves.toEqual(DEFAULT_USER_SETTINGS);
    });

    it('leaves settings a user already saved alone', async () => {
      await putSettings(CUSTOM);

      await prisma.$executeRawUnsafe(backfill);

      expect(await storedSettings()).toEqual(CUSTOM_SETTINGS);
    });
  });
});

describe('GET /settings', () => {
  it('falls back to the default for anything in the row it cannot read', async () => {
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        settings: { theme: 'sepia', colorScheme: 'rose', legacyFlag: true },
      },
    });

    await expect(getSettings()).resolves.toEqual({
      ...DEFAULT_USER_SETTINGS,
      colorScheme: 'rose',
    });
  });
});

describe('PUT /settings', () => {
  it('stores the whole document and returns it', async () => {
    await expect(putSettings(CUSTOM)).resolves.toEqual(CUSTOM_SETTINGS);

    await expect(getSettings()).resolves.toEqual(CUSTOM_SETTINGS);
    expect((await storedDocument())?.settings).toEqual(CUSTOM_SETTINGS);
  });

  it('replaces an earlier document', async () => {
    await putSettings(CUSTOM);
    const { currencies: _currencies, ...defaults } = DEFAULT_USER_SETTINGS;

    await expect(putSettings({ ...defaults, theme: 'light' })).resolves.toEqual(
      { ...DEFAULT_USER_SETTINGS, theme: 'light' }
    );
  });

  it('rejects currencies, which it cannot change', async () => {
    await putSettings({ ...CUSTOM, currencies: ['RSD'] }, 400);
  });

  it('rejects a display currency the user has not enabled', async () => {
    await putSettings({ ...CUSTOM, currency: 'GBP' }, 400);

    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('requires every key', async () => {
    const { location: _location, ...withoutLocation } = CUSTOM;

    await putSettings(withoutLocation, 400);
    await putSettings({ theme: 'dark' }, 400);

    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });
});

describe('PATCH /settings', () => {
  it('changes only the given keys', async () => {
    await putSettings(CUSTOM);

    await expect(patchSettings({ currency: 'HUF' })).resolves.toEqual({
      ...CUSTOM_SETTINGS,
      currency: 'HUF',
    });
  });

  it('starts a new user from the defaults', async () => {
    await expect(patchSettings({ theme: 'dark' })).resolves.toEqual({
      ...DEFAULT_USER_SETTINGS,
      theme: 'dark',
    });
  });

  it('replaces the location as a whole', async () => {
    await putSettings(CUSTOM);

    const settings = await patchSettings({ location: { mode: 'auto' } });

    expect(settings.location).toEqual({ mode: 'auto' });
    expect((await storedDocument())?.settings).toMatchObject({
      location: { mode: 'auto' },
    });
  });

  it('rounds the coordinates and trims the name of a chosen place', async () => {
    const settings = await patchSettings({
      location: {
        mode: 'manual',
        name: ' Subotica, RS ',
        lat: 46.100472,
        lon: 19.667611,
      },
    });

    expect(settings.location).toEqual({
      mode: 'manual',
      name: 'Subotica, RS',
      lat: 46.1,
      lon: 19.67,
    });
  });

  it('accepts an empty body', async () => {
    await expect(patchSettings({})).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it.each([
    ['an unknown theme', { theme: 'sepia' }],
    ['an unknown color scheme', { colorScheme: 'teal' }],
    ['an unknown currency', { currency: 'XYZ' }],
    ['a currency the user has not enabled', { currency: 'USD' }],
    ['the currency list', { currencies: ['RSD'] }],
    ['a location that is not an object', { location: 'Belgrade' }],
    ['an unknown location mode', { location: { mode: 'gps' } }],
    [
      'a chosen place without coordinates',
      { location: { mode: 'manual', name: 'Belgrade' } },
    ],
    [
      'a chosen place without a name',
      { location: { mode: 'manual', lat: 1, lon: 1 } },
    ],
    [
      'a latitude out of range',
      { location: { mode: 'manual', name: 'X', lat: 91, lon: 0 } },
    ],
    [
      'a longitude out of range',
      { location: { mode: 'manual', name: 'X', lat: 0, lon: 181 } },
    ],
    [
      'coordinates as strings',
      { location: { mode: 'manual', name: 'X', lat: '45', lon: '19' } },
    ],
    [
      'a name that is too long',
      { location: { mode: 'manual', name: 'x'.repeat(101), lat: 0, lon: 0 } },
    ],
    ['an unknown key', { fontSize: 14 }],
    ['an unknown key in the location', { location: { mode: 'auto', zoom: 3 } }],
  ])('rejects %s with 400 and changes nothing', async (_label, body) => {
    await patchSettings(body, 400);

    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });
});

describe('DELETE /settings', () => {
  it('keeps the enabled currencies', async () => {
    await addCurrency('GBP');
    await patchSettings({ currency: 'GBP' });

    const settings = await expectJson<UserSettings>(
      server()
        .delete('/settings')
        .set(...bearer(user))
    );

    expect(settings).toEqual({
      ...DEFAULT_USER_SETTINGS,
      currencies: ['RSD', 'EUR', 'HUF', 'GBP'],
    });
  });

  it('resets to the defaults and stores them', async () => {
    await putSettings(CUSTOM);

    await expect(
      expectJson<UserSettings>(
        server()
          .delete('/settings')
          .set(...bearer(user))
      )
    ).resolves.toEqual(DEFAULT_USER_SETTINGS);
    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
    await expect(getSettings()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it('recreates a missing row', async () => {
    await prisma.userSettings.delete({ where: { userId: user.id } });

    await expect(
      expectJson<UserSettings>(
        server()
          .delete('/settings')
          .set(...bearer(user))
      )
    ).resolves.toEqual(DEFAULT_USER_SETTINGS);
    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });
});

describe('settings per user', () => {
  it('are kept apart', async () => {
    const other = await registerUser(app);
    await putSettings(CUSTOM);

    await expect(getSettings(other)).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it('are deleted with their user', async () => {
    await putSettings(CUSTOM);

    await prisma.user.delete({ where: { id: user.id } });

    await expect(storedDocument()).resolves.toBeNull();
  });
});

function addCurrency(code: unknown, status = 200) {
  return expectJson<UserSettings>(
    server()
      .post('/settings/currencies')
      .set(...bearer(user))
      .send({ code }),
    status
  );
}

function removeCurrency(code: string, status = 200) {
  return expectJson<RemoveCurrencyResult>(
    server()
      .delete(`/settings/currencies/${code}`)
      .set(...bearer(user)),
    status
  );
}

describe('/settings/currencies', () => {
  it('requires a token', async () => {
    await expectStatus(server().post('/settings/currencies'), 401);
    await expectStatus(server().delete('/settings/currencies/EUR'), 401);
  });
});

describe('POST /settings/currencies', () => {
  it('appends the currency and stores it', async () => {
    const settings = await addCurrency('GBP');

    expect(settings.currencies).toEqual(['RSD', 'EUR', 'HUF', 'GBP']);
    expect(await storedSettings()).toMatchObject({
      currencies: ['RSD', 'EUR', 'HUF', 'GBP'],
    });
  });

  it('changes nothing for a currency that is already enabled', async () => {
    await expect(addCurrency('EUR')).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it.each([['XYZ'], ['eur'], [42], [undefined]])(
    'rejects %p with 400',
    async (code) => {
      await addCurrency(code, 400);

      expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
    }
  );
});

describe('DELETE /settings/currencies/:code', () => {
  it('drops a currency without transactions', async () => {
    await expect(removeCurrency('HUF')).resolves.toEqual({
      settings: { ...DEFAULT_USER_SETTINGS, currencies: ['RSD', 'EUR'] },
      convertedCount: 0,
    });
  });

  it('converts the transactions in it to RSD at the day rates', async () => {
    const category = await seedCategory(user.id);
    // Fake rates: 1 EUR = 100 RSD = 400 HUF.
    const eur = await seedTransaction({
      userId: user.id,
      categoryId: category.id,
      amount: '12.34',
      currency: 'EUR',
    });
    const huf = await seedTransaction({
      userId: user.id,
      categoryId: category.id,
      amount: '555.00',
      currency: 'HUF',
    });

    const result = await removeCurrency('HUF');

    expect(result.convertedCount).toBe(1);
    const rows = await prisma.transaction.findMany({
      orderBy: { amount: 'asc' },
    });
    expect(
      rows.map((row) => [row.id, row.amount.toFixed(2), row.currency])
    ).toEqual([
      [eur.id, '12.34', 'EUR'],
      // 555 / 4 = 138.75
      [huf.id, '138.75', 'RSD'],
    ]);
  });

  it('rounds the converted amounts to cents', async () => {
    const category = await seedCategory(user.id);
    // 0.01 HUF = 0.0025 RSD, 1.99 HUF = 0.4975 RSD
    for (const amount of ['0.01', '1.99']) {
      await seedTransaction({
        userId: user.id,
        categoryId: category.id,
        amount,
        currency: 'HUF',
      });
    }

    await removeCurrency('HUF');

    const rows = await prisma.transaction.findMany({
      orderBy: { amount: 'asc' },
    });
    expect(rows.map((row) => row.amount.toFixed(2))).toEqual(['0.00', '0.50']);
  });

  it('switches the display currency to RSD when it is the one removed', async () => {
    await patchSettings({ currency: 'EUR' });

    const { settings } = await removeCurrency('EUR');

    expect(settings.currency).toBe('RSD');
    await expect(getSettings()).resolves.toMatchObject({
      currency: 'RSD',
      currencies: ['RSD', 'HUF'],
    });
  });

  it('then refuses new transactions in it', async () => {
    const category = await seedCategory(user.id);
    await removeCurrency('EUR');

    await expectStatus(
      server()
        .post('/transactions')
        .set(...bearer(user))
        .send({
          amount: 1,
          currency: 'EUR',
          type: 'EXPENSE',
          date: '2026-09-10',
          categoryId: category.id,
        }),
      400
    );
  });

  it('refuses to remove RSD', async () => {
    await removeCurrency('RSD', 400);
  });

  it('rejects an unknown code with 400', async () => {
    await removeCurrency('XYZ', 400);
  });

  it('answers 404 for a currency that is not enabled', async () => {
    await removeCurrency('GBP', 404);
  });

  it('shows the converted amounts in the list', async () => {
    const category = await seedCategory(user.id);
    await seedTransaction({
      userId: user.id,
      categoryId: category.id,
      amount: '10.00',
      currency: 'EUR',
    });

    await removeCurrency('EUR');

    const page = await expectJson<TransactionsPage>(
      server()
        .get('/transactions?currency=RSD')
        .set(...bearer(user))
    );
    expect(page.items[0]).toMatchObject({
      amount: '1000.00',
      currency: 'RSD',
      convertedAmount: '1000.00',
    });
    expect(page.ratesDate).toBeNull();
  });
});
