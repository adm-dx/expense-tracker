import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WeatherReading } from '../contracts';
import { WeatherProvider } from './weather.provider';

export const DEFAULT_WEATHER_URL = 'https://api.open-meteo.com/v1';
const TIMEOUT_MS = 5000;

interface OpenMeteoResponse {
  current?: {
    time?: number;
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
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
      timeformat: 'unixtime',
    });
    const response = await fetch(`${this.baseUrl}/forecast?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Weather request failed: HTTP ${response.status}`);
    }
    const { current } = (await response.json()) as OpenMeteoResponse;
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
    };
  }
}
