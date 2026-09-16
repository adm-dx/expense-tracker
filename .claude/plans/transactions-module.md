# План: модуль транзакций (backend)

## Context
Нужен центральный модуль учёта доходов и расходов: CRUD по транзакциям пользователя, фильтры списка и месячная сводка. Сейчас в схеме есть неиспользуемая модель `Expense`. Её заменяет `Transaction` (решение пользователя: удалить `Expense`). Если у категории есть транзакции, удалить её нельзя: ответ 409 (Restrict). Объём работ: только API и общие типы, без новых зависимостей.

## 1. Prisma (`apps/api/prisma/schema.prisma`)
```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

model Transaction {
  id          String          @id @default(uuid())
  amount      Decimal         @db.Decimal(12, 2)
  type        TransactionType
  description String?
  date        DateTime
  categoryId  String
  category    Category        @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime        @default(now())

  @@map("transactions")
  @@index([userId, date])
  @@index([categoryId])
}
```
- Имена `categoryId`/`userId` в camelCase, как принято в схеме (в задаче `categoryID`/`userID`).
- `User`: убрать `expenses Expense[]`, добавить `transactions Transaction[]`.
- `Category`: убрать `expenses Expense[]`, добавить `transactions Transaction[]`.
- Удалить модель `Expense`.
- Миграция: `cd apps/api && npx prisma migrate dev --name add_transactions`, затем `npx prisma generate`.

## 2. Общие типы (`packages/types/src/index.ts`)
- Удалить `Expense`.
- Добавить `TransactionType = 'INCOME' | 'EXPENSE'`, `Transaction` (`amount: string`, потому что Prisma Decimal сериализуется в JSON как строка; `description: string | null`; `date`, `createdAt`), `CreateTransactionRequest`, `UpdateTransactionRequest`, `TransactionFilters`, `TransactionSummary`.

## 3. NestJS-модуль `apps/api/src/modules/transactions/`
Повторяет структуру `modules/categories` (repository → service → controller, `types.ts` с локальным публичным типом, потому что `@expense-tracker/types` ломает `rootDir`, см. раздел «Отклонения» в `categories-module.md`).

**`types.ts`**: `PublicTransaction` (без `userId`, `amount: string`), `TransactionSummary`:
```ts
{ month, year, totalIncome: string, totalExpense: string, balance: string,
  byCategory: { categoryId, name, color, icon, type, total: string }[] }
```

**`dto/`** (class-validator; для query-чисел `@Type(() => Number)` из class-transformer, который уже есть в зависимостях; учесть `exactOptionalPropertyTypes`):
- `create-transaction.dto.ts`: `amount` `@IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9_999_999_999.99)`; `type` `@IsEnum(TransactionType)` (из `@prisma/client`); `description?` `@IsOptional @IsString @MaxLength(255)`; `date` `@IsISO8601()`; `categoryId` `@IsString @IsNotEmpty`.
- `update-transaction.dto.ts`: те же поля с `@IsOptional()` (без `@nestjs/mapped-types`). `description` можно передать как `null`, чтобы очистить: `@ValidateIf(v => v.description !== null)`.
- `list-transactions.query.ts`: `dateFrom?`, `dateTo?` `@IsISO8601`; `type?` `@IsEnum`; `categoryId?` `@IsString`.
- `summary.query.ts`: `month` `@Type(() => Number) @IsInt @Min(1) @Max(12)`; `year` `@Type(() => Number) @IsInt @Min(1970) @Max(9999)`. Оба обязательные.

**`transactions.repository.ts`** (`PrismaService`):
- `findManyByUser(userId, filters)`: `where` собирается из фильтров (`date: { gte, lte }`), `orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]`.
- `findByIdForUser(id, userId)` через `findFirst`; `create`; `update(id, data)`; `delete(id)`.
- `sumByTypeAndCategory(userId, from, to)`: `prisma.transaction.groupBy({ by: ['type', 'categoryId'], where: { userId, date: { gte: from, lt: to } }, _sum: { amount: true } })`.
- `findCategoriesByIds(ids)`: `prisma.category.findMany({ where: { id: { in: ids } } })`, чтобы получить name/color/icon для сводки.
- Проверку принадлежности категории пользователю делаем через `prisma.category.findFirst({ where: { id, userId } })` прямо в репозитории транзакций. Модуль категорий не импортируем и сервис у него не экспортируем, поэтому модули не связываются друг с другом.

