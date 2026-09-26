# Expense Tracker

Монорепозиторий для трекера расходов, включающий фронтенд на Next.js и бэкенд на NestJS.

## Структура проекта

```
expense-tracker/
├── apps/
│   ├── web/          # Next.js 16 фронтенд
│   └── api/          # NestJS 12 бэкенд
├── packages/
│   ├── types/        # Общие TypeScript типы
│   └── config/       # Общие конфигурации
└── docker/           # Docker Compose для PostgreSQL
```

## Стек технологий

### Frontend

- **Next.js 16** с App Router
- **React 19**
- **TypeScript 6** (strict mode)
- **Tailwind CSS 3** (намеренно без перехода на v4)
- **shadcn/ui** на **Radix UI**
- **Zustand 5** — состояние
- **React Hook Form 7** + **Zod 4** — формы и валидация

### Backend

- **NestJS 12** (+ `@nestjs/cqrs`, `@nestjs/jwt`, `@nestjs/config`)
- **Prisma 7** ORM с драйвер-адаптером `@prisma/adapter-pg`
- **PostgreSQL 16**
- **TypeScript 6** (strict mode)
- **class-validator** — валидация DTO

### Инструменты

- **npm workspaces** — управление монорепозиторием
- **ESLint 9 + Prettier 3** — линтинг и форматирование
- **Jest 30** + React Testing Library + Supertest — тесты
- **Docker Compose** — локальная база данных

### Требования

- **Node.js 24.9+** (NestJS 12 работает с 20.19+ / 22.12+, но тестам нужен `require(esm)` в Jest, а он есть только с 24.9)
- **Docker** — для PostgreSQL

## Установка

### 1. Клонируйте репозиторий и установите зависимости

```bash
npm install
```

Prisma Client генерируется автоматически после установки (в `apps/api/src/generated/prisma`, не хранится в git).

### 2. Настройте переменные окружения

```bash
cp .env.example .env
```

### 3. Запустите PostgreSQL

```bash
npm run db:start
```

### 4. Примените миграции Prisma

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

Prisma CLI берёт `DATABASE_URL` из корневого `.env` (через `apps/api/prisma.config.ts`).

## Запуск проекта

### Запустить все приложения

```bash
npm run dev
```

### Запустить только фронтенд

```bash
npm run dev:web
```

Откройте [http://localhost:3000](http://localhost:3000)

### Запустить только бэкенд

```bash
npm run dev:api
```

API доступно на [http://localhost:3001](http://localhost:3001)

## Полезные команды

### База данных

```bash
npm run db:start      # Запустить PostgreSQL
npm run db:stop       # Остановить PostgreSQL
npm run db:restart    # Перезапустить PostgreSQL
```

### Сборка

```bash
npm run build         # Собрать все приложения
npm run build:web     # Собрать только фронтенд
npm run build:api     # Собрать только бэкенд
```

### Линтинг и форматирование

```bash
npm run lint          # Проверить все приложения
npm run format        # Отформатировать код
npm run format:check  # Проверить форматирование
```

## Разработка

### Добавление зависимостей

```bash
# Для фронтенда
npm install <package> --workspace=apps/web

# Для бэкенда
npm install <package> --workspace=apps/api

# Для общих пакетов
npm install <package> --workspace=packages/types
```

### Работа с Prisma

```bash
cd apps/api

# Создать миграцию
npx prisma migrate dev --name <migration-name>

# Применить миграции
npx prisma migrate deploy

# Открыть Prisma Studio
npx prisma studio

# Сгенерировать Prisma Client
npx prisma generate
```

## Архитектура

### Монорепозиторий

Проект использует npm workspaces для управления несколькими пакетами в одном репозитории. Это позволяет:

- Переиспользовать код между фронтендом и бэкендом
- Управлять зависимостями централизованно
- Версионировать всё вместе

### Общие пакеты

- **@expense-tracker/types** — TypeScript типы для данных API
- **@expense-tracker/config** — общие конфигурации ESLint, Prettier, TypeScript

## Следующие шаги

1. Определить модели данных в `apps/api/prisma/schema.prisma`
2. Создать миграции базы данных
3. Разработать API эндпоинты в NestJS
4. Создать UI компоненты в Next.js
5. Настроить аутентификацию
