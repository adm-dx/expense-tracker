# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an npm workspaces monorepo for an expense tracking application with:

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript (strict), Tailwind CSS
- **Backend**: NestJS 11, Prisma ORM, TypeScript (strict)
- **Database**: PostgreSQL 16 (via Docker Compose)
- **Shared packages**: `@expense-tracker/types` (common types), `@expense-tracker/config` (ESLint/Prettier/TypeScript configs)

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

```bash
# Backend tests (from apps/api)
cd apps/api
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:cov            # With coverage
npm run test:e2e            # E2E tests

# Frontend tests
cd apps/web
npm test
```

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

- `src/main.ts`: Application entry point (port 3001, CORS enabled for frontend)
- `src/app.module.ts`: Root module that imports feature modules
- `src/prisma/`: Global Prisma module for database access
  - `prisma.service.ts`: PrismaClient wrapper with lifecycle hooks
  - `prisma.module.ts`: Global module exported to all features
- `src/modules/`: Feature modules go here (currently empty)

**Prisma conventions:**

- Schema location: `apps/api/prisma/schema.prisma`
- Client output: `apps/api/node_modules/.prisma/client`
- Models use `cuid()` for IDs
- Relations have proper cascade deletes and indexes
- Decimal fields for currency amounts

### Frontend Architecture (Next.js + Feature-Sliced Design)

The web app uses Next.js 15 App Router as the routing shell, with everything else under `src/` organized by **Feature-Sliced Design (FSD)**. Layers, from lowest to highest:

- `src/shared/`: framework-agnostic building blocks with no business logic.
  - `shared/ui/`: shadcn/ui primitives (generated via `npx shadcn@latest add <name>`, see below) plus a hand-written `index.ts` barrel. Don't hand-edit generated primitives beyond intentional customization.
  - `shared/api/`: generic HTTP client (`http-client.ts`) and thin per-domain endpoint wrappers (e.g. `auth-api.ts`). The HTTP client itself must stay dependency-free from other layers — it exposes a `configureHttpClient(hooks)` seam so an `entities/*` slice can wire it to a store, instead of importing that store directly.
  - `shared/lib/`: small framework-agnostic helpers (`cn`, error formatting).
  - `shared/config/`: env var access.
  - Unlike the layers below, `shared` has no business "slices" — its segments (`ui`, `api`, `lib`, `config`) may freely reference each other.
- `src/entities/`: business objects and their own state, e.g. `entities/session` (the Zustand auth-session store, hydration, and the one call to `configureHttpClient`). May import `shared` only.
- `src/features/`: user actions/use-cases, e.g. `features/auth/login` and `features/auth/register` (form + validation schema + submit hook per sub-module). May import `entities`, `shared`.
- `src/widgets/`: composite UI blocks assembled from multiple features/entities. Not created until a feature actually needs one — don't add an empty layer speculatively.
- `src/app/`: Next.js routing layer (this _is_ FSD's "pages" layer here — there is no separate `src/pages` folder). Route files stay thin: they compose `widgets`/`features`/`entities`/`shared` and add layout/metadata. May import any lower layer.

**Import direction rule:** `shared → entities → features → widgets → app`, imports only flow "up" this list — never sideways within the same layer, never downward. Each slice exposes its public surface via `index.ts`; don't deep-import another slice's internals. One documented exception: feature groups (`features/auth/*`, `features/transaction/*`) have no group-level barrel — consumers import the sub-module directly (`features/auth/login`, `features/transaction/upsert`), since each sub-module is an independent entry point with its own `index.ts`.

**Session-scoped stores:** a store holding data for the signed-in user (`entities/category`, `entities/transaction`) registers its `reset` via `registerStoreReset` (`shared/lib/store-reset.ts`), and `entities/session` calls `resetRegisteredStores()` on sign-in, sign-out and auth failure. This keeps one user's data from leaking into the next session in the same tab without `entities/*` slices importing each other. Any store whose `fetch` can be in flight across a reset must also invalidate its pending request (the `latestRequestId` pattern), or a late response will refill a cleared store.

**Client-persisted state:** any store that persists to `localStorage` (via Zustand's `persist` middleware) must use `skipHydration: true` + an explicit `hasHydrated` flag flipped in `onRehydrateStorage`, with a dedicated client component calling `store.persist.rehydrate()` once (mounted in root layout). This avoids SSR/localStorage hydration mismatches — see `entities/session` for the reference implementation.

**shadcn/ui setup:** `components.json` aliases point `ui`/`components` at `@/shared/ui` and `utils`/`lib` at `@/shared/lib`, so `npx shadcn@latest add <name>` lands new primitives directly in the FSD `shared` layer. The project is pinned to Tailwind v3 — if a future `shadcn` CLI run offers to upgrade Tailwind to v4 or rewrite `globals.css` to `@import "tailwindcss"` syntax, decline it and add components manually instead.

**Next.js configuration:**

- `transpilePackages: ['@expense-tracker/types']` enables monorepo package usage
- `reactStrictMode: true` for development checks

### Database Schema

Current models in `apps/api/prisma/schema.prisma`:

- **User**: Basic user model with email, name, timestamps
- **Expense**: Expense records with amount (Decimal), currency, category, description, date
  - Foreign key to User with cascade delete
  - Indexed on userId and date

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
