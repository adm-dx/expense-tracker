# План: мультивалютность (EUR / RSD / HUF) и выбор валюты отображения

> Ветка: `feat/multi-currency` от свежего `main` (после мержа `feat/web-sidebar-navigation`).
> Коммиты: `feat(types)`, `feat(api)` (миграция + модуль курсов + транзакции), `feat(web)`, `test`, `docs`.

## Context

У транзакции сейчас нет валюты (`amount Decimal(12,2)` без единицы), таблица и карточки Income / Expenses / Balance показывают «голые» числа. Нужно:

1. Транзакция хранит свою валюту (`EUR` | `RSD` | `HUF`), её можно выбрать при создании/редактировании.
2. Дропдаун валюты отображения в хедере слева от кнопки профиля; при выборе все суммы (таблица и карточки) пересчитываются в эту валюту **по курсу на сегодня**.
3. Валюта отображения по умолчанию RSD, выбор сохраняется в `localStorage`.

### Принятые решения (согласованы с пользователем)

- **Источник курсов — ExchangeRate-API open access**: `GET https://open.er-api.com/v6/latest/EUR`, без ключа, обновление раз в сутки, есть RSD/HUF/EUR; требуется ссылка-атрибуция в UI. Провайдер за интерфейсом `ExchangeRatesProvider` — заменяем без правок остального кода.
- **Пересчёт на бэкенде** (`?currency=` в `GET /transactions` и `GET /transactions/summary`): сводка агрегируется в SQL, считать на клиенте нельзя; конвертация в `Prisma.Decimal`.
- **Курс «сегодня»**, исходные `amount` + `currency` хранятся неизменными.
- **Существующие транзакции** при миграции → `RSD`.
- **Валюта отображения** — только клиент (`localStorage`), настройка устройства: не сбрасывается при logout/login.
- **Дефолт валюты в форме новой транзакции — `RSD`** (`DEFAULT_CURRENCY`), независимо от валюты отображения.

Вне скоупа: курс на дату транзакции, история курсов в БД, серверная настройка валюты, фильтр по валюте, другие валюты.

## 1. Общие типы — `packages/types/src/index.ts`

```ts
export const CURRENCIES = ['RSD', 'EUR', 'HUF'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'RSD';
```

- `Transaction` + `currency: Currency`.
- `TransactionListItem extends Transaction` + `convertedAmount: string`.
- `TransactionsPage extends PaginatedResponse<TransactionListItem>` + `currency: Currency`, `ratesDate: string | null` (`null` — пересчёт не понадобился).
- `CreateTransactionRequest` + `currency: Currency` (обязательное); `UpdateTransactionRequest` + `currency?`.
- `ListTransactionsParams`, `SummaryParams` + `currency?: Currency`.
- `TransactionSummary` + `currency`, `ratesDate: string | null`.
- `ExchangeRates { base: Currency; date: string; rates: Record<Currency, string> }`.

## 2. API — схема и миграция

`apps/api/prisma/schema.prisma`: `enum Currency { RSD EUR HUF }`, в `Transaction` — `currency Currency @default(RSD)`.
Из `apps/api`: `npx prisma migrate dev --name add_transaction_currency` (колонка `NOT NULL DEFAULT 'RSD'` → старые строки получают RSD). Индексов не добавляем.

## 3. API — модуль `exchange-rates` (по образцу `modules/categories`, CQRS)

```
apps/api/src/modules/exchange-rates/
  contracts/{queries/get-exchange-rates.query.ts, types.ts, index.ts}  // ExchangeRatesSnapshot { base, date: Date, rates: Map<Currency, Prisma.Decimal> }
  handlers/get-exchange-rates.handler.ts
  providers/exchange-rates.provider.ts   // abstract class = DI-токен: fetchLatest()
  providers/open-er-api.provider.ts      // глобальный fetch (Node 24), без новых зависимостей
  exchange-rates.service.ts              // кэш + convert()
  exchange-rates.controller.ts           // GET /exchange-rates (под JwtAuthGuard)
  exchange-rates.module.ts
```

- **`OpenErApiProvider`**: `fetch(`${EXCHANGE_RATES_URL}/latest/EUR`, { signal: AbortSignal.timeout(5000) })`; проверка `result === 'success'` и наличия всех трёх кодов, иначе ошибка; числа → `new Prisma.Decimal(String(rate))`; дата из `time_last_update_unix`. `EXCHANGE_RATES_URL` через `ConfigService`, дефолт `https://open.er-api.com/v6`.
- **`ExchangeRatesService.getRates()`**: кэш в памяти на текущую UTC-дату; параллельные вызовы делят один промис. При ошибке провайдера и наличии старого кэша — отдаём его (`Logger.warn`, повтор не чаще раза в 10 минут); без кэша — `ServiceUnavailableException('Exchange rates are unavailable')`.
- **`convert(amount, from, to, snapshot)`**: `from === to` → как есть; иначе `amount × rates[to] / rates[from]` без округления.
- Модуль наружу отдаёт только `contracts`; `transactions` использует `QueryBus` + `GetExchangeRatesQuery`. `ExchangeRatesModule` — в `apps/api/src/app.module.ts`.

