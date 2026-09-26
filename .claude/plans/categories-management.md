# План: модуль «Категории» (API + страница /categories)

> Файл плана: `.claude/plans/categories-management.md`.
> Ветка: `feat/categories-management` от свежего `main` (после мержа `feat/weather-widget`). PR: #10.
> Коммиты: `feat(types)`, `feat(api)`, `feat(web)`, `test`, `docs`, плюс два `fix(web)` для выравнивания формы.

## Контекст

Сейчас на странице «Категории» (`apps/web/src/app/(app)/categories/page.tsx`) стоит заглушка. API категорий уже умеет почти всё: `GET/POST/PATCH/DELETE /categories`, проверку владельца, ответ 409 на повтор имени и на удаление категории с транзакциями. Покрыт юнит- и интеграционными тестами. Не хватает трёх вещей:

1. Иконки ничем не ограничены (принимается любая kebab-строка), а фронт их нигде не рисует. Вместо иконок в таблице показана цветная точка.
2. Категорию с транзакциями нельзя удалить. Нужно удаление с переносом транзакций в другую категорию.
3. На фронте нет UI для управления категориями.

Что решили:

- Категорию обозначает **иконка, а не цвет**. Пользователь меняет только название и иконку.
- Иконку выбирают во всплывающем окне из стандартного набора дизайн-системы (lucide, на нём построен shadcn).
- Список допустимых иконок общий и лежит в `@expense-tracker/types`.
- При удалении категории с транзакциями их переносят в другую категорию.

Ветка: `feat/categories-management` от свежего `main`. Текущая `feat/weather-widget` к этой задаче не относится.

## 1. Общие типы — `packages/types/src/index.ts`

- `CATEGORY_ICONS = [...] as const` — около 30–40 ключей lucide в kebab-case, сгруппированных по смыслу: еда (`utensils`, `coffee`, `pizza`, `shopping-cart`), транспорт (`car`, `bus`, `fuel`, `plane`), дом (`house`, `lightbulb`, `wifi`), здоровье (`heart-pulse`, `pill`), развлечения (`clapperboard`, `gamepad-2`, `music`), покупки (`shopping-bag`, `shirt`, `gift`), деньги (`banknote`, `wallet`, `piggy-bank`, `credit-card`, `trending-up`), прочее (`graduation-cap`, `baby`, `paw-print`, `dumbbell`, `circle-ellipsis`). Плюс `type CategoryIcon`.
- `Category.icon: CategoryIcon`. В `Category` добавить `transactionCount: number`, он нужен странице для диалога удаления.
- `CreateCategoryRequest`: `{ name; icon; color? }`. `UpdateCategoryRequest`: `{ name?; icon? }`.
- Добавить `DeleteCategoryOptions { reassignTo?: string }`.

## 2. API — `apps/api/src/modules/categories/`

**DTO**

- В `create-category.dto.ts` и `update-category.dto.ts` для `icon` поставить `@IsIn(CATEGORY_ICONS)` вместо `ICON_KEY_PATTERN`.
- В create поле `color` сделать необязательным. Из update его убрать: цвет больше не редактируется.
- Новый `dto/delete-category.query.ts`: `reassignTo?: string` (`@IsOptional @IsString @IsNotEmpty`).

**Цвет.** Колонку в БД оставляем: её использует сводка (`TransactionCategorySummary.color`), и миграция не нужна. Если `color` не передан, сервис берёт его из небольшой палитры (`CATEGORY_COLORS` в `default-categories.ts`) по кругу, например по числу категорий пользователя. В UI цвет больше не выводится.

**Дефолтные категории** (`default-categories.ts`): у Salary заменить `wallet` на `banknote` («значок денег»), остальные иконки уже подходят по смыслу. Для существующих пользователей добавить SQL-миграцию `UPDATE "Category" SET icon='banknote' WHERE name='Salary' AND icon='wallet'`, чтобы не трогать иконки, которые пользователь поменял сам. Все текущие ключи есть в `CATEGORY_ICONS`, поэтому старые данные остаются валидными.

