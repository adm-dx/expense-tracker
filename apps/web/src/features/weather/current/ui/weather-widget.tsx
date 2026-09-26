'use client';

import { describeWeather, useWeatherStore } from '@/entities/weather';
import { formatTemperature, formatTime } from '@/shared/lib/format';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';
import { useWeatherAutoRefresh } from '../model/use-weather-auto-refresh';

const attributionLinkClassName =
  'underline underline-offset-2 hover:text-foreground';

/**
 * One line for the header: condition icon, temperature and place. Renders
 * nothing when the user's position is unknown, so a denied permission
 * leaves no trace.
 */
export function WeatherWidget() {
  useWeatherAutoRefresh();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {temperature}
            {weather.location && ` · ${weather.location}`}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="space-y-0.5 text-xs font-normal text-muted-foreground">
          <p>Updated {formatTime(weather.observedAt)}</p>
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
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
