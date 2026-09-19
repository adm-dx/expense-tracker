import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
