import { INestApplication } from '@nestjs/common';
import { RATE_LIMIT_OPTIONS, RATE_LIMITS } from '@api/rate-limit';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { disconnectDatabase, resetDatabase } from '@tests/setup/prisma';

let app: INestApplication;
let user: TestUser;

beforeAll(async () => {
  app = await createTestApp(undefined, { rateLimit: true });
  await resetDatabase();
  user = await registerUser(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

// Counters live as long as the app, so every test is its own client: nginx
// passes the client's address in X-Forwarded-For, and the test client
// connects from loopback, which the API trusts as the proxy.
let clientCount = 0;
function newClientIp(): string {
  clientCount += 1;
  return `203.0.113.${clientCount}`;
}

const server = () => request(app.getHttpServer());

function login(ip: string) {
  return server()
    .post('/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ email: user.email, password: 'wrong-password' });
}

describe('rate limits', () => {
  it('answers 429 with Retry-After once a client has used up its logins', async () => {
    const ip = newClientIp();
    for (let i = 0; i < RATE_LIMITS.credentials.limit; i += 1) {
      expect((await login(ip)).status).toBe(401);
    }

    const blocked = await login(ip);

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      message: RATE_LIMIT_OPTIONS.errorMessage,
    });
  });

  it('counts each client on its own', async () => {
    const ip = newClientIp();
    for (let i = 0; i < RATE_LIMITS.credentials.limit; i += 1) {
      await login(ip);
    }
    expect((await login(ip)).status).toBe(429);

    expect((await login(newClientIp())).status).toBe(401);
  });

  it('ignores X-Forwarded-For from anything but the first hop', async () => {
    const ip = newClientIp();
    for (let i = 0; i < RATE_LIMITS.credentials.limit; i += 1) {
      await login(ip);
    }

    // A client can prepend its own X-Forwarded-For; nginx appends the real
    // address, and only the last entry, the one loopback vouches for, counts.
    const spoofed = await server()
      .post('/auth/login')
      .set('X-Forwarded-For', `${newClientIp()}, ${ip}`)
      .send({ email: user.email, password: 'wrong-password' });

    expect(spoofed.status).toBe(429);
  });

  it('limits registrations', async () => {
    const ip = newClientIp();
    const register = (i: number) =>
      server()
        .post('/auth/register')
        .set('X-Forwarded-For', ip)
        .send({
          name: 'Spam',
          email: `spam${i}-${Date.now()}@example.com`,
          password: 'password123',
        });
    for (let i = 0; i < RATE_LIMITS.credentials.limit; i += 1) {
      expect((await register(i)).status).toBe(201);
    }

    expect((await register(-1)).status).toBe(429);
  });

  it('limits place searches more tightly than other routes', async () => {
    const ip = newClientIp();
    const search = (q: string) =>
      server()
        .get(`/weather/places?q=${q}`)
        .set('X-Forwarded-For', ip)
        .set(...bearer(user));
    for (let i = 0; i < RATE_LIMITS.placeSearch.limit; i += 1) {
      expect((await search(`town${i}`)).status).toBe(200);
    }

    expect((await search('belgrade')).status).toBe(429);
  });

  it('applies the default limit to every other route', async () => {
    const response = await server()
      .get('/categories')
      .set('X-Forwarded-For', newClientIp())
      .set(...bearer(user));

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe(
      String(RATE_LIMITS.default.limit)
    );
  });
});
