# План: модуль «Настройки пользователя» (API + страница /settings)

> Файл плана: `.claude/plans/user-settings.md`. Задача: `.claude/prompts/feature-settings.md`.
> Ветка: `feat/user-settings` от свежего `main`.
> Коммиты: `feat(types)`, `feat(api)`, `feat(web)`, два `fix` (найдены тестами), `test`, `docs`.

## Контекст

Страница `apps/web/src/app/(app)/settings/page.tsx` сейчас заглушка. Нужны настройки, которые хранятся в БД отдельно для каждого пользователя:

1. **Тема** = режим (`light` | `dark` | `system`) + **цветовая схема из дизайн-системы**. Дизайн-система — shadcn/ui (`apps/web/components.json`: `new-york`, `baseColor: slate`, `cssVariables: true`). Берём официальные схемы shadcn для Tailwind v3 (HSL): базовые `slate` (текущая, по умолчанию), `zinc`, `stone`, `gray`, `neutral` и акцентные `red`, `rose`, `orange`, `green`, `blue`, `yellow`, `violet`, у каждой есть светлый и тёмный набор токенов. Выбор идёт в попапе с живыми превью. Новых зависимостей (next-themes) не ставим.
2. **Местоположение** — город для погоды: режим `auto` (геолокация браузера, как сейчас) или `manual` (город, найденный по названию через Nominatim). Закрывает пункт «fallback на город из настроек» из CLAUDE.md.
3. **Валюта по умолчанию** — единая настройка: переключатель в шапке и страница настроек меняют одно значение на сервере; `localStorage` (`display-currency`) остаётся только кэшем, чтобы не мигало. Также подставляется в форму новой транзакции.
4. **Смена пароля** — с проверкой текущего, отзывом всех refresh-токенов и выдачей новой пары текущей сессии.
5. **Сброс настроек** к значениям по умолчанию (пароль не затрагивает).

## 1. Общие типы — `packages/types/src/index.ts`

```ts
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export type LocationSetting =
  | { mode: 'auto' }
  | { mode: 'manual'; name: string; lat: number; lon: number };

// shadcn/ui color themes (Tailwind v3): base colors first, then accents.
export const COLOR_SCHEMES = [
  'slate', 'zinc', 'stone', 'gray', 'neutral',
  'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet',
] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export interface UserSettings {
  theme: Theme;
  colorScheme: ColorScheme;
  currency: Currency;
  location: LocationSetting;
}
export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system', colorScheme: 'slate',
  currency: DEFAULT_CURRENCY, location: { mode: 'auto' },
};

export type UpdateUserSettingsRequest = Partial<UserSettings>;   // PATCH
export type ReplaceUserSettingsRequest = UserSettings;            // PUT

export interface Place { name: string; lat: number; lon: number } // "Belgrade, RS"
export interface ChangePasswordRequest { currentPassword: string; newPassword: string }
```

## 2. БД — `apps/api/prisma/schema.prisma`

Одна строка на пользователя, настройки в `jsonb` (как предложено в задаче):

```prisma
model UserSettings {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  settings  Json     @default("{}")   // jsonb, полный валидный объект UserSettings
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("user_settings")
}
```

- `userId` — PK и FK одновременно (1:1, отдельный индекс не нужен), каскадное удаление с пользователем. В `User` добавить `settings UserSettings?`.
- Строка создаётся лениво при первом сохранении (upsert); нет строки → дефолты. Регистрацию не трогаем.
- Почему JSON, а не колонки: набор настроек будет расти, новые ключи не требуют миграций. Цена — валидация в приложении: на запись через class-validator, на чтение — «санитайзер», который накладывает сохранённые значения на `DEFAULT_USER_SETTINGS` и отбрасывает невалидные/неизвестные ключи (устаревшие данные никогда не ломают ответ).
- Миграция: `npx prisma migrate dev --name user-settings` (из `apps/api`).

## 3. API — модуль `apps/api/src/modules/settings/` (по образцу `categories`)

```
settings.module.ts, settings.controller.ts, settings.service.ts, settings.repository.ts, types.ts
dto/replace-settings.dto.ts, dto/update-settings.dto.ts, dto/location-setting.dto.ts
lib/sanitize-settings.ts
```