**Список с количеством транзакций.** `findManyByUser` получает `include: { _count: { select: { transactions: true } } }`, `toPublic` возвращает `transactionCount`. Для `get`/`create`/`update` количество считается тем же `_count`, у новой категории оно равно 0.

**Удаление с переносом** (`DELETE /categories/:id?reassignTo=<id>`):

- Сервис проверяет, что обе категории принадлежат пользователю (`findOwned`), иначе 404. Если `reassignTo === id`, отвечает 400.
- Репозиторий делает новый `reassignAndDelete(fromId, toId, userId)` через `prisma.$transaction([transaction.updateMany({ where: { categoryId: fromId, userId }, data: { categoryId: toId } }), category.delete(...)])`. Всё происходит атомарно. Прецедент уже есть: `transactions.repository.ts` сам читает таблицу `Category`. Через CQRS-команду атомарность не обеспечить.
- Без `reassignTo` поведение прежнее: при наличии транзакций ответ 409 (`FOREIGN_KEY_VIOLATION`).
- Контроллер: `@Query() query: DeleteCategoryQuery` → `service.remove(user.sub, id, query.reassignTo)`.

## 3. Web

**shared**

- `shared/api/categories-api.ts`: добавить `create`, `update`, `remove(id, { reassignTo })` рядом с `list`.
- `shared/ui`: `npx shadcn@latest add popover` (ставит `@radix-ui/react-popover`). Если CLI предложит перейти на Tailwind v4, отказаться. Экспортировать компонент из `shared/ui/index.ts`.

**entities/category**

- `ui/category-icon.tsx`: `CategoryIcon({ icon, className })` рисует нужный компонент lucide по ключу. В `lib/icons.ts` лежит карта `Record<CategoryIcon, LucideIcon>`, и TypeScript проверяет, что каждому ключу из types соответствует иконка. Для неизвестного ключа выводится запасная `circle-ellipsis`.
- Стор без изменений: после мутаций достаточно вызвать `load({ force: true })`. Экспортировать `CategoryIcon` из `index.ts`.

