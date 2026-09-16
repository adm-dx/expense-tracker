# Новая функциональность - Создать модуль транзакций

## Контекст:
Проект: Nest.js + Next + PostgreSQL + Prisma. Что уже есть: API авторизации, регистрации пользователя, 
API категорий, фронтэнд авторизации и регистрации пользователя. Авторизация JWT токен с refresh. Есть модули User и
Categories

## Задача:
Создай TrasnactionModule - центральный модуль приложения для учета доходов и расходов

## Модель данных:
Добавь модель Transaction в schema.Prisma:
- id (String, uuid, @default(uuid()))
- amount (Decimal)
- type(ENUM: INCOME, EXPENSE)
- description (String, nullable)
- date (DateTime)
- categoryID (String, связь с Category)
- userID (String, связь с User)
- createdAt(DateTime, @default(now()))

Обнови модели User, Category - создай обратные связи для transactions Transaction[]

После изменения схемы создай и примени миграции


## Контроллеры:
POST /transactions: создать транзакцию
GET /transactions: список с query параметрами dateFrom, dateTo, type, categoryId (по пользователю)
GET /transactions/summary: агрегация, query параметры month и year (оба обязательные)
GET /transactions/:id: одна транзакция
PATCH /transactions/:id: обновить
DELETE /transactions/:id: удалить

## Паттерны:
Используй apps/api/src/modules/categories как образец структуры для модулей backend

## Ограничения:
- Не добавлять зависимости если это не просят в задаче
- Использовать class-validator для dto
- После реализации собирай проект
- План реализации пиши в папку .claude/plans