# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an npm workspaces monorepo for an expense tracking application with:

- **Frontend**: Next.js 16 with App Router, React 19, TypeScript 6 (strict), Tailwind CSS 3, Zustand, React Hook Form + Zod
- **Backend**: NestJS 12 (+ `@nestjs/cqrs`, `@nestjs/jwt`), Prisma ORM 7, TypeScript 6 (strict)
- **Database**: PostgreSQL 16 (via Docker Compose)
- **Shared packages**: `@expense-tracker/types` (common types), `@expense-tracker/config` (ESLint/Prettier/TypeScript configs)
- **Runtime**: Node.js 24.9+ (the Jest setup relies on `require(esm)`, see Testing)

## Development Commands

### Starting the Application

```bash
# Start PostgreSQL (required first time)
npm run db:start

# Start both frontend and backend concurrently
npm run dev

# Start only frontend (http://localhost:3000)
npm run dev:web

# Start only backend (http://localhost:3001)
npm run dev:api
```

### Database Operations

All Prisma commands must be run from `apps/api`:

```bash
cd apps/api

# Create and apply a new migration
npx prisma migrate dev --name <migration-name>

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma Client (after schema changes)
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Testing

All tests live in the top-level `tests/` directory, not next to the sources, in three levels:

| Level       | Where                                | What it runs against                                                             | Command                    |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------------- | -------------------------- |
| Unit (API)  | `tests/unit/api/**`                  | Classes built with `new`, every collaborator mocked                              | `npm test`                 |
| Unit (web)  | `tests/unit/web/**`                  | Pure logic, stores and components under jsdom (Jest + React Testing Library)     | `npm test`                 |
| Integration | `tests/integration/api/**`           | The real Nest app (guards, pipes, controllers, repositories) and a real Postgres | `npm run test:integration` |
| E2E         | `tests/e2e/api/**` (`*.e2e-spec.ts`) | Whole user journeys over HTTP                                                    | `npm run test:e2e`         |

```bash
npm test                    # Unit tests, api + web. No database, no network, ~3s
npm run test:watch          # Unit tests in watch mode
npm run test:cov            # Unit tests with coverage (written to ./coverage)
npm run test:cov:integration # API coverage from the integration tests (needs the test database)

npm run db:test:start       # Start the throwaway test database (Postgres on :5433)
npm run test:integration    # Integration tests (needs the test database)
npm run test:e2e            # E2E scenarios (needs the test database)
npm run test:all            # All three, in order
npm run db:test:stop        # Remove the test database

npm run lint                # ESLint over every workspace, plus tests/ and apps/api/src
npm run lint:tests          # Just tests/ and apps/api/src (flat config at the repo root)

# A single file or test: extra args after `--` go straight to Jest
npm test -- tests/unit/api/modules/auth/auth.service.spec.ts
npm test -- -t "ConflictException for a duplicate email"
npm run test:integration -- tests/integration/api/transactions.repository.spec.ts
```

`apps/api` has the same `test`, `test:integration` and `test:e2e` scripts; they use the same configs.

**Layout and conventions**

- `tests/unit/api/**` mirrors `apps/api/src/**` (e.g. `tests/unit/api/modules/auth/auth.service.spec.ts` covers `apps/api/src/modules/auth/auth.service.ts`); `tests/unit/web/**` mirrors `apps/web/src/**`.
- Import the code under test through an alias, never a relative path into `apps/`: `@api/*` (`apps/api/src`), `@web/*` and `@/*` (`apps/web/src`), `@tests/*` (`tests/`). An alias must be declared in `tests/tsconfig.json` (`paths`) **and** in the Jest configs that use it (`moduleNameMapper`).
- NestJS 12 ships ESM-only, so the API (CommonJS) loads it via `require(esm)`. Jest supports that only when started with `--experimental-vm-modules` (Node 24.9+), which is why the `test*` scripts run `node --experimental-vm-modules node_modules/jest/bin/jest.js` instead of plain `jest`.
- One Jest config per level: `tests/jest.unit-api.config.js`, `jest.unit-web.config.js` (via `next/jest`), `jest.integration.config.js`, `jest.e2e.config.js`. `tests/jest.config.js` only combines the two unit projects, so plain `npm test` stays fast and database-free.
- Read response bodies through `expectJson<T>(request, status)` (`tests/setup/http.ts`) instead of `response.body`, which is `any`: a typo in a field name would otherwise compile and assert against `undefined`.
- A spec that needs no DOM (for example the HTTP client) opts out with a `@jest-environment node` docblock; `tests/setup/web-setup.ts` skips its jsdom polyfills there.
- Shared setup is in `tests/setup/`: `app.ts` (boots the real app the way `main.ts` does, via `configureApp`; `registerUser`), `prisma.ts` (`resetDatabase`), `seed.ts` (direct DB fixtures), `web-setup.ts` (jest-dom and jsdom polyfills for Radix), `http.ts` (typed response helpers).

**The test database**

- `postgres-test` in `docker/docker-compose.yml` runs on **:5433** with its data in tmpfs, behind the `test` compose profile, so `npm run db:start` never starts it and nothing survives a restart. Both databases publish to `127.0.0.1` only — never widen that to `0.0.0.0`, the passwords are in the repo.
- Tests never read the repo `.env`. They use `TEST_DATABASE_URL` (default: the :5433 database) and refuse to run against any database whose name doesn't end in `_test`, so they can't touch your dev data.
- Migrations are applied once per run by `tests/setup/global-setup.ts`. Each integration/e2e file empties the tables in `beforeEach` (or `beforeAll` for a journey), and files run serially (`maxWorkers: 1`) because they share one database.

**What goes where**

- Business rules in a service or handler, with everything else mocked: **unit**.
- Anything that depends on Nest wiring (validation pipe rules, guards) or on SQL (filters, ordering, pagination, aggregates, uniqueness, foreign keys): **integration**. Don't mock Prisma to test a query.
- A user-visible flow that spans several endpoints and must stay consistent (the table and the summary cards agreeing, session lifecycle): **e2e**.
- When fixing a bug, add the regression test at the lowest level that reproduces it.

### Code Quality

```bash
# Lint all workspaces
npm run lint

# Format all code
npm run format

# Check formatting without changes
npm run format:check

# Build all workspaces
npm run build
```

### Package Management

```bash
# Add dependency to frontend
npm install <package> --workspace=apps/web

# Add dependency to backend
npm install <package> --workspace=apps/api

# Add dependency to shared types
npm install <package> --workspace=packages/types

# Install all dependencies (from root)
npm install
```

## Architecture

### Monorepo Structure

The project uses npm workspaces to share code between frontend and backend:

- **apps/web**: Next.js frontend application
- **apps/api**: NestJS backend application
- **packages/types**: Shared TypeScript types imported by both apps
- **packages/config**: Shared configuration files (ESLint, Prettier, TypeScript base config)

Both apps reference `@expense-tracker/types` for type safety across the stack.

### TypeScript Configuration

All packages use **strict mode** TypeScript with these additional checks:

- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `exactOptionalPropertyTypes: true`

The base TypeScript config is in `packages/config/tsconfig.base.json`. Individual apps extend this base.

### Backend Architecture (NestJS)

The API follows NestJS module structure:

- `src/main.ts`: Application entry point (port 3001); calls `configureApp` from `src/app.config.ts`
- `src/app.config.ts`: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) and CORS (`WEB_URL`). Put app-wide setup here, not in `main.ts`, so the integration tests boot with the same rules
- `src/app.module.ts`: Root module (`ConfigModule`, `CqrsModule.forRoot()`, Prisma, feature modules)
- `src/prisma/`: Global Prisma module for database access
- `src/modules/`: `auth`, `users`, `categories`, `transactions`, `exchange-rates`, `weather`, `settings`. Each has controller → service → repository (the only layer that touches Prisma), with DTOs in `dto/`

**Auth:** `JwtAuthGuard` is registered as a global `APP_GUARD` in `AuthModule`, so every route requires an access token unless marked `@Public()`. Get the caller with `@CurrentUser()`. Refresh tokens are stored hashed in the `RefreshToken` table (`refresh-tokens.repository.ts`). `POST /auth/change-password` checks the current password (a wrong one is **400**, not 401: the web client treats 401 as an expired session), stores the new hash via `ChangeUserPasswordCommand`, **deletes** every refresh token of the user and returns a new pair for the caller. Deleting rather than revoking matters: a revoked token that comes back counts as theft and revokes the whole family, so another device refreshing its old token would sign the caller out too.

**Cross-module communication goes through CQRS, not imports of another module's services.** A module that others may call exposes a `contracts/` folder (commands, queries, events and their result types, re-exported from `contracts/index.ts`), and implements them in `handlers/`. Other modules import only from `../<module>/contracts` and dispatch via `CommandBus`/`QueryBus`/`EventBus`. Example: registration in `AuthService` runs `CreateUserCommand` (users) and `CreateDefaultCategoriesCommand` (categories); login publishes `UserLoggedInEvent`, handled in `users`.

**Currencies:** `CURRENCIES` in `@expense-tracker/types` is the catalog of ISO codes a user can enable (each published by the rates provider), with a symbol and a name per code in `CURRENCY_DETAILS` (a `Record`, so a new code without them fails to compile); the web shows a currency as `EUR (€)` everywhere via `formatCurrency`. Each user enables a list of them (`currencies` in the settings; a new user has only `DEFAULT_CURRENCY`, EUR, which is always included and can't be removed). A transaction stores the `amount` and the `currency` it was entered in, which must be one of the user's (400 otherwise, checked through `GetUserSettingsQuery`); nothing is converted on write. The column is `TEXT`, validated by the DTOs against the catalog. `GET /transactions` and `GET /transactions/summary` take `?currency=` (default `EUR`) and convert on read at **today's** rates: each row gets a `convertedAmount`, and the summary converts its per-currency SQL groups and rounds only the totals. The summary's `byCategory` has, per (type, category), the converted `total` and the `count` of transactions behind it (the reports page reads it). The `exchange-rates` module fetches the rates (ExchangeRate-API open access, `EXCHANGE_RATES_URL`) behind the `ExchangeRatesProvider` DI token, caches them per UTC day, falls back to the last good rates when the provider is down, and answers 503 when it has none. Other modules get them via `GetExchangeRatesQuery` and convert with `convertAmount` from its `contracts`. Rates are requested only when some amount is in another currency than the requested one. The provider keeps every catalog code the response has and fails only without EUR (the base, also the default currency); a conversion that needs a missing rate answers 503. `DELETE /settings/currencies/:code` first runs `ConvertTransactionsCurrencyCommand` (`transactions/contracts`), which rewrites the user's transactions in that currency to EUR at today's rates in one SQL `UPDATE` (rounded to cents, the `convertAmount` formula), then disables the currency; without transactions to convert it asks for no rates. Tests replace the provider with `FakeExchangeRatesProvider` (`tests/setup/exchange-rates.ts`) in `createTestApp`, so they never reach the network.

**Settings:** `GET/PUT/PATCH/DELETE /settings` for the caller's `UserSettings` (`theme` light/dark/system, `colorScheme` from `COLOR_SCHEMES`, `currency`, `location` `{ mode: 'auto' }` or `{ mode: 'manual', name, lat, lon }`; defaults in `DEFAULT_USER_SETTINGS`, all in `@expense-tracker/types`). One JSON document per user in `user_settings`. Registration stores the defaults (system theme, slate, EUR, weather for Belgrade) through `CreateDefaultSettingsCommand` (`settings/contracts`), and the `backfill_default_settings` migration gave every existing user a row; a missing row still reads as the defaults. `PATCH` merges top-level keys and replaces `location` whole, `PUT` needs every key but `currencies`, `DELETE` stores the defaults again but keeps `currencies`, and answers with the result. `currencies` changes only through `POST /settings/currencies` `{ code }` (idempotent) and `DELETE /settings/currencies/:code` (answers `{ settings, convertedCount }`; EUR is 400, a code not enabled 404; the display `currency` falls back to EUR if it was the one removed), since removing one must convert its transactions. `currency` must be one of `currencies` on write, and reads as EUR otherwise. Rows stored before `currencies` existed got the then-default RSD/EUR/HUF from the `currency_default_eur` migration; a row without the key still reads as `[EUR]`. Stored rows hold the values as they were, so changing a default later affects only new users and resets unless a migration updates the rows too. DTOs validate on write; on read `lib/sanitize-settings.ts` falls back to the default for any key it can't read, so a new setting needs no migration, just a key, a default, a DTO field and a sanitizer case. Manual coordinates are rounded to two decimals.

**Weather:** `GET /weather?lat=&lon=` returns the current temperature (°C), WMO `weatherCode`, `isDay`, a city-level `location` ("Belgrade, RS", or `null`) and a 5-day `forecast` (today first; `date` is the place's local day, days with a missing value are dropped, and an empty list doesn't fail the request), all from one Open-Meteo call. The `weather` module reads Open-Meteo (`WEATHER_URL`) behind the `WeatherProvider` token and names the place with OpenStreetMap Nominatim (`GEOCODING_URL`) behind `GeocodingProvider`; the UI must keep both attributions. Coordinates are rounded to two decimals (~1 km) on the client and again on the server, which is also the cache key: weather for 30 min (served up to 3 h old while Open-Meteo is down, else 503), names for a day. `&refresh=1` (the widget's refresh button; never the automatic loads) skips the weather cache, but only once the cached reading is 5 min old (`MIN_REFRESH_INTERVAL_MS`), so the button can't hammer Open-Meteo; names stay cached. A failed lookup only drops the name. Nominatim allows one request a second, so `NominatimProvider` queues its requests; don't bypass the cache. `GET /weather/places?q=` finds towns by name (Nominatim `/search`, `featureType=settlement`, through the same queue), cached per normalized query for a day; 503 when the provider fails. Nominatim forbids autocomplete, so the UI searches on submit only. Tests replace both with `FakeWeatherProvider`/`FakeGeocodingProvider` (`tests/setup/weather.ts`) in `createTestApp`.

**Prisma conventions:**

- Schema location: `apps/api/prisma/schema.prisma`; CLI config (datasource URL, migrations path) in `apps/api/prisma.config.ts`, which loads the repo-root `.env`
- Client output: `apps/api/src/generated/prisma` (gitignored, regenerated by the `api` workspace's `postinstall`). Import from there (`../generated/prisma/client` in `src`, `@api/generated/prisma/client` in tests), not from `@prisma/client`
- The client connects through the `@prisma/adapter-pg` driver adapter (`PrismaService` builds it from `DATABASE_URL`)
- IDs are `uuid()`, stored as `TEXT`
- Relations have proper cascade deletes and indexes
- Decimal fields for currency amounts

### Frontend Architecture (Next.js + Feature-Sliced Design)

The web app uses Next.js 16 App Router as the routing shell, with everything else under `src/` organized by **Feature-Sliced Design (FSD)**. Layers, from lowest to highest:

- `src/shared/`: framework-agnostic building blocks with no business logic.
  - `shared/ui/`: shadcn/ui primitives (generated via `npx shadcn@latest add <name>`, see below) plus a hand-written `index.ts` barrel. Don't hand-edit generated primitives beyond intentional customization.
  - `shared/api/`: generic HTTP client (`http-client.ts`) and thin per-domain endpoint wrappers (e.g. `auth-api.ts`). The HTTP client itself must stay dependency-free from other layers — it exposes a `configureHttpClient(hooks)` seam so an `entities/*` slice can wire it to a store, instead of importing that store directly.
  - `shared/lib/`: small framework-agnostic helpers (`cn`, error formatting).
  - `shared/config/`: env var access.
  - Unlike the layers below, `shared` has no business "slices" — its segments (`ui`, `api`, `lib`, `config`) may freely reference each other.
- `src/entities/`: business objects and their own state, e.g. `entities/session` (the Zustand auth-session store, hydration, and the one call to `configureHttpClient`). May import `shared` only.
- `src/features/`: user actions/use-cases, e.g. `features/auth/login` and `features/auth/register` (form + validation schema + submit hook per sub-module). May import `entities`, `shared`.
- `src/widgets/`: composite UI blocks assembled from multiple features/entities (e.g. `app-header`, `transactions-table`, `transactions-summary`). Add a widget only when a block actually composes several features/entities.
- `src/app/`: Next.js routing layer (this _is_ FSD's "pages" layer here — there is no separate `src/pages` folder). Route files stay thin: they compose `widgets`/`features`/`entities`/`shared` and add layout/metadata. May import any lower layer.

**Import direction rule:** `shared → entities → features → widgets → app`, imports only flow "up" this list — never sideways within the same layer, never downward. Each slice exposes its public surface via `index.ts`; don't deep-import another slice's internals. One documented exception: feature groups (`features/auth/*`, `features/transaction/*`, `features/category/*`) have no group-level barrel — consumers import the sub-module directly (`features/auth/login`, `features/transaction/upsert`), since each sub-module is an independent entry point with its own `index.ts`.

**Session-scoped stores:** a store holding data for the signed-in user (`entities/category`, `entities/transaction`) registers its `reset` via `registerStoreReset` (`shared/lib/store-reset.ts`), and `entities/session` calls `resetRegisteredStores()` on sign-in, sign-out and auth failure. This keeps one user's data from leaking into the next session in the same tab without `entities/*` slices importing each other. Any store whose `fetch` can be in flight across a reset must also invalidate its pending request (the `latestRequestId` pattern), or a late response will refill a cleared store.

**Settings page:** `app/(app)/settings` renders `widgets/settings-panel`, one card per group: `features/settings/theme` (a dialog of live previews), `features/settings/currency` with `features/settings/currencies` (the enabled list: add from the catalog, remove after a confirm that says the transactions become EUR, then reload the transactions and the summary), `widgets/settings-panel`'s own `CategoriesList` with `features/category/upsert`'s `AddCategoryButton` (see Categories below), `features/settings/location` (browser position or a town found through `/weather/places`), `features/auth/change-password` and `features/settings/reset`. `entities/settings` holds the user's settings (session-scoped, optimistic `update` that rolls back and rethrows; non-optimistic `resetToDefaults`, `addCurrency`, `removeCurrency`; `useEnabledCurrencies()` for every currency picker); `features/settings/sync`'s `SettingsSync` (in `app/(app)/layout.tsx`) loads them and pushes the theme and the currency to where the rest of the app reads them.

**Theme:** the color schemes are the shadcn/ui base colors and themes for Tailwind v3, copied into `globals.css` as `[data-scheme='x']` and `[data-scheme='x'][data-mode='dark']` blocks (`tests/unit/web/app/globals-css.spec.ts` checks that each defines every token). `shared/lib/theme.ts`'s `applyTheme` sets `data-scheme`, `data-mode`, the `dark` class (for Tailwind's `dark:`) and `color-scheme` on `<html>`, and follows the OS while the theme is `system`. The same attributes on any element repaint only its subtree, which is how the previews work. The theme is cached in `localStorage` (`theme`) and painted before the first paint by `THEME_INIT_SCRIPT`, an inline script in the root layout's `<head>` (see Next's "Preventing Flash" guide); `entities/settings`'s `ThemeHydration` repaints it after Strict Mode's dev remount strips `<html>`. Keep the script and `applyTheme` in step: the tests run both.

**Display currency:** the user's `currency` setting is the source of truth; the header's `CurrencySelect` and the settings page both save it, and new transactions start in it. `entities/currency` keeps a persisted copy (default EUR, `localStorage` key `display-currency`) only so a reload shows the right currency before the settings arrive; `SettingsSync` overwrites it. The copy is deliberately **not** registered with `registerStoreReset`, so it survives sign-out until the next user's settings replace it. `entities/transaction` can't import it, so `features/currency/select`'s `DisplayCurrencySync` (mounted in `app/(app)/layout.tsx`) pushes it into `useTransactionsStore.currency` after hydration; the summary store reads it from there, like `period`. Both stores skip `fetch()` while `currency` is `null`, so nothing is loaded in EUR before a stored RSD is restored.

**Date filter:** `shared/ui`'s `PeriodPicker` (a preset list from `PERIOD_PRESETS`, From/To dates and a Reset button that goes back to `DEFAULT_PERIOD_PRESET`, "This month") is used twice, with the state in the owning store: `features/transaction/period-filter` over `useTransactionsStore.period` (the table and the summary cards share it) and the reports page over `useCategoryReportStore.period` (its own). Both stores persist `{ period, preset }` (`localStorage` keys `transactions-period` and `report-period`), so a reload keeps the user's choice; the transactions store keeps its `pageSize` (rows per page) in the same entry, read back by `restorePageSize` (any value outside `TRANSACTION_PAGE_SIZES` falls back to 10); `restorePeriod` (`shared/lib/period.ts`) reads it back and **recomputes a preset from today** (a stored "Last month" must mean the month before now), keeps the dates only for `custom`, and falls back to the default for anything unreadable. Both are session-scoped, so the filter goes back to This month on sign-out. Until the stores are rehydrated by `TransactionsPeriodHydration`/`ReportPeriodHydration` (root layout) their `fetch()` returns early, like `currency === null` above, and the views pass `hasHydrated` as an effect dependency so the load starts once it flips, even when the stored period equals the default.

**Categories:** there is no categories page; they are managed in the settings, in the card right after the currencies (`next.config.ts` redirects the old `/categories` to `/settings`). `widgets/settings-panel`'s `CategoriesList` (icon, name, transaction count, edit/delete menu) lives inside that widget, since one widget can't import another. A category is shown by its **icon, not its color**: `entities/category`'s `CategoryIcon` maps the key to a lucide component through `CATEGORY_ICON_COMPONENTS`, typed `Record<CategoryIcon, LucideIcon>`, so a key added to the shared list without a component fails to compile. The form's `IconPicker` is a popover grid of every icon. `features/category/delete` asks for a target category when the one being deleted has transactions, and reloads the transactions and summary after moving them.

**Weather widget:** `features/weather/current`'s `WeatherWidget` sits in the middle of `app-header`; it opens a popover with the details, the forecast and a refresh button (`useWeatherAutoRefresh` returns that forced reload). It asks the browser for an approximate position (`shared/lib/geolocation.ts`) and loads `entities/weather` on mount, every hour, when a tab with hour-old weather comes back to the front, and when the location permission changes. Without a position (denied, unsupported, timed out) it renders nothing. When the `location` setting is a chosen town, it loads the weather there instead and never asks the browser; it waits for the settings (or their failure) before doing either.

**Client-persisted state:** any store that persists to `localStorage` (via Zustand's `persist` middleware) must use `skipHydration: true` + an explicit `hasHydrated` flag flipped in `onRehydrateStorage`, with a dedicated client component calling `store.persist.rehydrate()` once (mounted in root layout). This avoids SSR/localStorage hydration mismatches — see `entities/session` for the reference implementation.

**shadcn/ui setup:** `components.json` aliases point `ui`/`components` at `@/shared/ui` and `utils`/`lib` at `@/shared/lib`, so `npx shadcn@latest add <name>` lands new primitives directly in the FSD `shared` layer. The project is pinned to Tailwind v3 — if a future `shadcn` CLI run offers to upgrade Tailwind to v4 or rewrite `globals.css` to `@import "tailwindcss"` syntax, decline it and add components manually instead.

**Next.js configuration:**

- `transpilePackages: ['@expense-tracker/types']` enables monorepo package usage
- `reactStrictMode: true` for development checks
- Next.js 16 has breaking changes versus older versions; `apps/web/AGENTS.md` (written by `next dev`, pulled in by `apps/web/CLAUDE.md`) says to read the bundled guides in `node_modules/next/dist/docs/` (hoisted to the repo root) before using an unfamiliar API.

### Database Schema

Current models in `apps/api/prisma/schema.prisma`:

- **User**: email (unique), name, `passwordHash`, `isActive`, `lastLoginAt`
- **RefreshToken**: hashed refresh tokens per user, with expiry and revocation
- **Category**: per-user (`@@unique([userId, name])`), with color and icon; default categories are seeded on registration
  - `icon` must be one of `CATEGORY_ICONS` in `@expense-tracker/types` (lucide names; the API validates with `@IsIn`). Only the name and the icon can be edited; `color` is optional on create (the server picks the next one from `CATEGORY_COLORS`) and isn't shown in the UI
  - `GET /categories` returns each category's `transactionCount`. `DELETE /categories/:id?reassignTo=<id>` moves the transactions to another of the user's categories and deletes it in one DB transaction; without `reassignTo`, a category with transactions answers 409
- **UserSettings**: `userId` is both the primary key and the foreign key (cascade), `settings` is `jsonb`; see Settings above
- **Transaction**: `amount` `Decimal(12,2)` in `currency` (`TEXT`, one of `CURRENCIES`, default `EUR`), `type` (`INCOME` | `EXPENSE`), optional description, date; indexed on `(userId, date)`
  - Deleting a user cascades to everything; deleting a category that still has transactions is blocked (`onDelete: Restrict`)
  - Every query is scoped by `userId` — cross-user access is covered by `tests/integration/api/tenant-isolation.spec.ts`

## Environment Setup

1. Copy `.env.example` to `.env`
2. Key variables:
   - `DATABASE_URL`: PostgreSQL connection string (default: local Docker instance)
   - `API_PORT`: Backend port (default: 3001)
   - `NEXT_PUBLIC_API_URL`: Frontend's API endpoint
   - `EXCHANGE_RATES_URL`: exchange rates API (default `https://open.er-api.com/v6`; no key needed)
   - `WEATHER_URL`, `GEOCODING_URL`: Open-Meteo and Nominatim (defaults `https://api.open-meteo.com/v1`, `https://nominatim.openstreetmap.org`; no keys)

## Important Notes

- **Always run Prisma commands from `apps/api`**, not from root
- After changing the Prisma schema, run `npx prisma generate` before using the client
- The PostgreSQL container persists data in a Docker volume - use `npm run db:stop` to stop (keeps data) or `docker compose -f docker/docker-compose.yml down -v` to remove data
- Frontend and backend must both be running for full functionality
- Changes to `packages/types` require rebuilding apps that depend on it. The web and the tests read its `src`; the API resolves it through `node_modules` to the built `dist`, which `prebuild`/`predev` in `apps/api` rebuild first (with `rootDir: ./src`, the API can't compile the package's sources itself)

## Git Workflow (GitHub Flow)

- `main` is always deployable and protected by convention: never commit or push directly to it.
- Every piece of work (feature, fix, refactor, docs) starts on a new short-lived branch created from an up-to-date `main`:
  ```bash
  git checkout main && git pull --ff-only
  git checkout -b <type>/<short-description>
  ```
- Branch naming: `<type>/<kebab-case-description>`, where `<type>` is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`. Scope the description to the app when relevant, e.g. `feat/web-home-screen`, `feat/api-transactions`, `fix/web-login-redirect`.
- One branch = one focused change. Don't mix unrelated work; start a separate branch instead.
- Commit small, logical steps with descriptive messages; push the branch to `origin` regularly.
- Merge into `main` only through a Pull Request on GitHub. Before opening/merging, `npm run lint`, `npm run build` and relevant tests must pass.
- Keep the branch current by merging or rebasing `origin/main` into it when `main` moves ahead.
- After the PR is merged, delete the branch (remote and local) and start the next task from a fresh `main`. Don't reuse a merged branch for new work.
