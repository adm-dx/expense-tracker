# План: виджеты Income / Expenses / Balance с выбором периода

> Ветка: `feat/web-home-screen` (поверх 4 коммитов главного экрана).

## Context

На главном экране есть таблица транзакций, но нет сводки. Нужны три виджета над таблицей — доходы, расходы, баланс — за текущий календарный месяц по умолчанию или за выбранный пользователем период.

Решения пользователя:
- **API**: `GET /transactions/summary` расширяем парой `dateFrom`/`dateTo`; `month`+`year` остаются как альтернативный способ задать месяц.
- **Один период на весь экран**: переключатель фильтрует и виджеты, и таблицу (`GET /transactions` уже принимает `dateFrom`/`dateTo`).
- **UI периода**: `Select` с пресетами (This month, Last month, Last 30 days, This year, Custom) + два `<input type="date">` для своего диапазона. Без новых зависимостей.

Вне скоупа: разбивка по категориям (`byCategory` уже отдаётся API, но на экране пока не показываем), графики.

## 1. API — период в summary

**`apps/api/src/modules/transactions/dto/summary.query.ts`** — все поля опциональные:
- `month` (`@IsInt() @Min(1) @Max(12)`), `year` (`@IsInt() @Min(1970) @Max(9999)`) — как сейчас, но опциональные;
- `dateFrom`, `dateTo` — `@IsISO8601({ strict: true })`.

**`transactions.service.ts` `summary(userId, query)`** — правила разрешения периода (валидация — `BadRequestException`):
1. `month`/`year` заданы вместе → период = этот UTC-месяц; по отдельности → 400;
2. одновременно `month|year` и `dateFrom|dateTo` → 400 («use either month/year or dateFrom/dateTo»);
3. иначе период = `dateFrom`/`dateTo` (любая граница может отсутствовать), по умолчанию — текущий UTC-месяц;
4. `dateFrom > dateTo` → 400 (та же проверка, что в `list`, — вынести в приватный хелпер и переиспользовать).

**Согласованность с таблицей:** сейчас `list` фильтрует `date gte/lte`, а `summary` — `gte/lt`. Чтобы одни и те же строки попадали в обе выдачи, `TransactionsRepository.sumByTypeAndCategory(userId, filters: TransactionFilters)` переводим на общий `buildWhere()` (уже есть в репозитории после добавления пагинации), т.е. границы включительные.

**Ответ** `TransactionSummary`: вместо `month`/`year` — `dateFrom`/`dateTo` (ISO-строки фактически применённого периода), остальное (`totalIncome`, `totalExpense`, `balance`, `byCategory`) без изменений. Правим `transactions/types.ts` и `packages/types/src/index.ts` (`SummaryParams { month?, year?, dateFrom?, dateTo? }`).

**`transactions.controller.ts`** — передаёт весь `SummaryQuery` в сервис.

**`transactions.service.spec.ts`** — обновить блок `summary`: месяц через `month/year`, произвольный диапазон, дефолт (текущий месяц), 400 на `dateFrom > dateTo` и на смешивание режимов, вызов репозитория с фильтрами.

## 2. Web — период как общее состояние

**`apps/web/src/shared/lib/period.ts`** (новый): тип `Period { dateFrom: string; dateTo: string }` в формате `YYYY-MM-DD`, пресеты `this-month` (дефолт), `last-month`, `last-30-days`, `this-year`, `custom` и `getPresetPeriod(preset): Period`. Границы считаем от локального «сегодня» (`todayDateInputValue()` из `shared/lib/format.ts`), в API отправляем через существующий `toIsoDate()` — даты транзакций хранятся как UTC-полночь.

**`entities/transaction/model/store.ts`** — добавить `period: Period`, `preset`, `setPeriod(period, preset)`; `setPeriod` сбрасывает `page = 1`; `fetch()` передаёт `dateFrom`/`dateTo` в `transactionsApi.list`; `reset()` возвращает дефолтный период.

**`entities/transaction/model/summary-store.ts`** (новый, по образцу существующих сторов): `summary`, `status`, `error`, `fetch()` — читает период из `useTransactionsStore.getState()` и зовёт `transactionsApi.summary(...)`; тот же guard от устаревших ответов (`latestRequestId`), что в списке. Экспорт из `entities/transaction/index.ts`.

