import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Global pipes, CORS and proxy trust shared by `main.ts` and the integration
 * tests, so the tests exercise exactly the rules the real server runs with.
 */
export function configureApp(app: INestApplication): void {
  // nginx on the same host is the only proxy: take the client's IP from its
  // X-Forwarded-For, which rate limiting keys on. Only when the request comes
  // from loopback, so a client reaching the API directly can't forge it.
  (app as NestExpressApplication).set('trust proxy', 'loopback');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });
}
