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

- [x] `git checkout -b test/testing-pyramid` от `main` — незакоммиченные правки (перенос spec-файлов в `tests/unit`, `tests/jest.config.js`, `tests/tsconfig.json`, скрипты в `package.json`, раздел Testing в `CLAUDE.md`) переезжают в новую ветку вместе с переключением.
- [x] Закоммитить этот перенос отдельным коммитом (`npm test` перед коммитом должен быть зелёным).
- [x] Положить план в `.claude/plans/testing-pyramid.md`.

### Шаг 1. Инфраструктура тестовой БД

- [x] В `docker/docker-compose.yml` добавить сервис `postgres-test` (`expense-tracker-postgres-test`, порт `5433`, БД `expense_tracker_test`, **без** volume — данные одноразовые, healthcheck как у основного).
- [x] В корневой `package.json`: `db:test:start`, `db:test:stop` (docker compose up/down конкретного сервиса).
- [x] `tests/setup/env.ts`: `DATABASE_URL` из `TEST_DATABASE_URL` (дефолт `postgresql://expense_tracker:dev_password@localhost:5433/expense_tracker_test?schema=public`), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/сроки жизни — фиксированные тестовые значения. Прод-`.env` не читаем, чтобы тесты не ходили в dev-базу.
- [x] `tests/setup/global-setup.ts`: `prisma migrate deploy` (через `execFileSync`, cwd `apps/api`, `DATABASE_URL` из окружения тестов) — один раз на прогон.
- [x] `tests/setup/prisma.ts`: singleton `PrismaClient` + `resetDatabase()` (`TRUNCATE "transactions", "categories", "refresh_tokens", "users" RESTART IDENTITY CASCADE`) + `disconnect()`.
- [x] Добавить в `.env.example` закомментированный `TEST_DATABASE_URL` и описание в `CLAUDE.md`.

### Шаг 2. Конфигурация раннеров

- [x] `apps/web/package.json`: добавить devDeps (`jest`, `jest-environment-jsdom`, `@testing-library/*`).
- [x] `tests/jest.unit-api.config.js` — текущий конфиг (node, `roots: tests/unit/api`).
- [x] `tests/jest.unit-web.config.js` — через `next/jest` (`createJestConfig({ dir: 'apps/web' })`), `testEnvironment: jsdom`, `setupFilesAfterEach: tests/setup/jest-dom.ts`, `moduleNameMapper` для `@/` → `apps/web/src`.
- [x] `tests/jest.config.js` → `projects: [unit-api, unit-web]`, чтобы `npm test` оставался быстрым и без БД.
- [x] `tests/jest.integration.config.js` и `tests/jest.e2e.config.js`: node-окружение, `globalSetup`, `setupFiles: tests/setup/env.ts`, `maxWorkers: 1` (общая БД), `testTimeout: 30000`.
- [x] Скрипты в корне: `test` (unit), `test:integration`, `test:e2e`, `test:all` (последовательно), `test:cov`. В `apps/api/package.json` — `test:e2e` на новый конфиг вместо несуществующего `./test/jest-e2e.json`.
- [x] `tests/tsconfig.json`: добавить `@web/*` → `apps/web/src/*`, `jsx: preserve`, типы `@testing-library/jest-dom`.

### Шаг 3. Юнит-тесты фронтенда (`tests/unit/web`)

- [x] `shared/lib/period.spec.ts` — границы всех пресетов (включая переход через январь и високосный февраль), `formatPeriod`, стабильность при фиксированном «сегодня» (fake timers).
- [x] `shared/lib/format.spec.ts` — `formatAmount` (+/−), `formatCurrency`, `toIsoDate`, `toIsoEndOfDay` (`23:59:59.999Z` — регрессия на потерянный последний день), `toDateInputValue`.
- [x] `features/transaction/upsert/schema.spec.ts` — сумма (ноль, отрицательная, три знака, верхний предел), описание > 255, формат даты.
- [x] `entities/transaction/store.spec.ts` (мок `shared/api/transactions-api`) — `setPeriod` сбрасывает страницу; `fetch` шлёт конец дня; откат страницы при опустевшей последней; `reset()` инвалидирует ответ «на лету».
- [x] `entities/session/store.spec.ts` — `setSession`/`clearSession` вызывают `resetRegisteredStores()`, данные категорий/транзакций не переживают смену пользователя.
- [x] `features/transaction/period-filter/period-filter.spec.tsx` (RTL + user-event) — выбор пресета меняет период в сторе; правка «From» за «To» подтягивает вторую границу, а не шлёт инвертированный диапазон.

### Шаг 4. Интеграционные тесты API (`tests/integration/api`)