**`shared/api/transactions-api.ts`** — метод `summary(params: SummaryParams)`.

**`shared/lib/format.ts`** — `formatCurrency(amount: string)` (знак только у отрицательных, в отличие от `formatAmount`) и `formatPeriod(period)` для подписи «Sep 1 – Sep 30, 2026».

## 3. Web — UI

**`features/transaction/period-filter`** (новая фича): `ui/period-filter.tsx` — `Select` пресетов + два `<input type="date">` (видны при `custom`, `dateFrom` ограничен `max={dateTo}` и наоборот); `onChange` → `setPeriod(...)`. `index.ts` экспортирует `PeriodFilter`.

**`widgets/transactions-summary`** (новый виджет): `ui/transactions-summary.tsx` — `PeriodFilter` + сетка из трёх `Card` (`grid gap-4 sm:grid-cols-3`): Income (зелёный), Expenses (красный), Balance (зелёный/красный по знаку), у каждой подпись с периодом; `useEffect` на `period` вызывает `fetch()` из summary-стора; скелетоны при загрузке, `Alert` + Retry при ошибке — как в `widgets/transactions-table`.

**`widgets/transactions-table/ui/transactions-table.tsx`** — эффект дополнительно подписан на `period` (рефетч при смене периода). После мутаций (`features/transaction/upsert` и `.../delete`) кроме списка обновляем и сводку: добавить вызов `useSummaryStore.getState().fetch()` рядом с существующим `useTransactionsStore.getState().fetch()`.

**`app/page.tsx`** — `<TransactionsSummary />` между заголовком и `<TransactionsTable />`; страница остаётся серверным компонентом.

## Verification

1. `cd apps/api && npm test` (обновлённые тесты `summary`), `npx tsc --noEmit`, `npm run build`.
2. `cd apps/web && npx tsc --noEmit && npm run lint && npm run build`.
3. curl (на тестовом пользователе с транзакциями за сентябрь 2026):
   - `GET /transactions/summary` без параметров → период = текущий месяц;
   - `?dateFrom=2026-09-01T00:00:00.000Z&dateTo=2026-09-10T00:00:00.000Z` → суммы только за первые 10 дней, `total` совпадает с суммой `items` из `GET /transactions` с теми же датами;
   - `?month=9&year=2026` → тот же результат, что и полный сентябрь;
   - `?month=9` → 400; `?month=9&year=2026&dateFrom=...` → 400; `dateFrom > dateTo` → 400.
4. Браузер (`npm run dev`): по умолчанию «This month», суммы сходятся с таблицей; переключение пресетов и своего диапазона меняет и виджеты, и таблицу (страница сбрасывается на 1); добавление/редактирование/удаление транзакции обновляет и виджеты; при отрицательном балансе он красный.
5. Коммиты в `feat/web-home-screen` (api + web), запушить ветку (нужен вход в GitHub — прошлый `git push` не прошёл).

## Отклонения при реализации

- **Границы периода включительные с обеих сторон.** `summary` раньше считал `gte from, lt to`; теперь и список, и сводка используют общий `buildWhere()` (`gte/lte`), а конец месяца — `23:59:59.999Z`. Так суммы виджетов всегда совпадают со строками таблицы.
- **Ответ `TransactionSummary`** отдаёт `dateFrom`/`dateTo` вместо `month`/`year` (это фактически применённый период). `month`+`year` остались только как способ задать запрос.
- **Период живёт в `entities/transaction`** (`period` + `preset` в сторе списка), summary-стор читает его оттуда. Оба виджета подписаны на `period` и перезапрашивают данные сами.
- **Пресет `custom`** не пересчитывает даты, а только оставляет текущие и разблокирует поля; ручное изменение любой даты переключает пресет в `custom`. Поля `From`/`To` видны всегда (так нагляднее, чем прятать их до выбора `custom`), ограничены `min`/`max` друг относительно друга.
- **Мутации** (создание, редактирование, удаление) и выход обновляют/сбрасывают и сводку — рядом с существующими вызовами стора списка.
- **`DEFAULT_PERIOD`** вычисляется один раз при загрузке модуля: вкладка, открытая через смену месяца, покажет прежний период до перезагрузки — приемлемо.
