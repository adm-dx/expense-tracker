# План: главный экран (web) + пагинация транзакций и дефолтные категории (api)

> Ветка: `feat/web-home-screen`.

## Context

После логина `/` сейчас показывает только «Welcome, {name}» и кнопку Log out. Нужен настоящий главный экран:
- шапка с меню профиля (имя/email, выход) и ссылкой на категории (сам экран категорий — позже, пока заглушка);
- добавление транзакции (категория, сумма + обязательные для API тип и дата, опц. описание);
- таблица транзакций с пагинацией 10 (по умолчанию) / 20 / 50;
- редактирование и удаление транзакции.

Решения пользователя:
- **Пагинация серверная**: `GET /transactions` сейчас отдаёт весь массив — добавляем `page`/`pageSize` и `total`.
- **Зависимости**: разрешены только shadcn-примитивы (`@radix-ui/*`). Загрузку данных делаем своими хуками/Zustand, без react-query.
- **Категории**: при регистрации бэкенд создаёт набор дефолтных категорий (у нового пользователя их сейчас 0).

Вне скоупа: фильтры, summary, экран категорий. Удаление использует уже существующий `DELETE /transactions/:id` (204), бэкенд не меняется.

## 1. API — пагинация транзакций

**`packages/types/src/index.ts`**
- `interface PaginatedResponse<T> { items: T[]; total: number; page: number; pageSize: number }`
- `const TRANSACTION_PAGE_SIZES = [10, 20, 50] as const; type TransactionPageSize = ...`
- `interface ListTransactionsParams extends TransactionFilters { page?: number; pageSize?: TransactionPageSize }`
- Поправить `Transaction.date`/`createdAt` и `User` под реальный JSON (ISO-строки `string`; у `User` добавить `isActive`, `lastLoginAt`) — проверить, что api/web собираются.

**`apps/api/src/modules/transactions/dto/list-transactions.query.ts`**
- `page`: `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`, default 1.
- `pageSize`: `@IsOptional() @Type(() => Number) @IsIn([10, 20, 50])`, default 10.

**`transactions.repository.ts`** — `findManyByUser(userId, filters, { skip, take })` возвращает `{ items, total }` через `prisma.$transaction([findMany({ where, orderBy, skip, take }), count({ where })])`. Сборку `where` вынести в приватный метод.

**`transactions.service.ts`** — `list()` возвращает `PaginatedResponse<PublicTransaction>`; `skip = (page - 1) * pageSize`. Страница за пределами — пустой `items` + реальный `total` (клиент сам откатится на последнюю страницу).

**`transactions.service.spec.ts`** — обновить тесты `list` (skip/take, дефолты, форма ответа).

## 2. API — дефолтные категории при регистрации

Следуем CQRS-паттерну, как `CreateUserCommand` (users) и `UserLoggedInEvent` (auth → users):

- **`apps/api/src/modules/categories/contracts/commands/create-default-categories.command.ts`** — `CreateDefaultCategoriesCommand(userId)`; `contracts/index.ts` реэкспорт.
- **`categories/default-categories.ts`** — константа набора `{ name, color, icon }`: Food, Transport, Housing, Entertainment, Health, Shopping, Salary, Other (цвета `#RRGGBB`, иконки kebab-case lucide-имена).
- **`categories.repository.ts`** — `createMany(userId, items)` с `skipDuplicates: true` (уникальность userId+name → идемпотентно).
- **`categories/handlers/create-default-categories.handler.ts`** — `@CommandHandler`, вызывает `CategoriesService.createDefaults(userId)`.
- **`categories.module.ts`** — `imports: [CqrsModule]`, провайдер хендлера.
- **`auth/auth.service.ts` `register()`** — после `CreateUserCommand` **await** `commandBus.execute(new CreateDefaultCategoriesCommand(user.id))` (команда, а не событие: событие не дожидается, и фронт сразу после регистрации может получить пустой список).
- Тесты: `auth.service.spec.ts` (команда вызывается), spec хендлера/сервиса категорий.
- Существующим пользователям дефолтный набор выдаётся data-миграцией `20260916220000_backfill_default_categories` (см. «Отклонения»).

## 3. Web — shared

**shadcn**: `npx shadcn@latest add dialog alert-dialog select dropdown-menu avatar table` (из `apps/web`; отказаться от апгрейда Tailwind v4, см. CLAUDE.md). Экспортировать новые компоненты из `src/shared/ui/index.ts`.

**`shared/api/http-client.ts`**
- Добавить `patch` и `delete` рядом с `get`/`post`.
- В `RequestOptions` — `params?: Record<string, string | number | undefined>` → `URLSearchParams` в `request()` (undefined пропускаются).