- [x] Вынести настройку приложения из `apps/api/src/main.ts` в `apps/api/src/app.config.ts` (`configureApp(app)`: `ValidationPipe` + CORS), чтобы тесты поднимали приложение ровно с теми же правилами. `main.ts` использует её же.
- [x] `tests/setup/app.ts`: `createTestApp()` — `Test.createTestingModule({ imports: [AppModule] })` + `configureApp` + `app.init()`; хелпер `registerUser(app)` возвращает токены и `userId`.
- [x] `transactions.validation.spec.ts` — `pageSize=15`, `page=0`, `page` выше максимума, нестрогая дата, лишнее поле в теле → 400 с понятным сообщением; без токена → 401.
- [x] `transactions.repository.spec.ts` (реальная БД) — порядок и счётчики пагинации, включительность границ `dateFrom`/`dateTo`, фильтр по типу и категории, `sumByTypeAndCategory` совпадает с суммой строк списка.
- [x] `categories.spec.ts` — `createMany({ skipDuplicates })` идемпотентен; дубль имени → 409; удаление категории с транзакциями → 409.
- [x] `auth.spec.ts` — регистрация создаёт 8 дефолтных категорий; ротация refresh-токена; повторное использование старого токена отзывает все.
- [x] `resetDatabase()` в `beforeEach`, `app.close()` + `disconnect()` в `afterAll`.

### Шаг 5. E2E (`tests/e2e/api`)

- [x] `home-screen.e2e-spec.ts` — один сквозной сценарий через HTTP (supertest): регистрация → категории по умолчанию → создание 25 транзакций → пагинация 10/20/50 → сводка сходится с суммой строк за тот же период → редактирование → удаление → выход → 401 на старый refresh-токен.
- [x] Проверить, что «последний день периода» попадает и в список, и в сводку (транзакция с временем 18:45 последнего дня).

### Шаг 6. Документация и проверка

- [x] `CLAUDE.md`: раздел Testing — уровни, где что лежит, команды, как поднять тестовую БД.
- [x] Прогнать всё, поправить найденное, обновить `.claude/plans/testing-pyramid.md` разделом «Отклонения при реализации».

## Verification

1. `npm test` — unit-проекты (api + web) зелёные, без БД и без сети.
2. `npm run db:test:start && npm run test:integration && npm run test:e2e` — зелёные; повторный прогон подряд тоже зелёный (проверка изоляции данных).
3. `npm run test:cov` — покрытие собирается по `apps/api/src` и `apps/web/src`.
4. Регрессии, которые новые тесты обязаны ловить (проверить, временно откатив фикс): `toIsoEndOfDay` → полночь, `@Max` у `page`, сброс сторов при `setSession`.
5. `npm run build --workspaces`, `npx tsc --noEmit` в `apps/web`, `npm run lint --workspace=apps/web` — без ошибок; `apps/api` собирается (spec-файлы в `dist` не попадают).
6. Дев-база `expense_tracker_dev` после прогонов не изменилась (тесты ходят только на :5433).

## Отклонения при реализации

- **Профиль compose и `--wait`.** `postgres-test` висит на профиле `test`, иначе `npm run db:start` (`up -d` без имён сервисов) поднимал бы и его. `db:test:start` использует `--wait`, чтобы скрипт возвращался, когда БД уже healthy. Данные лежат в `tmpfs`, а не «без volume»: у образа postgres объявлен `VOLUME`, и без `tmpfs` Docker создал бы анонимный том.
- **Защита от записи в dev-базу — в двух местах.** `assertTestDatabase()` (имя БД обязано оканчиваться на `_test`) вызывается и в `tests/setup/env.ts`/`prisma.ts`, и в `createTestApp()`: клиент Prisma самого приложения читает `DATABASE_URL`, а `ConfigModule` подхватил бы корневой `.env`, если бы переменная не была уже выставлена.
- **`jsx: react-jsx`** в `tests/tsconfig.json` вместо `preserve` из плана: этот конфиг только для `tsc --noEmit`, а компоненты в тестах трансформирует SWC через `next/jest`.
- **Приложение слушает фиксированный порт** (`app.listen(0)` в `createTestApp`). Один раз из ~15 прогонов запрос вернул `301` вместо `400`; при повторах воспроизвести не удалось, причина не установлена. Подозрение: supertest на каждый запрос занимает новый эфемерный порт, и по переиспользованному порту мог ответить посторонний процесс. После правки 0 сбоев на серии прогонов, но это профилактика, а не доказанный фикс.
- **`waitForLastLogin`.** После успешного `POST /auth/login` `lastLoginAt` обновляет асинхронный обработчик события. Если следующий тест успевал очистить таблицы раньше, Prisma писал в лог «No record was found for an update» (1 из ~9 прогонов). Тесты теперь дожидаются обработчика; за 15 прогонов после правки шума нет.
- **`@IsJWT()` у `RefreshTokenDto`.** Строка, не похожая на JWT, отсекается валидацией (`400`), а JWT с испорченной подписью — авторизацией (`401`, для logout — тихий `204`). Первая версия тестов ожидала `401` для `'garbage'` — ошибка была в тесте, не в коде.
- **Покрытие.** `roots` unit-проектов включают исходники приложений, иначе Jest не видит файлы, которые тесты не загружают, и процент получается завышенным (было 70%, честные цифры: **42%** у юнит-тестов, **95%** строк API у интеграционных, **87%** у одного e2e). Интеграционное покрытие — отдельным скриптом `test:cov:integration`.
- **Сверх плана:** `summary-store.spec.ts`, `store-reset.spec.ts`, `category/store.spec.ts`, `tenant-isolation.spec.ts` (пользователь не видит и не меняет чужие транзакции и категории; ответ `404`, а не `403`), а также тесты идемпотентности `createMany`, отказа `DELETE` категории с транзакциями и дрейфа десятичных сумм.
- **Проверка того, что тесты умеют падать.** Временно ломались исправления из ревью — каждая поломка ловилась: `toIsoEndOfDay` → полночь (4 падения), сброс сторов при `setSession` (1), инвалидация `reset()` (1), `@Max` у `page` (2), `skipDuplicates` (2), фильтр владельца в `findByIdForUser` (3), `lte` → `lt` у `dateTo` (4), summary без периода в e2e (4).