## 4. API — транзакции (`apps/api/src/modules/transactions/`)

- **DTO**: `CreateTransactionDto` — `@IsEnum(Currency) currency!`; `UpdateTransactionDto` — `currency?` через `@ValidateIf((_, v) => v !== undefined)` + `@IsEnum` (как соседние поля); `ListTransactionsQuery`, `SummaryQuery` — `@IsOptional() @IsEnum(Currency) currency?`.
- **`types.ts`**: `PublicTransaction` + `currency`; `PublicTransactionListItem` + `convertedAmount`; `TransactionsPage`; `TransactionSummary` + `currency`, `ratesDate`.
- **Репозиторий**: `sumByTypeAndCategory` группирует по `['type', 'categoryId', 'currency']`, `TransactionSumRow` + `currency`. `buildWhere` не меняется.
- **Сервис** (внедрить `QueryBus`):
  - `create`/`update`/`toPublic` — поле `currency`.
  - общий хелпер `loadRatesIfNeeded(currencies, target)` — курсы запрашиваются только если есть валюта ≠ `target`; иначе `ratesDate: null` (список работает при недоступном внешнем API).
  - `list`: `target = query.currency ?? DEFAULT_CURRENCY`, `convertedAmount = convert(...).toFixed(2)` на строку.
  - `summary`: каждая группа конвертируется в `target`, `byCategory` сливает `(type, categoryId)` из разных валют, `toFixed(2)` только на итогах.
- **Согласованность**: при смешанных валютах сумма округлённых строк может отличаться от карточки на ≤ 0.01 × число строк — ожидаемо; в e2e точное совпадение проверяем для одной валюты, для смешанных — с допуском.

## 5. Web — валюта отображения

- **`entities/currency/`** (новый слайс):
  - `model/store.ts` — `useCurrencyStore` (`currency`, `setCurrency`, `hasHydrated`), `persist` с `name: 'display-currency'`, `skipHydration: true`, `partialize` → `currency`, `onRehydrateStorage` → `setHasHydrated(true)`, невалидное значение → RSD. Образец — `entities/session/model/store.ts`. **Не** регистрирует `registerStoreReset`.
  - `model/rates-store.ts` — `useExchangeRatesStore` (`rates`, `status`, `load()` с `latestRequestId`), регистрирует reset.
  - `ui/currency-hydration.tsx` — как `entities/session/ui/session-hydration.tsx`; монтируется в `apps/web/src/app/layout.tsx`.
- **`shared/api/exchange-rates-api.ts`** — `get()`; `shared/api/transactions-api.ts` — `list` → `TransactionsPage`.
- **Связь с транзакциями** (без sideways-импорта entities):
  - `entities/transaction/model/store.ts`: `currency: Currency | null` (`null` = не синхронизирована), `setCurrency` (страницу не сбрасывает), `fetch()` при `null` — no-op, передаёт `currency`; хранит `ratesDate`; `reset()` чистит данные, но сохраняет `currency`.
  - `summary-store.ts` читает `currency` из `useTransactionsStore.getState()`, как `period`.
  - `features/currency/select/ui/display-currency-sync.tsx` — после `hasHydrated` пишет валюту в `useTransactionsStore.setCurrency`; монтируется в `app/(app)/layout.tsx`.
  - `widgets/transactions-table`, `widgets/transactions-summary`: `currency` в зависимостях эффектов `fetch()`; при `null` — скелетоны (нет лишнего запроса в RSD до гидрации).
- **`features/currency/select/ui/currency-select.tsx`**: `DropdownMenu`, триггер `Button variant="ghost" size="sm"` (код + `ChevronDown`), `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` (есть в `shared/ui/dropdown-menu.tsx`, добавить в барель `shared/ui/index.ts`); внизу — курсы к выбранной валюте, дата, ссылка «Rates by ExchangeRate-API»; курсы грузятся при первом открытии; до гидрации — disabled-кнопка той же ширины. `index.ts` → `CurrencySelect`, `DisplayCurrencySync`.
- **`widgets/app-header/ui/app-header.tsx`**: `ml-auto` переносится на обёртку `flex items-center gap-2` с `<CurrencySelect />` и кнопкой профиля.

## 6. Web — отображение сумм

