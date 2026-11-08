import { INestApplication } from '@nestjs/common';
import { createTestApp, request } from '@tests/setup/app';
import { disconnectDatabase } from '@tests/setup/prisma';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());

describe('security headers', () => {
  it('does not name the framework', async () => {
    const response = await server().get('/auth/me');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sends the helmet headers, on errors too', async () => {
    const response = await server().get('/auth/me');

    expect(response.status).toBe(401);
    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': expect.stringContaining('max-age='),
    });
    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'self'"
    );
  });

  it('still lets the web origin through CORS', async () => {
    const response = await server()
      .options('/auth/login')
      .set('Origin', process.env.WEB_URL ?? '')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      process.env.WEB_URL
    );
  });
});
