import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT_OPTIONS } from './rate-limit';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { WeatherModule } from './modules/weather/weather.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    CqrsModule.forRoot(),
    ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TagsModule,
    TransactionsModule,
    ExchangeRatesModule,
    WeatherModule,
    SettingsModule,
  ],
  controllers: [],
  // Per client IP; `trust proxy` in app.config.ts makes that nginx's client.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