- **`shared/lib/format.ts`**: `formatMoney(amount, currency)` — `Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' })`, форматтеры кэшируются по валюте; `formatAmount(amount, type, currency)` со знаком; вызовы `formatCurrency` → `formatMoney`.
- **Таблица**: Amount = `convertedAmount`; если `transaction.currency !== currency` — ниже мелко исходная сумма; заголовок `Amount (EUR)`.
- **Сводка**: `formatMoney(summary.totalIncome, summary.currency)` и т.д.; к подписи периода — «rate of 26 Sep 2026», если `ratesDate !== null`.
- 503 показывается существующими `Alert` + Retry.

## 7. Web — валюта в форме транзакции (`features/transaction/upsert/`)

- `model/schema.ts`: `currency: z.enum(CURRENCIES)`.
- `ui/transaction-form.tsx`: поле `Currency` (`Select`) рядом с `Amount` (первая строка `grid-cols-[1fr_1fr_110px]`, на узком экране `grid-cols-2`). В `toFormValues`: новая транзакция → `currency: DEFAULT_CURRENCY` (RSD); редактирование → `transaction.currency`. Смена валюты не пересчитывает сумму.
- `model/use-upsert-transaction.ts`: `currency` в `create`; в `buildUpdate` — `if (values.currency !== transaction.currency) body.currency = values.currency`.

## 8. Тесты

- **Unit (API)**: новые `tests/unit/api/modules/exchange-rates/exchange-rates.service.spec.ts` (кэш на день, смена UTC-дня через fake timers, dedupe, stale fallback, 503 без кэша, `convert` включая кросс-курс) и `open-er-api.provider.spec.ts` (mock `global.fetch`: успех, `result: 'error'`, нет RSD, таймаут); `transactions.service.spec.ts` — currency в create/update, `list` без чужих валют не зовёт `QueryBus`, `summary` сливает группы и округляет только итог.
- **Unit (web)**: `entities/currency/store.spec.ts` (дефолт RSD, восстановление, мусор → RSD, reset сессии не трогает); `entities/transaction/store.spec.ts`, `summary-store.spec.ts` (передача `currency`, no-op при `null`, reset сохраняет валюту); `features/currency/currency-select.spec.tsx` (+ sync); `features/transaction/schema.spec.ts`, `use-upsert-transaction.spec.ts` (currency, дефолт RSD в форме); `shared/lib/format.spec.ts` (`formatMoney`).
- **Integration** (`overrideProvider(ExchangeRatesProvider)` фейком с фиксированными курсами в `tests/setup/app.ts`, без сети): `transactions.validation.spec.ts` (нет/неверная валюта → 400, `currency=USD` в query → 400, `PATCH { currency: null }` → 400); `transactions.repository.spec.ts` (группы по валюте); новый `exchange-rates.spec.ts` (401 без токена; курсы фейка; провайдер падает при пустом кэше → смешанный список 503, одновалютный 200); `tenant-isolation.spec.ts` остаётся зелёным.
- **E2E** `tests/e2e/api/home-screen.e2e-spec.ts`: транзакции в трёх валютах → `list`/`summary?currency=EUR` согласованы в пределах допуска, HUF даёт ожидаемые по фейку цифры, исходные `amount`/`currency` не меняются.

## 9. Документация

- `CLAUDE.md`: модуль `exchange-rates`, `Transaction.currency`, `entities/currency` и правило «валюта отображения не сбрасывается при смене сессии», `EXCHANGE_RATES_URL`.
- `.env.example`: `EXCHANGE_RATES_URL="https://open.er-api.com/v6"`.

## Verification

1. `cd apps/api && npx prisma migrate dev --name add_transaction_currency && npx prisma generate`; старые транзакции — `RSD`.
2. `npm test`; `npm run db:test:start && npm run test:integration && npm run test:e2e`.
3. `npm run lint`, `npm run build`.
4. curl с токеном: `GET /exchange-rates` (второй вызов без внешнего запроса); `POST /transactions` без `currency` → 400, с `EUR` → 201; `GET /transactions?currency=RSD` → у EUR-строки `amount`, `currency: 'EUR'`, `convertedAmount`; `GET /transactions/summary?currency=HUF` → итоги в HUF, сегодняшний `ratesDate`.
5. Браузер (`npm run dev`): по умолчанию RSD; EUR → таблица и карточки пересчитаны, у чужих валют видна исходная сумма; reload и logout/login сохраняют EUR без мигания RSD; в дропдауне курсы, дата, атрибуция; новая транзакция по умолчанию в RSD, можно выбрать EUR/HUF, редактирование показывает исходную валюту; при недоступном `open.er-api.com` на холодном старте API — Alert с Retry.
