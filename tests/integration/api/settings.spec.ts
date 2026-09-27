import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import {
  DEFAULT_USER_SETTINGS,
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

const CUSTOM: UserSettings = {
  theme: 'dark',
  colorScheme: 'violet',
  currency: 'EUR',
  location: { mode: 'manual', name: 'Novi Sad, RS', lat: 45.25, lon: 19.84 },
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
      location: { mode: 'manual', name: 'Belgrade, RS', lat: 44.82, lon: 20.46 },
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

      expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
      expect(await storedSettings(other.id)).toEqual(DEFAULT_USER_SETTINGS);
    });

    it('leaves settings a user already saved alone', async () => {
      await putSettings(CUSTOM);

      await prisma.$executeRawUnsafe(backfill);

      expect(await storedSettings()).toEqual(CUSTOM);
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
    await expect(putSettings(CUSTOM)).resolves.toEqual(CUSTOM);

    await expect(getSettings()).resolves.toEqual(CUSTOM);
    expect((await storedDocument())?.settings).toEqual(CUSTOM);
  });

  it('replaces an earlier document', async () => {
    await putSettings(CUSTOM);
    const next: UserSettings = { ...DEFAULT_USER_SETTINGS, theme: 'light' };

    await expect(putSettings(next)).resolves.toEqual(next);
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
      ...CUSTOM,
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
    ['an unsupported currency', { currency: 'USD' }],
    ['a location that is not an object', { location: 'Belgrade' }],
    ['an unknown location mode', { location: { mode: 'gps' } }],
    ['a chosen place without coordinates', { location: { mode: 'manual', name: 'Belgrade' } }],
    ['a chosen place without a name', { location: { mode: 'manual', lat: 1, lon: 1 } }],
    ['a latitude out of range', { location: { mode: 'manual', name: 'X', lat: 91, lon: 0 } }],
    ['a longitude out of range', { location: { mode: 'manual', name: 'X', lat: 0, lon: 181 } }],
    ['coordinates as strings', { location: { mode: 'manual', name: 'X', lat: '45', lon: '19' } }],
    ['a name that is too long', { location: { mode: 'manual', name: 'x'.repeat(101), lat: 0, lon: 0 } }],
    ['an unknown key', { fontSize: 14 }],
    ['an unknown key in the location', { location: { mode: 'auto', zoom: 3 } }],
  ])('rejects %s with 400 and changes nothing', async (_label, body) => {
    await patchSettings(body, 400);

    expect(await storedSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });
});

describe('DELETE /settings', () => {
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