**features/category/** (группа без общего barrel, как `features/transaction/*`)

- `upsert/`: `model/schema.ts` (Zod: `name` trim 1–50, `icon` enum из `CATEGORY_ICONS`), `model/use-upsert-category.ts` (по образцу `use-upsert-transaction.ts`: отправлять только изменённые поля, показывать тост и вызывать `useCategoriesStore.getState().load({ force: true })`), `ui/category-dialog.tsx` + `ui/category-form.tsx` (Dialog + RHF), `ui/icon-picker.tsx` (Popover: кнопка с текущей иконкой, внутри сетка иконок с `aria-label` и выделением выбранной; клавиатурная навигация через кнопки).
- `delete/`: `model/use-delete-category.ts`, `ui/delete-category-dialog.tsx` (по образцу `delete-transaction-dialog.tsx`). Если `transactionCount > 0`, показывать текст «N транзакций будут перенесены в…» и Select с остальными категориями. Пока цель не выбрана, кнопка «Удалить» неактивна. Если категория последняя и у неё есть транзакции, удалить её нельзя, об этом выводится поясняющий текст.
- После удаления или переименования обновлять ещё `useTransactionsStore.fetch()` и `useSummaryStore.fetch()`: в сводке имя и иконка приходят с сервера, а у транзакций мог смениться `categoryId`.

**widgets/categories-list** — список карточек или таблица: иконка, название, число транзакций, меню «Изменить/Удалить» (по образцу `transactions-table.tsx`), кнопка «Добавить категорию». Состояния загрузки, ошибки и пустого списка.

**app/(app)/categories/page.tsx** — заменить заглушку на `<CategoriesList />`, метаданные оставить.

**Цвет → иконка в остальном UI:** в `widgets/transactions-table/ui/transactions-table.tsx` (стр. ~139) заменить цветную точку на `<CategoryIcon>`. В сводке, если там выводятся категории, сделать так же.

## 4. Тесты

- **Unit API** `tests/unit/api/modules/categories/categories.service.spec.ts`: цвет по умолчанию при create, `remove` с `reassignTo` (обе категории свои, чужая цель дает 404, `reassignTo === id` дает 400, вызывается `reassignAndDelete`).
- **Integration** `tests/integration/api/categories.spec.ts`: 400 на иконку не из списка; POST без `color`; PATCH игнорирует `color` (`forbidNonWhitelisted` вернёт 400); `transactionCount` в GET; DELETE с `reassignTo` переносит транзакции и удаляет категорию; перенос в чужую категорию дает 404 и ничего не меняет. В `tenant-isolation.spec.ts` добавить случай с `reassignTo`. В тесте дефолтных категорий учесть `banknote`.
- **Unit web**: `tests/unit/web/features/category/schema.spec.ts`, `use-upsert-category.spec.ts`, `use-delete-category.spec.ts`, `icon-picker.spec.tsx` (открыть, выбрать, вызвать onChange), `delete-category-dialog.spec.tsx` (Select переноса показывается только при `transactionCount > 0`). Отдельно проверить, что карта иконок покрывает все `CATEGORY_ICONS`.

## 5. Документация

В `CLAUDE.md` обновить абзац о модели Category (иконки из `CATEGORY_ICONS`, цвет назначается сервером, `DELETE ?reassignTo=`) и описание фронта (`features/category/*`, `widgets/categories-list`).

## Проверка

1. `npm run build -w packages/types`, затем `npm run lint`, `npm run build`.
2. `npm test`; `npm run db:test:start && npm run test:integration && npm run test:e2e`.
3. Вручную (`npm run db:start`, `npm run dev`): на /categories видно 8 дефолтных категорий с иконками. Создать категорию с иконкой из попапа, переименовать её, сменить иконку, попробовать задвоить имя (тост 409). Удалить категорию с транзакциями с переносом и убедиться, что транзакции в таблице и сводке теперь в новой категории. На главной в таблице вместо цветной точки показывается иконка.

## Итоги реализации

План выполнен. Ниже отличия от него и то, что выяснилось по ходу работы.

- **API и `@expense-tracker/types`.** API впервые импортирует из пакета значение времени выполнения (`CATEGORY_ICONS` для `@IsIn`). Сборка с сопоставлением `paths` на `packages/types/src` падала: исходники пакета выходят за `rootDir: ./src` (TS6059). Поэтому:
  - `paths` из `apps/api/tsconfig.json` убран, и API берёт собранный `dist` через `node_modules`;
  - в `apps/api` добавлены `prebuild`/`predev`, которые сначала собирают типы;
  - Jest по-прежнему берёт исходники.
- **Иконки на фронте.** Компонент берётся из статической карты `CATEGORY_ICON_COMPONENTS` по ключу из `resolveCategoryIcon()`. Функция, возвращающая компонент (`getCategoryIcon()`), не прошла lint: правило `react-hooks/static-components` считает такой компонент созданным во время рендера.
- **Удаление.** Перенос и обычное удаление обёрнуты в одну обработку FK-ошибки. Если между проверкой и удалением появилась транзакция, API отвечает 409, а не 500. На 409 диалог перезагружает счётчики и предлагает выбрать категорию для переноса.
- **Форма категории.** Поля «Icon» и «Name» стоят рядом, и оба `FormItem` должны быть `flex flex-col`. У `Label` класс `leading-none`: строчная подпись берёт высоту строки от родителя, и тогда подписи и поля разъезжаются на несколько пикселей.
- **Наблюдение.** При сохранении `packages/types/src/index.ts` что-то снаружи (скорее всего, IDE) компилирует рядом `index.js`/`.d.ts`/`.js.map`. Эти файлы не коммитить.

### Проверка

- `npm run lint`, `npm run build`: проходят.
- `npm test`: 348 тестов, `npm run test:integration`: 199, `npm run test:e2e`: 29. Все проходят.
- Вручную проверено выравнивание в диалоге редактирования. Полный сценарий на `/categories` после `npx prisma migrate dev` ещё предстоит проверить.