**`transactions.service.ts`**:
- `list(userId, query)`: если `dateFrom > dateTo`, ответ `BadRequestException`.
- `get` / `update` / `remove` проверяют владельца через `findOwned`, иначе `NotFoundException('Transaction not found')`.
- `create` и `update` при переданном `categoryId` проверяют, что категория принадлежит пользователю, иначе `NotFoundException('Category not found')`. Если категория удалена между проверкой и записью, Prisma вернёт P2003: это тоже ответ 404.
- `amount` передаём в Prisma как `new Prisma.Decimal(dto.amount.toFixed(2))`, `date` как `new Date(dto.date)`, `description` обрезаем через trim (пустая строка превращается в `null`).
- `summary(userId, month, year)`: границы месяца в UTC `[Date.UTC(year, month-1, 1), Date.UTC(year, month, 1))`. Итоги считаем через `Prisma.Decimal` (без float), `balance = income − expense`, суммы отдаём строками с `toFixed(2)`. `byCategory` сортируем по `total` по убыванию.
- `toPublic()` возвращает `amount.toFixed(2)` и не отдаёт `userId`.

**`transactions.controller.ts`**: `@Controller('transactions')`, `@CurrentUser()` из `auth/decorators/current-user.decorator.ts` (JWT-гвард глобальный):
- `POST /transactions` → 201
- `GET /transactions`
- `GET /transactions/summary`. Объявить **до** `:id`, иначе маршрут перехватит `:id`.
- `GET /transactions/:id`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id` → `@HttpCode(204)`

**`transactions.module.ts`**: регистрирует контроллер и провайдеры, модуль подключается в `apps/api/src/app.module.ts`.

## 4. Изменение в модуле категорий (Restrict → 409)
`apps/api/src/modules/categories/categories.service.ts`, метод `remove`: перехватить `PrismaClientKnownRequestError` с кодом `P2003` и выбросить `ConflictException('Category has transactions and cannot be deleted')`. Добавить тест в `categories.service.spec.ts`.

## 5. Тесты
`transactions.service.spec.ts` по образцу `categories.service.spec.ts` (мок репозитория):
- NotFound для чужой или несуществующей транзакции (get/update/remove, без вызова update/delete);
- NotFound для чужой категории при create/update;
- `dateFrom > dateTo` даёт BadRequest;
- update отправляет только переданные поля;
- summary: правильные границы месяца (включая декабрь → январь следующего года), суммы и баланс на Decimal, `byCategory` с данными категории.

## Verification
1. `npm run db:start`; `cd apps/api && npx prisma migrate dev --name add_transactions && npx prisma generate`.
2. `cd apps/api && npm test`: все тесты проходят.
3. `npm run build` в корне: собираются все workspaces, в том числе web (удаление `Expense` из types ничего не ломает: в web `Expense` встречается только в тексте).
4. `npm run dev:api`, получить токен через `POST /auth/login`, дальше curl:
   - создать категорию и две транзакции (INCOME и EXPENSE) → 201, `amount` строкой;
   - `amount: -5`, `type: "FOO"`, чужой `categoryId` → 400/400/404;
   - `GET /transactions?type=EXPENSE&dateFrom=...&dateTo=...` фильтрует;
   - `GET /transactions/summary?month=9&year=2026` → итоги; без `year` → 400;
   - `PATCH`, `DELETE` → 204, повторный `GET /:id` → 404;
   - `DELETE /categories/:id` для категории с транзакциями → 409;
   - запрос без токена → 401.

## Отклонения при реализации
- **Update DTO:** для `amount`, `type`, `date` и `categoryId` вместо `@IsOptional()` стоит `@ValidateIf(v !== undefined)`. `@IsOptional` пропускает `null`, и `{"amount": null}` прошёл бы валидацию. Значение `null` разрешено только для `description`.
- **Даты:** `@IsISO8601({ strict: true })` отклоняет несуществующие даты (`2026-02-30`). Фильтр `dateTo` включает границу (`lte`), поэтому `dateTo=2026-09-30` означает полночь UTC. Чтобы включить весь день, клиент передаёт `2026-09-30T23:59:59Z`.
- **Сводка:** если в месяце нет транзакций, запрос категорий не выполняется, а итоги равны `"0.00"`.
- **Сборка:** `npm run build` в корне падает на `packages/config`: у пакета нет скрипта `build`, так было и до изменений. `apps/api`, `apps/web` и `packages/types` собираются.