**`shared/api/transactions-api.ts`** (по образцу `auth-api.ts`): `list(params) → PaginatedResponse<Transaction>`, `create(body)`, `update(id, body)`, `remove(id) → void`.
**`shared/api/categories-api.ts`**: `list() → Category[]`.

**`shared/lib/format.ts`**: `formatAmount(amount: string, type)` (Intl.NumberFormat, знак +/−), `formatDate(iso)` (в UTC, чтобы день совпадал с сохранённым), `toIsoDate(yyyyMmDd)` → `YYYY-MM-DDT00:00:00.000Z`.

## 4. Web — entities

**`entities/session`**
- `ui/auth-guard.tsx` — клиентский компонент: пока `!hasHydrated` — пусто/скелет; если `!user` — `router.replace('/login')`; иначе `children`. Экспорт из `index.ts`.

**`entities/category`** — `model/store.ts` (Zustand, без persist): `categories`, `status`, `load()` (один раз, повторно по `force`), `byId` селектор. `index.ts`: `useCategoriesStore`, `useCategoryMap`.

**`entities/transaction`** — `model/store.ts` (Zustand, без persist): `items`, `total`, `page`, `pageSize` (10), `status`, `error`; `setPage`, `setPageSize` (сбрасывает page=1), `fetch()` (вызывает `transactionsApi.list`, если `items` пусто и `page > 1` — откат на последнюю страницу). `index.ts` экспортирует стор и `TRANSACTION_PAGE_SIZES`.

## 5. Web — features

**`features/auth/logout`** — вынести логику из текущего `app/page.tsx`: `useLogout()` (best-effort `authApi.logout`, `clearSession`, `router.replace('/login')`). `index.ts`: `useLogout`.

**`features/transaction/upsert`** — одна фича на создание и редактирование (общая форма; соседние фичи друг друга импортировать не могут):
- `model/schema.ts` — zod: `type` (`INCOME|EXPENSE`), `categoryId` (min 1), `amount` (строка → число > 0, ≤ 2 знаков, ≤ 9 999 999 999.99), `date` (`YYYY-MM-DD`, default сегодня), `description` (≤ 255, опц.).
- `model/use-upsert-transaction.ts` — `{ submit, isPending }`: create → `transactionsApi.create`; edit → `transactionsApi.update` только с изменёнными полями (пустое описание → `null`); после успеха `toast.success`, `useTransactionsStore.getState().fetch()`, закрыть диалог; ошибки — `toast.error(getErrorMessage(err))` (как в `use-login.ts`).
- `ui/transaction-form.tsx` — shadcn `Form` + `Select` категорий (цветная точка + имя) + `Select` типа + `Input` суммы/даты/описания.
- `ui/transaction-dialog.tsx` — `Dialog` с формой, `mode: 'create' | 'edit'`, `transaction?`.
- `ui/add-transaction-button.tsx` — кнопка «Add transaction» + диалог.
- `index.ts`: `AddTransactionButton`, `TransactionDialog` (для edit).

