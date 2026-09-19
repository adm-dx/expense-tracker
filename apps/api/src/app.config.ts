import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Global pipes and CORS shared by `main.ts` and the integration tests, so the
 * tests exercise exactly the validation rules the real server runs with.
 */
export function configureApp(app: INestApplication): void {
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
