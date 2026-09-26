# План: виджет погоды в хедере

> Файл плана: `.claude/plans/weather-widget.md`.
> Ветка: `feat/weather-widget` от свежего `main` (после мержа `feat/multi-currency`).
> Коммиты: `feat(types)`, `feat(api)`, `feat(web)`, `test`, `docs`.

## Context

В хедере (`widgets/app-header`) слева «Expense Tracker», справа валюта и профиль, середина пустая. Нужен компактный строчный виджет текущей погоды там, где находится пользователь: пиктограмма условий, температура, название места.

### Принятые решения

- **Погода идёт через наш API** (новый модуль `weather`, по образцу `exchange-rates`): провайдер за DI-токеном, кэш, тесты без сети. Позже тот же эндпоинт без координат возьмёт город из настроек пользователя.
- **Источники** (оба без ключа):
  - прогноз — **Open-Meteo** `GET https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code,is_day&timezone=auto` (CC BY 4.0, нужна атрибуция);
  - название места — **Nominatim (OpenStreetMap)** `GET https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=&lon=&zoom=10&accept-language=en` (у Open-Meteo нет обратного геокодинга; политика Nominatim: свой `User-Agent`, ≤ 1 запрос/с, кэширование — выполняем за счёт кэша на сутки; атрибуция «© OpenStreetMap contributors»).
- **Геолокация отклонена / недоступна / таймаут → виджет скрыт.** Фоллбэк на город из настроек — отдельная задача (см. «Вне скоупа»).
- **Координаты округляются до 2 знаков (~1 км) на клиенте** — приватность и попадания в кэш.
- **Обновление**: при входе на сайт (монтирование хедера) и раз в час; плюс при возвращении на вкладку, если данным больше часа (фоновые вкладки душат таймеры).
- Единицы — °C, температура округляется до целого. Интерпретация WMO-кода в иконку и подпись — на фронте.

Вне скоупа: город/страна в настройках и forward-геокодинг (Open-Meteo Geocoding API `geocoding-api.open-meteo.com/v1/search`), выбор °C/°F, прогноз на несколько дней.

## Чеклист

### 0. Подготовка

- [x] `git checkout main && git pull --ff-only && git checkout -b feat/weather-widget`

### 1. Общие типы — `packages/types/src/index.ts`

- [x] `WeatherParams { lat: number; lon: number }`
- [x] `CurrentWeather { temperature: number; weatherCode: number; isDay: boolean; location: string | null; observedAt: string }` (`location: null` — геокодинг не ответил, погоду всё равно показываем)

### 2. API — модуль `weather` (`apps/api/src/modules/weather/`, образец — `modules/exchange-rates`)

```
contracts/{queries/get-current-weather.query.ts, types.ts, index.ts}   // на будущее: другие модули (settings) через QueryBus
handlers/get-current-weather.handler.ts
providers/weather.provider.ts          // abstract class = DI-токен: fetchCurrent(lat, lon)
providers/open-meteo.provider.ts       // fetch + AbortSignal.timeout(5000), как open-er-api.provider.ts
providers/geocoding.provider.ts        // abstract class: reverse(lat, lon): Promise<string | null>
providers/nominatim.provider.ts        // User-Agent: 'expense-tracker/<version> (<contact>)'
dto/current-weather.query.ts           // class-validator
weather.service.ts
weather.controller.ts                  // GET /weather (под глобальным JwtAuthGuard)
weather.module.ts                      // + в app.module.ts
```

