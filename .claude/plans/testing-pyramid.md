# План: достроить пирамиду тестов (web-unit, API integration, e2e)

> После утверждения копируем план в `.claude/plans/testing-pyramid.md`.
>
> **Ветка:** новая `test/testing-pyramid` от `main` (PR #3 и #4 уже влиты, `main` = `origin/main` = `074621c`).
>
> Незакоммиченный перенос тестов в `tests/unit` сейчас лежит прямо в рабочем дереве на `main` — переносим его в новую ветку и коммитим первым, до новых уровней тестов.

## Context

Сейчас в `tests/unit` только 10 юнит-тестов сервисов и CQRS-хендлеров API: классы создаются через `new`, все зависимости замоканы. Целые слои не покрыты ничем:

- **Контроллеры и DTO** — правила `ValidationPipe` (`pageSize` только 10/20/50, строгий ISO-формат, `whitelist`/`forbidNonWhitelisted`), `JwtAuthGuard` — проверялись только вручную через curl.
- **Репозитории** — `buildWhere`, пагинация через `$transaction`, `groupBy` в сводке, `createMany({ skipDuplicates })`, запрет удаления категории с транзакциями.
- **Сквозные сценарии** — баг «терялся последний день периода» жил на стыке фронтенда и SQL; юнит-тесты такое не ловят.
- **Фронтенд** — тестов нет вообще, хотя есть чистая логика (`shared/lib/period.ts`, `shared/lib/format.ts`, zod-схема формы) и сторы с нетривиальными инвариантами (сброс при смене сессии, откат страницы, guard от устаревших ответов).

Решения пользователя: тестовая БД — **отдельный контейнер на :5433**; фронтенд — **Jest + React Testing Library** (один раннер на репозиторий); делаем **все три уровня сразу**.

Новые devDependencies только для web: `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. Для API ничего ставить не нужно — `@nestjs/testing`, `supertest` и `@types/supertest` уже в `apps/api/package.json`.

## Целевая структура

```
tests/
  jest.config.js              # projects: unit-api + unit-web (быстрый npm test)
  jest.integration.config.js  # + globalSetup с миграциями
  jest.e2e.config.js
  tsconfig.json               # алиасы @api/*, @web/*
  setup/
    env.ts                    # TEST_DATABASE_URL, JWT-секреты для тестов
    global-setup.ts           # prisma migrate deploy в тестовую БД
    prisma.ts                 # клиент + truncate между тестами
    app.ts                    # поднятие Nest-приложения для integration/e2e
    jest-dom.ts               # setupFilesAfterEach для web-проекта
  unit/api/**                 # как сейчас
  unit/web/**                 # новое
  integration/api/**          # новое
  e2e/api/**                  # новое
```

## Чеклист

### Шаг 0. Ветка и перенос тестов
- [ ] `git checkout -b test/testing-pyramid` от `main` — незакоммиченные правки (перенос spec-файлов в `tests/unit`, `tests/jest.config.js`, `tests/tsconfig.json`, скрипты в `package.json`, раздел Testing в `CLAUDE.md`) переезжают в новую ветку вместе с переключением.
- [ ] Закоммитить этот перенос отдельным коммитом (`npm test` перед коммитом должен быть зелёным).
- [ ] Положить план в `.claude/plans/testing-pyramid.md`.

### Шаг 1. Инфраструктура тестовой БД
- [ ] В `docker/docker-compose.yml` добавить сервис `postgres-test` (`expense-tracker-postgres-test`, порт `5433`, БД `expense_tracker_test`, **без** volume — данные одноразовые, healthcheck как у основного).
- [ ] В корневой `package.json`: `db:test:start`, `db:test:stop` (docker compose up/down конкретного сервиса).
- [ ] `tests/setup/env.ts`: `DATABASE_URL` из `TEST_DATABASE_URL` (дефолт `postgresql://expense_tracker:dev_password@localhost:5433/expense_tracker_test?schema=public`), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/сроки жизни — фиксированные тестовые значения. Прод-`.env` не читаем, чтобы тесты не ходили в dev-базу.
- [ ] `tests/setup/global-setup.ts`: `prisma migrate deploy` (через `execFileSync`, cwd `apps/api`, `DATABASE_URL` из окружения тестов) — один раз на прогон.
- [ ] `tests/setup/prisma.ts`: singleton `PrismaClient` + `resetDatabase()` (`TRUNCATE "transactions", "categories", "refresh_tokens", "users" RESTART IDENTITY CASCADE`) + `disconnect()`.
- [ ] Добавить в `.env.example` закомментированный `TEST_DATABASE_URL` и описание в `CLAUDE.md`.

### Шаг 2. Конфигурация раннеров
- [ ] `apps/web/package.json`: добавить devDeps (`jest`, `jest-environment-jsdom`, `@testing-library/*`).
- [ ] `tests/jest.unit-api.config.js` — текущий конфиг (node, `roots: tests/unit/api`).
- [ ] `tests/jest.unit-web.config.js` — через `next/jest` (`createJestConfig({ dir: 'apps/web' })`), `testEnvironment: jsdom`, `setupFilesAfterEach: tests/setup/jest-dom.ts`, `moduleNameMapper` для `@/` → `apps/web/src`.
- [ ] `tests/jest.config.js` → `projects: [unit-api, unit-web]`, чтобы `npm test` оставался быстрым и без БД.
- [ ] `tests/jest.integration.config.js` и `tests/jest.e2e.config.js`: node-окружение, `globalSetup`, `setupFiles: tests/setup/env.ts`, `maxWorkers: 1` (общая БД), `testTimeout: 30000`.
- [ ] Скрипты в корне: `test` (unit), `test:integration`, `test:e2e`, `test:all` (последовательно), `test:cov`. В `apps/api/package.json` — `test:e2e` на новый конфиг вместо несуществующего `./test/jest-e2e.json`.
- [ ] `tests/tsconfig.json`: добавить `@web/*` → `apps/web/src/*`, `jsx: preserve`, типы `@testing-library/jest-dom`.

### Шаг 3. Юнит-тесты фронтенда (`tests/unit/web`)
- [ ] `shared/lib/period.spec.ts` — границы всех пресетов (включая переход через январь и високосный февраль), `formatPeriod`, стабильность при фиксированном «сегодня» (fake timers).
- [ ] `shared/lib/format.spec.ts` — `formatAmount` (+/−), `formatCurrency`, `toIsoDate`, `toIsoEndOfDay` (`23:59:59.999Z` — регрессия на потерянный последний день), `toDateInputValue`.
- [ ] `features/transaction/upsert/schema.spec.ts` — сумма (ноль, отрицательная, три знака, верхний предел), описание > 255, формат даты.
- [ ] `entities/transaction/store.spec.ts` (мок `shared/api/transactions-api`) — `setPeriod` сбрасывает страницу; `fetch` шлёт конец дня; откат страницы при опустевшей последней; `reset()` инвалидирует ответ «на лету».
- [ ] `entities/session/store.spec.ts` — `setSession`/`clearSession` вызывают `resetRegisteredStores()`, данные категорий/транзакций не переживают смену пользователя.
- [ ] `features/transaction/period-filter/period-filter.spec.tsx` (RTL + user-event) — выбор пресета меняет период в сторе; правка «From» за «To» подтягивает вторую границу, а не шлёт инвертированный диапазон.

### Шаг 4. Интеграционные тесты API (`tests/integration/api`)
- [ ] Вынести настройку приложения из `apps/api/src/main.ts` в `apps/api/src/app.config.ts` (`configureApp(app)`: `ValidationPipe` + CORS), чтобы тесты поднимали приложение ровно с теми же правилами. `main.ts` использует её же.
- [ ] `tests/setup/app.ts`: `createTestApp()` — `Test.createTestingModule({ imports: [AppModule] })` + `configureApp` + `app.init()`; хелпер `registerUser(app)` возвращает токены и `userId`.
- [ ] `transactions.validation.spec.ts` — `pageSize=15`, `page=0`, `page` выше максимума, нестрогая дата, лишнее поле в теле → 400 с понятным сообщением; без токена → 401.
- [ ] `transactions.repository.spec.ts` (реальная БД) — порядок и счётчики пагинации, включительность границ `dateFrom`/`dateTo`, фильтр по типу и категории, `sumByTypeAndCategory` совпадает с суммой строк списка.
- [ ] `categories.spec.ts` — `createMany({ skipDuplicates })` идемпотентен; дубль имени → 409; удаление категории с транзакциями → 409.
- [ ] `auth.spec.ts` — регистрация создаёт 8 дефолтных категорий; ротация refresh-токена; повторное использование старого токена отзывает все.
- [ ] `resetDatabase()` в `beforeEach`, `app.close()` + `disconnect()` в `afterAll`.

### Шаг 5. E2E (`tests/e2e/api`)
- [ ] `home-screen.e2e-spec.ts` — один сквозной сценарий через HTTP (supertest): регистрация → категории по умолчанию → создание 25 транзакций → пагинация 10/20/50 → сводка сходится с суммой строк за тот же период → редактирование → удаление → выход → 401 на старый refresh-токен.
- [ ] Проверить, что «последний день периода» попадает и в список, и в сводку (транзакция с временем 18:45 последнего дня).

### Шаг 6. Документация и проверка
- [ ] `CLAUDE.md`: раздел Testing — уровни, где что лежит, команды, как поднять тестовую БД.
- [ ] Прогнать всё, поправить найденное, обновить `.claude/plans/testing-pyramid.md` разделом «Отклонения при реализации».

## Verification

1. `npm test` — unit-проекты (api + web) зелёные, без БД и без сети.
2. `npm run db:test:start && npm run test:integration && npm run test:e2e` — зелёные; повторный прогон подряд тоже зелёный (проверка изоляции данных).
3. `npm run test:cov` — покрытие собирается по `apps/api/src` и `apps/web/src`.
4. Регрессии, которые новые тесты обязаны ловить (проверить, временно откатив фикс): `toIsoEndOfDay` → полночь, `@Max` у `page`, сброс сторов при `setSession`.
5. `npm run build --workspaces`, `npx tsc --noEmit` в `apps/web`, `npm run lint --workspace=apps/web` — без ошибок; `apps/api` собирается (spec-файлы в `dist` не попадают).
6. Дев-база `expense_tracker_dev` после прогонов не изменилась (тесты ходят только на :5433).