**Контроллер** (`@Controller('settings')`, пользователь через `@CurrentUser()`):

| Метод | Путь | Что делает | Ответ |
| --- | --- | --- | --- |
| GET | `/settings` | сохранённые поверх дефолтов | 200 `UserSettings` |
| PUT | `/settings` | полная замена (все поля обязательны), upsert | 200 `UserSettings` |
| PATCH | `/settings` | частичное обновление; ключи верхнего уровня сливаются, `location` заменяется целиком | 200 `UserSettings` |
| DELETE | `/settings` | сброс: удаляет строку | 200 `DEFAULT_USER_SETTINGS` |

**DTO (class-validator):**
- `theme`: `@IsIn(THEMES)`; `colorScheme`: `@IsIn(COLOR_SCHEMES)`; `currency`: `@IsIn(CURRENCIES)`.
- `location`: `@ValidateNested() @Type(() => LocationSettingDto)`; в нём `mode` `@IsIn(['auto','manual'])`, а `name` (`@IsString @IsNotEmpty @MaxLength(100)`), `lat` (`@IsLatitude`), `lon` (`@IsLongitude`) — под `@ValidateIf(o => o.mode === 'manual')`.
- `UpdateSettingsDto` — те же поля с `@IsOptional()`; пустой PATCH допустим (возвращает текущие).
- Глобальный `ValidationPipe` (`forbidNonWhitelisted`) уже отклоняет лишние ключи.

**Сервис:** `get`, `replace`, `update` (прочитать → слить → нормализовать → upsert), `reset`. Нормализация: `auto` → ровно `{ mode: 'auto' }`, координаты округляются до 2 знаков (как `roundCoordinate` в `weather.service.ts`), `name` триммится. `toPublic` = `sanitizeSettings(row?.settings)`.

**Репозиторий** (единственный слой с Prisma): `findByUser`, `upsert(userId, settings)`, `delete(userId)` (`deleteMany`, чтобы сброс без строки не падал).

**Модуль** регистрируется в `app.module.ts`. CQRS-контракты пока не нужны — другие модули настройки не читают.

### 3.1 Смена пароля — в модуле `auth`

`POST /auth/change-password` (не `@Public`), DTO `ChangePasswordDto`: `currentPassword` (`@IsString @IsNotEmpty @MaxLength(72)`), `newPassword` (`@IsString @MinLength(8) @MaxLength(72)`, как в `RegisterDto`).

`AuthService.changePassword(userId, dto)`:
1. `GetUserCredentialsByIdQuery(userId)` (новый запрос в `users/contracts`, рядом с `GetUserCredentialsQuery`).
2. `bcrypt.compare(current)`; неверный → **400** `Current password is incorrect` (не 401: 401 заставит http-клиент фронта обновлять токен/разлогинивать). Совпадает с новым → 400.
3. `bcrypt.hash` → `ChangeUserPasswordCommand(userId, passwordHash)` (новая команда + handler в `users`, `UsersRepository.updatePasswordHash`).
4. `RefreshTokensRepository.revokeAllForUser(userId)` — все остальные сессии теряют refresh (access живёт до истечения, ~15 мин — ограничение текущей схемы JWT).
5. `tokenService.issueTokens(user)` → 200 `AuthTokens` для текущей сессии.

### 3.2 Поиск города — в модуле `weather`

`GET /weather/places?q=Belgrade` → `Place[]` (до 5).
- `GeocodingProvider` получает `abstract search(query): Promise<Place[]>`; `NominatimProvider.search` идёт через тот же `throttled()` в `/search?format=jsonv2&q=&featureType=settlement&addressdetails=1&limit=5&accept-language=en`, имя формируется так же, как в `reverse` (вынести форматирование адреса в общую функцию).
- `WeatherService.searchPlaces` кэширует по нормализованному запросу (lower/trim) на день в `BoundedCache`; ошибка провайдера → 503.
- DTO `SearchPlacesQuery`: `q` `@IsString @Length(2, 100)` + trim.
- Политика Nominatim запрещает автокомплит — на фронте поиск только по кнопке/Enter.

## 4. Web