- [x] **DTO** `CurrentWeatherQuery`: `@Type(() => Number) @IsLatitude() lat`, `@IsLongitude() lon` (оба обязательны пока; станут `@IsOptional` вместе с настройками).
- [x] **`OpenMeteoProvider`**: `WEATHER_URL` через `ConfigService`, дефолт `https://api.open-meteo.com/v1`; проверка `response.ok` и наличия `current.temperature_2m`/`weather_code`/`is_day`, иначе ошибка; `observedAt` из `current.time` + `utc_offset_seconds`.
- [x] **`NominatimProvider`**: `GEOCODING_URL`, дефолт `https://nominatim.openstreetmap.org`; имя = `address.city ?? town ?? village ?? municipality ?? state`, плюс `address.country_code.toUpperCase()` → `"Belgrade, RS"`; любая ошибка → `null` (не валит погоду).
- [x] **`WeatherService.getCurrent(lat, lon)`**:
  - ключ кэша — координаты, округлённые до 2 знаков (повторно на сервере, не доверяя клиенту);
  - погода в памяти на **30 мин**, название места на **24 ч**, у каждого — ограничение размера (напр. 500 записей, вытеснение самой старой через `Map`);
  - параллельные запросы по одному ключу делят промис (как `inFlight` в `ExchangeRatesService`);
  - сбой провайдера погоды: есть запись моложе 3 ч → отдаём её (`Logger.warn`), иначе `ServiceUnavailableException('Weather is unavailable')`.
- [x] `.env.example`: `WEATHER_URL`, `GEOCODING_URL` с дефолтами.

### 3. Web — данные (`apps/web/src/`)

- [x] **`shared/api/weather-api.ts`**: `get(params) → httpClient.get<CurrentWeather>('/weather', …)` (как `exchange-rates-api.ts`).
- [x] **`shared/lib/geolocation.ts`**: `getApproximatePosition(): Promise<WeatherParams | null>` — обёртка над `navigator.geolocation.getCurrentPosition` с `enableHighAccuracy: false`, `maximumAge: 1 ч`, `timeout: 10 с`; отказ/ошибка/нет API → `null`; округление до 2 знаков. `watchGeolocationPermission(cb)` — через `navigator.permissions.query({ name: 'geolocation' })`, если доступно (при смене `denied → granted` виджет подгрузится без перезагрузки).
- [x] **`entities/weather/`**:
  - `model/store.ts` — `useWeatherStore`: `weather`, `status: 'idle' | 'locating' | 'loading' | 'success' | 'unavailable' | 'error'`, `updatedAt`, `refresh()` (геолокация → запрос; `null` → `unavailable`), паттерн `latestRequestId`, `registerStoreReset` (эндпоинт под авторизацией, данные сессионные). Ошибка при уже загруженных данных — оставляем старые.
  - `lib/weather-condition.ts` — `describeWeather(code, isDay) → { label, Icon }`: группы WMO-кодов → иконки `lucide-react` (`Sun`/`Moon`, `CloudSun`/`CloudMoon`, `Cloud`, `CloudFog`, `CloudDrizzle`, `CloudRain`, `CloudSnow`, `CloudLightning`), неизвестный код → `Cloud`, «Unknown».
  - `index.ts` — публичный API.

### 4. Web — фича и UI

- [x] **`features/weather/current/`**:
  - `model/use-weather-auto-refresh.ts` — `refresh()` при монтировании, `setInterval` 1 ч, `visibilitychange` → `refresh()` если `updatedAt` старше часа; подписка на смену разрешения геолокации; очистка в cleanup.
  - `ui/current-weather.tsx` — строка `[иконка] 18°C · Belgrade, RS` (`text-sm`, иконка `size-4`, место `text-muted-foreground`, `truncate max-w-[12rem]`). Кнопка-триггер `DropdownMenu` (как `CurrencySelect`): внутри — подпись условий («Partly cloudy»), «Updated 14:05», атрибуция-ссылки «Weather by Open-Meteo», «© OpenStreetMap contributors». `aria-label="Weather: Partly cloudy, 18°C in Belgrade"`.
  - Состояния: `locating`/`loading` без данных — скелетон той же ширины; `unavailable` или `error` без данных — `null` (виджет скрыт); ошибка обновления при имеющихся данных — показываем старые.
  - `index.ts` → `CurrentWeather`.
- [x] **`widgets/app-header/ui/app-header.tsx`**: сетка `grid grid-cols-[1fr_auto_1fr]` — логотип `justify-self-start`, `<CurrentWeather />` по центру, группа валюта+профиль `justify-self-end` (вместо `ml-auto`). На узком экране (`< sm`) название места скрывается (`hidden sm:inline`), остаются иконка и температура.

