import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const port = process.env.API_PORT || 3001;
  // Loopback only: nginx on the same host is the way in, so the API stays
  // closed even if the firewall is off. API_HOST=0.0.0.0 to open it.
  const host = process.env.API_HOST || '127.0.0.1';
  await app.listen(port, host);

  console.log(`Application is running on: http://${host}:${port}`);
}
void bootstrap();