**`features/transaction/delete`**
- `model/use-delete-transaction.ts` — `{ remove(id), isPending }`: `transactionsApi.remove` → `toast.success` → `useTransactionsStore.getState().fetch()` (если удалили последнюю строку на странице — стор откатывается на предыдущую); 404 (уже удалена) тоже просто рефетчит; прочие ошибки — `toast.error(getErrorMessage(err))`.
- `ui/delete-transaction-dialog.tsx` — shadcn `AlertDialog` с подтверждением («Delete transaction? This can't be undone.», сумма и дата в тексте), кнопка Delete `variant="destructive"`, disabled пока `isPending`.
- `index.ts`: `DeleteTransactionDialog`.

## 6. Web — widgets

**`widgets/app-header`** — логотип/название, ссылка `Categories` → `/categories`, `DropdownMenu` с `Avatar` (инициалы), именем и email, пунктом `Log out` (`useLogout`).

**`widgets/transactions-table`**
- `ui/transactions-table.tsx` — shadcn `Table`: Date | Category | Description | Type | Amount (зелёный/красный) | Actions: `DropdownMenu` (иконка `MoreHorizontal`) с пунктами Edit (открывает `TransactionDialog` в режиме edit) и Delete (открывает `DeleteTransactionDialog`). Диалоги рендерятся один раз на таблицу, в состоянии хранится выбранная транзакция. Состояния: loading (skeleton-строки), error (Alert + Retry), empty («No transactions yet»).
- `ui/transactions-pagination.tsx` — `Select` rows per page 10/20/50, «Page X of Y · N total», кнопки Prev/Next (disabled на границах).
- `useEffect` вызывает `fetch()` при изменении `page`/`pageSize`.

## 7. Web — app

- **`app/page.tsx`** — `AuthGuard` → `AppHeader` + заголовок + `AddTransactionButton` + `TransactionsTable`. На маунте `useCategoriesStore.load()`. Роут остаётся тонким.
- **`app/categories/page.tsx`** — заглушка «Coming soon» под `AuthGuard` с `AppHeader`.
- `use-login.ts` / `use-register.ts` уже делают `router.push('/')` — не меняем.

## Verification

1. `cd apps/api && npm test` — все тесты зелёные (включая обновлённые list и регистрацию).
2. `npm run lint && npm run build` из корня.
3. curl: `POST /auth/register` → `GET /categories` возвращает 8 дефолтных; `GET /transactions?page=1&pageSize=20` → `{ items, total, page: 1, pageSize: 20 }`; `pageSize=15` → 400.
4. `npm run db:start && npm run dev`, в браузере:
   - без сессии `/` редиректит на `/login`; регистрация → главный экран;
   - меню профиля показывает имя/email, Log out возвращает на `/login`; `Categories` открывает заглушку;
   - создать 25 транзакций (через UI + скрипт curl) → по 10 на странице, 3 страницы; переключение на 20/50 сбрасывает на стр. 1;
   - Edit меняет категорию/сумму, строка обновляется; валидация суммы (0, отрицательная, 3 знака) показывает ошибки;
   - Delete → подтверждение → строка исчезает, `total` уменьшается; Cancel ничего не удаляет; удаление единственной строки на последней странице переводит на предыдущую.
5. Закоммитить изменения (включая ранее внесённый раздел Git Workflow в `CLAUDE.md`), открыть PR в `main`.

## Отклонения при реализации

- **Загрузка категорий** перенесена из `app/page.tsx` в `AddTransactionButton` и `TransactionsTable` (`load()` идемпотентен). Эффект страницы срабатывал раньше `SessionHydration` (эффекты детей выполняются раньше родителя) → запрос без токена → 401 → неудачный refresh очищал сессию. Теперь `app/page.tsx` — серверный компонент, все запросы идут внутри `AuthGuard`.
- **Откат страницы** в `entities/transaction`: `fetch()` при пустой странице за пределами `total` только выставляет `page = lastPage`, а рефетч делает эффект таблицы (подписан на `page`) — без рекурсии и двойных запросов. Добавлен guard от устаревших ответов (`latestRequestId`).
- **Меню строки** — `DropdownMenu modal={false}`: модальное меню, закрывающееся при открытии Dialog/AlertDialog, может оставить `pointer-events: none` на `body`.
- **Удаление** — кнопка подтверждения обычный `Button`, а не `AlertDialogAction`, чтобы диалог не закрывался до ответа API.
- **Выход** (`features/auth/logout`) дополнительно сбрасывает сторы транзакций и категорий, чтобы данные не протекли к следующему пользователю.
- **Кнопка «Add transaction»** всегда активна (баг: изначально была `disabled` при пустом списке категорий, и у аккаунтов без категорий её нельзя было нажать). При открытии диалога категории перезагружаются, если список пуст; если категорий нет или загрузка упала, селект категории неактивен и под ним подсказка, а валидация формы не даёт отправить транзакцию без категории.
- **shadcn**: `add` остановился на вопросе о перезаписи `button.tsx` — `alert-dialog` добавлен отдельно с ответом «нет». В сгенерированном `dropdown-menu.tsx` поправлен `checked` под `exactOptionalPropertyTypes`. Новые примитивы отформатированы prettier.
- **Типы**: даты в `User`/`Category`/`Transaction` переведены на `string` (реальный JSON), в `User` добавлены `isActive`, `lastLoginAt`. `TRANSACTION_PAGE_SIZES` — runtime-константа в `@expense-tracker/types`; в API продублирована в DTO (API не импортирует пакет типов в `src`).
- **Backfill дефолтных категорий**: изначально планировалось создавать их только при регистрации, но требование — дефолтный список у каждого пользователя. Добавлена data-миграция `apps/api/prisma/migrations/20260916220000_backfill_default_categories` (INSERT … CROSS JOIN VALUES … `ON CONFLICT ("userId", "name") DO NOTHING`, id — `gen_random_uuid()::text`). Список в SQL дублирует `default-categories.ts` — при изменении набора менять оба места (миграция влияет только на уже существующих пользователей).
- **Prisma CLI и `.env`**: `.env` лежит в корне, а Prisma ищет его рядом со схемой/в cwd, поэтому команды из `apps/api` нужно запускать с загруженным окружением: `set -a && . ../../.env && set +a && npx prisma migrate deploy`.
- **Не связано с задачей, но всплыло при проверке**: `npm run lint` в корне падает — у `packages/config` и `packages/types` нет скрипта `lint`, у `apps/api` нет `eslint.config.*` под ESLint 9. `npm run build` падает на `packages/config` (нет скрипта `build`), при этом api, web и types собираются. `apps/web` lint — чисто.
