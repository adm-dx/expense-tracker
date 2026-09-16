# План: модуль категорий расходов (backend)

## Context
Пользователю нужно управлять личными категориями расходов: создавать, изменять, удалять и искать. Категория хранит id, название, цвет и иконку (ключ из набора, напр. `shopping-cart`). Сейчас `Expense.category` — просто строка; заменяем её на FK `categoryId`. Объём — только API (фронтенд пока пустой).

## 1. Prisma (`apps/api/prisma/schema.prisma`)
```prisma
model Category {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String    @db.VarChar(50)
  color     String    @db.VarChar(7)   // #RRGGBB
  icon      String    @db.VarChar(50)  // kebab-case ключ иконки
  expenses  Expense[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("categories")
  @@unique([userId, name])
  @@index([userId])
}
```
- `User`: добавить `categories Category[]`.
- `Expense`: удалить `category String`, добавить `categoryId String?` + `category Category? @relation(..., onDelete: SetNull)` и `@@index([categoryId])`.
- Миграция: `cd apps/api && npx prisma migrate dev --name add_categories` (данные колонки `expenses.category` теряются — модуля расходов ещё нет, это допустимо).

## 2. Общие типы (`packages/types/src/index.ts`)
- `Category`: `{ id; name; color: string; icon: string; createdAt: Date; updatedAt: Date }` (color/icon обязательные).
- `Expense`: `category: string` → `categoryId: string | null`.
- Добавить `CreateCategoryRequest`, `UpdateCategoryRequest` (все поля опциональны).

## 3. NestJS-модуль `apps/api/src/modules/categories/`
По образцу `users` (repository → service, Prisma P2002 → ConflictException как в `users.service.ts`):

- `categories.repository.ts` — `findManyByUser(userId, search?)` (`name: { contains, mode: 'insensitive' }`, `orderBy: name asc`), `findByIdForUser(id, userId)` (`findFirst`), `create`, `update(id, data)`, `delete(id)`.
- `categories.service.ts` — `list(userId, search?)`, `get(userId, id)` (NotFoundException если нет/чужая), `create(userId, dto)`, `update(userId, id, dto)`, `remove(userId, id)`; trim имени; P2002 → `ConflictException('Category with this name already exists')`; `toPublic()` без `userId`.
- `categories.controller.ts` — `@Controller('categories')`, пользователь через `@CurrentUser()` из `auth/decorators/current-user.decorator.ts` (JWT-гвард уже глобальный через `APP_GUARD`):
  - `GET /categories?search=` — список + поиск
  - `GET /categories/:id`
  - `POST /categories` → 201
  - `PATCH /categories/:id`
  - `DELETE /categories/:id` → 204
- `dto/create-category.dto.ts` — class-validator (стиль `auth/dto/register.dto.ts`): `name` `@IsString @IsNotEmpty @MaxLength(50)`; `color` `@Matches(/^#[0-9a-fA-F]{6}$/)`; `icon` `@Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(50)`.
- `dto/update-category.dto.ts` — те же поля с `@IsOptional()` (без `@nestjs/mapped-types`, если его нет в зависимостях; учесть `exactOptionalPropertyTypes` — поля `name?: string`, при передаче в Prisma не подставлять `undefined` явно).
- `dto/search-categories.query.ts` — `search?` `@IsOptional @IsString @MaxLength(50)`.
- `categories.module.ts` — controllers/providers; подключить в `apps/api/src/app.module.ts`.

## 4. Тесты
- `categories.service.spec.ts` (по образцу `users.service.spec.ts`, мок репозитория): P2002 → Conflict на create/update; NotFound для чужой/несуществующей категории на get/update/remove; trim имени; передача search в репозиторий.

## Verification
1. `npm run db:start`; в `apps/api`: `npx prisma migrate dev --name add_categories`, `npx prisma generate`.
2. `cd apps/api && npm test` — все тесты зелёные; `npm run lint`, `npm run build`.
3. `npm run dev:api`, получить токен через `POST /auth/login`, затем curl: создать категорию, дубликат имени → 409, невалидный цвет → 400, `GET /categories?search=foo` (регистр не важен), `PATCH`, `DELETE` → 204, повторный GET → 404; запрос без токена → 401.

## Отклонения при реализации
- **Тип ответа API объявлен локально.** Импорт `@expense-tracker/types` из `categories.service.ts` ломал `tsc` (TS6059: `packages/types/src/index.ts` вне `rootDir` `apps/api/src`). Поэтому `PublicCategory` вынесен в `apps/api/src/modules/categories/types.ts` — так же, как в модуле `users` (`users/contracts/types.ts`). Он совпадает с `Category` из `packages/types`, при изменении полей нужно править оба места.
- **ESLint не запускался:** в проекте нет `eslint.config.js` (ESLint 9), так было и до изменений. Новые файлы отформатированы Prettier.
- **Нормализация данных:** сервис обрезает пробелы в `name` и приводит `color` к верхнему регистру; пустой `search` игнорируется.
