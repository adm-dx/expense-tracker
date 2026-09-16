# План: авторизация в API (Users + Auth, JWT, CQRS)

## Context
В API (`apps/api`) сейчас только `PrismaModule`, модулей нет, авторизации нет. Нужно: модуль пользователей (репозиторий + сервис), отдельный модуль авторизации на JWT, эндпоинты регистрации и логина, access + refresh токены. Модули общаются друг с другом через CQRS (`@nestjs/cqrs`), без прямых импортов сервисов. Модель `User` в Prisma уже есть (id, email, name, timestamps), но без пароля.

Факты по коду, влияющие на решения:
- Реально стоит **NestJS 10** (`@nestjs/common ^10.4.15`), а не 11, как в CLAUDE.md → ставим совместимые версии пакетов.
- `@nestjs/config` нет; `.env` лежит в корне монорепо.
- tsconfig: `strict`, `exactOptionalPropertyTypes`, `isolatedModules` + `emitDecoratorMetadata` → классы, внедряемые через конструктор, импортировать обычным `import`, не `import type`.
- Есть миграция `prisma/migrations/20260912221126_init`.

## 1. Зависимости (`--workspace=apps/api`)
- `@nestjs/jwt@^10`, `@nestjs/config@^3`, `@nestjs/cqrs@^10` (версия под Nest 10)
- `class-validator`, `class-transformer` (валидация DTO)
- `bcryptjs` + `@types/bcryptjs` (dev) — чистый JS, без нативной сборки на Windows

## 2. Prisma schema — `apps/api/prisma/schema.prisma`
Добавить в `User`:
```prisma
passwordHash String
isActive     Boolean   @default(true)
lastLoginAt  DateTime?
```
и связь `refreshTokens RefreshToken[]`. Новая модель:
```prisma
model RefreshToken {
  id        String    @id @default(cuid())   // = jti в refresh JWT
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String                            // sha256 от refresh-токена
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@map("refresh_tokens")
  @@index([userId])
}
```
Затем из `apps/api`: `npx prisma migrate dev --name add_auth` и `npx prisma generate`.
(Если в таблице `users` уже есть строки — миграция на NOT NULL упадёт; в dev-базе ожидается пусто, иначе сбросить через `prisma migrate reset`.)

