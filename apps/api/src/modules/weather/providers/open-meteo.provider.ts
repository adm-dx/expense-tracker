import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DailyForecast } from '@expense-tracker/types';
import type { WeatherReading } from '../contracts';
import { WeatherProvider } from './weather.provider';

export const DEFAULT_WEATHER_URL = 'https://api.open-meteo.com/v1';
const TIMEOUT_MS = 5000;
/** Today and the next four days. */
export const FORECAST_DAYS = 5;

interface OpenMeteoResponse {
  /** Of the place's timezone (`timezone=auto`). */
  utc_offset_seconds?: number;
  current?: {
    time?: number;
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  /** Parallel arrays, one entry per day; a value the model lacks is null. */
  daily?: {
    time?: number[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

/**
 * Open-Meteo forecast API (https://open-meteo.com/en/docs): no key, free for
 * non-commercial use, CC BY 4.0, so the UI links back to it.
 */
@Injectable()
export class OpenMeteoProvider extends WeatherProvider {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    super();
    this.baseUrl =
      configService.get<string>('WEATHER_URL') ?? DEFAULT_WEATHER_URL;
  }

  async fetchCurrent(lat: number, lon: number): Promise<WeatherReading> {
    const query = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,weather_code,is_day',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: String(FORECAST_DAYS),
      // Days run midnight to midnight where the place is, not in UTC.
      timezone: 'auto',
      timeformat: 'unixtime',
    });
    const response = await fetch(`${this.baseUrl}/forecast?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Weather request failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as OpenMeteoResponse;
    const { current } = body;
    if (
      typeof current?.temperature_2m !== 'number' ||
      typeof current.weather_code !== 'number' ||
      typeof current.is_day !== 'number'
    ) {
      throw new Error('Weather response has no current conditions');
    }

    return {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      observedAt:
        typeof current.time === 'number'
          ? new Date(current.time * 1000)
          : new Date(),
      // The current conditions are worth showing without it.
      forecast: parseForecast(body),
    };
  }
}

/** The complete days of the forecast; a day missing a value is left out. */
function parseForecast({
  daily,
  utc_offset_seconds: offset = 0,
}: OpenMeteoResponse): DailyForecast[] {
  const forecast: DailyForecast[] = [];
  (daily?.time ?? []).forEach((time, i) => {
    const weatherCode = daily?.weather_code?.[i];
    const temperatureMax = daily?.temperature_2m_max?.[i];
    const temperatureMin = daily?.temperature_2m_min?.[i];
    const precipitationProbability = daily?.precipitation_probability_max?.[i];
    if (
      typeof time !== 'number' ||
      typeof weatherCode !== 'number' ||
      typeof temperatureMax !== 'number' ||
      typeof temperatureMin !== 'number'
    ) {
      return;
    }
    forecast.push({
      // `time` is local midnight; shifted by the offset it reads as that
      // calendar day in UTC.
      date: new Date((time + offset) * 1000).toISOString().slice(0, 10),
      weatherCode,
      temperatureMax,
      temperatureMin,
      precipitationProbability:
        typeof precipitationProbability === 'number'
          ? precipitationProbability
          : null,
    });
  });
  return forecast;
}