### 5. Тесты

- [x] **Unit (API)** `tests/unit/api/modules/weather/`:
  - `weather.service.spec.ts` — кэш 30 мин / 24 ч (fake timers), округление ключа, dedupe параллельных, stale fallback, 503 без кэша, геокодинг упал → `location: null`, лимит размера кэша;
  - `open-meteo.provider.spec.ts`, `nominatim.provider.spec.ts` — mock `global.fetch`: успех, не-2xx, битый ответ, таймаут, выбор city/town/village, `User-Agent`.
- [x] **Integration** — `tests/setup/weather.ts` (`FakeWeatherProvider`, `FakeGeocodingProvider`), подменить в `createTestApp` (`tests/setup/app.ts`) рядом с курсами; новый `tests/integration/api/weather.spec.ts`: 401 без токена; нет/невалидные `lat`/`lon` (`lat=91`, `lon=abc`) → 400; успех — данные фейка; провайдер падает при пустом кэше → 503.
- [x] **Unit (web)**:
  - `tests/unit/web/shared/lib/geolocation.spec.ts` — успех + округление, отказ, нет API, таймаут;
  - `tests/unit/web/entities/weather/store.spec.ts` и `weather-condition.spec.ts` — статусы, `unavailable`, поздний ответ после `reset`, маппинг кодов день/ночь;
  - `tests/unit/web/features/weather/current-weather.spec.tsx` — рендер иконки/температуры/места, скрыт при `unavailable`, обновление по таймеру и `visibilitychange` (fake timers).
- E2E не нужен: сценарий из одного эндпоинта.

### 6. Документация

- [x] `CLAUDE.md`: модуль `weather` в списке модулей, абзац «Weather» (источники, кэш, округление координат, фейки в `createTestApp`), `entities/weather` + `features/weather/current`, переменные `WEATHER_URL`/`GEOCODING_URL`.
- [x] Отметить выполненные пункты в `.claude/plans/weather-widget.md`.

## Отличия реализации от плана

- Компонент назван `WeatherWidget` (не `CurrentWeather` — конфликт имени с типом из `@expense-tracker/types`), файл `features/weather/current/ui/weather-widget.tsx`.
- Статусы `locating` и `loading` объединены в `loading`: для UI они неотличимы.
- `NominatimProvider` дополнительно ставит запросы в очередь не чаще раза в секунду (политика Nominatim), а неудачный геокодинг кэшируется на 30 мин (`LOCATION_RETRY_MS`), чтобы не повторять его на каждом запросе; ранее известное имя при сбое сохраняется.
- `lat=` (пустое) → 400: вместо `@Type(() => Number)` используется `@Transform`, иначе пустая строка превращалась в 0.
- На узком экране (`< sm`) скрывается и надпись «Expense Tracker» (остаётся иконка, как у сайдбара `max-md:sr-only`), иначе хедер не помещается в 375 px.
- Интеграционный тест дополнительно проверяет ответ без названия места при сбое геокодинга.

## Verification

1. `npm test`; `npm run db:test:start && npm run test:integration`.
2. `npm run lint`, `npm run build`.
3. curl с токеном: `GET /weather?lat=44.79&lon=20.45` → температура, код, `location: "Belgrade, RS"`; повторный вызов — без внешнего запроса (лог/дебаггер); `GET /weather?lat=91&lon=0` → 400; без токена → 401.
4. Браузер (`npm run dev`): при входе запрос разрешения; разрешить → в центре хедера иконка, `°C`, город; клик → условия, время обновления, атрибуция. Запретить → виджет не рендерится, остальной хедер на месте. DevTools → Sensors: сменить локацию, переключить вкладку через час (или уменьшить интервал локально) → данные обновились. Узкий экран — без названия места, без горизонтального скролла. Offline API погоды при холодном старте → виджет скрыт, остальные страницы работают.