## 3. Конфиг
- `.env.example` (+ локальный `.env`): `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN="15m"`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN="7d"` (разные секреты, чтобы refresh нельзя было использовать как access).
- `app.module.ts`: `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] })`.
- `main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`.

## 4. CQRS: правила взаимодействия модулей
- `app.module.ts` импортирует `CqrsModule.forRoot()` один раз (глобальные `CommandBus`/`QueryBus`/`EventBus`); feature-модули импортируют `CqrsModule`, чтобы регистрировать хендлеры.
- **Модули не импортируют друг друга и не экспортируют сервисы.** Межмодульное взаимодействие — только через шину:
  - **Command** — изменить состояние в чужом модуле, возвращает результат.
  - **Query** — прочитать данные чужого модуля.
  - **Event** — уведомить «что-то произошло», без ожидания ответа.
- Публичный контракт модуля — папка `contracts/` (классы команд/запросов/событий + типы результатов) с `index.ts`. Другие модули импортируют **только** из `modules/<name>/contracts`. Хендлеры, сервисы, репозитории остаются внутренними.
- Внутри модуля (controller → service → repository) обычный DI, шину не используем — лишняя косвенность.
- Типизация результата в `@nestjs/cqrs@10`: `queryBus.execute<GetUserCredentialsQuery, UserCredentials | null>(new GetUserCredentialsQuery(email))`.
- Хендлеры — тонкие: принимают команду/запрос и делегируют в сервис модуля.

## 5. Модуль пользователей — `apps/api/src/modules/users/`
- `users.repository.ts` — `@Injectable() UsersRepository`, единственное место работы с `PrismaService` для `user`:
  `findById(id)`, `findByEmail(email)`, `create(data: Prisma.UserCreateInput)`, `updateLastLogin(id)`.
- `users.service.ts` — `UsersService` поверх репозитория: `findById`, `findByEmail`, `create({ name, email, passwordHash })` (ловит `P2002` → `ConflictException`), `markLoggedIn(id)`, `toPublic(user)` — отдаёт `User` без `passwordHash`. Email нормализуется (`trim().toLowerCase()`).
- `contracts/` (публичный API модуля):
  - `commands/create-user.command.ts` — `CreateUserCommand(name, email, passwordHash)` → `PublicUser`
  - `queries/get-user-by-id.query.ts` — `GetUserByIdQuery(id)` → `PublicUser | null`
  - `queries/get-user-credentials.query.ts` — `GetUserCredentialsQuery(email)` → `UserCredentials | null` (`{ id, email, passwordHash, isActive }` — отдельный запрос, чтобы хэш не утекал в обычные чтения)
  - `types.ts` — `PublicUser`, `UserCredentials`
- `handlers/` — `CreateUserHandler` (`@CommandHandler`), `GetUserByIdHandler`, `GetUserCredentialsHandler` (`@QueryHandler`), `UserLoggedInHandler` (`@EventsHandler(UserLoggedInEvent)` → `usersService.markLoggedIn`).
- `users.module.ts` — imports: `CqrsModule`; providers: `UsersRepository`, `UsersService`, все хендлеры. **Без exports.**

## 6. Модуль авторизации — `apps/api/src/modules/auth/`
- `dto/register.dto.ts` — `name` (`IsString`, `IsNotEmpty`, `MaxLength(100)`), `email` (`IsEmail`), `password` (`IsString`, `MinLength(8)`, `MaxLength(72)` — лимит bcrypt).
- `dto/login.dto.ts` — `email`, `password`.
- `dto/refresh-token.dto.ts` — `refreshToken` (`IsJWT`). Используется для `/refresh` и `/logout`.
- `contracts/events/user-logged-in.event.ts` — `UserLoggedInEvent(userId, occurredAt)`; публикует auth, слушает users (обновляет `lastLoginAt`).
- `refresh-tokens.repository.ts` — работа с `prisma.refreshToken`: `create`, `findById`, `revoke(id)`, `revokeAllForUser(userId)`.
- `token.service.ts` — `TokenService`:
  - `issueTokens(user)`: создаёт запись `RefreshToken` (получаем `id`), подписывает access `{ sub, email }` секретом `JWT_ACCESS_SECRET` и refresh `{ sub, jti: record.id }` секретом `JWT_REFRESH_SECRET`, сохраняет `sha256(refreshToken)` и `expiresAt`. Возвращает `{ accessToken, refreshToken }`.
  - `rotate(refreshToken)`: verify → запись по `jti` → проверки (существует, не отозвана, не истекла, хэш совпадает, пользователь активен — через `GetUserByIdQuery`). Успех → отозвать старую, выдать новую пару. **Повторное использование уже отозванного токена** → `revokeAllForUser` + 401 (защита от кражи).
  - `revoke(refreshToken)`: verify (при ошибке подписи → 204 без действий) → `revoke(jti)`.
  - Для подписи используется один `JwtService` с явными `secret`/`expiresIn` в `signAsync`/`verifyAsync`.
- `auth.service.ts`:
  - Зависит от `CommandBus`, `QueryBus`, `EventBus` и `TokenService` — **не** от `UsersService`.
  - `register(dto)`: `bcrypt.hash(password, 10)` → `commandBus.execute(new CreateUserCommand(...))` (дубликат → 409 из хендлера users) → `tokenService.issueTokens`.
  - `login(dto)`: `queryBus.execute(new GetUserCredentialsQuery(email))` → `bcrypt.compare`; при неверном email/пароле или `isActive=false` — одинаковый `UnauthorizedException('Invalid credentials')` → `eventBus.publish(new UserLoggedInEvent(userId))` → `GetUserByIdQuery` для публичного профиля → `issueTokens`.
  - `me(userId)` — через `GetUserByIdQuery`.
  - Ответ register/login/refresh: `{ accessToken, refreshToken, user: PublicUser }`.
- Refresh-токен передаётся в теле запроса (удобно для Next.js-клиента; httpOnly-cookie можно добавить позже).
- `guards/jwt-auth.guard.ts` — глобальный `CanActivate`: пропускает маршруты с `@Public()` (через `Reflector`), иначе берёт `Authorization: Bearer <token>`, `verifyAsync` с `JWT_ACCESS_SECRET`, кладёт payload в `request.user`; ошибки → `UnauthorizedException`.
- `decorators/public.decorator.ts` — `@Public()` (`SetMetadata(IS_PUBLIC_KEY, true)`).
- `decorators/current-user.decorator.ts` — `@CurrentUser()` достаёт `request.user`.
- `auth.controller.ts` (`/auth`):
  - `POST /auth/register` — `@Public()`, 201
  - `POST /auth/login` — `@Public()`, `@HttpCode(200)`
  - `POST /auth/refresh` — `@Public()`, `@HttpCode(200)`, новая пара токенов
  - `POST /auth/logout` — `@Public()`, `@HttpCode(204)`, отзывает переданный refresh-токен
  - `GET /auth/me` — защищён, возвращает публичного пользователя
- `auth.module.ts` — imports: `CqrsModule`, `JwtModule.register({})` (**без** `UsersModule`; секреты передаются явно в `TokenService` из `ConfigService.getOrThrow`); providers: `AuthService`, `TokenService`, `RefreshTokensRepository`, `{ provide: APP_GUARD, useClass: JwtAuthGuard }`.
- `app.module.ts`: добавить `CqrsModule.forRoot()`, `UsersModule`, `AuthModule`.

Глобальный guard = все будущие эндпоинты (expenses и т.д.) защищены по умолчанию, открытые помечаются `@Public()`.

## 7. Общие типы — `packages/types/src/index.ts`
Добавить `RegisterRequest`, `LoginRequest`, `RefreshTokenRequest`, `AuthTokens { accessToken: string; refreshToken: string }`, `AuthResponse extends AuthTokens { user: User }`, `JwtPayload { sub: string; email: string }`. `User` в shared-типах **не** получает `passwordHash`.

## 8. Тесты
- `auth.service.spec.ts`: register (успех, дубликат email → 409), login (успех, неверный пароль → 401, неизвестный email → 401). `CommandBus`/`QueryBus`/`EventBus`/`TokenService` мокаются; проверяется, что при логине публикуется `UserLoggedInEvent`.
- `token.service.spec.ts`: rotate (успех отзывает старый токен; истёкший/несовпадающий хэш → 401; повторное использование отозванного → `revokeAllForUser` + 401), revoke.
- `users.service.spec.ts`: create мапит `P2002` в `ConflictException`, `toPublic` не содержит `passwordHash`.
- `users/handlers/*.spec.ts`: хендлеры делегируют в `UsersService`; `GetUserByIdHandler` не возвращает `passwordHash`.

## Verification
1. `npm run db:start`; из `apps/api`: `npx prisma migrate dev --name add_auth`.
2. `cd apps/api; npm test` — юнит-тесты зелёные; `npm run build` — без ошибок TS.
3. `npm run dev:api`, затем:
   - `POST /auth/register` `{name,email,password}` → 201, токены + user без `passwordHash`
   - повтор → 409; невалидный email/короткий пароль → 400
   - `POST /auth/login` → 200 с токенами; неверный пароль → 401; в `users.lastLoginAt` появилось время (проверка события)
   - `GET /auth/me` без токена → 401, с `Authorization: Bearer <accessToken>` → 200; с refresh-токеном вместо access → 401
   - `POST /auth/refresh` → 200 с новой парой; повтор со старым refresh → 401, и новый refresh тоже перестаёт работать
   - `POST /auth/logout` → 204; после этого refresh с этим токеном → 401
