import { INestApplication } from '@nestjs/common';
import {
  bearer,
  createTestApp,
  DEFAULT_PASSWORD,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  waitForLastLogin,
} from '@tests/setup/prisma';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());
/** Same shape and claims, but the signature no longer matches. */
function tamper(jwt: string): string {
  const last = jwt.slice(-1) === 'A' ? 'B' : 'A';
  return jwt.slice(0, -1) + last;
}

const post = (path: string, body: Record<string, unknown>) =>
  server().post(path).send(body);

describe('POST /auth/register', () => {
  const valid = {
    name: 'Jane',
    email: 'jane@example.com',
    password: 'super-secret',
  };

  it('returns tokens and a public user, never the password hash', async () => {
    const response = await post('/auth/register', valid);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      user: { email: 'jane@example.com', name: 'Jane', isActive: true },
    });
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|super-secret/
    );
  });

  it('stores a hash rather than the password', async () => {
    await post('/auth/register', valid);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: valid.email },
    });

    expect(stored.passwordHash).not.toBe(valid.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('gives the new user their default categories', async () => {
    const response = await post('/auth/register', valid);

    expect(
      await prisma.category.count({ where: { userId: response.body.user.id } })
    ).toBe(8);
  });

  it('answers 409 for a duplicate email', async () => {
    await post('/auth/register', valid);

    const response = await post('/auth/register', {
      ...valid,
      name: 'Someone else',
    });

    expect(response.status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ['an invalid email', { email: 'not-an-email' }],
    ['a password under 8 characters', { password: 'short' }],
    ['a password over 72 characters', { password: 'a'.repeat(73) }],
    ['an empty name', { name: '' }],
    ['an unknown field', { isActive: false }],
  ])('rejects %s', async (_label, override) => {
    const response = await post('/auth/register', { ...valid, ...override });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('POST /auth/login', () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await registerUser(app);
  });

  it('returns tokens for valid credentials', async () => {
    const response = await post('/auth/login', {
      email: user.email,
      password: user.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.id);
    expect(typeof response.body.accessToken).toBe('string');
    await waitForLastLogin(user.id);
  });

  it('records the login time', async () => {
    await post('/auth/login', {
      email: user.email,
      password: user.password,
    }).expect(200);

    const lastLoginAt = await waitForLastLogin(user.id);
    expect(lastLoginAt).toBeInstanceOf(Date);
  });

  it('answers the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await post('/auth/login', {
      email: user.email,
      password: 'wrong-pass',
    });
    const unknownEmail = await post('/auth/login', {
      email: 'ghost@example.com',
      password: DEFAULT_PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('refuses a deactivated account even with the right password', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const response = await post('/auth/login', {
      email: user.email,
      password: user.password,
    });

    expect(response.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the signed-in user', async () => {
    const user = await registerUser(app);

    const response = await server()
      .get('/auth/me')
      .set(...bearer(user));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: user.id, email: user.email });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('is 401 when the user has been deleted since the token was issued', async () => {
    const user = await registerUser(app);
    await prisma.user.delete({ where: { id: user.id } });

    const response = await server()
      .get('/auth/me')
      .set(...bearer(user));

    expect(response.status).toBe(401);
  });
});

describe('refresh tokens', () => {
  const refresh = (refreshToken: string) =>
    post('/auth/refresh', { refreshToken });

  it('issues a new pair that works', async () => {
    const user = await registerUser(app);

    const response = await refresh(user.refreshToken);

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).not.toBe(user.refreshToken);
    await server()
      .get('/auth/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    await refresh(response.body.refreshToken).expect(200);
  });

  it('rotates: the old refresh token stops working', async () => {
    const user = await registerUser(app);
    await refresh(user.refreshToken).expect(200);

    const reuse = await refresh(user.refreshToken);

    expect(reuse.status).toBe(401);
  });

  it('treats reuse of a rotated token as theft and revokes the whole family', async () => {
    const user = await registerUser(app);
    const rotated = await refresh(user.refreshToken).expect(200);

    await refresh(user.refreshToken).expect(401); // the attacker replays the old token
    const legitimate = await refresh(rotated.body.refreshToken); // the real user's new token

    expect(legitimate.status).toBe(401);
  });

  it("revokes only that user's tokens", async () => {
    const victim = await registerUser(app);
    const bystander = await registerUser(app);
    const rotated = await refresh(victim.refreshToken).expect(200);
    await refresh(victim.refreshToken).expect(401);
    expect(rotated.status).toBe(200);

    expect((await refresh(bystander.refreshToken)).status).toBe(200);
  });

  it('rejects an access token used as a refresh token', async () => {
    const user = await registerUser(app);

    expect((await refresh(user.accessToken)).status).toBe(401);
  });

  it('rejects a string that is not a JWT at all with a 400', async () => {
    expect((await refresh('garbage')).status).toBe(400);
  });

  it('rejects a JWT with a forged signature', async () => {
    const user = await registerUser(app);

    expect((await refresh(tamper(user.refreshToken))).status).toBe(401);
  });

  it('rejects a token whose record has expired', async () => {
    const user = await registerUser(app);
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await refresh(user.refreshToken)).status).toBe(401);
  });

  it('refuses to refresh for a deactivated user', async () => {
    const user = await registerUser(app);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    expect((await refresh(user.refreshToken)).status).toBe(401);
  });

  it('requires a token in the body', async () => {
    expect((await post('/auth/refresh', {})).status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token', async () => {
    const user = await registerUser(app);

    await post('/auth/logout', { refreshToken: user.refreshToken }).expect(204);

    expect(
      (await post('/auth/refresh', { refreshToken: user.refreshToken })).status
    ).toBe(401);
  });

  it('is idempotent and quiet about invalid tokens', async () => {
    const user = await registerUser(app);

    await post('/auth/logout', { refreshToken: user.refreshToken }).expect(204);
    await post('/auth/logout', { refreshToken: user.refreshToken }).expect(204);
    await post('/auth/logout', {
      refreshToken: tamper(user.refreshToken),
    }).expect(204);
  });

  it('rejects a body that is not a JWT with a 400', async () => {
    await post('/auth/logout', { refreshToken: 'garbage' }).expect(400);
  });

  it("only ends that session, not the user's other ones", async () => {
    const user = await registerUser(app);
    const secondSession = await post('/auth/login', {
      email: user.email,
      password: user.password,
    });
    await waitForLastLogin(user.id);

    await post('/auth/logout', { refreshToken: user.refreshToken }).expect(204);

    expect(
      (
        await post('/auth/refresh', {
          refreshToken: secondSession.body.refreshToken,
        })
      ).status
    ).toBe(200);
  });
});