**shared**
- `shared/api/settings-api.ts`: `get`, `update` (PATCH), `replace` (PUT), `reset` (DELETE).
- `shared/api/auth-api.ts`: `changePassword`. `shared/api/weather-api.ts`: `searchPlaces(q)`.
- `app/globals.css` — цветовые схемы. Токены для всех 12 схем берутся из shadcn: реестр `ui.shadcn.com/r/colors/<base>.json` и темы Tailwind v3 на ui.shadcn.com/themes, в HSL, как в текущем файле. Каждая схема задаёт два блока с полным набором токенов (`--background` … `--ring`, 19 переменных):
  ```css
  [data-scheme='zinc'] { /* light */ }
  [data-scheme='zinc'][data-mode='dark'] { /* dark */ }
  ```
  `:root` и `.dark` остаются как `slate`: это запасной вариант до запуска скрипта. Поскольку токены — CSS-переменные, те же атрибуты на любом `div` перекрашивают только его поддерево. На этом и строятся превью.
- `shared/lib/theme.ts`: `THEME_STORAGE_KEY = 'theme'`, `resolveMode(theme)` (`system` → по `matchMedia('(prefers-color-scheme: dark)')`), `applyTheme({ theme, colorScheme })`: ставит на `<html>` `data-scheme`, `data-mode`, класс `.dark` (для вариантов `dark:` в Tailwind) и `color-scheme`, а для `system` подписывается на `matchMedia` и возвращает отписку. Ещё `readCachedTheme`/`cacheTheme` (в try/catch) и `THEME_INIT_SCRIPT` — строка для инлайн-скрипта, чтобы тема применялась без мигания.
- `shared/lib/color-schemes.ts`: `COLOR_SCHEME_LABELS` (`Record<ColorScheme, string>`) и `swatch` для каждой схемы (цвет `--primary` для кружка в превью), типизированы через `Record`, поэтому схема без подписи не скомпилируется.
- `app/layout.tsx`: `<html suppressHydrationWarning>` и инлайн `<script>` с `THEME_INIT_SCRIPT` в `<head>` (перед реализацией прочитать гайд в `node_modules/next/dist/docs/01-app` про скрипты в root layout). Работает и на `/login`, где пользователя нет — берётся кэш устройства.

**entities/settings**
- `model/store.ts`: `useSettingsStore { settings, status, error, load(), update(patch), replace(), reset() }`. `update` — оптимистично с откатом при ошибке. `registerStoreReset` + `latestRequestId` (данные пользователя; см. «Session-scoped stores» в CLAUDE.md).
- `index.ts` экспортирует стор и селекторы.

**entities/currency** — стор остаётся (persist, `skipHydration`), но теперь это кэш серверной настройки. Комментарий «device preference» заменить.

**entities/weather** — `refresh(position?: Coordinates)`: если позиция передана, геолокация браузера не запрашивается.

