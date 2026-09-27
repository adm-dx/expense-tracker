'use client';

import type { DailyForecast } from '@expense-tracker/types';
import { Droplets, RefreshCw } from 'lucide-react';
import { describeWeather, useWeatherStore } from '@/entities/weather';
import {
  formatTemperature,
  formatTime,
  formatWeekday,
} from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@/shared/ui';
import { useWeatherAutoRefresh } from '../model/use-weather-auto-refresh';

const attributionLinkClassName =
  'underline underline-offset-2 hover:text-foreground';

/**
 * One line for the header: condition icon, temperature and place. Opens the
 * details with the forecast and a refresh button. Renders nothing when the
 * user's position is unknown, so a denied permission leaves no trace.
 */
export function WeatherWidget() {
  const reload = useWeatherAutoRefresh();
  const weather = useWeatherStore((state) => state.weather);
  const status = useWeatherStore((state) => state.status);

  if (!weather) {
    return status === 'loading' ? (
      <div
        className="h-5 w-16 animate-pulse rounded-md bg-muted sm:w-40"
        aria-hidden="true"
        data-testid="weather-skeleton"
      />
    ) : null;
  }

  const { label, Icon } = describeWeather(weather.weatherCode, weather.isDay);
  const temperature = formatTemperature(weather.temperature);
  const summary = `Weather: ${label}, ${temperature}${
    weather.location ? ` in ${weather.location}` : ''
  }`;
  const loading = status === 'loading';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 gap-1.5 font-normal"
          aria-label={summary}
          title={summary}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium tabular-nums">{temperature}</span>
          {weather.location && (
            <span className="truncate text-muted-foreground max-sm:hidden sm:max-w-48">
              · {weather.location}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3"
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold leading-none tabular-nums">
              {temperature}
            </p>
            <p className="mt-1 text-sm font-medium">{label}</p>
            {weather.location && (
              <p className="truncate text-xs text-muted-foreground">
                {weather.location}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={reload}
            disabled={loading}
            aria-label="Refresh weather"
            title="Refresh weather"
          >
            <RefreshCw
              className={cn('size-4', loading && 'animate-spin')}
              aria-hidden="true"
            />
          </Button>
        </div>

        {weather.forecast.length > 0 && (
          <>
            <Separator />
            <ForecastList days={weather.forecast} />
          </>
        )}

        <Separator />
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {status === 'error' ? (
            <p role="alert" className="text-destructive">
              Couldn&apos;t refresh the weather. Try again later.
            </p>
          ) : (
            <p>Updated {formatTime(weather.observedAt)}</p>
          )}
          <p>
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noreferrer"
              className={attributionLinkClassName}
            >
              Weather by Open-Meteo
            </a>
          </p>
          <p>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className={attributionLinkClassName}
            >
              © OpenStreetMap contributors
            </a>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A row per day: weekday, condition, chance of precipitation, low and high. */
function ForecastList({ days }: { days: DailyForecast[] }) {
  return (
    <ul aria-label={`${days.length}-day forecast`} className="space-y-1">
      {days.map((day, index) => {
        // Daily codes describe the whole day, so the daytime icon fits.
        const { label, Icon } = describeWeather(day.weatherCode, true);
        const name = index === 0 ? 'Today' : formatWeekday(day.date);
        const low = formatTemperature(day.temperatureMin);
        const high = formatTemperature(day.temperatureMax);
        const chance = day.precipitationProbability;

        return (
          <li
            key={day.date}
            aria-label={`${name}: ${label}, ${low} to ${high}${
              chance !== null ? `, ${chance}% chance of precipitation` : ''
            }`}
            title={label}
            className="grid grid-cols-[3rem_1.25rem_1fr_auto] items-center gap-2 text-sm"
          >
            <span className="font-medium">{name}</span>
            <Icon className="size-4" aria-hidden="true" />
            <span
              className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums"
              aria-hidden="true"
            >
              {chance !== null && chance > 0 && (
                <>
                  <Droplets className="size-3" />
                  {chance}%
                </>
              )}
            </span>
            <span className="tabular-nums" aria-hidden="true">
              <span className="text-muted-foreground">{low}</span>
              <span className="mx-1 text-muted-foreground">/</span>
              {high}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