## Не сделано / что дальше

- Компонентных тестов на фронтенде мало: покрыт только `PeriodFilter`. Форма транзакции, диалог удаления, таблица с пагинацией, `AuthGuard` и шапка не тестируются (покрытие у виджетов 0%).
- E2E — на уровне HTTP. Браузерных сценариев (Playwright) нет, поэтому связка «React + реальный API» проверяется только вручную.
- В CI тесты не подключены (в репозитории нет конфигурации CI).

## Правки после ревью тестов

**Безопасность**

- Порты Postgres опубликованы как `127.0.0.1:5432` и `127.0.0.1:5433` вместо `0.0.0.0` — пароли лежат в репозитории, база не должна быть доступна из сети. Dev-контейнер подхватит это при пересоздании (`npm run db:restart`).
- Добавлены тесты guard'а: просроченный access-токен, токен с чужой подписью, «alg: none», токен для несуществующего пользователя. Для `jsonwebtoken` заведена явная devDependency (раньше он приходил транзитивно через `@nestjs/jwt`).
- Зафиксировано текущее поведение: у деактивированного пользователя access-токен продолжает работать до истечения (guard проверяет только подпись), а refresh отклоняется сразу.

**Изоляция и надёжность тестов**

- `resetDatabase()` берёт список таблиц из `pg_tables`, а не из зашитого перечня: новая модель больше не сможет тихо протащить данные между тестами.
- Тест изоляции сравнивает всю строку со снимком «до» вместо проверки «сумма есть»: ответ `404`, который всё-таки изменил или удалил запись, теперь падает.
- Тест «текущий месяц» выводит ожидание из самого ответа и не может упасть на границе месяца.

**Покрытие критичной логики фронтенда**

- `http-client`: заголовки и сборка query, ошибки `ApiError`, обновление токена по 401 с повтором запроса, общий запрос обновления при параллельных 401, единственный повтор, `onAuthFailure` при неудаче. Спецификация помечена `@jest-environment node`, так как jsdom не даёт `fetch`/`Response`.
- `use-upsert-transaction`: отправка только изменённых полей, `12.50` против `12.5`, очистка описания в `null`, отсутствие запроса при нетронутой форме.
- `use-delete-transaction`: успех, `404` как «уже удалено», прочие ошибки.

**Чистота кода**

- Появился корневой `eslint.config.mjs` (flat config) для `tests/**` и `apps/api/src/**` с `typescript-eslint` и `eslint-plugin-jest`: ловит незахваченные промисы, тесты без проверок, забытые `.only`. Корневой `npm run lint` больше не падает (`--if-present` + `lint:tests`), у `apps/api` починен собственный скрипт линта.
- Тела ответов читаются через типизированный `expectJson<T>()` вместо `any`.
- Тест `PeriodFilter` проверяет результат через интерфейс и мокает «сегодня» вместо подмены таймеров.
- Спецификация валидации регистрирует пользователя один раз на файл и чистит только транзакции: 6.4 с → 2.1 с.
- Удалена папка `tests/coverage/`, оставшаяся от раннего прогона.

Новые поломки проверены мутациями: отключение повтора после обновления токена (2 падения), общего запроса обновления (1), диффа полей при редактировании (8), обработки `404` при удалении (1).
