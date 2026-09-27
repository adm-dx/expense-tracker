import { INestApplication } from '@nestjs/common';
import {
  DEFAULT_USER_SETTINGS,
  type AuthResponse,
  type AuthTokens,
  type Place,
  type TransactionsPage,
  type UserSettings,
} from '@expense-tracker/types';
import { createTestApp, request } from '@tests/setup/app';
import { expectJson, expectStatus } from '@tests/setup/http';
import {
  disconnectDatabase,
  resetDatabase,
  waitForLastLogin,
} from '@tests/setup/prisma';

/**
 * The settings journey the way the web app drives it: sign up with the
 * defaults, pick a theme, a currency and a town found by name, see the
 * choices survive a new sign-in and drive the amounts, change the password
 * on one device and watch the other one lose its session, then reset.
 *
 * Steps share state and run in order.
 */

const EMAIL = 'settings-journey@example.com';
const PASSWORD = 'journey-password';
const NEW_PASSWORD = 'journey-password-2';

let app: INestApplication;
let laptop: AuthTokens;
let phone: AuthTokens;

const server = () => request(app.getHttpServer());
const as = (tokens: AuthTokens) => ({
  Authorization: `Bearer ${tokens.accessToken}`,
});

async function login(password: string): Promise<AuthResponse> {
  const session = await expectJson<AuthResponse>(
    server().post('/auth/login').send({ email: EMAIL, password })
  );
  await waitForLastLogin(session.user.id);
  return session;
}

function getSettings(tokens: AuthTokens) {
  return expectJson<UserSettings>(server().get('/settings').set(as(tokens)));
}

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

describe('user settings journey', () => {
  it('signs up on the laptop and gets the defaults', async () => {
    laptop = await expectJson<AuthResponse>(
      server()
        .post('/auth/register')
        .send({ name: 'Journey', email: EMAIL, password: PASSWORD }),
      201
    );

    await expect(getSettings(laptop)).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it('picks a dark violet theme and EUR', async () => {
    const settings = await expectJson<UserSettings>(
      server()
        .patch('/settings')
        .set(as(laptop))
        .send({ theme: 'dark', colorScheme: 'violet', currency: 'EUR' })
    );

    expect(settings).toEqual({
      ...DEFAULT_USER_SETTINGS,
      theme: 'dark',
      colorScheme: 'violet',
      currency: 'EUR',
    });
  });

  it('finds a town by name and chooses it for the weather', async () => {
    const places = await expectJson<Place[]>(
      server().get('/weather/places?q=Belgrade').set(as(laptop))
    );
    const [belgrade] = places;
    expect(belgrade?.name).toBe('Belgrade, RS');

    const settings = await expectJson<UserSettings>(
      server()
        .patch('/settings')
        .set(as(laptop))
        .send({ location: { mode: 'manual', ...belgrade } })
    );

    expect(settings.location).toEqual({
      mode: 'manual',
      name: 'Belgrade, RS',
      lat: 44.82,
      lon: 20.46,
    });
    await expectStatus(
      server().get('/weather?lat=44.82&lon=20.46').set(as(laptop)),
      200
    );
  });

  it('sees the same settings after signing in on the phone', async () => {
    phone = await login(PASSWORD);

    await expect(getSettings(phone)).resolves.toEqual(
      await getSettings(laptop)
    );
  });

  it('lists amounts in the chosen currency when the app asks for it', async () => {
    const { currency } = await getSettings(phone);

    const page = await expectJson<TransactionsPage>(
      server().get(`/transactions?currency=${currency}`).set(as(phone))
    );

    expect(page.currency).toBe('EUR');
  });

  it('changes the password on the laptop, which stays signed in', async () => {
    laptop = await expectJson<AuthTokens>(
      server()
        .post('/auth/change-password')
        .set(as(laptop))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
    );

    await expectStatus(server().get('/auth/me').set(as(laptop)), 200);
  });

  it('signs the phone out at its next refresh, without hurting the laptop', async () => {
    await expectStatus(
      server()
        .post('/auth/refresh')
        .send({ refreshToken: phone.refreshToken }),
      401
    );

    laptop = await expectJson<AuthTokens>(
      server()
        .post('/auth/refresh')
        .send({ refreshToken: laptop.refreshToken })
    );
    await expectStatus(server().get('/auth/me').set(as(laptop)), 200);
  });

  it('signs in on the phone again with the new password only', async () => {
    await expectStatus(
      server().post('/auth/login').send({ email: EMAIL, password: PASSWORD }),
      401
    );
    phone = await login(NEW_PASSWORD);

    // The password change leaves the settings alone.
    expect((await getSettings(phone)).colorScheme).toBe('violet');
  });

  it('resets the settings, which every device then sees', async () => {
    await expect(
      expectJson<UserSettings>(server().delete('/settings').set(as(phone)))
    ).resolves.toEqual(DEFAULT_USER_SETTINGS);

    await expect(getSettings(laptop)).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });
});