**features/settings/** (группа без общего barrel, как `features/category/*`)
- `sync/` — `SettingsSync` (монтируется в `app/(app)/layout.tsx` рядом с `DisplayCurrencySync`): загружает настройки после входа. При изменении `theme`/`colorScheme` вызывает `applyTheme` + `cacheTheme`, при изменении `currency` — `useCurrencyStore.setCurrency`.
- `theme/` — выбор оформления в попапе с превью:
  - На карточке «Оформление» видно текущую схему (кружок + название) и режим, по кнопке «Изменить» открывается `ThemeDialog` (`Dialog`).
  - Вверху диалога переключатель режима: три кнопки-радио `Sun`/`Moon`/`Monitor`.
  - Ниже сетка `ThemePreviewCard` для всех 12 схем. Каждая карточка — обёртка `<div data-scheme={s} data-mode={resolvedMode}>` с мини-макетом приложения на настоящих токенах: фон, карточка с суммой, основная и второстепенная кнопки, muted-текст, рамка. Превью совпадает с тем, что будет в приложении, без отдельных макетов.
  - Выбранная карточка выделена `ring`. Карточки — радио-кнопки (`role="radio"`, `aria-checked`, стрелки/Enter).
  - Пока диалог открыт, выбранная схема сразу примеряется ко всему приложению (`applyTheme`). «Применить» сохраняет её (`update({ theme, colorScheme })`), «Отмена» или закрытие возвращают сохранённую.
  - Модель диалога — `model/use-theme-draft.ts`: черновик, примерка и откат.
- `currency/` — `DefaultCurrencySelect` (Select по `CURRENCIES`).
- `location/` — `LocationForm`: радио «Автоматически» / «Вручную»; в ручном режиме поле + кнопка «Найти» → список `Place` → выбор сохраняет `{ mode: 'manual', ... }`. Под списком атрибуция © OpenStreetMap.
- `reset/` — `ResetSettingsButton` + `AlertDialog` («Тема, валюта и местоположение вернутся к значениям по умолчанию. Пароль не изменится.»).
- Все изменения — `useSettingsStore.update(...)` с тостом об ошибке (`getErrorMessage`).

**features/auth/change-password** — `model/schema.ts` (Zod: `currentPassword`, `newPassword` 8–72, `confirmPassword`; refine: совпадение и новый ≠ текущий), `model/use-change-password.ts` (успех → `useSessionStore.getState().setTokens(tokens)`, тост, сброс формы; 400 → `setError('currentPassword')`), `ui/change-password-form.tsx` (RHF, по образцу `features/auth/register`).

**Существующие места**
- `features/currency/select/ui/currency-select.tsx`: выбор валюты вызывает `useSettingsStore.update({ currency })` (оптимистично, стор валюты обновит `SettingsSync`).
- `features/weather/current`: `WeatherWidget`/`use-weather-auto-refresh` читают `location` из `entities/settings`; `manual` → `refresh({ lat, lon })`, смена настройки → обновление. Без настроек (ещё грузятся) — ждём, как стор транзакций ждёт `currency`.
- `features/transaction/upsert/ui/transaction-form.tsx`: для новой транзакции `currency` по умолчанию из `useCurrencyStore` вместо `DEFAULT_CURRENCY`.

**widgets/settings-panel** — карточки «Оформление», «Валюта», «Местоположение», «Безопасность» (смена пароля), «Сброс»; состояния загрузки/ошибки настроек. `app/(app)/settings/page.tsx` — заменить заглушку на `<SettingsPanel />`, метаданные оставить.

## 5. Тесты

- **Unit API**: `tests/unit/api/modules/settings/settings.service.spec.ts` (нет строки → дефолты; PATCH сливает и заменяет `location` целиком; нормализация `auto`/округление; сброс), `sanitize-settings.spec.ts` (мусор в JSON → дефолты по ключам); `auth/auth.service.spec.ts` — `changePassword` (неверный текущий → 400, совпадающий → 400, успех: хэш, команда, `revokeAllForUser`, новые токены); `users` — handler смены пароля; `weather/weather.service.spec.ts` — кэш поиска, 503.
- **Integration**: `tests/integration/api/settings.spec.ts` (401 без токена; GET дефолты; PUT/PATCH валидация: неверные theme/currency, `manual` без координат, lat вне диапазона, лишние поля → 400; PATCH частично; DELETE → дефолты; каскад при удалении пользователя); `tenant-isolation.spec.ts` — настройки одного не видны другому; `auth.spec.ts` — смена пароля (старый refresh → 401, вход новым паролем, неверный текущий → 400); `weather.spec.ts` — `/weather/places`. `FakeGeocodingProvider` (`tests/setup/weather.ts`) получает `search`. Проверить, что `resetDatabase` (`tests/setup/prisma.ts`) чистит `user_settings`.
- **E2E**: `tests/e2e/api/settings.e2e-spec.ts` — регистрация → изменить настройки → перелогин видит их → сброс; смена пароля → вторая сессия не может обновить токен.
- **Unit web**: `entities/settings` store (оптимистичное обновление и откат, `latestRequestId`), `shared/lib/theme` (атрибуты `data-scheme`/`data-mode` и класс `.dark`, режим system и отписка), `ThemeDialog` (12 превью, у каждого свой `data-scheme`; выбор примеряется сразу, «Отмена» откатывает, «Применить» вызывает `update`), тест полноты `COLOR_SCHEME_LABELS`, `change-password` schema + hook, `LocationForm` (поиск только по сабмиту, выбор сохраняет), `ResetSettingsButton`, `SettingsSync`, `CurrencySelect` пишет в настройки.

## 6. Документация

`CLAUDE.md`: модель `UserSettings` в «Database Schema»; модуль `settings` и `POST /auth/change-password`, `GET /weather/places` в Backend; переписать абзацы «Display currency» (теперь серверная настройка, localStorage — кэш), «Weather widget» (ручной город больше не «planned»), добавить про тему (`shared/lib/theme.ts`, инлайн-скрипт). В конце плана — раздел «Итоги реализации».

## Проверка

1. `npm run build -w packages/types`; в `apps/api`: `npx prisma migrate dev --name user-settings`, `npx prisma generate`.
2. `npm run lint`, `npm run build` — должны пройти (требование задачи: собрать проект).
3. `npm test`; `npm run db:test:start && npm run test:integration && npm run test:e2e`.
4. Вручную (`npm run db:start`, `npm run dev`): на /settings открыть попап оформления. Превью показывают все 12 схем в текущем режиме, при смене режима превью переключаются. Выбор сразу примеряется, «Отмена» откатывает, «Применить» сохраняет. После перезагрузки нет мигания, в том числе на /login. Проверить контраст в обоих режимах на главной, в таблице, диалогах и тостах; сменить валюту — шапка и суммы обновились, в новой транзакции та же валюта; выбрать город вручную — погода в шапке для него; сменить пароль — войти новым, в другом браузере сессия отваливается после истечения access; «Сбросить» — всё вернулось к system/slate/RSD/auto.

## Итоги реализации

План выполнен. Ниже отличия от него и то, что выяснилось по ходу работы.

- **Смена пароля удаляет refresh-токены, а не отзывает их.** Это нашёл интеграционный тест. Ротация считает повторное использование отозванного токена кражей и отзывает всё семейство. Поэтому первое же обновление токена на другом устройстве разлогинивало и того, кто сменил пароль. Удалённый токен просто неизвестен и получает обычный 401 (`RefreshTokensRepository.deleteAllForUser`).
- **Токены схем взяты из реестра shadcn** (`ui.shadcn.com/r/colors/*.json`, `cssVars` — HSL для Tailwind v3; акцентные темы — `baseColors` в `apps/v4/registry/_legacy-base-colors.ts`). В реестре опечатка: у slate в тёмном режиме `--ring: 212.7 26.8% 83.9` без `%`. Её поймал тест `globals-css.spec.ts`, значение исправлено. Светлая slate совпала с прежним `:root` один в один.
- **Превью без отдельных макетов.** Каждая карточка в диалоге — это `div` с `data-scheme`/`data-mode`, и токены переопределяются только внутри него. Отдельной таблицы «цвет кружка» не понадобилось.
- **Без мигания темы** — по гайду Next «Preventing Flash»: инлайн-скрипт в `<head>`, `suppressHydrationWarning` на `<html>` и `ThemeHydration` с `useLayoutEffect`. В dev Strict Mode при повторном монтировании сбрасывает атрибуты `<html>`, и компонент их возвращает. Тест выполняет сам скрипт и сверяет результат с `applyTheme`.
- **Радио-группы на нативных `input type="radio"`** (`shared/ui/segmented-control.tsx` и карточки схем). Клавиатура и доступность работают без нового Radix-пакета: `@radix-ui/react-radio-group` не ставили, так как зависимости добавлять нельзя.
- **Погода ждёт настройки.** Пока они не загрузились, браузер не спрашивает позицию: у пользователя может быть выбран город. Если настройки не загрузились, погода берётся по позиции браузера. Запрос для другого места вытесняет запрос в полёте (`loadingTarget` в `entities/weather`).
- **Ограничения.** Два одновременных PATCH разных ключей: выигрывает последний (read-merge-write без блокировки). После смены пароля на других устройствах access-токен работает, пока не истечёт (~15 мин).
- **Наблюдение.** При сборке `packages/types` в `src/` снова появились `index.js`/`.d.ts`/`.js.map`. Их удалили и не коммитили.

### Проверка

- `npm run lint`, `npm run build`: проходят.
- `npm test`: 489 тестов, `npm run test:integration`: 250, `npm run test:e2e`: 38. Все проходят.
- Вручную в браузере не проверялось.

