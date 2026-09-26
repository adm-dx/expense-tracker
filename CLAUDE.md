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
- `src/modules/`: `auth`, `users`, `categories`, `transactions`. Each has controller → service → repository (the only layer that touches Prisma), with DTOs in `dto/`

**Auth:** `JwtAuthGuard` is registered as a global `APP_GUARD` in `AuthModule`, so every route requires an access token unless marked `@Public()`. Get the caller with `@CurrentUser()`. Refresh tokens are stored hashed in the `RefreshToken` table (`refresh-tokens.repository.ts`).

**Cross-module communication goes through CQRS, not imports of another module's services.** A module that others may call exposes a `contracts/` folder (commands, queries, events and their result types, re-exported from `contracts/index.ts`), and implements them in `handlers/`. Other modules import only from `../<module>/contracts` and dispatch via `CommandBus`/`QueryBus`/`EventBus`. Example: registration in `AuthService` runs `CreateUserCommand` (users) and `CreateDefaultCategoriesCommand` (categories); login publishes `UserLoggedInEvent`, handled in `users`.

**Prisma conventions:**

- Schema location: `apps/api/prisma/schema.prisma`; CLI config (datasource URL, migrations path) in `apps/api/prisma.config.ts`, which loads the repo-root `.env`
- Client output: `apps/api/src/generated/prisma` (gitignored, regenerated by the `api` workspace's `postinstall`). Import from there (`../generated/prisma/client` in `src`, `@api/generated/prisma/client` in tests), not from `@prisma/client`
- The client connects through the `@prisma/adapter-pg` driver adapter (`PrismaService` builds it from `DATABASE_URL`)
- IDs are `cuid()`, except `Transaction`, which uses `uuid()`
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

**Import direction rule:** `shared → entities → features → widgets → app`, imports only flow "up" this list — never sideways within the same layer, never downward. Each slice exposes its public surface via `index.ts`; don't deep-import another slice's internals. One documented exception: feature groups (`features/auth/*`, `features/transaction/*`) have no group-level barrel — consumers import the sub-module directly (`features/auth/login`, `features/transaction/upsert`), since each sub-module is an independent entry point with its own `index.ts`.

**Session-scoped stores:** a store holding data for the signed-in user (`entities/category`, `entities/transaction`) registers its `reset` via `registerStoreReset` (`shared/lib/store-reset.ts`), and `entities/session` calls `resetRegisteredStores()` on sign-in, sign-out and auth failure. This keeps one user's data from leaking into the next session in the same tab without `entities/*` slices importing each other. Any store whose `fetch` can be in flight across a reset must also invalidate its pending request (the `latestRequestId` pattern), or a late response will refill a cleared store.

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
- **Transaction**: `amount` `Decimal(12,2)`, `type` (`INCOME` | `EXPENSE`), optional description, date; indexed on `(userId, date)`
  - Deleting a user cascades to everything; deleting a category that still has transactions is blocked (`onDelete: Restrict`)
  - Every query is scoped by `userId` — cross-user access is covered by `tests/integration/api/tenant-isolation.spec.ts`

## Environment Setup

1. Copy `.env.example` to `.env`
2. Key variables:
   - `DATABASE_URL`: PostgreSQL connection string (default: local Docker instance)
   - `API_PORT`: Backend port (default: 3001)
   - `NEXT_PUBLIC_API_URL`: Frontend's API endpoint

## Important Notes

- **Always run Prisma commands from `apps/api`**, not from root
- After changing the Prisma schema, run `npx prisma generate` before using the client
- The PostgreSQL container persists data in a Docker volume - use `npm run db:stop` to stop (keeps data) or `docker compose -f docker/docker-compose.yml down -v` to remove data
- Frontend and backend must both be running for full functionality
- Changes to `packages/types` require rebuilding apps that depend on it

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
